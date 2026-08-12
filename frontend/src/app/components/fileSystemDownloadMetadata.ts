// Helper module for reading and writing download metadata to the file system using the File System Access API.

export const DOWNLOAD_METADATA_FILENAME = ".download-metadata";

const DOWNLOAD_METADATA_VERSION = 1;

export type DownloadFileStatus = "partial" | "complete";

export type DownloadFileMetadata = {
  fileId: string;
  filePath: string;
  etag?: string;
  totalBytes?: number;
  status: DownloadFileStatus;
  updatedAt: number;
};

export type DownloadMetadata = {
  version: typeof DOWNLOAD_METADATA_VERSION;
  files: Record<string, DownloadFileMetadata>;
};

export async function readDownloadMetadata(
  rootDirectoryHandle: FileSystemDirectoryHandle,
): Promise<DownloadMetadata> {
  const metadataFileHandle =
    await getDownloadMetadataFileHandle(rootDirectoryHandle);

  const metadataFile = await metadataFileHandle.getFile();

  if (metadataFile.size === 0) {
    return createEmptyDownloadMetadata();
  }

  try {
    const metadataText = await metadataFile.text();
    const parsedMetadata = JSON.parse(
      metadataText,
    ) as Partial<DownloadMetadata>;

    if (
      parsedMetadata.version !== DOWNLOAD_METADATA_VERSION ||
      typeof parsedMetadata.files !== "object" ||
      parsedMetadata.files === null
    ) {
      throw new Error("Invalid metadata schema.");
    }

    return {
      version: DOWNLOAD_METADATA_VERSION,
      files: parsedMetadata.files as Record<string, DownloadFileMetadata>,
    };
  } catch {
    throw new Error(
      `Could not read download metadata file ${DOWNLOAD_METADATA_FILENAME}.`,
    );
  }
}

export async function writeDownloadMetadata(
  rootDirectoryHandle: FileSystemDirectoryHandle,
  metadata: DownloadMetadata,
) {
  const metadataFileHandle =
    await getDownloadMetadataFileHandle(rootDirectoryHandle);

  const writable = await metadataFileHandle.createWritable();

  try {
    await writable.write(JSON.stringify(metadata, null, 2));
    await writable.close();
  } catch (error) {
    try {
      await writable.abort(error);
    } catch {}

    throw error;
  }
}

export function cloneDownloadMetadata(
  metadata: DownloadMetadata,
): DownloadMetadata {
  return {
    version: metadata.version,
    files: Object.fromEntries(
      Object.entries(metadata.files).map(([fileId, fileMetadata]) => [
        fileId,
        { ...fileMetadata },
      ]),
    ),
  };
}

function createEmptyDownloadMetadata(): DownloadMetadata {
  return {
    version: DOWNLOAD_METADATA_VERSION,
    files: {},
  };
}

async function getDownloadMetadataFileHandle(
  rootDirectoryHandle: FileSystemDirectoryHandle,
): Promise<FileSystemFileHandle> {
  return rootDirectoryHandle.getFileHandle(DOWNLOAD_METADATA_FILENAME, {
    create: true,
  });
}
