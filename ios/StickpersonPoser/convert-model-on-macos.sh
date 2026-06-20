#!/bin/sh
set -eu

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
RESOURCE_DIR="$SCRIPT_DIR/StickpersonPoser/Resources"
INPUT="$RESOURCE_DIR/stickman_default.glb"
OUTPUT="$RESOURCE_DIR/stickman_default.usdz"

if command -v xcrun >/dev/null 2>&1 && xcrun -f usdz_converter >/dev/null 2>&1; then
  xcrun usdz_converter "$INPUT" "$OUTPUT"
else
  echo "Could not find Apple's usdz_converter."
  echo "Open $INPUT in Reality Converter or another USDZ-capable tool and export:"
  echo "$OUTPUT"
  exit 1
fi

echo "Wrote $OUTPUT"

