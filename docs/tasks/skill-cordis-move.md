# Task `skill.cordis_move`

Read `docs/tasks/README.md` first. It holds the rules for every task.

## Goal `skill.cordis_move.goal`

Add the Cordis skill to this repository at `.agents/skills/cordis/`. In this repository, `.claude/skills` is a symbolic link to `../.agents/skills`. So Claude Code then finds the skill as `.claude/skills/cordis/`.

This task can run at the same time as `fork.baseline`. The two tasks change different files.

## Setup `skill.cordis_move.setup`

| Item | Value |
|---|---|
| Base | `origin/main`. It must contain commit `1968e927`. |
| Branch | `rohan/skill-cordis-move` |
| Worktree | `~/deepWidgets/.worktrees/rohan-skill-cordis-move` |
| Temporary files | `$TMPDIR/deepwidgets-skill-cordis-move/` |
| Source | the 17 files under `.claude/skills/cordis/` in local commit `4d34ec5` |

```bash
git -C ~/deepWidgets fetch origin
git -C ~/deepWidgets merge-base --is-ancestor 1968e927 origin/main
git -C ~/deepWidgets cat-file -e 4d34ec5
git -C ~/deepWidgets worktree add -b rohan/skill-cordis-move .worktrees/rohan-skill-cordis-move origin/main
```

If the second or third command exits with a code other than 0, stop.

## Steps `skill.cordis_move.steps`

1. Copy the source files into the worktree:

   ```bash
   cd ~/deepWidgets/.worktrees/rohan-skill-cordis-move
   mkdir -p .agents/skills/cordis
   git -C ~/deepWidgets archive 4d34ec5 .claude/skills/cordis | tar -x --strip-components 3 -C .agents/skills/cordis
   ```

2. Run `find .agents/skills/cordis -type f | wc -l`. It must print `17`.

3. In `.agents/skills/cordis/SKILL.md`, delete the line under `## Guardrails` that names `GLUE.md` and `src/glue.ts`. Those files are not in this repository. Change nothing else.

4. Run the check.

## Check `skill.cordis_move.check`

```bash
test -f .claude/skills/cordis/SKILL.md ; echo "link exit=$?"            # must print exit=0
grep -rn -i "glue" .agents/skills/cordis ; echo "glue exit=$?"          # must print exit=1
for f in $(git -C ~/deepWidgets ls-tree -r --name-only 4d34ec5 .claude/skills/cordis); do
  rel=${f#.claude/skills/cordis/}
  [ "$rel" = SKILL.md ] && continue
  cmp -s <(git -C ~/deepWidgets show 4d34ec5:"$f") ".agents/skills/cordis/$rel" || echo "differs: $rel"
done ; echo "copy loop done"                                              # must print no "differs" line
git diff --no-index --stat <(git -C ~/deepWidgets show 4d34ec5:.claude/skills/cordis/SKILL.md) .agents/skills/cordis/SKILL.md
                                                                          # must show 1 deletion and 0 insertions
```

The last command exits 1 because the files differ. This task expects that exit code.

## Files you may change `skill.cordis_move.files`

- `.agents/skills/cordis/` (new, 17 files)

## Done when `skill.cordis_move.done`

- Every check line gives its expected output.

- `git status --short` shows only `.agents/skills/cordis/`.

- The PR is open against `main`. Its title is `skill.cordis_move: add the Cordis skill under .agents/skills`.
