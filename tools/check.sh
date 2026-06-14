#!/bin/sh
# Preflight: every static check the project has, in one command. Run before
# committing/deploying, or in CI.
#
#   tools/check.sh                 # everything
#   tools/check.sh --no-viewports  # skip the headless-Chrome layout check (CI)
set -eu
cd "$(dirname "$0")/.."

echo "==> Prettier"
tools/format.sh --check

echo "==> PHP lint"
for f in api/*.php tools/*.php; do
	if ! php -l "$f" >/dev/null 2>&1; then
		php -l "$f" # re-run to surface the error
		exit 1
	fi
done
echo "  ok"

echo "==> JS syntax"
for f in js/*.js tools/*.mjs; do node --check "$f"; done
echo "  ok"

if [ "${1:-}" != "--no-viewports" ]; then
	echo "==> Viewport layout"
	node tools/check-viewports.mjs
fi

echo "All checks passed."
