#!/bin/zsh
# Headless-Chrome screenshot helper with a stable command prefix, so a single
# permission allow rule (Bash(tools/screenshot.sh *)) covers every invocation.
#
# Usage: tools/screenshot.sh <url> <out.png> [WIDTHxHEIGHT] [virtual-time-budget-ms]
set -euo pipefail

CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
URL="$1"
OUT="$2"
SIZE="${3:-1180x900}"
BUDGET="${4:-6000}"

exec "$CHROME" --headless=new --disable-gpu --hide-scrollbars \
	--window-size="${SIZE/x/,}" --virtual-time-budget="$BUDGET" \
	--screenshot="$OUT" "$URL" 2>/dev/null
