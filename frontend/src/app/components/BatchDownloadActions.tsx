"use client";

import { MAX_TAR_SELECTION } from "@/app/lib/constants";

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
  const selectedCount = selectedFileIds.size;
  const tooMany = selectedCount > MAX_TAR_SELECTION;
  const enabled = canDownload && selectedCount > 0 && !tooMany;

  const tarUrl =
    `/api/datasets/${encodeURIComponent(datasetId)}/download.tar` +
    `?fileIds=${Array.from(selectedFileIds).map(encodeURIComponent).join(",")}`;

  const reason = !canDownload
    ? "Upload your Crypt4GH public key on the profile page to enable downloads."
    : selectedCount === 0
      ? null // not really an error — don't nag the user
      : tooMany
        ? `Selection exceeds the ${MAX_TAR_SELECTION}-file cap.`
        : null;

  return (
    <div className="d-flex flex-column align-items-start gap-1">
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
          aria-describedby={reason ? "batch-tar-reason" : undefined}
        >
          Download selected as TAR
        </button>
      )}
      {reason && (
        <small
          id="batch-tar-reason"
          className={`text-${tooMany ? "warning" : "muted"}`}
        >
          {reason}
        </small>
      )}
    </div>
  );
}
