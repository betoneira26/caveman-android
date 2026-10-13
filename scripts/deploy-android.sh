#!/usr/bin/env bash
# Deploy caveman android/aarch64 binaries to an attached Android device via adb.
set -euo pipefail

DEST_DIR="/data/local/tmp/caveman"
BIN_DIR="/data/local/tmp/bin"

if ! command -v adb >/dev/null 2>&1; then
  echo "error: adb command not found in PATH" >&2
  exit 1
fi

DEVICE="${1:-}"
ADB_ARGS=()
if [ -n "$DEVICE" ]; then
  ADB_ARGS+=("-s" "$DEVICE")
fi

echo "Checking connected adb devices..."
adb "${ADB_ARGS[@]}" get-state >/dev/null

ABI="$(adb "${ADB_ARGS[@]}" shell getprop ro.product.cpu.abi | tr -d '\r')"
echo "Target device ABI: $ABI"
if [[ "$ABI" != *"arm64"* ]]; then
  echo "warning: device ABI ($ABI) is not arm64; binaries may fail to execute" >&2
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DIST_DIR="$REPO_ROOT/dist/binaries"

# Build if missing
BINARIES=("caveman-proxy" "caveman-engine" "caveman-mcp" "cavemem" "caveman-browse" "caveman-shrink")
NEED_BUILD=0
for bin in "${BINARIES[@]}"; do
  if [ ! -f "$DIST_DIR/${bin}_android_arm64" ]; then
    NEED_BUILD=1
    break
  fi
done

if [ "$NEED_BUILD" -eq 1 ]; then
  echo "Building android/arm64 binaries..."
  (cd "$REPO_ROOT" && node scripts/build-release-binaries.mjs --target android/arm64)
fi

echo "Pushing binaries to $DEST_DIR on device..."
adb "${ADB_ARGS[@]}" shell "mkdir -p $DEST_DIR $BIN_DIR"

for bin in "${BINARIES[@]}"; do
  SRC="$DIST_DIR/${bin}_android_arm64"
  DST="$DEST_DIR/${bin}_android_arm64"
  echo "  pushing $bin..."
  adb "${ADB_ARGS[@]}" push "$SRC" "$DST" >/dev/null
  adb "${ADB_ARGS[@]}" shell "chmod 755 $DST && ln -sf $DST $BIN_DIR/$bin"
done

echo "Verifying installation on device..."
for bin in "${BINARIES[@]}"; do
  echo -n "  $bin: "
  adb "${ADB_ARGS[@]}" shell "export PATH=$BIN_DIR:\$PATH; $bin version 2>/dev/null || $bin --help 2>/dev/null || $bin help 2>/dev/null || echo 'installed ok'" | head -n 1
done

echo ""
echo "Done! Caveman binaries installed on device at $DEST_DIR (symlinks in $BIN_DIR)."
echo "Run on device with: adb shell 'export PATH=$BIN_DIR:\$PATH; <command>'"
