#!/bin/sh
# Seed script for download v2 dev compose.
# Creates a real Crypt4GH encrypted test file, uploads data segments to MinIO,
# and inserts matching metadata (header, checksums, sizes) into the database.
# Idempotent: safe to re-run against existing volumes.
# Creates 120 datasets and reuses the base file for additional files.
# It distributes files across the dataset  with a variable spread to support pagination testing.
# Up to max 101 files per dataset.
set -e

SEED_MARKER="/shared/.download_v2_seeded"
SEED_MARKER_TMP="/shared/.download_v2_seeded.tmp"

if [ -f "$SEED_MARKER" ]; then
  echo "Seed already completed, skipping."
  exit 0
fi

echo "=== Seeding test data ==="

SUBMISSION_USER="integration_test@example.org"
BASE_FILE_UUID="aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
BASE_FILE_STABLE_ID="EGAF00000000001"
BASE_DATASET_STABLE_ID="EGAD00000000001"

# Create deterministic plaintext test data (1 KB)
python3 -c "import hashlib; open('/tmp/plaintext.bin','wb').write(hashlib.sha256(b'sda-download-v2-dev-test-data').digest() * 32)"

# Encrypt with crypt4gh using the server's public key
crypt4gh encrypt --recipient_pk /shared/c4gh.pub.pem < /tmp/plaintext.bin > /tmp/encrypted.c4gh

# Split: extract header and data segments, compute checksums
python3 << 'PYEOF'
import struct, hashlib

with open("/tmp/encrypted.c4gh", "rb") as f:
    data = f.read()

# Parse c4gh header
magic = data[:8]
assert magic == b"crypt4gh", f"Bad magic: {magic}"
packet_count = struct.unpack("<I", data[12:16])[0]

offset = 16
for _ in range(packet_count):
    pkt_len = struct.unpack("<I", data[offset:offset+4])[0]
    offset += pkt_len

header = data[:offset]
body = data[offset:]

with open("/tmp/header.bin", "wb") as f:
    f.write(header)
with open("/tmp/body.bin", "wb") as f:
    f.write(body)

plaintext = open("/tmp/plaintext.bin", "rb").read()

with open("/tmp/seed_metadata.env", "w") as f:
    f.write(f"HEADER_HEX={header.hex()}\n")
    f.write(f"ARCHIVE_SIZE={len(body)}\n")
    f.write(f"DECRYPTED_SIZE={len(plaintext)}\n")
    f.write(f"ARCHIVE_CHECKSUM={hashlib.sha256(body).hexdigest()}\n")
    f.write(f"DECRYPTED_CHECKSUM={hashlib.sha256(plaintext).hexdigest()}\n")

print(f"Header: {len(header)} bytes, Body: {len(body)} bytes")
PYEOF

# Load computed metadata
. /tmp/seed_metadata.env

# MinIO setup
mc alias set myminio http://s3:9000 access secretKey --quiet
mc mb myminio/archive --ignore-existing --quiet

# Upload base archived object
mc pipe myminio/archive/test-file.c4gh < /tmp/body.bin
echo "Uploaded to MinIO: archive/test-file.c4gh"

# Create all additional archived objects needed:
# - files 2..101 for dataset 1
# - a variable spread for datasets 2..120
#
# Global file sequence:
#   1   = base file EGAF00000000001 => test-file.c4gh
#   2+  = generated files => generated-file-XXXXXXXXXXX.c4gh
#
# Spread function for datasets 2..120:
#   file_count = ((dataset_index - 2) % 10) + 1
# This gives a repeating spread of 1..10 files across the remaining datasets.
GLOBAL_FILE_SEQ=2

# Additional archived objects for dataset 1 (100 more files)
i=2
while [ "$i" -le 101 ]; do
  OBJ_NAME=$(printf "generated-file-%011d.c4gh" "$GLOBAL_FILE_SEQ")
  mc cp "myminio/archive/test-file.c4gh" "myminio/archive/$OBJ_NAME" --quiet
  GLOBAL_FILE_SEQ=$((GLOBAL_FILE_SEQ+1))
  i=$((i+1))
done

# Archived objects for datasets 2..120 with spread 1..10
dataset_idx=2
while [ "$dataset_idx" -le 120 ]; do
  file_count=$(( ((dataset_idx - 2) % 10) + 1 ))
  j=1
  while [ "$j" -le "$file_count" ]; do
    OBJ_NAME=$(printf "generated-file-%011d.c4gh" "$GLOBAL_FILE_SEQ")
    mc cp "myminio/archive/test-file.c4gh" "myminio/archive/$OBJ_NAME" --quiet
    GLOBAL_FILE_SEQ=$((GLOBAL_FILE_SEQ+1))
    j=$((j+1))
  done
  dataset_idx=$((dataset_idx+1))
