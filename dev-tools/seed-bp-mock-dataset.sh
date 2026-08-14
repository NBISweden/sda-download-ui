#!/bin/sh
# Seeds a mock BP dataset that reproduces the currently used dataset folder structure.
# Files are truly downloadable: real crypt4gh-encrypted objects live in MinIO
# and DB metadata (header, sizes, checksums) matches.
#
set -e

SEED_MARKER="/shared/.download_v2_tree_seeded"
SEED_MARKER_TMP="/shared/.download_v2_tree_seeded.tmp"

if [ -f "$SEED_MARKER" ]; then
  echo "Tree dataset already seeded, skipping."
  exit 0
fi

echo "=== Seeding tree dataset ==="

# MinIO setup
mc alias set myminio http://s3:9000 access secretKey --quiet
mc mb myminio/archive --ignore-existing --quiet

# Generate folder structured data, encrypt and upload to MinIO, emit a single SQL file.
python3 << 'PYEOF'
import hashlib, os, struct, subprocess

DATASET_STABLE_ID = "bp-Dataset-d6ummy-m3oc2k"
DATASET_TITLE     = "BP dummy dataset"
SUB_USER          = "integration_test@example.org"
UUID_PREFIX       = "aaaaaaaa-bbbb-cccc-eeee-"
FILE_SEQ_OFFSET   = 200000
ROOT              = DATASET_STABLE_ID  # top-level folder in submission paths

# Deterministic "bp-File-xxxxxx-xxxxxx" stable IDs derived from the UUID
# so re-runs produce the same values and ON CONFLICT works cleanly.
ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789"
def bp_file_id(uuid_str: str) -> str:
    h = hashlib.sha256(uuid_str.encode()).digest()
    def chunk(offset):
        return "".join(ALPHABET[b % len(ALPHABET)] for b in h[offset:offset+6])
    return f"bp-File-{chunk(0)}-{chunk(6)}"

# (path, size) for every leaf in the tree
tree = []

# ANNOTATIONS
for tag in ["COHgRAvaSh","FynRUsFMQg","GwyXFSqENy","oywigPjsrl","SICYJPKBvG","uAveaVJgGn","vLjSZDKbil"]:
    tree.append((f"{ROOT}/ANNOTATIONS/annotation_{tag}.geojson.c4gh", 140))

# IMAGES
image_sizes_a = [2259838, 9947106, 548012, 1665590, 628916, 121877050]
image_sizes_b = [1841504, 2651070, 813424, 1904756, 939656, 60473088]
image_sizes_c = [128116, 13338328, 1001624, 13367590, 16729978, 68172052]

image_groups = [
    ("COHgRAvaSh", image_sizes_a),
    ("FynRUsFMQg", image_sizes_a),
    ("GwyXFSqENy", image_sizes_b),
    ("oywigPjsrl", image_sizes_a),
    ("SICYJPKBvG", image_sizes_a),
    ("uAveaVJgGn", image_sizes_c),
    ("vLjSZDKbil", image_sizes_c),
]
for tag, sizes in image_groups:
    for i, sz in enumerate(sizes, start=1):
        tree.append((f"{ROOT}/IMAGES/IMAGE_{tag}/{tag}_{i}.dcm.c4gh", sz))

# METADATA
for name, sz in [
    ("annotation.xml", 9803),
    ("dataset.xml",    1473),
    ("image.xml",      47646),
    ("observation.xml",2219),
    ("observer.xml",   260),
    ("policy.xml",     2533),
    ("sample.xml",     8490),
    ("staining.xml",   707),
]:
    tree.append((f"{ROOT}/METADATA/{name}.c4gh", sz))

expected = 7 + (7 * 6) + 8  # 7 annotations + 42 dcm + 8 metadata = 57
assert len(tree) == expected, f"Expected {expected} files, got {len(tree)}"

# Build one encrypted archive object per unique plaintext size
unique_sizes = sorted({sz for _, sz in tree})
print(f"Unique sizes to encrypt: {len(unique_sizes)}")

