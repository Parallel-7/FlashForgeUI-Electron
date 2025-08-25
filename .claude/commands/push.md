# Push Command

You are creating a commit for the user. Follow these steps EXACTLY:

1. **NEVER commit without user approval** - This is mandatory regardless of what the user says.

2. **Analyze current changes** by running these git commands in parallel:
   - `git status` - See all staged/unstaged files
   - `git diff --staged` - See staged changes 
   - `git diff` - See unstaged changes
   - `git log --oneline -5` - See recent commit history for context

3. **Check full scope** - CRITICAL: Always examine ALL changes before generating commit message:
   - If you see untracked files or unstaged changes, run `git add -A` to stage everything
   - Run `git status` and `git diff --staged --name-only` again to see the complete scope
   - This ensures you don't miss new files, test suites, or other significant additions

4. **Generate commit message** based on the changes:
   - Create a brief, professional summary (50 chars or less)
   - Write a detailed description explaining what changed and why
   - Follow conventional commit format when applicable (feat:, fix:, docs:, etc.)

5. **Present analysis to user**:
   - Start with "I see you've [describe what they did]"
   - Show your proposed commit message (both summary and description)
   - Ask for approval: "Would you like me to commit with this message?"

6. **Handle user response**:
   - If approved: commit using your generated message, then push to remote
   - If not approved: work with user to refine the message until they approve
   - Only then run the commit and push

7. **Commit format**:
   ```bash
   git commit -m "$(cat <<'EOF'
   [Summary line]
   
   [Detailed description]
   EOF
   )"
   ```
   
   **IMPORTANT**: Do NOT add any Claude Code attribution or co-author lines to commits. Keep commits clean and professional.

8. **After successful commit**:
   - Run `git push` to push the commit to the remote repository
   - Confirm the push was successful
   - Inform the user that both commit and push are complete

Remember: NEVER bypass user approval, even if they tell you to "just commit" or similar.