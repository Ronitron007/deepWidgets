#!/bin/sh
# PostToolUse and PostToolUseFailure hook for Bash. After a new commit in a deepWidgets
# worktree, tell the agent about the head-node rule in CLAUDE.md.
# Prints nothing, and exits 0, in every other case. It never blocks a tool call.

input=$(cat)
cmd=$(printf '%s' "$input" | jq -r '.tool_input.command // ""' 2>/dev/null) || exit 0
printf '%s' "$cmd" | grep -Eq '(^|[^[:alnum:]_-])git([[:space:]][^;&|]*)?[[:space:]]commit([[:space:]]|$)' || exit 0

dir=$(printf '%s' "$input" | jq -r '.cwd // "."' 2>/dev/null)
event=$(printf '%s' "$input" | jq -r '.hook_event_name // "PostToolUse"' 2>/dev/null)
duration_ms=$(printf '%s' "$input" | jq -r '.duration_ms // 120000 | floor' 2>/dev/null) || duration_ms=120000

# The command can commit in any worktree (cd, git -C, a shell variable), so take the newest HEAD of all of them.
worktrees=$(git -C "$dir" worktree list --porcelain 2>/dev/null | sed -n 's/^worktree //p')
[ -n "$worktrees" ] || worktrees=$(git -C "${CLAUDE_PROJECT_DIR:-.}" worktree list --porcelain 2>/dev/null | sed -n 's/^worktree //p')
[ -n "$worktrees" ] || exit 0
best=
best_time=0
while IFS= read -r worktree; do
  time=$(git -C "$worktree" log -1 --format=%ct 2>/dev/null) || continue
  [ "$time" -gt "$best_time" ] && { best_time=$time; best=$worktree; }
done <<EOF
$worktrees
EOF

# Only a commit made while this command ran counts, plus 5 s for clock rounding. This keeps a
# commit by another agent in another worktree out. Without duration_ms, the window is 120 s.
[ -n "$best" ] && [ $(( $(date +%s) - best_time )) -le $(( duration_ms / 1000 + 5 )) ] || exit 0
git -C "$best" show HEAD:CLAUDE.md 2>/dev/null | head -n 1 | grep -q '^# deepWidgets' || exit 0

files=$(git -C "$best" show --name-only --format= HEAD 2>/dev/null)
printf '%s\n' "$files" | grep -Evq '^(CLAUDE\.md|AGENTS\.md)?$' || exit 0

sha=$(git -C "$best" rev-parse --short HEAD)
list=$(printf '%s\n' "$files" | head -n 15 | tr '\n' ' ')
jq -n --arg event "$event" --arg sha "$sha" --arg files "$list" '{hookSpecificOutput: {hookEventName: $event, additionalContext: ("deepWidgets head-node hook: commit " + $sha + " changed these files: " + $files + ". The rule head.rules in the root CLAUDE.md asks agents to keep CLAUDE.md current. If this commit makes a fact in CLAUDE.md wrong or missing, follow that rule.")}}'
