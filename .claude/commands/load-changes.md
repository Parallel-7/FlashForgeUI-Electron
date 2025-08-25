# Load Changes Command

## Purpose
Analyze all recent changes in the workspace/repository to quickly get up to speed with pending work. Use this after breaks, context clearing, or when returning to the project.

## Instructions
Execute the following steps to provide a comprehensive overview of recent changes:

1. **Run git analysis commands in parallel using multiple Bash tool calls:**
   - `git status` - Show all staged/unstaged files and working tree status
   - `git diff --staged` - Display staged changes ready for commit
   - `git diff` - Display unstaged changes in working directory
   - `git log --oneline -5` - Show recent 5 commit history for context

2. **Analyze and summarize:**
   - Review all command outputs to understand current state
   - Identify modified, added, or deleted files
   - Understand the scope and nature of pending changes
   - Note any patterns in the recent commit history

3. **Provide clear summary:**
   - Summarize the recent work and current changes
   - Highlight key files that have been modified
   - Mention any staged vs unstaged changes
   - Confirm understanding of current project state

## Output Format
Structure the response as:
- **Current Status:** Brief overview of working tree state
- **Staged Changes:** What's ready to be committed
- **Unstaged Changes:** What's been modified but not staged
- **Recent Activity:** Summary based on commit history
- **Summary:** Overall understanding of recent work

This helps ensure context continuity and efficient resumption of development work.