"use client";

import { useMemo, useSyncExternalStore } from "react";
import type { DatasetFile } from "@/app/actions/datasets";
import { TarBatchDownloadActions } from "@/app/components/TarBatchDownloadActions";
import { FileSystemAccessBatchDownloadActions } from "@/app/components/FileSystemAccessBatchDownloadActions";

type BatchDownloadActionsProps = {
  files: Pick<DatasetFile, "fileId" | "filePath">[];
  selectedFileIds: Set<string>;
  datasetId: string;
  canDownload?: boolean;
};

type WindowWithDirectoryPicker = Window & {
  showDirectoryPicker?: unknown;
};

function subscribe() {
  return function unsubscribe() {
    // No clean up needed.
  };
}

function getSnapshot() {
  return (
    typeof window !== "undefined" &&
    typeof (window as WindowWithDirectoryPicker).showDirectoryPicker ===
      "function"
  );
}

function getServerSnapshot() {
  return false;
}

function useFileSystemAccessSupported() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

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
