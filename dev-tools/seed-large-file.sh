#!/bin/sh
# Adds a single 2 GiB file to dataset EGAD00000000002.
# Run inside the same seed container (needs crypt4gh, mc, psql, python3,
# and access to /shared/c4gh.pub.pem).
set -e

LARGE_MARKER="/shared/.large_file_seeded"
if [ -f "$LARGE_MARKER" ]; then
  echo "Large file already seeded, skipping."
  exit 0
fi

FILE_STABLE_ID="EGAF00000000999"
FILE_UUID="aaaaaaaa-bbbb-cccc-dddd-000000000999"
FILE_NAME="large-file-2gb.c4gh"
DATASET_STABLE_ID="EGAD00000000002"
SUBMISSION_USER="integration_test@example.org"

PLAINTEXT=/tmp/large_plaintext.bin
ENCRYPTED=/tmp/large_encrypted.c4gh

# Create 2 GiB of deterministic plaintext (fast: sparse-ish, but we need real bytes for c4gh)
# Use /dev/zero so encryption is quick and reproducible.
echo "Generating 2 GiB plaintext..."
dd if=/dev/zero of="$PLAINTEXT" bs=1M count=2048 status=none

echo "Encrypting with crypt4gh..."
crypt4gh encrypt --recipient_pk /shared/c4gh.pub.pem < "$PLAINTEXT" > "$ENCRYPTED"

echo "Splitting header/body and computing checksums..."
python3 << 'PYEOF'
import struct, hashlib

with open("/tmp/large_encrypted.c4gh", "rb") as f:
    # Read header first
    magic = f.read(8)
    assert magic == b"crypt4gh", f"Bad magic: {magic}"
    version = f.read(4)
    packet_count = struct.unpack("<I", f.read(4))[0]
    header = magic + version + struct.pack("<I", packet_count)
    for _ in range(packet_count):
        pkt_len_bytes = f.read(4)
        pkt_len = struct.unpack("<I", pkt_len_bytes)[0]
        rest = f.read(pkt_len - 4)
        header += pkt_len_bytes + rest

    with open("/tmp/large_header.bin", "wb") as h:
        h.write(header)

    # Stream body to file while computing sha256
    body_sha = hashlib.sha256()
    body_size = 0
    with open("/tmp/large_body.bin", "wb") as b:
        while True:
            chunk = f.read(8 * 1024 * 1024)
            if not chunk:
                break
            b.write(chunk)
            body_sha.update(chunk)
            body_size += len(chunk)

# Plaintext checksum (stream)
pt_sha = hashlib.sha256()
pt_size = 0
with open("/tmp/large_plaintext.bin", "rb") as p:
    while True:
        chunk = p.read(8 * 1024 * 1024)
        if not chunk:
            break
        pt_sha.update(chunk)
        pt_size += len(chunk)

with open("/tmp/large_seed_metadata.env", "w") as f:
    f.write(f"HEADER_HEX={header.hex()}\n")
    f.write(f"ARCHIVE_SIZE={body_size}\n")
    f.write(f"DECRYPTED_SIZE={pt_size}\n")
    f.write(f"ARCHIVE_CHECKSUM={body_sha.hexdigest()}\n")
    f.write(f"DECRYPTED_CHECKSUM={pt_sha.hexdigest()}\n")

print(f"Header: {len(header)} bytes, Body: {body_size} bytes, Plaintext: {pt_size} bytes")
PYEOF

. /tmp/large_seed_metadata.env

echo "Uploading to MinIO..."
mc alias set myminio http://s3:9000 access secretKey --quiet
mc mb myminio/archive --ignore-existing --quiet
mc pipe "myminio/archive/$FILE_NAME" < /tmp/large_body.bin

echo "Inserting DB rows..."
pg_isready -h postgres -p 5432 -U postgres

psql -h postgres -U postgres -d sda << EOSQL
INSERT INTO sda.files (
  id, stable_id, submission_user, submission_file_path,
  archive_file_path, archive_location, archive_file_size, decrypted_file_size,
  header, encryption_method
) VALUES (
  '$FILE_UUID',
  '$FILE_STABLE_ID',
  '$SUBMISSION_USER',
  '$FILE_NAME',
  '$FILE_NAME',
  'http://s3:9000/archive',
  $ARCHIVE_SIZE,
  $DECRYPTED_SIZE,
  '$HEADER_HEX',
  'CRYPT4GH'
) ON CONFLICT (id) DO UPDATE SET
  stable_id = EXCLUDED.stable_id,
  archive_file_size = EXCLUDED.archive_file_size,
  decrypted_file_size = EXCLUDED.decrypted_file_size,
  header = EXCLUDED.header,
  archive_file_path = EXCLUDED.archive_file_path,
  submission_file_path = EXCLUDED.submission_file_path;

INSERT INTO sda.file_dataset (file_id, dataset_id)
  SELECT '$FILE_UUID'::uuid, d.id
  FROM sda.datasets d
  WHERE d.stable_id = '$DATASET_STABLE_ID'
  ON CONFLICT DO NOTHING;

DELETE FROM sda.checksums WHERE file_id = '$FILE_UUID';
INSERT INTO sda.checksums (file_id, checksum, type, source) VALUES
  ('$FILE_UUID', '$ARCHIVE_CHECKSUM', 'SHA256', 'ARCHIVED'),
  ('$FILE_UUID', '$DECRYPTED_CHECKSUM', 'SHA256', 'UNENCRYPTED');
EOSQL

# Cleanup big temp files
rm -f "$PLAINTEXT" "$ENCRYPTED" /tmp/large_body.bin /tmp/large_header.bin

echo "Added $FILE_STABLE_ID (2 GiB) to $DATASET_STABLE_ID"

touch "$LARGE_MARKER"
