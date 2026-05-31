# Quality Assurance Command

Run systematic code quality analysis workflow to identify real-world issues affecting maintainability, production readiness, and futureproofing of the FlashForgeUI-Electron codebase.

## Workflow Phases

### Phase 1: Documentation Audit
- Invoke `code-documenter` agent to scan entire codebase
- Get list of all `.ts` files missing `@fileoverview` headers
- Capture this as the "Documentation Debt" section of the report

### Phase 2: Parallel Code Quality Analysis
Divide codebase using a **hybrid approach** (mix of directory structure + architectural layers):
1. **src/main/** - Main process core (IPC, managers, services, windows)
2. **src/renderer/src/ui/** - UI components, dialogs, settings
3. **src/renderer/src/** (non-ui) + **src/shared/** - Renderer core, shared types, utilities
4. **src/main/printer-backends/** + **src/main/services/** - Backend implementations, specialized services

Spawn **4 `code-quality-auditor` agents in parallel**, each analyzing one quadrant above. Ensure:
- No overlap between agents
- Focus on **real-world production issues only**:
  - Type safety violations (missing types, improper `any` usage)
  - SOLID/DRY/KISS/YAGNI violations that impact maintainability
  - Security vulnerabilities (XSS, IPC injection, unsafe patterns)
  - Error handling gaps (silent failures, missing error paths)
  - Architectural inconsistencies (duplicated logic, coupling issues)
  - Hardcoded CSS (theme system violations)
- **Ignore** nitpicky style issues, minor formatting, or trivial preferences
- Wait for all 4 agents to complete before proceeding

Continue spawning additional groups of 4 agents until the entire codebase is thoroughly reviewed. No corner cutting.

### Phase 3: Initial Report Compilation
Compile all findings from Phase 2 agents into a structured initial report with:
- Issue summary by category
- File locations with line numbers
- Brief description of each issue
- Agent attribution (which agent found what)

### Phase 4: Senior Engineer Triage
Invoke `senior-engineer` agent to:
1. Analyze all compiled issues
2. **Triage by severity**:
   - **CRITICAL**: Security vulnerabilities, data loss risks, crashes
   - **HIGH**: Type safety breaks, architectural violations, maintenance blockers
   - **MEDIUM**: Code quality issues, minor violations, technical debt
   - **LOW**: Nice-to-have improvements, documentation gaps
3. **Prioritize fixes**: Order issues within each severity by impact + effort
4. **Route to specialists**:
   - `electron-engineer` → Most issues (main process, IPC, windows, security)
   - `senior-engineer` → Complex architectural decisions, multi-file refactoring
   - `vite-engineer` → Build system, electron-vite, HMR, compilation issues
   - `go2rtc-engineer` → Camera streaming, go2rtc integration, port allocation

### Phase 5: Final Report Generation
Create **qa-report-[TIMESTAMP].md** in repository root with:

```markdown
# Code Quality Analysis Report
**Generated**: [TIMESTAMP]
**Analyzed**: [X] files across [Y] directories

## Executive Summary
- Total Issues Found: [X]
- Critical: [X] | High: [X] | Medium: [X] | Low: [X]
- Files Missing @fileoverview: [X]

## Severity Breakdown

### 🔴 CRITICAL ([X] issues)
[List issues requiring immediate attention]

### 🟠 HIGH ([X] issues)
[List issues impacting production readiness]

### 🟡 MEDIUM ([X] issues)
[List technical debt items]

### 🟢 LOW ([X] issues)
[List nice-to-have improvements]

## Documentation Debt
[Files missing @fileoverview from Phase 1]

## Routing Recommendations
[Which issues go to which specialist agents]

## Next Steps
[Recommended action order, considering dependencies and risk]
```

## Important Constraints

1. **Speed + Efficiency**: Run agents in parallel where possible. Minimize sequential waiting.
2. **Real-World Focus**: Ignore trivial nitpicks. Only surface issues that genuinely impact production software.
3. **No Breaking Changes**: The goal is identification and triage, not remediation. Flag potential regressions in the report.
4. **Futureproofing**: Prioritize issues that make the codebase harder to maintain or extend (tight coupling, duplication, missing types).
5. **Complete Coverage**: Every `.ts` file in `src/` should be reviewed. Skip `node_modules/`, `dist/`, `out/`.

## Completion

The command is complete when:
1. All 4+ code-quality-auditor agents have finished
2. Senior engineer has triaged and prioritized all issues
3. Routing recommendations are clear
4. qa-report-[TIMESTAMP].md is written to repo root
5. A summary is displayed in chat with top 5 issues to address

**STOP after generating the report**. Do not attempt fixes. The user will review the report and decide on bulk remediation actions.
