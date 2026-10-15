"use client";

import { useMemo, useState } from "react";
import type { DatasetFile } from "../actions/datasets";
import {
  canExportChecksums,
  createChecksumFileContent,
  downloadTextFile,
} from "../actions/checksums";
import Alert from "@/app/components/Alert";
import DropdownButton from "@/app/components/DropdownButton";

type ChecksumExportActionsProps = {
  files: DatasetFile[];
  selectedFileIds: Set<string>;
  datasetId: string;
};

export function ChecksumExportActions({
  files,
  selectedFileIds,
  datasetId,
}: ChecksumExportActionsProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const selectedFiles = useMemo(() => {
    return files.filter((file) => selectedFileIds.has(file.fileId));
  }, [files, selectedFileIds]);

  const canExportSha256 = canExportChecksums(selectedFiles, "sha256");
  const canExportMd5 = canExportChecksums(selectedFiles, "md5");

  function handleChecksumExport(checksumType: string) {
    setErrorMessage(null);

    try {
      const content = createChecksumFileContent(selectedFiles, checksumType);
      downloadTextFile(content, `${datasetId}-selected-files.${checksumType}`);
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
      <form autoComplete="off">
        <DropdownButton
          label="Export options"
          disabled={selectedFiles.length === 0}
          items={[
            {
              label: "Export SHA256 checksums",
              onClick: () => handleChecksumExport("sha256"),
              disabled: !canExportSha256,
            },
            {
              label: "Export md5 checksums",
              onClick: () => handleChecksumExport("md5"),
              disabled: !canExportMd5,
            },
          ]}
        />
      </form>
    </div>
  );
}
