#!/bin/sh
# Builds the Chrome Web Store and release zip: only the files the extension runs on.
cd "$(dirname "$0")" || exit 1
version=$(sed -n 's/.*"version": "\(.*\)".*/\1/p' manifest.json)
zip="$PWD/dist/hide-thumbnails-for-youtube-$version.zip"
stage=$(mktemp -d) || exit 1
trap 'rm -rf "$stage"' EXIT
cp -R manifest.json _locales background.js content.js content.css LICENSE.md icons "$stage/"
# Store installs skip the dev build check, the only user of chrome.storage, so the
# release asks for no storage permission.
sed -i '' '/^[[:space:]]*"storage",$/d' "$stage/manifest.json"
! grep -q '"storage"' "$stage/manifest.json" || { echo "package.sh: storage permission not removed" >&2; exit 1; }
mkdir -p dist
rm -f "$zip"
(cd "$stage" && zip -q -X -r "$zip" . -x '*.DS_Store')
echo "dist/hide-thumbnails-for-youtube-$version.zip"
