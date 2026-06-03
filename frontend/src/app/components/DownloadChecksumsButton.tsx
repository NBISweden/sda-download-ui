"use client";

import { DatasetFile } from "../actions/datasets";

export function pickChecksumType(
  files: DatasetFile[],
): "sha256" | "md5" | null {
  const types = new Set(files.flatMap((f) => f.checksums.map((c) => c.type)));
  if (types.has("sha256")) return "sha256";
  if (types.has("md5")) return "md5";
  return null;
}

// Will create content in format "<checksum>  <filepath>" which is
// compatible with sha256sum and md5sum CLI tools.
export function buildChecksumFileContent(
  files: DatasetFile[],
  type: "sha256" | "md5",
): string {
  return (
    files
      .map((file) => {
        const match = file.checksums.find((c) => c.type === type);
        return match ? `${match.checksum}  ${file.filePath}` : null;
      })
      .filter((line): line is string => line !== null)
      .join("\n") + "\n"
  );
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

    const content = buildChecksumFileContent(files, checksumType);
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `${datasetId}_checksums.${checksumType}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <>
      {!checksumType ? (
        <></>
      ) : (
        <button
          type="button"
          className="btn btn-primary align-self-start"
          onClick={handleDownload}
          title={`Download ${checksumType} checksums`}
        >
          Download checksums
        </button>
      )}
    </>
  );
}
