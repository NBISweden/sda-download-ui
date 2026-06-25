import type { DatasetFile } from "../actions/datasets";

export function getChecksum(
  file: DatasetFile,
  checksumType: string,
): string | undefined {
  return file.checksums.find(
    (checksum) => checksum.type.toLowerCase() === checksumType.toLowerCase(),
  )?.checksum;
}

export function canExportChecksums(
  files: DatasetFile[],
  checksumType: string,
): boolean {
  return (
    files.length > 0 && files.every((file) => getChecksum(file, checksumType))
  );
}

export function createChecksumFileContent(
  files: DatasetFile[],
  checksumType: string,
): string {
  return (
    files
      .map((file) => {
        const checksum = getChecksum(file, checksumType);

        if (!checksum) {
          throw new Error(
            `Missing ${checksumType} checksum for file: ${file.filePath}`,
          );
        }
        // Decrypted filenames, i.e. same names but without .c4gh extension
        const fileExt = ".c4gh";
        const decryptedFilename = file.filePath.replace(fileExt, "");

        return `${checksum}  ${decryptedFilename}`;
      })
      .join("\n") + "\n"
  );
}

export function downloadTextFile(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  link.click();

  URL.revokeObjectURL(url);
}
