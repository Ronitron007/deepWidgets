#!/bin/sh
# PostToolUse hook for Bash. After a new commit, ask the agent to check the head node (CLAUDE.md).
# Prints nothing, and exits 0, in every other case. It never blocks a tool call.

input=$(cat)
cmd=$(printf '%s' "$input" | jq -r '.tool_input.command // ""' 2>/dev/null) || exit 0
printf '%s' "$cmd" | grep -Eq '(^|[^[:alnum:]_-])git([[:space:]]+-C[[:space:]]+[^[:space:]]+)*[[:space:]]+commit([[:space:]]|$)' || exit 0

dir=$(printf '%s' "$input" | jq -r '.cwd // "."' 2>/dev/null)
target=$(printf '%s' "$cmd" | sed -nE 's/.*git[[:space:]]+-C[[:space:]]+"?([^"[:space:]]+)"?[[:space:]]+commit.*/\1/p' | head -n 1)
case "$target" in
  '') ;;
  /*) dir=$target ;;
  *) dir="$dir/$target" ;;
esac

# Only a commit from the last 2 minutes counts. A failed commit leaves an older HEAD.
committed=$(git -C "$dir" log -1 --format=%ct 2>/dev/null) || exit 0
[ $(( $(date +%s) - committed )) -le 120 ] || exit 0

files=$(git -C "$dir" show --name-only --format= HEAD 2>/dev/null)
printf '%s\n' "$files" | grep -Evq '^(CLAUDE\.md|AGENTS\.md)?$' || exit 0

list=$(printf '%s\n' "$files" | head -n 15 | tr '\n' ' ')
jq -n --arg files "$list" '{hookSpecificOutput: {hookEventName: "PostToolUse", additionalContext: ("A commit just landed. Files: " + $files + "\nCheck the head node, the root CLAUDE.md. If this commit makes one of its facts wrong or missing (status, what runs, the trim rule, our own code, the skills table), update CLAUDE.md in a new commit. If your task file does not name CLAUDE.md, do not edit it: write the proposed change under Findings in your PR body. If nothing in the head node changes, do nothing and do not mention this reminder.")}}'
