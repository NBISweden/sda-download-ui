import { describe, it, expect } from "vitest";
import { pickChecksumType } from "./DownloadChecksumsButton";
import type { DatasetFile } from "../actions/datasets";

const makeFile = (
  overrides: Partial<DatasetFile> & { checksums: DatasetFile["checksums"] },
): DatasetFile => ({
  fileId: "file-id",
  filePath: "path/to/file.c4gh",
  size: 100,
  decryptedSize: 90,
  downloadUrl: "/files/file-id",
  ...overrides,
});

describe("pickChecksumType", () => {
  it("prefers sha256 when every file has both sha256 and md5", () => {
    const files = [
      makeFile({
        checksums: [
          { type: "sha256", checksum: "abc" },
          { type: "md5", checksum: "111" },
        ],
      }),
    ];
    expect(pickChecksumType(files)).toBe("sha256");
  });

  it("falls back to md5 when sha256 is missing from some file", () => {
    const files = [
      makeFile({
        checksums: [
          { type: "sha256", checksum: "abc" },
          { type: "md5", checksum: "111" },
        ],
      }),
      makeFile({
        checksums: [{ type: "md5", checksum: "222" }],
      }),
    ];
    expect(pickChecksumType(files)).toBe("md5");
  });

  it("returns null when neither sha256 nor md5 covers all files", () => {
    const files = [
      makeFile({ checksums: [{ type: "sha256", checksum: "abc" }] }),
      makeFile({ checksums: [{ type: "md5", checksum: "111" }] }),
    ];
    expect(pickChecksumType(files)).toBeNull();
  });
});
