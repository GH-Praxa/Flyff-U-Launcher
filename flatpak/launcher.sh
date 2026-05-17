#!/bin/sh
# Flatpak-Entry-Point fuer den Fork-Build. Setzt Ozone-Hint + reicht alle
# Argumente an die gepackte Electron-Binary durch.
exec zypak-wrapper /app/lib/flyff-steamdeck-fork-v1/Flyff-U-Launcher "$@"
