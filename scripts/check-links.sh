#!/usr/bin/env bash
# Check the links in the built site (dist/) with lychee.
#
#   scripts/check-links.sh internal   # links between the site's own pages
#   scripts/check-links.sh external   # links out to other sites
#   scripts/check-links.sh manual     # list the links nothing can check
#
# Run `npm run build` first. Needs lychee on PATH
# (https://lychee.cli.rs/guides/getting-started/). Shared settings and the allowlist of
# sites that block bots live in lychee.toml. Extra arguments are passed on to
# lychee, e.g. `scripts/check-links.sh external --format markdown --output report.md`.
#
# Exit status for internal and external is lychee's: 0 when every link is
# fine, 2 when a link is broken, anything else when the check could not run.
#
# `manual` prints a Markdown checklist of the links `external` skips, with
# the pages they appear on. That is the allowlist in lychee.toml (sites that
# answer a bot the same way for a live page and a dead one) plus the few
# hosts lychee never checks, such as example.com. A person has to open them. It exits 0 unless the list could not be produced.
set -euo pipefail

mode=${1:-}
[ "$#" -gt 0 ] && shift

cd "$(dirname "$0")/.."
self="$PWD/scripts/check-links.sh"

if [ ! -f dist/index.html ]; then
  echo 'dist/ is missing or empty; run `npm run build` first.' >&2
  exit 1
fi
if ! command -v lychee >/dev/null; then
  echo 'lychee is not installed; see https://lychee.cli.rs/guides/getting-started/' >&2
  exit 1
fi

dist="$PWD/dist"
# dist/ as a file:// URL, percent-encoded so a checkout path with spaces or
# other URL-special characters still makes a valid --remap target.
dist_url=$(node -e 'console.log(require("node:url").pathToFileURL(process.argv[1]).href)' "$dist")

case "$mode" in
  internal)
    # Offline: nothing leaves the machine, so this is fast and cannot flake.
    # Root-relative links resolve against dist/, a link to a directory must
    # find its index.html (what nginx serves), and #fragments must match an id
    # on the target page. Absolute https://chsmesh.org/ URLs (canonical links
    # and the sitemap) are mapped onto dist/ too, so they are checked against
    # this build rather than whatever is live. lychee does not read
    # <meta content>, so Open Graph URLs (og:image, og:url) are not covered.
    exec lychee --offline \
      --root-dir "$dist" \
      --index-files index.html \
      --include-fragments \
      --remap "^https://chsmesh\\.org/(.*)\$ $dist_url/\$1" \
      "$@" \
      'dist/**/*.html' 'dist/*.xml'
    ;;
  external)
    # Only http(s) links, and not the site's own URLs: `internal` covers those
    # against the build, and a page added by this change is not live yet.
    exec lychee \
      --root-dir "$dist" \
      --scheme https --scheme http \
      --exclude '^https://chsmesh\.org(/|$)' \
      "$@" \
      'dist/**/*.html'
    ;;
  manual)
    # lychee names the links it skipped only in its verbose JSON report, so
    # run the external check for that report and keep just the skipped
    # links. Broken links found on the way (exit 2) are `external`'s business.
    report=$(mktemp)
    log=$(mktemp)
    trap 'rm -f "$report" "$log"' EXIT
    status=0
    "$self" external --format json --verbose --output "$report" >"$log" 2>&1 || status=$?
    case "$status" in
      0|2) ;;
      *) cat "$log" >&2; echo "lychee could not run (exit $status)." >&2; exit "$status" ;;
    esac
    node scripts/link-review-checklist.mjs "$report"
    ;;
  *)
    echo "usage: $0 internal|external [lychee options]" >&2
    echo "       $0 manual" >&2
    exit 64
    ;;
esac
