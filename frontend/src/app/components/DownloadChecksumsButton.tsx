"use client";

import { DatasetFile } from "../actions/datasets";

type DownloadChecksumsButtonProps = {
  files: DatasetFile[];
  datasetId: string;
};

export default function DownloadChecksumsButton({
  files,
  datasetId,
}: DownloadChecksumsButtonProps) {
  let availableTypes: string[] = [];
  if (files && files.length > 0) {
    availableTypes = [
      ...new Set(files.flatMap((f) => f.checksums.map((c) => c.type))),
    ];
  }

  let checksumType: string | null = null;
  if (availableTypes.includes("sha256")) {
    checksumType = "sha256";
  } else if (availableTypes.includes("md5")) {
    checksumType = "md5";
  } else {
    checksumType = null;
  }

  const handleDownload = () => {
    if (!checksumType) return;

    // Will create content in format "<checksum>  <filepath>" which is
    // compatible with sha256sum and md5sum CLI tools.
    const content =
      files
        .map((file) => {
          const match = file.checksums.find((c) => c.type === checksumType);
          return match ? `${match.checksum}  ${file.filePath}` : null;
        })
        .filter((line): line is string => line !== null)
        .join("\n") + "\n";

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
