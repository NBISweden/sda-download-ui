import { describe, expect, it } from "vitest";
import type { DatasetFile } from "./datasets";
import {
  canExportChecksums,
  createChecksumFileContent,
  getChecksum,
} from "./checksums";

const files: DatasetFile[] = [
  {
    fileId: "file-1",
    filePath: "folder/file-1.cram",
    size: 100,
    decryptedSize: 90,
    checksums: [
      {
        type: "sha256",
        checksum: "sha256-checksum-file-1",
      },
      {
        type: "md5",
        checksum: "md5-checksum-file-1",
      },
    ],
    downloadUrl: "https://example.com/file-1",
  },
  {
    fileId: "file-2",
    filePath: "folder/file-2.cram",
    size: 200,
    decryptedSize: 180,
    checksums: [
      {
        type: "sha256",
        checksum: "sha256-checksum-file-2",
      },
    ],
    downloadUrl: "https://example.com/file-2",
  },
];

describe("getChecksum", () => {
  it("returns the checksum for the requested type", () => {
    expect(getChecksum(files[0], "sha256")).toBe("sha256-checksum-file-1");
  });

  it("matches checksum type case-insensitively", () => {
    expect(getChecksum(files[0], "SHA256")).toBe("sha256-checksum-file-1");
  });

  it("returns undefined when the checksum type does not exist", () => {
    expect(getChecksum(files[1], "md5")).toBeUndefined();
  });
});

describe("canExportChecksums", () => {
  it("returns true when all files have the requested checksum type", () => {
    expect(canExportChecksums(files, "sha256")).toBe(true);
  });

  it("returns false when at least one file is missing the requested checksum type", () => {
    expect(canExportChecksums(files, "md5")).toBe(false);
  });

  it("returns false when no files are provided", () => {
    expect(canExportChecksums([], "sha256")).toBe(false);
  });
});

describe("createChecksumFileContent", () => {
  it("creates checksum file content compatible with sha256sum and md5sum", () => {
    expect(createChecksumFileContent(files, "sha256")).toBe(
      [
        "sha256-checksum-file-1  folder/file-1.cram",
        "sha256-checksum-file-2  folder/file-2.cram",
        "",
      ].join("\n"),
    );
  });

  it("throws an error when a file is missing the requested checksum type", () => {
    expect(() => createChecksumFileContent(files, "md5")).toThrow(
      "Missing md5 checksum for file: folder/file-2.cram",
    );
  });
});
