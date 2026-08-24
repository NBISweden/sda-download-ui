"use client";

import { useRef, useState } from "react";
import type { DatasetFile } from "@/app/actions/datasets";
import {
  cloneDownloadMetadata,
  readDownloadMetadata,
  writeDownloadMetadata,
  type DownloadFileStatus,
  type DownloadMetadata,
} from "@/app/components/fileSystemDownloadMetadata";

// Controls the number of active concurrent downloads.
const FILE_SYSTEM_BATCH_CONCURRENCY = 2;

// Define a checkpoint interval for saving download progress.
// Every X bytes, save stream to disk so that in the event of a browser/tab crash, we
// need to re-download at most this many bytes upon resuming.
const FILE_SYSTEM_DOWNLOAD_CHECKPOINT_BYTES = 512 * 1024 * 1024;

// We need fileId for /api/files/:fileId and filePath to
// preserve the dataset folder structure.
type FileSystemAccessBatchDownloadActionsProps = {
  selectedFiles: Pick<DatasetFile, "fileId" | "filePath">[];
  canDownload: boolean;
};

type SaveMetadata = () => Promise<void>;


// For status reporting.
type DownloadFileResult = {
  resumed: boolean;
  skipped: boolean;
  restarted: boolean;
};

type DownloadFileCallbacks = {
  onResumeStart?: () => void;
};

export function FileSystemAccessBatchDownloadActions({
  selectedFiles,
  canDownload,
}: FileSystemAccessBatchDownloadActionsProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [completedCount, setCompletedCount] = useState(0);
  const [activeCount, setActiveCount] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  const selectedCount = selectedFiles.length;
  const enabled = canDownload && selectedCount > 0 && !isDownloading;

  async function startDownload() {
    if (!enabled) return;

    // Check that the browser supports the File System Access API.
    // Here we check for the existence of `showDirectoryPicker` in the window object and ensure it's a function.
    // Checking if `window` contains `showDirectoryPicker` before asserting its type is a workaround to the fact that
    // our current TypeScript version does not include this File System Access API method in its type definitions.
    if (
      !("showDirectoryPicker" in window) ||
      typeof window.showDirectoryPicker !== "function"
    ) {
      setErrorMessage("Folder downloads are not supported in this browser.");
      return;
    }

    setErrorMessage(null);
    setCompletedCount(0);
    setActiveCount(0);
    setIsDownloading(true);

    // An AbortController instance is shared by all active and future downloads in the
    // batch so that calling abort() cancels active fetches and prevents new workers
    // from starting more files.
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const directoryHandle = (await window.showDirectoryPicker({
        mode: "readwrite",
      })) as FileSystemDirectoryHandle;

      const metadata = await readDownloadMetadata(directoryHandle);

      // Metadata writes are serialized to avoid concurrent workers overwriting
      // each other's updates.
      // Note: may create a bottleneck, needs to be checked.
      let metadataWriteQueue: Promise<void> = Promise.resolve();

      const saveMetadata: SaveMetadata = () => {
        const snapshot = cloneDownloadMetadata(metadata);

        metadataWriteQueue = metadataWriteQueue.then(() =>
          writeDownloadMetadata(directoryHandle, snapshot),
        );

        return metadataWriteQueue;
      };

      await runWithConcurrency(
        selectedFiles,
        FILE_SYSTEM_BATCH_CONCURRENCY,
        abortController.signal,
        async (file) => {
          setActiveCount((count) => count + 1);

          try {
            await downloadFileToDirectory(
              file,
              directoryHandle,
              abortController.signal,
              metadata,
              saveMetadata,
            );

            setCompletedCount((count) => count + 1);
          } catch (error) {
            // A later PR could instead collect per-file failures and continue so that we can resume the download.
            abortController.abort();
            throw error;
          } finally {
            // Avoid negative counts in case of race condition situations.
            setActiveCount((count) => Math.max(count - 1, 0));
          }
        },
      );
    } catch (error) {
      if ((error as { name?: string }).name === "AbortError") {
        setErrorMessage("Download cancelled.");
      } else {
        const message =
          error instanceof Error ? error.message : "Download failed.";
        setErrorMessage(message);
      }
    } finally {
      setIsDownloading(false);
      abortControllerRef.current = null;
    }
  }

  function cancelDownload() {
    abortControllerRef.current?.abort();
  }

  const reason = !canDownload
    ? "Upload your Crypt4GH public key on the profile page to enable downloads."
    : selectedCount === 0
      ? null
      : null;

  return (
    <div className="d-flex flex-column align-items-start gap-1">
      <div className="d-flex gap-2">
        <button
          type="button"
          className="btn btn-outline-primary"
          onClick={startDownload}
          disabled={!enabled}
          aria-describedby={reason ? "batch-folder-download-reason" : undefined}
        >
          {isDownloading
            ? "Downloading selected files..."
            : "Download selected files to folder"}
        </button>

        {isDownloading && (
          <button
            type="button"
            className="btn btn-outline-danger"
            onClick={cancelDownload}
          >
            Cancel
          </button>
        )}
      </div>

      {reason && (
        <small id="batch-folder-download-reason" className="text-muted">
          {reason}
        </small>
      )}

      {isDownloading && (
        <small className="text-muted">
          Completed <strong>{completedCount}</strong> of{" "}
          <strong>{selectedCount}</strong>. Active downloads:{" "}
          <strong>{activeCount}</strong>.
        </small>
      )}

      {errorMessage && <small className="text-danger">{errorMessage}</small>}
    </div>
  );
}

