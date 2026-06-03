import { describe, it, expect } from "vitest";
import {
  pickChecksumType,
  buildChecksumFileContent,
} from "./DownloadChecksumsButton";
import type { DatasetFile } from "../actions/datasets";

// --- Test helpers ---------------------------------------------------------

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

// --- pickChecksumType ----------------------------------------------------

describe("pickChecksumType", () => {
  it("returns 'sha256' when both sha256 and md5 are present", () => {
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

  it("returns 'sha256' when only sha256 is present", () => {
    const files = [
      makeFile({ checksums: [{ type: "sha256", checksum: "abc" }] }),
    ];
    expect(pickChecksumType(files)).toBe("sha256");
  });

  it("returns 'md5' when only md5 is present", () => {
    const files = [makeFile({ checksums: [{ type: "md5", checksum: "111" }] })];
    expect(pickChecksumType(files)).toBe("md5");
  });

  it("prefers sha256 even when sha256 and md5 are split across files", () => {
    const files = [
      makeFile({ checksums: [{ type: "md5", checksum: "111" }] }),
      makeFile({ checksums: [{ type: "sha256", checksum: "abc" }] }),
    ];
    expect(pickChecksumType(files)).toBe("sha256");
  });

  it("returns null when no supported checksum types are present", () => {
    const files = [
      makeFile({
        checksums: [{ type: "crc32" as "sha256", checksum: "xyz" }],
      }),
    ];
    expect(pickChecksumType(files)).toBeNull();
  });

  it("returns null when files have no checksums", () => {
    const files = [makeFile({ checksums: [] })];
    expect(pickChecksumType(files)).toBeNull();
  });

  it("returns null for an empty files array", () => {
    expect(pickChecksumType([])).toBeNull();
  });
});

// --- buildChecksumFileContent --------------------------------------------

describe("buildChecksumFileContent", () => {
  it("formats lines as '<checksum>  <filepath>' with a trailing newline", () => {
    const files = [
      makeFile({
        filePath: "samples/file1.cram.c4gh",
        checksums: [{ type: "sha256", checksum: "abc123" }],
      }),
      makeFile({
        filePath: "samples/file2.cram.c4gh",
        checksums: [{ type: "sha256", checksum: "def456" }],
      }),
    ];

    expect(buildChecksumFileContent(files, "sha256")).toBe(
      "abc123  samples/file1.cram.c4gh\n" + "def456  samples/file2.cram.c4gh\n",
    );
  });

  it("uses exactly two spaces between checksum and filepath", () => {
    const files = [
      makeFile({
        filePath: "a.c4gh",
        checksums: [{ type: "sha256", checksum: "abc" }],
      }),
    ];

    expect(buildChecksumFileContent(files, "sha256")).toBe("abc  a.c4gh\n");
  });

  it("includes only checksums of the requested type", () => {
    const files = [
      makeFile({
        filePath: "file1.c4gh",
        checksums: [
          { type: "sha256", checksum: "sha-1" },
          { type: "md5", checksum: "md5-1" },
        ],
      }),
    ];

    const result = buildChecksumFileContent(files, "sha256");
    expect(result).toBe("sha-1  file1.c4gh\n");
    expect(result).not.toContain("md5-1");
  });

  it("skips files that don't have the requested checksum type", () => {
    const files = [
      makeFile({
        filePath: "file1.c4gh",
        checksums: [{ type: "sha256", checksum: "sha-1" }],
      }),
      makeFile({
        filePath: "file2.c4gh",
        checksums: [{ type: "md5", checksum: "md5-2" }],
      }),
    ];

    expect(buildChecksumFileContent(files, "sha256")).toBe(
      "sha-1  file1.c4gh\n",
    );
  });

  it("ends with exactly one trailing newline", () => {
    const files = [
      makeFile({
        filePath: "file1.c4gh",
        checksums: [{ type: "sha256", checksum: "abc" }],
      }),
    ];

    const result = buildChecksumFileContent(files, "sha256");
    expect(result.endsWith("\n")).toBe(true);
    expect(result.endsWith("\n\n")).toBe(false);
  });
});
