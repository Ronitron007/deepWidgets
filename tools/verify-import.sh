#!/usr/bin/env bash
# Exit 0 only when the import commit equals the upstream commit in UPSTREAM.md,
# except for the deepWidgets files listed in OWN.
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel)"
REV="${1:-HEAD}"
SHA="$(grep -oE '[0-9a-f]{40}' "$ROOT/UPSTREAM.md" | head -1)"
URL=https://github.com/deepseek-ai/deepseek-harness.git
OWN='^(UPSTREAM\.md|tools/verify-import\.sh|docs/specs/fork-trim\.md|docs/plans/fork-trim\.md)$'
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
git init -q --bare "$TMP/up"
git -C "$TMP/up" fetch -q --depth 1 "$URL" "$SHA"
git -C "$TMP/up" ls-tree -r "$SHA" > "$TMP/upstream.txt"
git -C "$ROOT" ls-tree -r "$REV" | awk -F'\t' -v own="$OWN" '$2 !~ own' > "$TMP/ours.txt"
if diff -u "$TMP/upstream.txt" "$TMP/ours.txt" > "$TMP/diff.txt"; then
  echo "verify-import: $REV matches $SHA ($(wc -l < "$TMP/ours.txt" | tr -d ' ') entries)"
else
  echo "verify-import: $REV differs from $SHA" >&2; head -40 "$TMP/diff.txt" >&2; exit 1
fi
