"use client";

import { DatasetFile } from "../actions/datasets";
import {
  useFileSystemAccessSupported,
  useFSABatchDownload,
} from "./FileSystemAccessBatchDownloadContext";

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
    supportsFileSystemAccess && "startDownload" in downloadContext
      ? () => {
          downloadContext.startDownload(files);
        }
      : null;

  return downloadAll ? (
    <button
      type="button"
      className="btn btn-primary align-self-start me-3"
      onClick={downloadAll}
      title={label}
      disabled={disabled}
    >
      {label}
    </button>
  ) : (
    <></>
  );
}
