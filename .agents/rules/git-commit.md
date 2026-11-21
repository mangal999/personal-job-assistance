---
trigger: model_decision
description: Enforce displaying exact commit message and file list before any git commit is performed.
---

# Git Commit Rules

Whenever committing changes to git:
1. Always present the **exact commit message** and **full list of files to be committed** to the user before running `git commit`.
2. Do not commit silently.
3. Refer to the `git-commit` skill instructions in `.agents/skills/git-commit/SKILL.md`.
