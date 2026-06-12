#!/bin/zsh
# Deploy the site to namastesano.com over rsync.
#
# Usage: tools/deploy.sh [-n]
#   -n  dry run: show what would change without uploading
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
[[ "${1:-}" == "-n" ]] && DRY=(--dry-run)

node tools/stamp-version.mjs

# --no-times: the host resets mtimes, so sync on checksum instead.
exec rsync "${DRY[@]}" --recursive --links --checksum --no-times --compress \
	--itemize-changes \
	index.html .htaccess favicon.svg apple-touch-icon.png css js fonts \
	"$DEST/"
