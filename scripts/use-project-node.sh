#!/bin/sh

PROJECT_ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
export PATH="$PROJECT_ROOT/.node/bin:$PATH"

if ! command -v node >/dev/null 2>&1; then
  echo "Project-local Node.js is missing. Install Node.js 22 LTS, then run npm install."
  exit 1
fi

exec "$@"