// Start concurrent workers to download files in parallel. All workers share the same AbortSignal
// so that a single failure cancels the entire batch.
async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  signal: AbortSignal,
  worker: (item: T, index: number) => Promise<void>,
) {
  let nextIndex = 0;

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      while (!signal.aborted) {
        const index = nextIndex++;

        if (index >= items.length) {
          return;
        }

        await worker(items[index], index);
      }
    },
  );

  await Promise.all(workers);
}

// Download one dataset file and write it into the selected folder. This reuses the
// existing single-file proxy endpoint: /api/files/:fileId?name=:filePath.
async function downloadFileToDirectory(
  file: Pick<DatasetFile, "fileId" | "filePath">,
  rootDirectoryHandle: FileSystemDirectoryHandle,
  signal: AbortSignal,
  metadata: DownloadMetadata,
  saveMetadata: SaveMetadata,
  callbacks: DownloadFileCallbacks = {},
): Promise<DownloadFileResult> {
  const url =
    `/api/files/${encodeURIComponent(file.fileId)}` +
    `?name=${encodeURIComponent(file.filePath)}`;

  const fileHandle = await getFileHandleForDatasetPath(
    rootDirectoryHandle,
    file.filePath,
  );

  // Read the existing file size to determine if we can resume a partial download or if we need to restart from scratch.
  const existingFile = await fileHandle.getFile();
  const existingSize = existingFile.size;

  // Check if metadata matches the existing file so to avoid any upstream mismatch.
  const existingMetadata = metadata.files[file.fileId];
  const matchingMetadata =
    existingMetadata?.filePath === file.filePath ? existingMetadata : undefined;

  // Skip the download if the existing file is already complete and matches the expected size.
  if (
    matchingMetadata?.status === "complete" &&
    typeof matchingMetadata.totalBytes === "number" &&
    existingSize === matchingMetadata.totalBytes
  ) {
    return {
      resumed: false,
      skipped: true,
      restarted: false,
    };
  }

  // Detect if local files are unsafe to resume.
  if (
    matchingMetadata &&
    typeof matchingMetadata.totalBytes === "number" &&
    existingSize > matchingMetadata.totalBytes
  ) {
    throw new Error(
      `Existing local file is larger than expected for ${file.filePath}. Delete or move the local file before retrying.`,
    );
  }

  // A mismatching etag implies a changed c4gh pub key, unsafe to resume.
  if (existingSize > 0 && !matchingMetadata?.etag) {
    throw new Error(
      `Existing local file ${file.filePath} cannot be safely resumed because download metadata is missing. Delete or move the local file before retrying.`,
    );
  }

  // Append resume headers if all looks ok this far. The server will respond with 206 Partial Content
  // if the resume is valid, or 416 Range Not Satisfiable if not.
  const headers = new Headers();
  let attemptedResume = false;

  if (existingSize > 0 && matchingMetadata?.etag) {
    headers.set("Range", `bytes=${existingSize}-`);
    headers.set("If-Range", matchingMetadata.etag);
    attemptedResume = true;
  }

  let response = await fetch(url, {
    credentials: "same-origin",
    headers,
    signal,
  });

  // If the server returns 416 (Range Not Satisfiable) but the local file size matches the expected totalBytes,
  if (
    response.status === 416 &&
    matchingMetadata &&
    typeof matchingMetadata.totalBytes === "number" &&
    existingSize === matchingMetadata.totalBytes
  ) {
    updateDownloadFileMetadata(metadata, file, {
      etag: matchingMetadata.etag,
      totalBytes: matchingMetadata.totalBytes,
      status: "complete",
    });

    await saveMetadata();

    return {
      resumed: false,
      skipped: true,
      restarted: false,
    };
  }

  let restarted = false;

  // If the local partial file is inconsistent with the server's/backend's view, restart
  // from byte zero.
  if (response.status === 416) {
    restarted = attemptedResume;
    response = await fetch(url, {
      credentials: "same-origin",
      signal,
    });

    attemptedResume = false;
  }

  if (!response.ok) {
    let message = `Failed to download ${file.filePath}: ${response.status}`;

    try {
      const body = await response.json();

      if (typeof body?.error === "string") {
        message = body.error;
      }
    } catch {}

    throw new Error(message);
  }

  // The individual-file endpoint should return application/octet-stream for successful
  // file downloads, so reject anything else. This helps avoid cases where e.g. the session has
  // expired and the server returns an HTML login page instead of the file.
  const contentType = response.headers.get("content-type") || "";

  if (!contentType.includes("application/octet-stream")) {
    throw new Error(
      `Unexpected response while downloading ${file.filePath}. Your session may have expired.`,
    );
  }

  if (!response.body) {
    throw new Error(`No response body for ${file.filePath}.`);
  }

  // Decide whether to resume or restart the download based on the response status and existing metadata.

  const responseEtag = response.headers.get("etag");

  // Do not reuse old eTag if the server returned 200 OK, as it indicates that the content has changed and the download should be restarted from scratch.
  const etag =
    response.status === 206
      ? responseEtag || matchingMetadata?.etag
      : responseEtag || undefined;

  let writeOffset = 0;
  let keepExistingData = false;
  let totalBytes: number;
  let resumed = false;

  const saveFileMetadata = async (status: DownloadFileStatus) => {
    updateDownloadFileMetadata(metadata, file, {
      etag: etag || undefined,
      totalBytes,
      status,
    });

    await saveMetadata();
  };

  if (response.status === 206) {
    const contentRange = response.headers.get("content-range");
    const parsedContentRange = parseContentRange(contentRange);

    if (!parsedContentRange) {
      throw new Error(
        `Could not resume ${file.filePath}: missing or invalid Content-Range header.`,
      );
    }

    if (parsedContentRange.start !== existingSize) {
      throw new Error(
        `Could not resume ${file.filePath}: resume offset mismatch.`,
      );
    }

    writeOffset = existingSize;
    keepExistingData = true;
    totalBytes = parsedContentRange.total;
    resumed = existingSize > 0;
    if (resumed) {
      callbacks.onResumeStart?.();
    }
  } else if (response.status === 200) {
    totalBytes = parseContentLength(response, file.filePath);

    // If attemptedResume was true and the server returned 200, the stored ETag
    // did not match anymore. This covers changed content and changed c4gh public key.
    // We intentionally restart from byte zero instead of appending.
    if (attemptedResume) {
      restarted = true;
      writeOffset = 0;
      keepExistingData = false;
    }
  } else {
    throw new Error(
      `Unexpected download response for ${file.filePath}: ${response.status}`,
    );
  }

  // Update local metadata file before resuming the download. This ensures that if the download is interrupted,
  // we can resume it later. The status is set to "partial" until the download completes successfully.
  if (keepExistingData) {
    await saveFileMetadata("partial");
  }

  // When keepExistingData is false, createWritable overwrites the
  // existing file. This is intentional for fresh downloads and stale resumes.
  // When keepExistingData is true, we seek to writeOffset and append.
  let writable = await fileHandle.createWritable({ keepExistingData });
  const reader = response.body.getReader();

  let nextWriteOffset = writeOffset;
  let bytesSinceCheckpoint = 0;

  // Every X bytes we close the file to commit bytes to disk and update metadata.
  // Subsequent writes reopen with keepExistingData: true and seek to the next offset.
  async function checkpointDownload() {
    await writable.close();
    await saveFileMetadata("partial");

    writable = await fileHandle.createWritable({
      keepExistingData: true,
    });

    await writable.seek(nextWriteOffset);
    bytesSinceCheckpoint = 0;
  }

  try {
    if (nextWriteOffset > 0) {
      await writable.seek(nextWriteOffset);
    }

    for (;;) {
      const { done, value } = await reader.read();

      if (done) break;

      if (!value || value.byteLength === 0) continue;

      const remainingBytes = totalBytes - nextWriteOffset;

      if (remainingBytes <= 0) {
        await reader.cancel();
        break;
      }

      // Avoid writing beyond the advertised total size even.
      const chunk =
        value.byteLength > remainingBytes
          ? value.subarray(0, remainingBytes)
          : value;

      await writable.write(chunk);

      nextWriteOffset += chunk.byteLength;
      bytesSinceCheckpoint += chunk.byteLength;

      if (bytesSinceCheckpoint >= FILE_SYSTEM_DOWNLOAD_CHECKPOINT_BYTES) {
        await checkpointDownload();
      }
    }

    await writable.close();
  } catch (error) {
    try {
      await reader.cancel();
    } catch {}

    // In case the user hits Cancel, we close the file handle and update the metadata to reflect the partial download.
    if (isAbortError(error)) {
      try {
        await writable.close();
        await saveFileMetadata("partial");
      } catch (closeError) {
        try {
          await writable.abort(closeError);
        } catch {}
      }
    } else {
      try {
        await writable.abort(error);
      } catch {}
    }

    throw error;
  }

  // Check the final file size and update local metadata.
  const finalFile = await fileHandle.getFile();

  if (finalFile.size !== totalBytes) {
    await saveFileMetadata("partial");

    throw new Error(
      `Downloaded size mismatch for ${file.filePath}: expected ${totalBytes}, got ${finalFile.size}.`,
    );
  }

  await saveFileMetadata("complete");

  return {
    resumed,
    skipped: false,
    restarted,
  };
}

