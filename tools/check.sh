#!/bin/sh
# Static preflight: formatting, asset stamps, and syntax — the fast checks with no browser
# or DB. The behavior tests (unit / data / api / e2e) live in tools/test.sh. This is what
# CI's `npm run lint` runs, and what `tools/test.sh --static` calls.
set -eu
cd "$(dirname "$0")/.."

echo "==> Prettier"
tools/format.sh --check

echo "==> Asset stamps"
node tools/stamp-version.mjs --check

echo "==> PHP lint"
for f in api/*.php tools/*.php tests/api/*.php; do
	if ! php -l "$f" >/dev/null 2>&1; then
		php -l "$f" # re-run to surface the error
		exit 1
	fi
done
echo "  ok"

echo "==> JS syntax"
for f in js/*.js tools/*.mjs tests/*.mjs tests/*/*.mjs; do node --check "$f"; done
echo "  ok"

echo "Static checks passed."
