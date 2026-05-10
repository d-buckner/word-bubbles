#!/usr/bin/env bash
# Downloads the ENABLE word list (~172k common English words, public domain)
# Run once from the project root: bash scripts/download-words.sh

set -euo pipefail

DEST="public/words.txt"

echo "Downloading ENABLE word list..."
curl -fsSL "https://raw.githubusercontent.com/dolph/dictionary/master/enable1.txt" -o "$DEST"

COUNT=$(wc -l < "$DEST" | tr -d ' ')
echo "Done. $COUNT words saved to $DEST"