done

echo "Uploaded/copied archived objects to MinIO"

# Seed database
pg_isready -h postgres -p 5432 -U postgres

psql -h postgres -U postgres -d sda << EOSQL
-- Base/original file
INSERT INTO sda.files (
  id, stable_id, submission_user, submission_file_path,
  archive_file_path, archive_location, archive_file_size, decrypted_file_size,
  header, encryption_method
) VALUES (
  '$BASE_FILE_UUID',
  '$BASE_FILE_STABLE_ID',
  '$SUBMISSION_USER',
  'test-file.c4gh',
  'test-file.c4gh',
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

-- Base/original dataset
INSERT INTO sda.datasets (stable_id, title)
  VALUES ('$BASE_DATASET_STABLE_ID', 'Test Dataset 001')
  ON CONFLICT (stable_id) DO NOTHING;

INSERT INTO sda.file_dataset (file_id, dataset_id)
  SELECT '$BASE_FILE_UUID'::uuid, d.id
  FROM sda.datasets d
  WHERE d.stable_id = '$BASE_DATASET_STABLE_ID'
  ON CONFLICT DO NOTHING;

DELETE FROM sda.checksums WHERE file_id = '$BASE_FILE_UUID';
INSERT INTO sda.checksums (file_id, checksum, type, source) VALUES
  ('$BASE_FILE_UUID', '$ARCHIVE_CHECKSUM', 'SHA256', 'ARCHIVED'),
  ('$BASE_FILE_UUID', '$DECRYPTED_CHECKSUM', 'SHA256', 'UNENCRYPTED');
EOSQL

# File sequence counter:
# 1 is already used by the base file.
NEXT_FILE_SEQ=2

# Add 100 more files to the first dataset
i=2
while [ "$i" -le 101 ]; do
  FILE_STABLE_ID=$(printf "EGAF%011d" "$NEXT_FILE_SEQ")
  FILE_UUID=$(printf "aaaaaaaa-bbbb-cccc-dddd-%012d" "$NEXT_FILE_SEQ")
  FILE_NAME=$(printf "generated-file-%011d.c4gh" "$NEXT_FILE_SEQ")

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
  WHERE d.stable_id = '$BASE_DATASET_STABLE_ID'
  ON CONFLICT DO NOTHING;

DELETE FROM sda.checksums WHERE file_id = '$FILE_UUID';
INSERT INTO sda.checksums (file_id, checksum, type, source) VALUES
  ('$FILE_UUID', '$ARCHIVE_CHECKSUM', 'SHA256', 'ARCHIVED'),
  ('$FILE_UUID', '$DECRYPTED_CHECKSUM', 'SHA256', 'UNENCRYPTED');
EOSQL

  NEXT_FILE_SEQ=$((NEXT_FILE_SEQ+1))
  i=$((i+1))
done

echo "Seeded 100 additional files into $BASE_DATASET_STABLE_ID"

# Add datasets 2..120, each with a spread of files:
#   file_count = ((dataset_index - 2) % 10) + 1
dataset_idx=2
while [ "$dataset_idx" -le 120 ]; do
  DATASET_STABLE_ID=$(printf "EGAD%011d" "$dataset_idx")
  DATASET_TITLE=$(printf "Test Dataset %03d" "$dataset_idx")
  FILE_COUNT=$(( ((dataset_idx - 2) % 10) + 1 ))

  psql -h postgres -U postgres -d sda << EOSQL
INSERT INTO sda.datasets (stable_id, title)
  VALUES ('$DATASET_STABLE_ID', '$DATASET_TITLE')
  ON CONFLICT (stable_id) DO NOTHING;
EOSQL

  j=1
  while [ "$j" -le "$FILE_COUNT" ]; do
    FILE_STABLE_ID=$(printf "EGAF%011d" "$NEXT_FILE_SEQ")
    FILE_UUID=$(printf "aaaaaaaa-bbbb-cccc-dddd-%012d" "$NEXT_FILE_SEQ")
    FILE_NAME=$(printf "generated-file-%011d.c4gh" "$NEXT_FILE_SEQ")

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

    NEXT_FILE_SEQ=$((NEXT_FILE_SEQ+1))
    j=$((j+1))
  done

  dataset_idx=$((dataset_idx+1))
done

echo "Seeded 119 additional datasets with a spread of file counts for $SUBMISSION_USER"
touch "$SEED_MARKER_TMP"
mv "$SEED_MARKER_TMP" "$SEED_MARKER"
echo "=== Seed complete ==="
