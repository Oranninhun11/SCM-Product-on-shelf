#!/usr/bin/env bash
#
# push.sh — one command to ship a source edit to the live app (@HEAD / the /dev URL).
#
# The source of truth is src/ — clasp pushes each src/*.html as its own Apps Script file,
# and Code.gs stitches them back via the index.html include-manifest at request time. So the
# only step between "edited a partial" and "see it on the /dev URL" is `clasp push`. This wraps
# build (keeps the manifest in sync) + push + a timestamped confirmation, so the push can't be
# silently skipped and you can see it landed.
#
# NB: build.py is only *required* when you add / remove / reorder a partial (the MANIFEST
# changes). For a plain content edit, push alone is enough — but running build is cheap and
# idempotent, so this always does it.
#
# Usage:
#   tools/push.sh        # build index.html, push every source file to Apps Script @HEAD
#
# Then hard-refresh the /dev URL (Cmd+Shift+R). No `clasp deploy` needed for @HEAD.

set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"   # repo: product-on-shelf/
cd "$HERE"

python3 build.py                       # regenerate the include-manifest from src/ + MANIFEST
npx @google/clasp push -f              # -f skips the manifest-change confirmation prompt

echo "Pushed @HEAD at $(date '+%H:%M:%S'). Hard-refresh the /dev URL (Cmd+Shift+R)."
