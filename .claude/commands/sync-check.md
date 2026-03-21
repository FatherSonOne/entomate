---
name: sync-check
description: Show recent git commits and changes so you can sync up when switching workstations
allowed-tools:
  - Bash
  - Read
---

<objective>
Pull the latest git state and display recent commits with file changes so you can confirm you're working from the same point across workstations.
</objective>

<process>
Run the following steps in order:

1. **Fetch latest from remote** (non-destructive, no merge):
   ```
   git fetch origin
   ```

2. **Show current branch and sync status** vs origin:
   ```
   git status -sb
   ```

3. **List the last 15 commits** with date, author, hash, and subject:
   ```
   git log --oneline --decorate --graph -15 --format="%C(yellow)%h%C(reset) %C(cyan)%cd%C(reset) %C(green)%an%C(reset) — %s %C(dim)%d%C(reset)" --date=short
   ```

4. **Show files changed in the last commit**:
   ```
   git diff-tree --no-commit-id -r --name-status HEAD
   ```

5. **Check for any uncommitted local changes**:
   ```
   git status --short
   ```

6. **Report any divergence** between local and origin/HEAD using:
   ```
   git rev-list --left-right --count HEAD...origin/$(git rev-parse --abbrev-ref HEAD) 2>/dev/null
   ```

Then present the results clearly with:

- Current branch name
- Whether local is ahead, behind, or in sync with remote
- Numbered list of recent commits (newest first) with: short hash, date, message
- Files changed in the most recent commit
- Any unstaged/uncommitted local changes (warn if present)
- A clear "SAFE TO WORK FROM" or "ACTION NEEDED" status line at the end

If local is **behind** remote, recommend: `git pull origin <branch>`
If local has **uncommitted changes**, warn the user before switching workstations.
If local is **ahead** of remote, recommend: push before switching.
</process>
