#!/usr/bin/env bash
# Baut den Steam-Deck-Fork als Flatpak-Bundle mit fork-eigener Versionierung.
#
# Ablauf:
#  1. electron-forge package → app/out/Flyff-U-Launcher-linux-x64/
#  2. flatpak-builder konsumiert dieses Verzeichnis und baut die .flatpak-Datei
#
# Voraussetzungen (lokal):
#   System-Pakete: flatpak
#   Flatpak-Apps:
#     flatpak install --user -y flathub org.flatpak.Builder \
#         org.freedesktop.Platform//25.08 \
#         org.freedesktop.Sdk//25.08 \
#         org.electronjs.Electron2.BaseApp//25.08
#   (Das Skript nutzt `flatpak run org.flatpak.Builder` — kein system-weites
#    flatpak-builder noetig. Fallback auf system-`flatpak-builder` wenn vorhanden.)
#
# Bundle-Output: dist/flyff-steamdeck-fork-v<N>.flatpak
# Standard-Version "1"; ueberschreibbar via Argument: ./build-flatpak.sh 2

set -euo pipefail

FORK_VERSION="${1:-1}"
APP_ID="local.praxa.flyff_steamdeck_fork_v1"
BUNDLE_NAME="flyff-steamdeck-fork-v${FORK_VERSION}.flatpak"

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
APP_DIR="${ROOT_DIR}/app"
FLATPAK_DIR="${ROOT_DIR}/flatpak"
DIST_DIR="${ROOT_DIR}/dist"
BUILD_DIR="${FLATPAK_DIR}/.flatpak-build"
REPO_DIR="${FLATPAK_DIR}/.flatpak-repo"

mkdir -p "${DIST_DIR}"

echo "→ Step 1/2: electron-forge package (Linux x64)"
cd "${APP_DIR}"
npx electron-forge package --arch=x64 --platform=linux

if [[ ! -d "${APP_DIR}/out/Flyff-U-Launcher-linux-x64" ]]; then
  echo "FEHLER: Forge-Output fehlt unter ${APP_DIR}/out/Flyff-U-Launcher-linux-x64"
  exit 1
fi

echo "→ Step 2/2: flatpak-builder (Fork-Version ${FORK_VERSION})"
cd "${FLATPAK_DIR}"
rm -rf "${BUILD_DIR}" "${REPO_DIR}"

# Prefer system-`flatpak-builder` wenn installiert; sonst die Flathub-Variante
# `org.flatpak.Builder` als Flatpak-App. Letztere braucht --filesystem-Zugriff
# auf das Source-Verzeichnis (Build-Dir + Output-Dir).
if command -v flatpak-builder >/dev/null 2>&1; then
  BUILDER_CMD=(flatpak-builder)
else
  BUILDER_CMD=(flatpak run --filesystem="${ROOT_DIR}" org.flatpak.Builder)
fi

"${BUILDER_CMD[@]}" \
  --force-clean \
  --user \
  --install-deps-from=flathub \
  --repo="${REPO_DIR}" \
  --default-branch="v${FORK_VERSION}" \
  "${BUILD_DIR}" \
  "${APP_ID}.yml"

flatpak build-bundle \
  "${REPO_DIR}" \
  "${DIST_DIR}/${BUNDLE_NAME}" \
  "${APP_ID}" \
  "v${FORK_VERSION}"

echo ""
echo "Fertig: ${DIST_DIR}/${BUNDLE_NAME}"
echo ""
echo "Installation:"
echo "  flatpak install --user ${DIST_DIR}/${BUNDLE_NAME}"
echo ""
echo "Starten:"
echo "  flatpak run ${APP_ID}"
