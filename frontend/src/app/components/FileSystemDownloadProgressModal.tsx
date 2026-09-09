"use client";

import type { DownloadGuardWarning } from "@/app/components/DownloadGuard";

import { filesize } from "filesize";

type FileSystemDownloadProgressModalProps = {
  title?: string;
  description?: string;
  selectedCount: number;
  completedCount: number;
  activeCount: number;
  activeResumeCount?: number;
  resumedCount?: number;
  skippedCount?: number;
  restartedCount?: number;
  downloadedBytes?: number;
  estimatedTotalBytes?: number;
  onCancel: () => void;

  // Replaces the description and the cancel button with the question, keeping the
  // progress above it. See DownloadGuard.
  warning?: DownloadGuardWarning | null;
};

export function FileSystemDownloadProgressModal({
  title = "Downloading selected files",
  // How to resume an interrupted download is explained by the warning shown when the
  // user is about to leave the page, see DownloadGuard.
  description = "Please keep this page open until the download has completed. Navigating away interrupts the current download.",
  selectedCount,
  completedCount,
  activeCount,
  activeResumeCount = 0,
  resumedCount = 0,
  skippedCount = 0,
  restartedCount = 0,
  downloadedBytes = 0,
  estimatedTotalBytes = 0,
  onCancel,
  warning = null,
}: FileSystemDownloadProgressModalProps) {
  const estimatedProgressPercent =
    estimatedTotalBytes > 0
      ? Math.min(100, Math.round((downloadedBytes / estimatedTotalBytes) * 100))
      : 0;
  return (
    <>
      <div
        className="modal fade show d-block"
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="fsa-download-progress-title"
      >
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h2 className="modal-title fs-5" id="fsa-download-progress-title">
                {warning ? warning.title : title}
              </h2>
            </div>

            <div className="modal-body">
              {!warning && <p className="mb-3">{description}</p>}

              <div
                className="progress mb-3"
                role="progressbar"
                aria-valuenow={estimatedProgressPercent}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Estimated download progress"
              >
                <div
                  className="progress-bar"
                  style={{ width: `${estimatedProgressPercent}%` }}
                >
                  {estimatedProgressPercent}%
                </div>
              </div>

              <div className="small text-muted" aria-live="polite">
                <div>
                  Estimated total size:{" "}
                  <strong>{filesize(estimatedTotalBytes)}</strong>.
                </div>

                <div>
                  Completed <strong>{completedCount}</strong> of{" "}
                  <strong>{selectedCount}</strong>.
                </div>

                <div>
                  Active downloads: <strong>{activeCount}</strong>.
                </div>

                {activeResumeCount > 0 && (
                  <div className="text-info">
                    Resuming <strong>{activeResumeCount}</strong>{" "}
                    {activeResumeCount === 1 ? "partial file" : "partial files"}
                    .
                  </div>
                )}

                {resumedCount > 0 && (
                  <div>
                    Resumed <strong>{resumedCount}</strong>{" "}
                    {resumedCount === 1 ? "file" : "files"}.
                  </div>
                )}

                {skippedCount > 0 && (
                  <div>
                    Skipped <strong>{skippedCount}</strong> already-complete{" "}
                    {skippedCount === 1 ? "file" : "files"}.
                  </div>
                )}

                {restartedCount > 0 && (
                  <div className="text-warning">
                    Restarted <strong>{restartedCount}</strong>{" "}
                    {restartedCount === 1
                      ? "stale partial download"
                      : "stale partial downloads"}
                    .
                  </div>
                )}
              </div>

              {warning && (
                <p className="mt-3 pt-3 border-top mb-0">{warning.body}</p>
              )}
            </div>

            <div className="modal-footer">
              {warning ? (
                <>
                  <button
                    type="button"
                    className="btn btn-primary"
                    autoFocus
                    onClick={warning.onStay}
                  >
                    {warning.stayLabel}
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline-danger"
                    onClick={warning.onLeave}
                  >
                    {warning.leaveLabel}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="btn btn-outline-danger"
                  onClick={onCancel}
                >
                  Cancel downloads
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="modal-backdrop fade show"></div>
    </>
  );
}
