"use client";

import { DatasetFile } from "../actions/datasets";
import {
  canExportChecksums,
  createChecksumFileContent,
  downloadTextFile,
} from "../actions/checksums";

export function pickChecksumType(
  files: DatasetFile[],
): "sha256" | "md5" | null {
  if (canExportChecksums(files, "sha256")) return "sha256";
  if (canExportChecksums(files, "md5")) return "md5";
  return null;
}

type DownloadChecksumsButtonProps = {
  files: DatasetFile[];
  datasetId: string;
};

export default function DownloadChecksumsButton({
  files,
  datasetId,
}: DownloadChecksumsButtonProps) {
  let checksumType: "sha256" | "md5" | null = null;
  if (files && files.length > 0) {
    checksumType = pickChecksumType(files);
  }

  const handleDownload = () => {
    if (!checksumType) return;

    const content = createChecksumFileContent(files, checksumType);
    downloadTextFile(content, `${datasetId}_checksums.${checksumType}`);
  };

  if (!checksumType) return null;

  return (
    <button
      type="button"
      className="btn btn-primary align-self-start me-3"
      onClick={handleDownload}
      title={`Download ${checksumType} checksums`}
    >
      Download checksums
    </button>
  );
}
