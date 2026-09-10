"use client";

import { useMemo } from "react";
import type { DatasetFile } from "@/app/actions/datasets";
import { TarBatchDownloadActions } from "@/app/components/TarBatchDownloadActions";
import { FileSystemAccessBatchDownloadActions } from "@/app/components/FileSystemAccessBatchDownloadActions";
import { useFileSystemAccessSupported } from "./FileSystemAccessBatchDownloadContext";

type BatchDownloadActionsProps = {
  files: Pick<DatasetFile, "fileId" | "filePath">[];
  selectedFileIds: Set<string>;
  datasetId: string;
  canDownload?: boolean;
};

export function BatchDownloadActions({
  files,
  selectedFileIds,
  datasetId,
  canDownload = true,
}: BatchDownloadActionsProps) {
  const supportsFileSystemAccess = useFileSystemAccessSupported();

  const selectedFiles = useMemo(() => {
    return files.filter((file) => selectedFileIds.has(file.fileId));
  }, [files, selectedFileIds]);

  if (supportsFileSystemAccess) {
    return (
      <FileSystemAccessBatchDownloadActions
        selectedFiles={selectedFiles}
        canDownload={canDownload}
      />
    );
  }

  return (
    <TarBatchDownloadActions
      selectedFileIds={selectedFileIds}
      datasetId={datasetId}
      canDownload={canDownload}
    />
  );
}
