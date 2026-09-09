import { createContext, useContext } from "react";
import { DownloadGuardWarning } from "./DownloadGuard";
import { DatasetFile } from "../actions/datasets";

export type DownloadableFile = Pick<DatasetFile, "fileId" | "filePath"> &
  Partial<Pick<DatasetFile, "size">>;

export type FSADownloadState = (
  | {
      currentDownload: {
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
        cancelDownload: () => void;
        downloadWarning: DownloadGuardWarning | null;
      };
    }
  | {
      startDownload: (files: DownloadableFile[]) => Promise<void>;
    }
) & {
  errorMessage: string | null;
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
