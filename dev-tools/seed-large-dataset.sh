#!/bin/sh
# Seed a single large dataset with 40,000 file entries for webapp load testing.
# DB-only: does NOT upload any new objects to MinIO.
# All file rows reuse the existing base archive object's header/checksums/sizes,
# so the entries are referentially consistent but share storage.
# Idempotent: safe to re-run.
set -e

SEED_MARKER="/shared/.download_v2_large_dataset_seeded"
SEED_MARKER_TMP="/shared/.download_v2_large_dataset_seeded.tmp"

if [ -f "$SEED_MARKER" ]; then
  echo "Large dataset already seeded, skipping."
  exit 0
fi

# Requires the base seed to have run (we reuse its metadata + archive object)
if [ ! -f /shared/seed_metadata.env ]; then
  echo "ERROR: /shared/seed_metadata.env not found. Run the base seed script first." >&2
  exit 1
fi

. /shared/seed_metadata.env

echo "=== Seeding large dataset (40k files) ==="

SUBMISSION_USER="integration_test@example.org"
LARGE_DATASET_STABLE_ID="EGAD00000040000"
LARGE_DATASET_TITLE="Large Test Dataset (40k files)"
FILE_COUNT=40000

# Offset the file sequence so we don't collide with the base seed's UUIDs/stable IDs.
# Base seed uses sequence 1..(101 + sum(1..10)*12 = ~1265). 100000+ is safely clear.
FILE_SEQ_OFFSET=100000

pg_isready -h postgres -p 5432 -U postgres

psql -h postgres -U postgres -d sda -v ON_ERROR_STOP=1 << EOSQL
BEGIN;

-- Create the dataset
INSERT INTO sda.datasets (stable_id, title)
  VALUES ('$LARGE_DATASET_STABLE_ID', '$LARGE_DATASET_TITLE')
  ON CONFLICT (stable_id) DO NOTHING;

-- Bulk-create 40k file rows in one shot using generate_series.
-- UUID format: aaaaaaaa-bbbb-cccc-dddd-XXXXXXXXXXXX (12 hex digits = decimal sequence)
-- Stable ID:   EGAF<11-digit zero-padded sequence>
-- File path:   generated-file-<11-digit sequence>.c4gh
WITH seq AS (
  SELECT generate_series($FILE_SEQ_OFFSET, $FILE_SEQ_OFFSET + $FILE_COUNT - 1) AS n
)
INSERT INTO sda.files (
  id, stable_id, submission_user, submission_file_path,
  archive_file_path, archive_location, archive_file_size, decrypted_file_size,
  header, encryption_method
)
SELECT
  ('aaaaaaaa-bbbb-cccc-dddd-' || lpad(n::text, 12, '0'))::uuid,
  'EGAF' || lpad(n::text, 11, '0'),
  '$SUBMISSION_USER',
  'generated-file-' || lpad(n::text, 11, '0') || '.c4gh',
  'test-file.c4gh',                 -- reuse existing archive object
  'http://s3:9000/archive',
  $ARCHIVE_SIZE,
  $DECRYPTED_SIZE,
  '$HEADER_HEX',
  'CRYPT4GH'
FROM seq
ON CONFLICT (id) DO NOTHING;

-- Link all newly created files to the large dataset
INSERT INTO sda.file_dataset (file_id, dataset_id)
SELECT
  ('aaaaaaaa-bbbb-cccc-dddd-' || lpad(n::text, 12, '0'))::uuid,
  d.id
FROM generate_series($FILE_SEQ_OFFSET, $FILE_SEQ_OFFSET + $FILE_COUNT - 1) AS n
CROSS JOIN sda.datasets d
WHERE d.stable_id = '$LARGE_DATASET_STABLE_ID'
ON CONFLICT DO NOTHING;

-- Bulk-insert checksums (ARCHIVED + UNENCRYPTED per file)
INSERT INTO sda.checksums (file_id, checksum, type, source)
SELECT
  ('aaaaaaaa-bbbb-cccc-dddd-' || lpad(n::text, 12, '0'))::uuid,
  '$ARCHIVE_CHECKSUM',
  'SHA256',
  'ARCHIVED'
FROM generate_series($FILE_SEQ_OFFSET, $FILE_SEQ_OFFSET + $FILE_COUNT - 1) AS n;

INSERT INTO sda.checksums (file_id, checksum, type, source)
SELECT
  ('aaaaaaaa-bbbb-cccc-dddd-' || lpad(n::text, 12, '0'))::uuid,
  '$DECRYPTED_CHECKSUM',
  'SHA256',
  'UNENCRYPTED'
FROM generate_series($FILE_SEQ_OFFSET, $FILE_SEQ_OFFSET + $FILE_COUNT - 1) AS n;

COMMIT;
EOSQL

echo "Seeded $FILE_COUNT files into dataset $LARGE_DATASET_STABLE_ID"
touch "$SEED_MARKER_TMP"
mv "$SEED_MARKER_TMP" "$SEED_MARKER"
echo "=== Large dataset seed complete ==="
