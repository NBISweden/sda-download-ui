/*
 * Deterministic TAR encoder (POSIX USTAR + PAX). We do not use any
 * existing TAR libraries because we need full control over the framing
 * of each entry in the archive, to support HTTP Range resumes on the
 * download endpoint.
 *
 * Each file becomes a regular USTAR entry. Paths longer than 100 bytes
 * or sizes above 8 GiB get a PAX extended header in front carrying the
 * full path/size, since they don't fit in USTAR's fixed-width fields.
 * Directories aren't emitted explicitly — tar readers reconstruct them
 * from the file paths.
 *
 * The encoder is deterministic by design: given the same inputs
 * (path, size, mtime), the framing bytes around the payload — the PAX
 * header, the USTAR header, and the trailing padding — are always
 * identical, and the entry occupies a fixed number of bytes in the
 * archive. The payload bytes themselves are streamed in by the caller
 * and are not produced by this module.
 *
 * This stable framing is what later lets the server support HTTP Range
 * resumes: the layout of each entry within the archive is fully
 * predictable from metadata alone, so the same byte offsets always
 * refer to the same region (PAX header / USTAR header / payload /
 * padding) across requests.
 */

// TAR is a stream of fixed-size 512-byte blocks.
export const TAR_BLOCK_SIZE = 512;

// An archive ends with two consecutive all-zero blocks ("the trailer").
export const TAR_TRAILER_LEN = 2 * TAR_BLOCK_SIZE;

// USTAR's `name` field is only 100 bytes wide. Longer paths must use PAX.
const NAME_LIMIT = 100;

// USTAR's `size`. Files larger than this need a PAX `size=` record instead.
const MAX_USTAR_SIZE = 8 ** 11 - 1;

const ENCODER = new TextEncoder();

// Write a string into `buf` at `offset`, truncating to `max` bytes.
// We rely on the buffer being zero-initialised for NUL termination.
function writeAscii(
  buf: Uint8Array,
  offset: number,
  max: number,
  value: string,
) {
  const bytes = ENCODER.encode(value);
  buf.set(bytes.subarray(0, Math.min(bytes.length, max)), offset);
}

// Write a TAR octal field: (fieldLen - 1) ASCII octal digits, zero-padded
// on the left, followed by a single NUL byte. This is the format every
// numeric field in a USTAR header uses (mode, uid, size, mtime, …).
function writeOctal(
  buf: Uint8Array,
  offset: number,
  fieldLen: number,
  value: number,
) {
  const digits = fieldLen - 1;
  const s = value.toString(8).padStart(digits, "0");
  buf.set(ENCODER.encode(s), offset);
  buf[offset + digits] = 0;
}

// Build a single 512-byte USTAR header block. Used both for regular file
// entries (typeflag "0") and for PAX extended-header blocks (typeflag "x").
// Most fields are hard-coded (mode 0644, uid/gid 0, empty uname/gname) so
// the bytes are deterministic and we don't emit host information.
function buildUstarHeader(opts: {
  name: string;
  ustarSize: number;
  mtime: number;
  typeflag: "0" | "x";
}): Uint8Array {
  const buf = new Uint8Array(TAR_BLOCK_SIZE);
  writeAscii(buf, 0, 100, opts.name);
  writeOctal(buf, 100, 8, 0o644);
  writeOctal(buf, 108, 8, 0);
  writeOctal(buf, 116, 8, 0);
  writeOctal(buf, 124, 12, opts.ustarSize);
  writeOctal(buf, 136, 12, opts.mtime);

  // The checksum is computed over the whole block with the chksum field
  // itself treated as 8 spaces. We fill those spaces in first, then sum,
  // then overwrite with the real value.
  buf.fill(0x20, 148, 156);
  buf[156] = opts.typeflag.charCodeAt(0);
  buf.set(ENCODER.encode("ustar"), 257);
  buf[262] = 0;
  buf[263] = 0x30;
  buf[264] = 0x30;

  let sum = 0;
  for (let i = 0; i < TAR_BLOCK_SIZE; i++) sum += buf[i];

  // The `chksum` field has a quirky format: 6 octal digits, NUL, space.
  buf.set(ENCODER.encode(sum.toString(8).padStart(6, "0")), 148);
  buf[154] = 0;
  buf[155] = 0x20;
  return buf;
}

