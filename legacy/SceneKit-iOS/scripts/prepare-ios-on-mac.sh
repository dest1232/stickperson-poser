#!/bin/sh
set -eu

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
IOS_DIR="$ROOT_DIR/ios/StickpersonPoser"
RESOURCE_DIR="$IOS_DIR/StickpersonPoser/Resources"
INPUT="$RESOURCE_DIR/stickman_default.glb"
OUTPUT="$RESOURCE_DIR/stickman_default.usdz"

if [ ! -f "$INPUT" ]; then
  echo "Missing GLB source: $INPUT" >&2
  exit 1
fi

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
elif command -v RealityConverter >/dev/null 2>&1; then
  echo "Reality Converter is installed, but command-line conversion is not available here." >&2
  echo "Open $INPUT and export $OUTPUT." >&2
  exit 1
else
  echo "No command-line USDZ converter found." >&2
  echo "Install/use usdzconvert, Reality Converter, Blender USD export, or another USDZ-capable tool." >&2
  echo "Export to: $OUTPUT" >&2
  exit 1
fi

echo "Prepared USDZ: $OUTPUT"
echo "Open: $IOS_DIR/StickpersonPoser.xcodeproj"
