# AI Agents Guide

**ALWAYS use specialized agents proactively rather than attempting tasks directly.** The Task tool provides expert agents optimized for specific development workflows. Each agent brings deep expertise and follows established best practices for their domain.

**Important**: All agents have testing limitations and cannot run the application or perform visual testing. See Testing and Build Limitations in CLAUDE.md for details. Agents focus on code-level quality assurance through static analysis, type checking, and linting.

## Available Agents

- **general-purpose**: **Use first** for any complex, multi-step tasks, comprehensive codebase exploration, or when determining which specialized agent to use next. This agent excels at research, code searching, and orchestrating complex workflows across the entire codebase.

- **project-typescript-engineer**: **Primary agent for ALL TypeScript development work.** Never attempt to implement features, fix bugs, or refactor TypeScript code directly - always delegate to this agent. It reads reference files automatically, follows project patterns, and ensures architecture compliance. **Use immediately** for any coding task.

- **senior-typescript-reviewer**: **Mandatory final step** after any code changes. Never consider development work complete without this comprehensive review. This agent performs deep code quality analysis, security auditing, and ensures adherence to TypeScript best practices. **Always invoke** after project-typescript-engineer work.

- **codebase-explorer**: **Use proactively** before starting any significant development work to understand system architecture, data flows, and existing patterns. This agent provides crucial context that prevents architectural misalignment and helps identify integration points. **Start with this agent** for complex features or when working in unfamiliar code areas.

- **ui-design-architect**: **Essential for all UI/UX work.** Never modify dialogs, windows, components, or themes directly - this agent ensures design consistency and proper integration with existing UI patterns. **Always use** for any visual or interface changes, from minor tweaks to major redesigns. **CRITICAL REQUIREMENTS:**

  **Dual UI Mode Compliance:** All designs must work flawlessly in both "rounded" (enabled) and "square" (disabled) UI modes. The agent must test both states and ensure visual consistency.

  **Shared Template Pattern:** All dialog windows MUST use `@import url('../shared/rounded-dialog-template.css')` as the foundation. Never duplicate base styles or create standalone CSS.

  **CSS Variables System:** Use CSS variables from `CSSVariables.ts` for dynamic styling (--ui-padding, --ui-border-radius, --ui-background, etc.). Never hardcode values that should adapt to UI mode.

  **Strict CSS Rules:**
  - `!important` is **FORBIDDEN** - structure CSS properly with appropriate specificity
  - Use semantic, maintainable class hierarchies - avoid convoluted nested selectors
  - Follow existing color scheme from `:root` variables (--dark-bg, --text-color, --accent-color, etc.)

  **Reference Examples:** Study IFS dialog (`ifs-dialog.css`), Settings dialog (`settings.css`), Connect Choice dialog (`connect-choice-dialog.css`), and Main Window (`index.css`) for proper implementation patterns.

  **Component Consistency:** Maintain visual harmony with existing buttons, headers, footers, animations, and interactive states. Reuse established patterns rather than inventing new ones.

- **code-documenter**: **Use immediately** when creating new files or when encountering files lacking `@fileoverview` documentation. This agent ensures consistent documentation standards across the codebase. **Invoke automatically** after implementing new features to maintain documentation quality.

- **comprehensive-docs-generator**: **Use for knowledge preservation.** When working with complex libraries, APIs, or architectural patterns, this agent creates reference documentation for future development work. **Deploy proactively** to document integration patterns, API usage, and complex workflows for the ai_reference folder.

- **production-readiness-auditor**: **Critical for release preparation.** Use proactively after significant changes, before releases, or when build workflows fail. This agent ensures all dependencies, configurations, and build processes are production-ready. **Invoke preventively** to catch issues early.

- **electron-security-analyst**: **Essential for security assurance.** Use after implementing authentication, IPC communication, external integrations, or before releases. This agent identifies vulnerabilities, validates security patterns, and ensures Electron security best practices. **Deploy proactively** for security-critical changes.

- **ascii-diagram-designer**: **Use for architectural communication.** When explaining system relationships, data flows, or complex interactions, this agent creates clear visual representations. **Invoke when** architectural understanding is needed or when documenting complex systems.

- **statusline-setup**: Configure Claude Code status line settings
- **output-style-setup**: Create Claude Code output styles

## Mandatory Agent Workflows

**Never attempt these tasks directly - always use the prescribed agent workflows:**

- **New Feature Implementation**: codebase-explorer (understand architecture) → project-typescript-engineer (implement) → senior-typescript-reviewer (review) → code-documenter (document) → production-readiness-auditor (validate)

- **Bug Fixes**: codebase-explorer (analyze issue) → project-typescript-engineer (fix) → senior-typescript-reviewer (review) → production-readiness-auditor (ensure stability)

- **UI/UX Development**: codebase-explorer (understand patterns) → ui-design-architect (design) → project-typescript-engineer (implement) → senior-typescript-reviewer (review) → code-documenter (document)

- **Security-Sensitive Changes**: electron-security-analyst (analyze) → project-typescript-engineer (implement) → senior-typescript-reviewer (review) → electron-security-analyst (validate)

- **Release Preparation**: production-readiness-auditor (audit) → electron-security-analyst (security review) → senior-typescript-reviewer (final code review)

- **Architecture Documentation**: codebase-explorer (analyze) → ascii-diagram-designer (visualize) → comprehensive-docs-generator (document)

## Critical Agent Collaboration Rules

- **NEVER skip codebase-explorer** for complex features or unfamiliar code areas - it provides essential architectural context that prevents integration issues
- **ALWAYS use project-typescript-engineer** for TypeScript work - direct coding attempts bypass critical reference file reading and pattern adherence
- **MANDATORY senior-typescript-reviewer** after ANY code changes - no exceptions, this ensures code quality and catches issues early
- **AUTO-INVOKE code-documenter** when creating new files or working on undocumented code - maintains documentation standards
- **PROACTIVE production-readiness-auditor** use after significant changes prevents build failures and deployment issues
- **PREVENTIVE electron-security-analyst** deployment for authentication, IPC, and external integration work catches vulnerabilities early

## Project Specifications Reference

- **`ai_specs/`**: Contains feature specifications and planning documents for active development work
- **`ai_specs/archive/`**: **Completed specifications only**. All specification files in this folder have already been fully implemented and should not be treated as active work items or TODO tasks
