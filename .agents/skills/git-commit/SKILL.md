---
name: git-commit
description: >-
  Use this skill whenever the user asks to commit files, create a git commit, or save changes to version control. Ensures that before committing, the agent presents the exact commit message and explicitly lists the files that will be committed.
---

# Safe Git Commit Workflow

Follow this procedure whenever the user asks to commit changes to Git.

## Core Rule
**Never execute `git commit` silently.** Always disclose the exact commit message and the exact list of files to be committed before executing the commit.

---

## Step-by-Step Procedure

### 1. Inspect Current Git Status
Check what has changed in the working directory:
```bash
git status -s
git diff --stat
```
Identify:
- Modified files (`M`)
- Untracked / newly created files (`??` or `A`)
- Deleted files (`D`)
- Exclude any unintended scratch or temporary files.

### 2. Formulate the Commit Message
Draft a clear, concise, direct commit message starting with an imperative verb (do not prefix with `feat:`):
- Example: `Upgrade resume template to ATS-compliant single-column layout`
- Example: `Fix pagination bug in job feed`
- Example: `Refactor API route to improve performance`
- Example: `Update documentation and configuration`

### 3. Pre-Commit Disclosure (Required)
Before running `git add` and `git commit`, explicitly present to the user:
1. **Commit Message**: The exact commit message string.
2. **Files to be Committed**: A bulleted list of all files that will be staged, along with their status (e.g., `[Modified]`, `[Added]`, `[Deleted]`).

Example format:
```markdown
### Proposed Git Commit
- **Commit Message:** `Upgrade resume template to ATS-compliant single column with location field`
- **Files to be committed:**
  - `components/builder/ResumeForm.tsx` (Modified)
  - `components/builder/ResumePreview.tsx` (Modified)
  - `lib/resume-docx.ts` (Modified)
  - `lib/resume-types.ts` (Modified)
```

### 4. Stage Specific Files & Commit
Stage only the intended files (avoid `git add .` if unintended or temporary files exist):
```bash
git add <file1> <file2> ...
git commit -m "<exact message shown to user>"
```

### 5. Verify the Commit
Confirm the commit was recorded cleanly:
```bash
git log -1 --stat
git status -s
```
Report the commit hash and confirmation to the user.
