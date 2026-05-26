"use client";

import { useMemo, useState } from "react";
import type { DatasetFile } from "../actions/datasets";
import {
  canExportChecksums,
  createChecksumFileContent,
  downloadTextFile,
} from "../actions/checksums";
import Alert from "@/app/components/Alert";

type ChecksumExportActionsProps = {
  files: DatasetFile[];
  selectedFileIds: Set<string>;
};

export function ChecksumExportActions({
  files,
  selectedFileIds,
}: ChecksumExportActionsProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const selectedFiles = useMemo(() => {
    return files.filter((file) => selectedFileIds.has(file.fileId));
  }, [files, selectedFileIds]);

  const canExportSha256 = canExportChecksums(selectedFiles, "sha256");

  function handleExportSha256() {
    setErrorMessage(null);

    const timestamp = new Date().toISOString().slice(0, 19);

    try {
      const content = createChecksumFileContent(selectedFiles, "sha256");
      downloadTextFile(content, `checksums.${timestamp}.sha256`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not export checksums.";

      setErrorMessage(message);
    }
  }

  return (
    <div className="d-flex flex-row-reverse align-items-center gap-2">
      {errorMessage && (
        <Alert
          type="danger"
          alertMessage={errorMessage}
          iconClass="bi bi-exclamation-circle"
        />
      )}

      <button
        type="button"
        className="btn btn-outline-primary"
        onClick={handleExportSha256}
        disabled={!canExportSha256}
      >
        Export SHA256 checksums
      </button>
    </div>
  );
}
