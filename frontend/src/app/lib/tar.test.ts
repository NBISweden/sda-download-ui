import { describe, expect, test } from "vitest";
import { planEntry, TAR_BLOCK_SIZE } from "./tar";

const ENCODER = new TextEncoder();
const DECODER = new TextDecoder();

// Read a TAR octal field, stopping at the first NUL or space terminator.
function readOctal(buf: Uint8Array, offset: number, len: number): number {
  let end = offset + len;
  for (let i = offset; i < offset + len; i++) {
    if (buf[i] === 0 || buf[i] === 0x20) {
      end = i;
      break;
    }
  }
  return parseInt(DECODER.decode(buf.subarray(offset, end)) || "0", 8);
}

describe("planEntry", () => {
  test("short path, no PAX, layout adds up", () => {
    const p = planEntry("hello.txt", 14, 0);
    expect(p.paxBlock).toBeNull();
    expect(p.ustarBlock.byteLength).toBe(TAR_BLOCK_SIZE);
    expect(p.paddingLen).toBe(TAR_BLOCK_SIZE - 14);
    expect(p.entryLen).toBe(TAR_BLOCK_SIZE + 14 + (TAR_BLOCK_SIZE - 14));
  });

  test("size exactly one block: zero padding", () => {
    const p = planEntry("a.bin", TAR_BLOCK_SIZE, 0);
    expect(p.paddingLen).toBe(0);
    expect(p.entryLen).toBe(2 * TAR_BLOCK_SIZE);
  });

  test("USTAR name field, magic, version", () => {
    const path = "dir/sub/file.bin";
    const p = planEntry(path, 1, 0);
    // Decode a window wider than the path so we can also see the trailing NUL.
    const nameWindow = DECODER.decode(p.ustarBlock.subarray(0, path.length + 1));
    expect(nameWindow.startsWith(`${path}\0`)).toBe(true);
    expect(DECODER.decode(p.ustarBlock.subarray(257, 263))).toBe("ustar\0");
    expect(p.ustarBlock[263]).toBe(0x30);
    expect(p.ustarBlock[264]).toBe(0x30);
  });

  test("USTAR numeric fields", () => {
    const p = planEntry("f.txt", 1234, 1700000000);
    expect(readOctal(p.ustarBlock, 100, 8)).toBe(0o644);
    expect(readOctal(p.ustarBlock, 108, 8)).toBe(0);
    expect(readOctal(p.ustarBlock, 116, 8)).toBe(0);
    expect(readOctal(p.ustarBlock, 124, 12)).toBe(1234);
    expect(readOctal(p.ustarBlock, 136, 12)).toBe(1700000000);
  });

  test("USTAR checksum matches the POSIX rule", () => {
    const p = planEntry("a.txt", 5, 1000);
    let expected = 0;
    for (let i = 0; i < TAR_BLOCK_SIZE; i++) {
      expected += i >= 148 && i < 156 ? 0x20 : p.ustarBlock[i];
    }
    const stored = parseInt(
      DECODER.decode(p.ustarBlock.subarray(148, 154)),
      8,
    );
    expect(stored).toBe(expected);
    expect(p.ustarBlock[154]).toBe(0);
    expect(p.ustarBlock[155]).toBe(0x20);
  });

  test("long path emits a PAX path= record", () => {
    const long = "a/".repeat(60) + "file.bin";
    const p = planEntry(long, 10, 0);
    expect(p.paxBlock).not.toBeNull();
    expect(p.paxBlock!.byteLength % TAR_BLOCK_SIZE).toBe(0);
    expect(String.fromCharCode(p.paxBlock![156])).toBe("x");
    const body = DECODER.decode(p.paxBlock!.subarray(TAR_BLOCK_SIZE));
    expect(body).toContain(`path=${long}`);
    const m = body.match(/^(\d+) path=/);
    expect(m).not.toBeNull();
    const len = parseInt(m![1], 10);
    expect(body.slice(0, len).endsWith("\n")).toBe(true);
  });

  test("size beyond USTAR limit emits PAX size= and zeros the ustar size", () => {
    const big = 8 ** 11;
    const p = planEntry("big.bin", big, 0);
    expect(p.paxBlock).not.toBeNull();
    const body = DECODER.decode(p.paxBlock!.subarray(TAR_BLOCK_SIZE));
    expect(body).toContain(`size=${big}`);
    expect(readOctal(p.ustarBlock, 124, 12)).toBe(0);
  });

  test("deterministic: same inputs → same bytes", () => {
    const a = planEntry("dir/file.bin", 1234, 555);
    const b = planEntry("dir/file.bin", 1234, 555);
    expect(a.ustarBlock).toEqual(b.ustarBlock);
    expect(a.entryLen).toBe(b.entryLen);
  });

  // ---------------------------------------------------------------------------
  // Boundary, edge, and regression tests
  // ---------------------------------------------------------------------------

  test("path of exactly 100 bytes stays in USTAR (no PAX); 101 triggers PAX", () => {
    const at = planEntry("a".repeat(100), 1, 0);
    expect(at.paxBlock).toBeNull();
    // The full 100-byte path fills the name field, no trailing NUL.
    expect(DECODER.decode(at.ustarBlock.subarray(0, 100))).toBe("a".repeat(100));

    const over = planEntry("a".repeat(101), 1, 0);
    expect(over.paxBlock).not.toBeNull();
  });

  test("size at MAX_USTAR_SIZE stays in USTAR; MAX_USTAR_SIZE + 1 triggers PAX size=", () => {
    const MAX_USTAR_SIZE = 8 ** 11 - 1;
    const at = planEntry("f", MAX_USTAR_SIZE, 0);
    expect(at.paxBlock).toBeNull();
    expect(readOctal(at.ustarBlock, 124, 12)).toBe(MAX_USTAR_SIZE);

    const over = planEntry("f", MAX_USTAR_SIZE + 1, 0);
    expect(over.paxBlock).not.toBeNull();
    expect(readOctal(over.ustarBlock, 124, 12)).toBe(0);
  });

  test("entryLen with PAX = paxBlock + ustar + payload + padding", () => {
    const path = "a/".repeat(60) + "file.bin";
    const p = planEntry(path, 1000, 0);
    expect(p.paxBlock).not.toBeNull();
    expect(p.entryLen).toBe(
      p.paxBlock!.length + TAR_BLOCK_SIZE + 1000 + p.paddingLen,
    );
  });

  test("empty file: zero padding, single-block entry", () => {
    const p = planEntry("empty.txt", 0, 0);
    expect(p.paxBlock).toBeNull();
    expect(p.paddingLen).toBe(0);
    expect(p.entryLen).toBe(TAR_BLOCK_SIZE);
  });

  test("1-byte file: 511 padding, two-block entry", () => {
    const p = planEntry("one.txt", 1, 0);
    expect(p.paxBlock).toBeNull();
    expect(p.paddingLen).toBe(511);
    expect(p.entryLen).toBe(2 * TAR_BLOCK_SIZE);
  });

  test("UTF-8 path triggers PAX by byte length, not code-point count", () => {
    // 50 × "é" = 100 UTF-8 bytes → still fits
    const fits = planEntry("é".repeat(50), 1, 0);
    expect(fits.paxBlock).toBeNull();

    // 51 × "é" = 102 UTF-8 bytes → PAX required
    const overflows = planEntry("é".repeat(51), 1, 0);
    expect(overflows.paxBlock).not.toBeNull();
    const body = DECODER.decode(overflows.paxBlock!.subarray(TAR_BLOCK_SIZE));
    expect(body).toContain(`path=${"é".repeat(51)}`);
  });

  test("PAX record's self-referential length is correct at 3-digit lengths", () => {
    // Path long enough that the encoded record is ≥ 100 bytes, forcing the
    // length-of-length fixed point to converge on a 3-digit length.
    const path = "a".repeat(150);
    const p = planEntry(path, 1, 0);
    const body = DECODER.decode(p.paxBlock!.subarray(TAR_BLOCK_SIZE));
    const m = body.match(/^(\d+) path=[^\n]*\n/);
    expect(m).not.toBeNull();
    const declaredLen = parseInt(m![1], 10);
    const actualLen = ENCODER.encode(m![0]).length;
    expect(declaredLen).toBe(actualLen);
    expect(String(declaredLen).length).toBeGreaterThanOrEqual(3);
  });

  test("checksum changes when path or mtime changes", () => {
    const a = planEntry("a.txt", 100, 1000);
    const b = planEntry("a.txt", 100, 2000);
    const c = planEntry("b.txt", 100, 1000);

    const csA = DECODER.decode(a.ustarBlock.subarray(148, 154));
    const csB = DECODER.decode(b.ustarBlock.subarray(148, 154));
    const csC = DECODER.decode(c.ustarBlock.subarray(148, 154));

    expect(csA).not.toBe(csB); // mtime affects checksum
    expect(csA).not.toBe(csC); // name affects checksum
  });

  test("both long path AND large size produce one PAX block with both records", () => {
    const path = "a/".repeat(60) + "file.bin";
    const big = 8 ** 11;
    const p = planEntry(path, big, 0);
    expect(p.paxBlock).not.toBeNull();

    const body = DECODER.decode(p.paxBlock!.subarray(TAR_BLOCK_SIZE));
    expect(body).toContain(`path=${path}`);
    expect(body).toContain(`size=${big}`);

    // The ustar block reflects PAX overrides for both fields.
    expect(readOctal(p.ustarBlock, 124, 12)).toBe(0);
    const ustarName = DECODER.decode(p.ustarBlock.subarray(0, 100)).replace(
      /\0+$/,
      "",
    );
    expect(path.endsWith(ustarName)).toBe(true);
  });

  test("ustar name is the last 100 bytes of an overlong path", () => {
    const path = "a".repeat(200) + "/end.bin";
    const p = planEntry(path, 1, 0);
    const ustarName = DECODER.decode(p.ustarBlock.subarray(0, 100));
    const expectedTail = path.slice(path.length - 100);
    expect(ustarName.startsWith(expectedTail)).toBe(true);
    expect(ustarName.endsWith("end.bin")).toBe(true);
  });

  test("PAX block name uses the PaxHeaders/<basename> convention", () => {
    const longPath = "a/".repeat(60) + "sample.bam.c4gh";
    const p = planEntry(longPath, 1, 0);
    const name = DECODER.decode(p.paxBlock!.subarray(0, 100)).replace(
      /\0+$/,
      "",
    );
    expect(name).toContain("PaxHeaders/");
    expect(name.endsWith("sample.bam.c4gh")).toBe(true);
  });
});
