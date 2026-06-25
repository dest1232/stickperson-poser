#!/bin/sh

set -eu

NODE_VERSION="22.23.1"
NODE_SHA256="ef28d8fab2c0e4314522d4bb1b7173270aa3937e93b92cb7de79c112ac1fa953"
PROJECT_ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
ARCH=$(uname -m)

if [ "$ARCH" != "arm64" ]; then
  echo "This setup script currently supports Apple Silicon Macs only."
  exit 1
fi

ARCHIVE="node-v${NODE_VERSION}-darwin-arm64.tar.gz"
DOWNLOAD_PATH="${TMPDIR:-/tmp}/${ARCHIVE}"
NODE_DIR="$PROJECT_ROOT/.node"

echo "Downloading Node.js ${NODE_VERSION}..."
curl -fsSL "https://nodejs.org/dist/v${NODE_VERSION}/${ARCHIVE}" -o "$DOWNLOAD_PATH"

ACTUAL_SHA256=$(shasum -a 256 "$DOWNLOAD_PATH" | awk '{print $1}')
if [ "$ACTUAL_SHA256" != "$NODE_SHA256" ]; then
  echo "Node.js archive checksum did not match."
  exit 1
fi

mkdir -p "$NODE_DIR"
tar -xzf "$DOWNLOAD_PATH" -C "$NODE_DIR" --strip-components=1

echo "Installed $("$NODE_DIR/bin/node" --version) in $NODE_DIR"
