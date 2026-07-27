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

# Apache config is invisible to every other tier — `php -S` ignores .htaccess, so a
# dropped directive here shows up only as a live exposure. Assert the security-critical
# ones survive any future rewrite of these files.
echo "==> Security directives"
# Comments are stripped first: a commented-out directive must fail the check, and a
# plain substring grep would happily match "# Options -Indexes".
root_active=$(grep -v '^[[:space:]]*#' .htaccess)
api_active=$(grep -v '^[[:space:]]*#' api/.htaccess)
for d in "Options -Indexes" "Content-Security-Policy" "X-Content-Type-Options" "Strict-Transport-Security"; do
	case "$root_active" in
	*"$d"*) ;;
	*)
		echo "  missing from .htaccess: $d" >&2
		exit 1
		;;
	esac
done
case "$api_active" in
*"Require all denied"*) ;;
*)
	echo "  api/.htaccess no longer denies lib.php" >&2
	exit 1
	;;
esac
echo "  ok"

echo "Static checks passed."
