#!/bin/sh -

set -u

# Unless already set, the build and runtime user:group IDs default to
# 6000:6000 and 6001:6001, respectively.
export BUILD_ID="${BUILD_ID:-6000:6000}"
export RUNTIME_ID="${RUNTIME_ID:-6001:6001}"
export TAG="${TAG:-latest}"

# Set environment variables for build info.
export BUILD_GIT_COMMIT="$(git rev-parse --short HEAD 2>/dev/null || true)"
export BUILD_GIT_BRANCH="$(git symbolic-ref --short -q HEAD 2>/dev/null || true)"

exec docker compose -f docker-compose.yml "$@"
