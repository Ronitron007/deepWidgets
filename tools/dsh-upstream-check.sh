#!/usr/bin/env bash
# Report upstream DSH changes in the parts deepWidgets uses (plan upstream_sync.plan).
# Read only on this repository: it fetches FORK_REF into the upstream clone and writes only under WORK.
# Usage: tools/dsh-upstream-check.sh [fork-ref] [upstream-base] [upstream-head]
#   fork-ref       default refs/remotes/origin/main
#   upstream-base  default: the upstream SHA named in the subject of the vendor branch tip (origin/rohan/dsh-upstream)
#   upstream-head  default master
# WORK (env DSH_UPSTREAM_WORK, default $TMPDIR/upstream-dsh) holds the upstream clone (repo/).
# Each run writes a new output folder WORK/out-<UTC time>, so it never overwrites an earlier report.
set -euo pipefail
FORK=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
FORK_REF=${1:-refs/remotes/origin/main}
VENDOR=refs/remotes/origin/rohan/dsh-upstream
BASE=${2:-$(git -C "$FORK" log -1 --format=%s "$VENDOR" | grep -oE '\b[0-9a-f]{7,40}\b' | head -1)}
HEAD=${3:-master}
[ -n "$BASE" ] || { echo "dsh-upstream-check: no upstream base; pass it or fetch $VENDOR" >&2; exit 1; }
HERE=$(cd "$(dirname "$0")/dsh-upstream" && pwd)
WORK=${DSH_UPSTREAM_WORK:-${TMPDIR:-/tmp}/upstream-dsh}; REPO=$WORK/repo; OUT=$WORK/out-$(date -u +%Y%m%dT%H%M%SZ)
URL=https://github.com/deepseek-ai/deepseek-harness
mkdir -p "$OUT"
[ -d "$REPO/.git" ] || git clone --quiet "$URL" "$REPO"
git -C "$REPO" fetch --quiet --tags origin
git -C "$REPO" remote get-url fork >/dev/null 2>&1 || git -C "$REPO" remote add fork "$FORK"
git -C "$REPO" fetch --quiet fork "+$FORK_REF:refs/fork/head"
HEAD=$(git -C "$REPO" rev-parse "origin/$HEAD" 2>/dev/null || git -C "$REPO" rev-parse "$HEAD")
# 1. Kept rows to package folders, read from the fork tree at FORK_REF.
TREE=$(mktemp -d); trap 'rm -rf "$TREE"' EXIT
git -C "$REPO" archive refs/fork/head packages/bundle deepwidgets | tar -x -C "$TREE"
git -C "$REPO" archive refs/fork/head -- '*package.json' | tar -x -C "$TREE" 2>/dev/null || true
(cd "$TREE" && git init -q && git add -A >/dev/null 2>&1) || true
python3 -I "$HERE/map_rows.py" "$TREE" > "$OUT/rows-map.tsv"
{ cut -f4 "$OUT/rows-map.tsv" | sed 's/  (subpath.*//' | grep -v -E '^(\?|deepwidgets/)' ; grep -v '^#' "$HERE/extras.txt"; } | sort -u > "$OUT/watched.txt"
# 2. One line per upstream PR that touches a watched folder.
python3 -I "$HERE/upstream_changes.py" "$REPO" "$BASE" "$HEAD" "$OUT/watched.txt" refs/fork/head > "$OUT/changes.tsv"
# 3. Effective change per watched folder (net diff, ignores commits already in BASE).
while read -r p; do s=$(git -C "$REPO" diff --shortstat "$BASE" "$HEAD" -- "$p" ":(exclude)$p/**/*.md" ":(exclude)$p/**/README.i18n.yaml" ":(exclude)$p/package.json"); [ -n "$s" ] && printf '%s\t%s\n' "$p" "$s"; done < "$OUT/watched.txt" > "$OUT/net-diff.tsv"
# 4. Simulated merge of upstream into the fork; lists files with conflicts.
git -C "$REPO" merge-tree --write-tree --name-only --no-messages --merge-base="$BASE" "$HEAD" refs/fork/head | tail -n +2 > "$OUT/conflicts.txt" || true
# 5. Branch age at merge for each first-parent commit.
git -C "$REPO" log --first-parent --format='%H %cI' "$BASE..$HEAD" | while read -r sha d; do
  if p2=$(git -C "$REPO" rev-parse -q --verify "$sha^2"); then old=$(git -C "$REPO" log --format=%aI "$sha^1..$p2" | sort | head -1); else old=$(git -C "$REPO" log -1 --format=%aI "$sha"); fi
  printf '%s\t%s\t%s\n' "${sha:0:10}" "$d" "$old"; done > "$OUT/ages.tsv"
echo "range $BASE..$HEAD: $(git -C "$REPO" rev-list --count "$BASE..$HEAD") commits, $(git -C "$REPO" rev-list --count --first-parent "$BASE..$HEAD") first-parent"
echo "PRs touching watched folders: $(wc -l < "$OUT/changes.tsv")"
echo "watched folders with a net change: $(wc -l < "$OUT/net-diff.tsv") of $(wc -l < "$OUT/watched.txt")"
echo "conflicting files: $(wc -l < "$OUT/conflicts.txt")"
echo "output: $OUT"
