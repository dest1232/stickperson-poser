#!/bin/sh
set -eu

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
RESOURCE_DIR="$SCRIPT_DIR/StickpersonPoser/Resources"
INPUT="$RESOURCE_DIR/stickman_default.glb"
OUTPUT="$RESOURCE_DIR/stickman_default.usdz"

if command -v usdzconvert >/dev/null 2>&1; then
  usdzconvert "$INPUT" "$OUTPUT"
elif command -v xcrun >/dev/null 2>&1 && xcrun -f usdz_converter >/dev/null 2>&1; then
  xcrun usdz_converter "$INPUT" "$OUTPUT"
elif command -v usdcat >/dev/null 2>&1 && command -v usdzip >/dev/null 2>&1; then
  TMP_DIR="$(mktemp -d)"
  TMP_USDA="$TMP_DIR/stickman_default.usda"
  trap 'rm -rf "$TMP_DIR"' EXIT
  usdcat "$INPUT" -o "$TMP_USDA"
  (cd "$TMP_DIR" && usdzip "$OUTPUT" stickman_default.usda)
else
  echo "Could not find usdzconvert, Apple's usdz_converter, or usdcat/usdzip."
  echo "Open $INPUT in Reality Converter or another USDZ-capable tool and export:"
  echo "$OUTPUT"
  exit 1
fi

echo "Wrote $OUTPUT"
