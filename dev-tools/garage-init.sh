#!/bin/sh
# Bootstrap a single-node Garage: layout, bucket, access key, permissions.
set -u

export RUST_LOG=warn
GARAGE_CTR="${GARAGE_CTR:-garage}"
BUCKET="${BUCKET:-archive}"
ACCESS_KEY_ID="${ACCESS_KEY_ID:-GKabcdef0123456789abcdef01}"
SECRET_KEY="${SECRET_KEY:-abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789}"
KEY_NAME="${KEY_NAME:-sda}"
ZONE="${ZONE:-dc1}"
CAPACITY="${CAPACITY:-1G}"

g() { docker exec "$GARAGE_CTR" /garage "$@"; }

echo "==> Waiting for garage..."
until g status >/dev/null 2>&1; do sleep 1; done

NODE_ID=$(g node id -q | cut -d@ -f1)
echo "==> Node ID: $NODE_ID"

# Layout
if g layout show 2>/dev/null | grep -qE '^Role:'; then
  echo "==> Layout already applied, skipping."
else
  echo "==> Staging and applying cluster layout."
  g layout revert --yes >/dev/null 2>&1 || true
  g layout assign -z "$ZONE" -c "$CAPACITY" "$NODE_ID"

  CUR_VER=$(g layout show 2>/dev/null \
            | awk '/Current cluster layout version:/ {print $NF; exit}')
  CUR_VER=${CUR_VER:-0}
  NEXT_VER=$((CUR_VER + 1))
  g layout apply --version "$NEXT_VER"
fi

#Bucket
if g bucket info "$BUCKET" >/dev/null 2>&1; then
  echo "==> Bucket '$BUCKET' already exists."
else
  echo "==> Creating bucket '$BUCKET'."
  g bucket create "$BUCKET"
fi

#Key, import only if missing. Never delete an existing key (would wipe its grants
# and could orphan clients still using the credentials).
if g key info "$ACCESS_KEY_ID" >/dev/null 2>&1; then
  echo "==> Key '$ACCESS_KEY_ID' already present."
else
  echo "==> Importing key '$ACCESS_KEY_ID'."
  g key import --yes -n "$KEY_NAME" "$ACCESS_KEY_ID" "$SECRET_KEY"
fi

if ! g key info "$ACCESS_KEY_ID" >/dev/null 2>&1; then
  echo "FATAL: key '$ACCESS_KEY_ID' not present after import attempt."
  g key list
  exit 1
fi

#Permissions
if g bucket info "$BUCKET" 2>/dev/null \
     | grep -qE "^  $ACCESS_KEY_ID\b.*(R|W)"; then
  echo "==> Key '$ACCESS_KEY_ID' already has permissions on '$BUCKET'."
else
  echo "==> Granting read/write on '$BUCKET' to '$ACCESS_KEY_ID'."
  g bucket allow --read --write --owner "$BUCKET" --key "$ACCESS_KEY_ID"
fi

# Grant create-bucket at account level if not already set.
if g key info "$ACCESS_KEY_ID" 2>/dev/null | grep -q 'Can create buckets:.*true'; then
  echo "==> Key already has create-bucket."
else
  echo "==> Granting create-bucket to '$ACCESS_KEY_ID'."
  g key allow --create-bucket "$ACCESS_KEY_ID" 2>/dev/null || true
fi

#Final state
echo "==> Current state:"
g bucket list
g key list
g key info "$ACCESS_KEY_ID"

echo "==> Garage ready."
