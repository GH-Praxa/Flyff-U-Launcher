#!/usr/bin/env bash
# fetch-tesseract.sh — Fetch platform-specific Tesseract binaries for bundling
#
# Usage:
#   ./scripts/fetch-tesseract.sh          # auto-detect platform
#   ./scripts/fetch-tesseract.sh darwin    # force macOS
#   ./scripts/fetch-tesseract.sh linux     # force Linux
#
# The script places binaries under app/resources/tesseract/<platform>/

set -euo pipefail

PLATFORM="${1:-$(uname -s | tr '[:upper:]' '[:lower:]')}"
case "$PLATFORM" in
  darwin|Darwin)  PLATFORM="darwin" ;;
  linux|Linux)    PLATFORM="linux" ;;
  *)
    echo "Unsupported platform: $PLATFORM (use 'darwin' or 'linux')"
    exit 1
    ;;
esac

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TESS_DIR="$REPO_ROOT/app/resources/tesseract/$PLATFORM"

echo "==> Preparing Tesseract binaries for $PLATFORM in $TESS_DIR"
mkdir -p "$TESS_DIR/tessdata"

if [ "$PLATFORM" = "darwin" ]; then
  # macOS: Install via Homebrew and copy binary + libs
  if ! command -v brew &>/dev/null; then
    echo "Error: Homebrew is required. Install from https://brew.sh"
    exit 1
  fi

  if ! command -v tesseract &>/dev/null; then
    echo "==> Installing Tesseract via Homebrew..."
    brew install tesseract
  else
    echo "==> Tesseract already installed: $(which tesseract)"
  fi

  cp "$(which tesseract)" "$TESS_DIR/"
  chmod 755 "$TESS_DIR/tesseract"

  # Copy tessdata language files
  TESSDATA_SRC="$(brew --prefix)/share/tessdata"
  if [ -d "$TESSDATA_SRC" ]; then
    for lang in eng deu osd; do
      [ -f "$TESSDATA_SRC/$lang.traineddata" ] && cp "$TESSDATA_SRC/$lang.traineddata" "$TESS_DIR/tessdata/"
    done
  fi

  # Copy required dynamic libraries
  for lib in $(otool -L "$TESS_DIR/tesseract" | grep -oE '/opt/homebrew[^ ]+|/usr/local[^ ]+' | sort -u); do
    cp "$lib" "$TESS_DIR/" 2>/dev/null || true
  done

elif [ "$PLATFORM" = "linux" ]; then
  # Linux: Install via apt and copy binary + libs
  if ! command -v tesseract &>/dev/null; then
    echo "==> Installing Tesseract via apt..."
    sudo apt-get update
    sudo apt-get install -y tesseract-ocr tesseract-ocr-eng tesseract-ocr-deu
  else
    echo "==> Tesseract already installed: $(which tesseract)"
  fi

  cp "$(which tesseract)" "$TESS_DIR/"
  chmod 755 "$TESS_DIR/tesseract"

  # Copy tessdata language files
  for tessdata_dir in /usr/share/tesseract-ocr/5/tessdata /usr/share/tesseract-ocr/4.00/tessdata /usr/share/tessdata; do
    if [ -d "$tessdata_dir" ]; then
      for lang in eng deu osd; do
        [ -f "$tessdata_dir/$lang.traineddata" ] && cp "$tessdata_dir/$lang.traineddata" "$TESS_DIR/tessdata/"
      done
      break
    fi
  done

  # Copy required shared libraries (skip system essentials)
  for lib in $(ldd "$TESS_DIR/tesseract" | grep -oE '/[^ ]+' | sort -u); do
    case "$lib" in
      */libc.so*|*/libm.so*|*/libpthread*|*/libdl*|*/ld-linux*|*/librt*|*/libgcc_s*|*/libstdc++*)
        continue ;;
    esac
    cp "$lib" "$TESS_DIR/" 2>/dev/null || true
  done
fi

# Remove .gitkeep if real files now exist
rm -f "$TESS_DIR/.gitkeep"

echo "==> Done. Tesseract binaries for $PLATFORM:"
ls -la "$TESS_DIR/"
echo ""
echo "Tessdata:"
ls -la "$TESS_DIR/tessdata/"
