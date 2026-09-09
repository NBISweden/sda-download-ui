"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import type { DatasetFile } from "@/app/actions/datasets";
import DropdownButton from "@/app/components/DropdownButton";
import { NoticeModal } from "./NoticeModal";
import { MAX_TAR_SELECTION } from "@/app/lib/constants";
import {
  canExportChecksums,
  createChecksumFileContent,
  downloadTextFile,
} from "@/app/actions/checksums";
import {
  useFileSystemAccessBatchDownload,
  FileSystemDownloadOverlays,
  useFileSystemAccessSupported,
} from "@/app/components/FileSystemAccessBatchDownloadActions";

const MISSING_KEY_REASON =
  "Upload your Crypt4GH public key on the profile page to enable file downloads.";

export function DownloadOptionsMenu({
  files,
  selectedFileIds,
  datasetId,
  canDownload = true,
}: {
  files: DatasetFile[];
  selectedFileIds: Set<string>;
  datasetId: string;
  canDownload?: boolean;
}) {
  const [notice, setNotice] = useState<{ message: string } | null>(null);

  const selectedFiles = useMemo(
    () => files.filter((file) => selectedFileIds.has(file.fileId)),
    [files, selectedFileIds],
  );

  const supportsFileSystemAccess = useFileSystemAccessSupported();
  const fsaDownload = useFileSystemAccessBatchDownload({
    selectedFiles,
    canDownload,
  });

  const selectedCount = selectedFiles.length;
  const tooManyForTar = selectedCount > MAX_TAR_SELECTION;

  const downloadItem = supportsFileSystemAccess
    ? {
        label: "Download selected files to folder",
        onClick: fsaDownload.startDownload,
        disabled:
          !canDownload || selectedCount === 0 || fsaDownload.isDownloading,
        disabledReason: !canDownload ? MISSING_KEY_REASON : undefined,
      }
    : {
        label: "Download selected as TAR",
        onClick: () => startTarDownload(datasetId, selectedFileIds),
        disabled: !canDownload || selectedCount === 0 || tooManyForTar,
        disabledReason: !canDownload
          ? MISSING_KEY_REASON
          : tooManyForTar
            ? `Selection exceeds the ${MAX_TAR_SELECTION}-file cap.`
            : undefined,
      };

  function handleChecksumExport(checksumType: string) {
    try {
      const content = createChecksumFileContent(selectedFiles, checksumType);
      downloadTextFile(content, `${datasetId}-selected-files.${checksumType}`);
    } catch (error) {
      setNotice({
        message:
          error instanceof Error
            ? error.message
            : "Could not export checksums.",
      });
    }
  }

  function startTarDownload(datasetId: string, selectedFileIds: Set<string>) {
    const link = document.createElement("a");
    link.href =
      `/api/datasets/${encodeURIComponent(datasetId)}/download.tar` +
      `?fileIds=${Array.from(selectedFileIds).map(encodeURIComponent).join(",")}`;
    link.download = "";
    link.click();
  }

  return (
    <>
      <DropdownButton
        label="Download options"
        items={[
          downloadItem,
          {
            label: "Export SHA256 checksums",
            onClick: () => handleChecksumExport("sha256"),
            disabled: !canExportChecksums(selectedFiles, "sha256"),
          },
          {
            label: "Export md5 checksums",
            onClick: () => handleChecksumExport("md5"),
            disabled: !canExportChecksums(selectedFiles, "md5"),
          },
        ]}
      />
      <NoticeModal
        id="checksum-export-notice-modal"
        notice={fsaDownload.error}
      />
      <FileSystemDownloadOverlays
        isDownloading={fsaDownload.isDownloading}
        error={fsaDownload.error}
        progress={fsaDownload.progress}
        onCancel={fsaDownload.cancelDownload}
      />
    </>
  );
}