// Format a single PAX record: "<len> <key>=<value>\n", where <len> is the
// total byte length of the record *including the digits of <len> itself*.
// That self-reference means we have to solve a small fixed point; in
// practice it converges in at most two iterations.
function paxRecord(key: string, value: string): string {
  const suffix = ` ${key}=${value}\n`;
  const suffixLen = ENCODER.encode(suffix).length;
  let len = suffixLen + 1;
  for (;;) {
    const total = String(len).length + suffixLen;
    if (total === len) return String(len) + suffix;
    len = total;
  }
}

// Pad a buffer up to the next 512-byte boundary with zeros. Used for the
// PAX payload so that the next entry's header lands on a block boundary.
function padToBlock(bytes: Uint8Array): Uint8Array {
  const rem = bytes.length % TAR_BLOCK_SIZE;
  if (rem === 0) return bytes;
  const out = new Uint8Array(bytes.length + (TAR_BLOCK_SIZE - rem));
  out.set(bytes);
  return out;
}

// When a path is too long for USTAR's 100-byte `name` field, we still need
// to put *something* there as a fallback. The trailing 100 bytes are the
// most informative slice (they usually contain the filename itself).
// PAX-aware readers ignore this and use the PAX `path=` record instead.
function tailNameForUstar(filePath: string): string {
  const bytes = ENCODER.encode(filePath);
  if (bytes.length <= NAME_LIMIT) return filePath;
  return new TextDecoder("utf-8", { fatal: false }).decode(
    bytes.subarray(bytes.length - NAME_LIMIT),
  );
}

// The PAX header block itself needs a `name` field too. Convention (used
// by GNU tar) is "PaxHeaders/<basename>" — innocuous if a non-PAX-aware
// reader extracts it by mistake.
function paxSyntheticName(filePath: string): string {
  const basename = filePath.split("/").pop() || "file";
  return tailNameForUstar(`PaxHeaders/${basename}`);
}

// Describes the byte layout of one TAR entry without holding the file's
// payload. The route handler uses this to know exactly what to emit
// before and after the streamed file bytes, and how many bytes the whole
// entry will occupy.
export type PlannedEntry = {
  filePath: string;
  fileDataLen: number;
  paxBlock: Uint8Array | null; // null when no PAX extensions are needed
  ustarBlock: Uint8Array; // always 512 bytes
  paddingLen: number; // zero bytes to emit after the payload
  entryLen: number; // total bytes occupied by this entry
};

// Plan a single TAR entry for a file. Decides whether PAX is needed for
// long paths or large sizes, builds the framing blocks, and reports how
// many bytes of padding the caller will need to emit after the payload.
export function planEntry(
  filePath: string,
  fileDataLen: number,
  mtime: number,
): PlannedEntry {
  const pathBytes = ENCODER.encode(filePath);
  const needsPaxForPath = pathBytes.length > NAME_LIMIT;
  const needsPaxForSize = fileDataLen > MAX_USTAR_SIZE;

  // Emit a PAX block in front of the regular entry when either the path
  // or the size doesn't fit in the USTAR fields.
  let paxBlock: Uint8Array | null = null;
  if (needsPaxForPath || needsPaxForSize) {
    let body = "";
    if (needsPaxForPath) body += paxRecord("path", filePath);
    if (needsPaxForSize) body += paxRecord("size", String(fileDataLen));
    const bodyBytes = ENCODER.encode(body);
    const paxHeader = buildUstarHeader({
      name: paxSyntheticName(filePath),
      ustarSize: bodyBytes.length,
      mtime,
      typeflag: "x",
    });
    const paddedBody = padToBlock(bodyBytes);
    paxBlock = new Uint8Array(paxHeader.length + paddedBody.length);
    paxBlock.set(paxHeader, 0);
    paxBlock.set(paddedBody, paxHeader.length);
  }

  // The regular file entry. If we already emitted a PAX `size=` record,
  // zero out the USTAR `size` field — the PAX value is authoritative and
  // the real size would overflow the 12-byte field anyway.
  const ustarBlock = buildUstarHeader({
    name: needsPaxForPath ? tailNameForUstar(filePath) : filePath,
    ustarSize: needsPaxForSize ? 0 : fileDataLen,
    mtime,
    typeflag: "0",
  });

  // File payloads must be padded up to a 512-byte boundary. The double
  // `% TAR_BLOCK_SIZE` turns "already on a boundary" into 0 instead of 512.
  const paddingLen =
    (TAR_BLOCK_SIZE - (fileDataLen % TAR_BLOCK_SIZE)) % TAR_BLOCK_SIZE;
  const entryLen =
    (paxBlock?.length ?? 0) + TAR_BLOCK_SIZE + fileDataLen + paddingLen;

  return { filePath, fileDataLen, paxBlock, ustarBlock, paddingLen, entryLen };
}
