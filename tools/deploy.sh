#!/bin/zsh
# Deploy the site to namastesano.com over rsync.
#
# Usage: tools/deploy.sh [-n] [--allow-dirty]
#   -n             dry run: show what would change without uploading
#   --allow-dirty  deploy even with uncommitted changes in the working tree
#
# Connection details live in the "sano-deploy" alias in ~/.ssh/config (key
# auth) — nothing sensitive is stored in the repo. To set up a new machine:
#   Host sano-deploy
#       HostName namastesano.com
#       User <user>
set -euo pipefail
cd "$(dirname "$0")/.."

# Path is relative to the remote home directory.
DEST='sano-deploy:namastesano.com'
DRY=()
ALLOW_DIRTY=0
for arg in "$@"; do
	case "$arg" in
		-n) DRY=(--dry-run) ;;
		--allow-dirty) ALLOW_DIRTY=1 ;;
	esac
done

# Deploy ships the working tree as-is (committed or not), so guard against
# shipping accidental edits: refuse a dirty tree unless it's a dry run or
# --allow-dirty. Only tracked modifications block; untracked files are ignored.
if [[ ${#DRY[@]} -eq 0 && $ALLOW_DIRTY -eq 0 ]] && ! git diff --quiet HEAD; then
	echo "Refusing to deploy: working tree has uncommitted changes." >&2
	git status --short >&2
	echo "Commit them, or re-run with --allow-dirty to ship the tree as-is." >&2
	exit 1
fi

# No stamping here: `npm run stamp` is a pre-commit step and `npm run check`
# verifies the ?v= hashes are current, so the committed tree is ship-ready and
# deploy is a pure transfer.
#
# --no-times: the host resets mtimes, so sync on checksum instead.
exec rsync "${DRY[@]}" --recursive --links --checksum --no-times --compress \
	--itemize-changes \
	index.html .htaccess favicon.svg apple-touch-icon.png icon-192.png icon-512.png icon-512-maskable.png \
	manifest.json sw.js css js fonts api \
	"$DEST/"
