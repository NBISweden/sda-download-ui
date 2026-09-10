"use client";

import { DatasetFile } from "../actions/datasets";
import { useFileSystemAccessSupported } from "./FileSystemAccessBatchDownloadActions";
import { useFSABatchDownload } from "./FileSystemAccessBatchDownloadContext";

type FileSystemAccessDownloadButtonProps = {
  files: DatasetFile[];
  disabled: boolean;
  label: string;
};

export function FileSystemAccessDownloadButton({
  files,
  disabled,
  label,
}: FileSystemAccessDownloadButtonProps) {
  const downloadContext = useFSABatchDownload();
  const supportsFileSystemAccess = useFileSystemAccessSupported();
  const downloadAll =
    "startDownload" in downloadContext
      ? () => {
          downloadContext.startDownload(files);
        }
      : undefined;

  return supportsFileSystemAccess ? (
    <button
      type="button"
      className="btn btn-primary align-self-start me-3"
      onClick={downloadAll}
      title={label}
      disabled={disabled || !downloadAll}
    >
      {label}
    </button>
  ) : (
    <></>
  );
}
