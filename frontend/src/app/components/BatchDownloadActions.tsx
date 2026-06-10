"use client";

type BatchDownloadActionsProps = {
  selectedFileIds: Set<string>;
  datasetId: string;
  canDownload?: boolean;
};

const MAX_TAR_SELECTION = 1000;

export function BatchDownloadActions({
  selectedFileIds,
  datasetId,
  canDownload = true,
}: BatchDownloadActionsProps) {
  const selectedCount = selectedFileIds.size;
  const tooMany = selectedCount > MAX_TAR_SELECTION;
  const enabled = canDownload && selectedCount > 0 && !tooMany;

  const tarUrl =
    `/api/datasets/${encodeURIComponent(datasetId)}/download.tar` +
    `?fileIds=${Array.from(selectedFileIds).map(encodeURIComponent).join(",")}`;

  const reason = !canDownload
    ? "Upload your Crypt4GH public key on the profile page to enable downloads."
    : selectedCount === 0
      ? "Select one or more files to enable TAR download."
      : tooMany
        ? `Too many files selected (${selectedCount}). The per-selection TAR is capped at ${MAX_TAR_SELECTION}; use “Download dataset” instead.`
        : "";

  return (
    <div className="d-flex align-items-center gap-2">
      {enabled ? (
        <a
          className="btn btn-outline-primary"
          href={tarUrl}
          download
          rel="noopener"
        >
          Download selected as TAR
        </a>
      ) : (
        <button
          type="button"
          className="btn btn-outline-primary"
          disabled
          title={reason}
        >
          Download selected as TAR
        </button>
      )}
    </div>
  );
}
