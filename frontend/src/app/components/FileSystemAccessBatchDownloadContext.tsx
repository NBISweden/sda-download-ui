import { createContext, useContext } from "react";
import { DownloadGuardWarning } from "./DownloadGuard";
import { DatasetFile } from "../actions/datasets";

export type DownloadableFile = Pick<DatasetFile, "fileId" | "filePath"> &
  Partial<Pick<DatasetFile, "size">>;

export type FileSystemDownloadProgress = {
  selectedCount: number;
  completedCount: number;
  activeCount: number;
  activeResumeCount: number;
  resumedCount: number;
  skippedCount: number;
  restartedCount: number;
  downloadedBytes: number;
  estimatedTotalBytes: number;
  estimatedDownloadSpeed: number;
  estimatedProgressPercent: number;
  warning: DownloadGuardWarning | null;
};

export type FileSystemDownloadHandle = {
  cancelDownload: () => void;
  setIsHidden: (v: boolean) => void;
  isHidden: boolean;
  progress: FileSystemDownloadProgress;
};

export type FSADownloadState = (
  | {
      currentDownload: FileSystemDownloadHandle;
    }
  | {
      startDownload: (files: DownloadableFile[]) => Promise<void>;
    }
) & {
  error: { message: string } | null;
};

export const FSABatchDownloadContext = createContext<FSADownloadState | null>(
  null,
);

export function useFSABatchDownload(): FSADownloadState {
  const context = useContext(FSABatchDownloadContext);
  if (context === null) {
    throw new Error("Failed to get FSA Batch Download Context");
  }
  return context;
}
