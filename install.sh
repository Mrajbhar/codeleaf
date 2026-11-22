#!/bin/bash
# Codeleaf installer for macOS.
#   curl -fsSL https://raw.githubusercontent.com/Mrajbhar/codeleaf/main/install.sh | bash
# Downloads the latest release for this Mac (Apple Silicon or Intel), checks its SHA-512
# checksum and installs it into Applications. Files downloaded with curl are not marked as
# "downloaded from the internet", so macOS opens the app without the unverified-developer warning.
set -euo pipefail

REPO="Mrajbhar/codeleaf"
APP="Codeleaf.app"

if [ "$(uname)" != "Darwin" ]; then
  echo "This installer is for macOS. For Windows and Linux, download from:"
  echo "  https://github.com/$REPO/releases/latest"
  exit 1
fi

ARCH="$(uname -m)"
[ "$ARCH" = "arm64" ] || ARCH="x64"

echo "→ Looking up the latest Codeleaf release…"
API="$(curl -fsSL "https://api.github.com/repos/$REPO/releases/latest")"
URL="$(printf '%s' "$API" | grep -o "\"browser_download_url\": *\"[^\"]*-${ARCH}\.zip\"" | head -1 | sed -E 's/.*"(https[^"]+)"$/\1/')"
YML="$(printf '%s' "$API" | grep -o '"browser_download_url": *"[^"]*/latest-mac\.yml"' | head -1 | sed -E 's/.*"(https[^"]+)"$/\1/')"
if [ -z "$URL" ]; then echo "✖ Could not find a macOS ($ARCH) download in the latest release."; exit 1; fi
NAME="$(basename "$URL")"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "→ Downloading ${NAME}…"
curl -fL --progress-bar "$URL" -o "$TMP/$NAME"

if [ -n "$YML" ]; then
  EXPECTED="$(curl -fsSL "$YML" | awk -v n="$NAME" '$0 ~ "url: "n {f=1; next} f && /sha512:/ {print $2; exit}')"
  if [ -n "$EXPECTED" ]; then
    ACTUAL="$(openssl dgst -sha512 -binary "$TMP/$NAME" | openssl base64 -A)"
    if [ "$EXPECTED" != "$ACTUAL" ]; then echo "✖ Checksum mismatch — the download is damaged. Please try again."; exit 1; fi
    echo "→ Checksum verified"
  fi
fi

ditto -x -k "$TMP/$NAME" "$TMP/unpacked"
[ -d "$TMP/unpacked/$APP" ] || { echo "✖ The download did not contain $APP."; exit 1; }

DEST="${CODELEAF_INSTALL_DIR:-/Applications}"
if [ ! -w "$DEST" ]; then DEST="$HOME/Applications"; mkdir -p "$DEST"; fi

osascript -e 'quit app "Codeleaf"' >/dev/null 2>&1 || true
sleep 1
rm -rf "$DEST/$APP"
ditto "$TMP/unpacked/$APP" "$DEST/$APP"
xattr -dr com.apple.quarantine "$DEST/$APP" 2>/dev/null || true

echo "✔ Codeleaf installed in $DEST"
open "$DEST/$APP"
