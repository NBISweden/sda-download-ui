"use client";

import { filesize } from "filesize";
import prettyMilliseconds from "pretty-ms";
import { FileSystemDownloadProgress } from "./FileSystemAccessBatchDownloadContext";
import { ModalDialog } from "./ModalDialog";
import { useId } from "react";

type FileSystemDownloadProgressModalProps = {
  title?: string;
  description?: string;
  progress?: FileSystemDownloadProgress;
  onCancel: () => void;
  onHide: () => void;
};

export function FileSystemDownloadProgressModal({
  title = "Downloading selected files",
  // How to resume an interrupted download is explained by the warning shown when the
  // user is about to leave the page, see DownloadGuard.
  description = "Please keep this site open until the download has completed. Navigating to another site or closing the window interrupts the current download.",
  progress,
  onCancel,
  onHide,
}: FileSystemDownloadProgressModalProps) {
  const {
    selectedCount = 0,
    completedCount = 0,
    activeCount = 0,
    activeResumeCount = 0,
    resumedCount = 0,
    skippedCount = 0,
    restartedCount = 0,
    downloadedBytes = 0,
    estimatedTotalBytes = 0,
    estimatedDownloadSpeed = 0,
    estimatedProgressPercent = 0,
    warning,
  } = progress || {};

  const body = (
    <>
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
          Estimated total size: <strong>{filesize(estimatedTotalBytes)}</strong>
          .
        </div>

        <div>
          Estimated download speed:{" "}
          <strong>{filesize(estimatedDownloadSpeed * 1000)} / s</strong>.
        </div>

        <div className="mb-3">
          Estimated time remaining:{" "}
          <strong>
            {estimatedDownloadSpeed > 0
              ? prettyMilliseconds(
                  (estimatedTotalBytes - downloadedBytes) /
                    estimatedDownloadSpeed,
                  { secondsDecimalDigits: 0 },
                )
              : "-"}
          </strong>
          .
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
            {activeResumeCount === 1 ? "partial file" : "partial files"}.
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

      {warning && <p className="mt-3 pt-3 border-top mb-0">{warning.body}</p>}
    </>
  );
  const modalId = useId();
  return (
    <>
      <ModalDialog
        id={modalId}
        show={true}
        title={warning ? warning.title : title}
        body={body}
        buttons={[
          {
            label: "Cancel downloads",
            action: onCancel,
          },
        ]}
        closeButton={{
          label: "Hide downloads",
          action: onHide,
        }}
      />
    </>
  );
}
