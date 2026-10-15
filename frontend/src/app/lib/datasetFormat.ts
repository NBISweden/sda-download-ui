/**
 * Shared formatting helpers for dataset metadata so the card and table views
 * (and search filtering) stay in sync.
 */

export function formatDatasetDate(date: string): string {
  return new Date(date).toLocaleDateString("sv-SE");
}

export function formatFileCount(files: number): string {
  return `${files} ${files === 1 ? "file" : "files"}`;
}