// Resolve a dataset file path to a File System Access file handle.
// filePath = "folder/subfolder/sample.cram.c4gh" becomes:
// <chosen-folder>/folder/subfolder/sample.cram.c4gh
async function getFileHandleForDatasetPath(
  rootDirectoryHandle: FileSystemDirectoryHandle,
  filePath: string,
): Promise<FileSystemFileHandle> {
  const pathParts = filePath
    .split(/[\\/]+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => part !== "." && part !== "..")
    .map(sanitizePathSegment);

  const filename = pathParts.pop() || "download.c4gh";

  let currentDirectory = rootDirectoryHandle;

  for (const directoryName of pathParts) {
    currentDirectory = await currentDirectory.getDirectoryHandle(
      directoryName,
      {
        create: true,
      },
    );
  }

  return currentDirectory.getFileHandle(filename, {
    create: true,
  });
}

function parseContentLength(response: Response, filePath: string): number {
  const value = response.headers.get("content-length");
  const contentLength = value ? Number(value) : NaN;

  if (!Number.isFinite(contentLength) || contentLength < 0) {
    throw new Error(`Missing or invalid Content-Length for ${filePath}.`);
  }

  return contentLength;
}

function parseContentRange(
  value: string | null,
): { start: number; end: number; total: number } | null {
  if (!value) return null;

  const match = value.match(/^bytes (\d+)-(\d+)\/(\d+)$/);

  if (!match) return null;

  return {
    start: Number(match[1]),
    end: Number(match[2]),
    total: Number(match[3]),
  };
}

function sanitizePathSegment(segment: string): string {
  const sanitized = segment
    .replace(/[<>:"|?*\x00-\x1F]/g, "_")
    .replace(/^\.+$/, "_")
    .slice(0, 255);

  return sanitized || "_";
}

function updateDownloadFileMetadata(
  metadata: DownloadMetadata,
  file: Pick<DatasetFile, "fileId" | "filePath">,
  data: {
    etag?: string;
    totalBytes: number;
    status: DownloadFileStatus;
  },
) {
  metadata.files[file.fileId] = {
    fileId: file.fileId,
    filePath: file.filePath,
    etag: data.etag,
    totalBytes: data.totalBytes,
    status: data.status,
    updatedAt: Date.now(),
  };
}

function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === "AbortError") ||
    (error instanceof Error && error.name === "AbortError")
  );
}
