#!/bin/sh
# Single entry point for the sano test suite — layered tiers, one command.
# Default (no flags) runs every locally-runnable tier; pass flags to pick tiers.
#
#   tools/test.sh            # static + unit + data + api + ui  (the full local suite)
#   tools/test.sh --unit     # node:test pure-logic tests
#   tools/test.sh --data     # node:test content-integrity tests
#   tools/test.sh --api      # PHP pure-helper checks + Playwright api/ guard specs
#   tools/test.sh --static   # Prettier / asset stamps / php -l / node --check (via check.sh)
#   tools/test.sh --ui       # headless-Chrome viewport layout (Playwright e2e arrives in Phase 3)
#
# node:test is invoked with explicit file globs (the shell expands them) because Node's
# bare-directory test discovery differs across the project's Node versions (20 in CI, 26
# locally). The Playwright api specs run WITHOUT a sano-config.php, so they assert only
# pre-DB guards; DB-backed integration specs are gated on SANO_TEST_DB.
set -eu
cd "$(dirname "$0")/.."

want_static=0 want_unit=0 want_data=0 want_api=0 want_ui=0 explicit=0
for arg in "$@"; do
	case "$arg" in
		--static) want_static=1 explicit=1 ;;
		--unit) want_unit=1 explicit=1 ;;
		--data) want_data=1 explicit=1 ;;
		--api) want_api=1 explicit=1 ;;
		--ui) want_ui=1 explicit=1 ;;
		-h | --help)
			sed -n '2,15p' "$0"
			exit 0
			;;
		*)
			echo "test.sh: unknown flag '$arg' (try --help)" >&2
			exit 2
			;;
	esac
done
if [ "$explicit" -eq 0 ]; then
	want_static=1
	want_unit=1
	want_data=1
	want_api=1
	want_ui=1
fi

if [ "$want_static" -eq 1 ]; then
	echo "==> Static checks"
	tools/check.sh --no-viewports
fi
if [ "$want_unit" -eq 1 ]; then
	echo "==> Unit (pure logic)"
	node --test tests/unit/*.test.mjs
fi
if [ "$want_data" -eq 1 ]; then
	echo "==> Data integrity"
	node --test tests/data/*.test.mjs
fi
if [ "$want_api" -eq 1 ]; then
	echo "==> API (PHP helpers + Playwright guards)"
	php tests/api/helpers.test.php
	npx playwright test tests/api
fi
if [ "$want_ui" -eq 1 ]; then
	echo "==> UI layout (headless Chrome)"
	node tools/check-viewports.mjs
fi
echo "test.sh: all requested tiers passed."
