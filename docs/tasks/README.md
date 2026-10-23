# Task protocol `tasks.protocol`

Each file in this folder is one task for one agent. A task implements one unit of the plan `docs/plans/fork-trim.md`. Read this file first. Then read your task file.

## Authority `tasks.protocol.authority`

- Your task file is the authority for your unit.

- The root `AGENTS.md` and the nested `CLAUDE.md` and `AGENTS.md` files come from upstream DeepSeek Harness (DSH). Use their code conventions when you edit DSH code.

- Do not follow the upstream process rules. These include PR description templates, AI usage sections, labels, `gh stack`, CI gates, release steps, upgrade guides, Agent Notes, and translations.

- When your task file and an upstream file disagree, follow your task file.

## Look Before You Build `tasks.protocol.look_before_you_build`

Before you write new code, search for code that already does the job. Search this repository first, because DSH is large. Then search maintained packages. Use what fits. If nothing fits, write one line in the PR body that says why.

## Work rules `tasks.protocol.work_rules`

- Work only in your own worktree at `.worktrees/<branch name with / replaced by ->`. Do not edit the main checkout at `~/deepWidgets`.

- Keep temporary files in `$TMPDIR/deepwidgets-<unit>/`. Do not use a folder of another task.

- Change only the files that your task names. If you must change another file, stop and report why.

- Do not delete code that the trim removes. Comment it out, and put the marker `deepwidgets-trim: <reason>` on the first commented line.

- To turn off a plugin row, set `disabled: true` on the row. Keep the row.

- Do not change the Electron version or the pnpm version.

- Do not install or upgrade global tools, for example Node, pnpm, Xcode, and Homebrew formulas. If a global tool is missing or too old, stop and report.

- Do not start background sub-agents.

- Capture the exit code of each command in your task. Commit only when every exit code is 0, unless your task says that a command must fail.

## Stop rule `tasks.protocol.stop`

When a step fails and your task gives no fallback for it, stop. Do not try other fixes. Report the command, the exit code, and the last 40 lines of output.

## Pull request `tasks.protocol.pull_request`

1. Push your branch with `git push -u origin <branch>`. Never force-push.

2. Open the PR with `gh pr create --base main --title "<unit>: <short summary>" --body-file <file>`.

3. Write the PR body in short, plain sentences. Use the sections `What`, `Check`, `Findings`, and `Base`.

4. In `Check`, paste each check command, its exit code, and its last output lines.

5. In `Base`, write the SHA of `origin/main` that you branched from.

## Review rounds `tasks.protocol.review`

The reviewer writes findings as PR comments. For each round:

1. Fix each finding in a new commit. Do not amend or rebase pushed commits.

2. Run the check of your task again.

3. Push the new commits.

4. Post one PR comment. In it, map each finding to the commit that fixes it, and paste the new check result.

## Report `tasks.protocol.report`

When you finish or stop, report in at most 200 words. Give the PR link or the stop reason, each check with its exit code, and any open question.
