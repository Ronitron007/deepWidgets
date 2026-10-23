#!/usr/bin/env bash
# Exit 0 only when the import commit equals the upstream commit in UPSTREAM.md,
# except for the deepWidgets files listed in OWN, and that commit is on master.
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel)"
REV="${1:-HEAD}"
SHA="$(git -C "$ROOT" show "$REV:UPSTREAM.md" | grep -oE '[0-9a-f]{40}' | head -1)"
REPO=deepseek-ai/deepseek-harness
OWN='UPSTREAM.md tools/verify-import.sh docs/specs/fork-trim.md docs/plans/fork-trim.md'
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
if ! STATUS="$(gh api "repos/$REPO/compare/$SHA...master" --jq .status 2>"$TMP/gh.err")"; then
  echo "verify-import: gh api compare failed for $SHA: $(head -c 300 "$TMP/gh.err")" >&2; exit 1
fi
case "$STATUS" in
  identical|ahead) ;;
  *) echo "verify-import: $SHA is not on $REPO master (compare status: ${STATUS:-none})" >&2; exit 1 ;;
esac
git init -q --bare "$TMP/up"
git -C "$TMP/up" fetch -q --depth 1 "https://github.com/$REPO.git" "$SHA"
git -C "$TMP/up" ls-tree -r "$SHA" > "$TMP/upstream.txt"
git -C "$ROOT" ls-tree -r "$REV" \
  | OWN="$OWN" awk -F'\t' 'BEGIN { n = split(ENVIRON["OWN"], a, " "); for (i = 1; i <= n; i++) own[a[i]] = 1 } !($2 in own)' \
  > "$TMP/ours.txt"
if diff -u "$TMP/upstream.txt" "$TMP/ours.txt" > "$TMP/diff.txt"; then
  echo "verify-import: $REV matches $SHA ($(wc -l < "$TMP/ours.txt" | tr -d ' ') entries)"
else
  echo "verify-import: $REV differs from $SHA" >&2; head -40 "$TMP/diff.txt" >&2; exit 1
fi