meta_by_size = {}
for sz in unique_sizes:
    # Deterministic filler content of exactly sz bytes
    seed = hashlib.sha256(f"tree-seed-size-{sz}".encode()).digest()  # 32 bytes
    reps = (sz // 32) + 1
    plaintext = (seed * reps)[:sz]

    plain_path = f"/tmp/tree_plain_{sz}.bin"
    enc_path   = f"/tmp/tree_enc_{sz}.c4gh"
    with open(plain_path, "wb") as f:
        f.write(plaintext)

    with open(plain_path, "rb") as fin, open(enc_path, "wb") as fout:
        subprocess.run(
            ["crypt4gh", "encrypt", "--recipient_pk", "/shared/c4gh.pub.pem"],
            stdin=fin, stdout=fout, check=True,
        )

    with open(enc_path, "rb") as f:
        data = f.read()
    assert data[:8] == b"crypt4gh", "Bad crypt4gh magic"
    packet_count = struct.unpack("<I", data[12:16])[0]
    off = 16
    for _ in range(packet_count):
        pkt_len = struct.unpack("<I", data[off:off+4])[0]
        off += pkt_len
    header = data[:off]
    body   = data[off:]

    archive_object = f"tree-blobs/size-{sz}.c4gh"

    # Upload archive object (body) to MinIO
    body_path = f"/tmp/tree_body_{sz}.bin"
    with open(body_path, "wb") as f:
        f.write(body)
    with open(body_path, "rb") as fin:
        subprocess.run(
            ["mc", "pipe", f"myminio/archive/{archive_object}"],
            stdin=fin, check=True,
        )

    meta_by_size[sz] = {
        "header_hex":         header.hex(),
        "archive_size":       len(body),
        "decrypted_size":     sz,
        "archive_checksum":   hashlib.sha256(body).hexdigest(),
        "decrypted_checksum": hashlib.sha256(plaintext).hexdigest(),
        "archive_object":     archive_object,
    }

    for p in (plain_path, enc_path, body_path):
        try: os.unlink(p)
        except OSError: pass

    print(f"  size={sz:>10}  archive={len(body):>10}  -> {archive_object}")

# Emit SQL
def sq(s):  # SQL single-quote escape
    return s.replace("'", "''")

with open("/tmp/tree_seed.sql", "w") as sql:
    sql.write("BEGIN;\n")
    sql.write(
        f"INSERT INTO sda.datasets (stable_id, title) "
        f"VALUES ('{sq(DATASET_STABLE_ID)}', '{sq(DATASET_TITLE)}') "
        f"ON CONFLICT (stable_id) DO NOTHING;\n"
    )

    for i, (path, sz) in enumerate(tree):
        seq       = FILE_SEQ_OFFSET + i
        uuid_     = f"{UUID_PREFIX}{seq:012d}"
        stable_id = bp_file_id(uuid_)
        m         = meta_by_size[sz]

        sql.write(f"""
INSERT INTO sda.files (
  id, stable_id, submission_user, submission_file_path,
  archive_file_path, archive_location, archive_file_size, decrypted_file_size,
  header, encryption_method
) VALUES (
  '{uuid_}',
  '{stable_id}',
  '{sq(SUB_USER)}',
  '{sq(path)}',
  '{m["archive_object"]}',
  'http://s3:9000/archive',
  {m["archive_size"]},
  {m["decrypted_size"]},
  '{m["header_hex"]}',
  'CRYPT4GH'
) ON CONFLICT (id) DO UPDATE SET
  stable_id = EXCLUDED.stable_id,
  archive_file_size = EXCLUDED.archive_file_size,
  decrypted_file_size = EXCLUDED.decrypted_file_size,
  header = EXCLUDED.header,
  archive_file_path = EXCLUDED.archive_file_path,
  submission_file_path = EXCLUDED.submission_file_path;

INSERT INTO sda.file_dataset (file_id, dataset_id)
  SELECT '{uuid_}'::uuid, d.id
  FROM sda.datasets d
  WHERE d.stable_id = '{sq(DATASET_STABLE_ID)}'
  ON CONFLICT DO NOTHING;

DELETE FROM sda.checksums WHERE file_id = '{uuid_}';
INSERT INTO sda.checksums (file_id, checksum, type, source) VALUES
  ('{uuid_}', '{m["archive_checksum"]}',   'SHA256', 'ARCHIVED'),
  ('{uuid_}', '{m["decrypted_checksum"]}', 'SHA256', 'UNENCRYPTED');
""")

    sql.write("COMMIT;\n")

print(f"Wrote SQL for {len(tree)} files to /tmp/tree_seed.sql")
PYEOF

pg_isready -h postgres -p 5432 -U postgres
psql -h postgres -U postgres -d sda -v ON_ERROR_STOP=1 -f /tmp/tree_seed.sql

echo "Seeded 57 files across the tree into bp-Dataset-d6ummy-m3oc2k"
touch "$SEED_MARKER_TMP"
mv "$SEED_MARKER_TMP" "$SEED_MARKER"
echo "=== Tree dataset seed complete ==="
