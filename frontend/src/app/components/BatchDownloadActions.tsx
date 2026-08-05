"use client";

import { TarBatchDownloadActions } from "@/app/components/TarBatchDownloadActions";

type BatchDownloadActionsProps = {
  selectedFileIds: Set<string>;
  datasetId: string;
  canDownload?: boolean;
};

export function BatchDownloadActions({
  selectedFileIds,
  datasetId,
  canDownload = true,
}: BatchDownloadActionsProps) {
  return (
    <TarBatchDownloadActions
      selectedFileIds={selectedFileIds}
      datasetId={datasetId}
      canDownload={canDownload}
    />
  );
}
