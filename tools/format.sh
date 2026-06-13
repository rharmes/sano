#!/bin/sh
# Run Prettier over all HTML, CSS, JS, and PHP in the project.
# `tools/format.sh`         → rewrites files in place.
# `tools/format.sh --check` → exits non-zero if anything would change (CI/preflight).
#
# Prettier and @prettier/plugin-php come from the devDependencies in package.json;
# run `npm install` once on a fresh clone.
set -eu

cd "$(dirname "$0")/.."

if [ ! -d node_modules/prettier ] || [ ! -d node_modules/@prettier/plugin-php ]; then
	echo "node_modules missing; run \`npm install\` first" >&2
	exit 1
fi

MODE="--write"
if [ "${1:-}" = "--check" ]; then
	MODE="--check"
fi

# Explicit globs so the file set is obvious; .prettierignore handles exclusions.
exec ./node_modules/.bin/prettier \
	--plugin ./node_modules/@prettier/plugin-php/standalone.js \
	"$MODE" \
	'**/*.html' \
	'**/*.css' \
	'**/*.{js,mjs}' \
	'**/*.php'
