# Biome Documentation Reference Index

This file provides quick navigation to all Biome documentation sections.

## Quick Reference

### Essential Reading
- [Getting Started](docs/guides/getting-started.md) - Installation and first steps
- [Configuration](docs/reference/configuration.md) - Complete configuration reference (42 KB)
- [CLI Reference](docs/reference/cli.md) - All CLI commands and options (70 KB)

### Core Guides
- [Configure Biome](docs/guides/configure-biome.md) - Configuration guide
- [Big Projects](docs/guides/big-projects.md) - Monorepo and large project setup
- [Migrate from ESLint & Prettier](docs/guides/migrate-eslint-prettier.md) - Migration guide
- [Upgrade to Biome v2](docs/guides/upgrade-to-biome-v2.md) - v1 to v2 upgrade guide

### Formatter
- [Formatter Introduction](docs/formatter/index.md) - Formatting engine overview
- [Differences with Prettier](docs/formatter/differences-with-prettier.md) - Prettier comparison
- [Option Philosophy](docs/formatter/option-philosophy.md) - Design philosophy

### Linter
- [Linter Introduction](docs/linter/index.md) - Linting system overview
- [Domains](docs/linter/domains.md) - Framework-specific linting (React, Next.js, etc.)
- [Plugins](docs/linter/plugins.md) - Plugin system
- [JavaScript Rules](docs/linter/javascript_rules.md) - All JavaScript/TypeScript rules (68 KB)
- [CSS Rules](docs/linter/css_rules.md) - CSS linting rules
- [JSON Rules](docs/linter/json_rules.md) - JSON linting rules
- [GraphQL Rules](docs/linter/graphql_rules.md) - GraphQL linting rules
- [HTML Rules](docs/linter/html_rules.md) - HTML linting rules

### Assist (Code Actions)
- [Assist Introduction](docs/assist/index.md) - Code actions overview
- [JavaScript Actions](docs/assist/javascript_actions.md)
- [CSS Actions](docs/assist/css_actions.md)
- [JSON Actions](docs/assist/json_actions.md)
- [GraphQL Actions](docs/assist/graphql_actions.md)

### Reference Documentation
- [CLI](docs/reference/cli.md) - Complete CLI reference
- [Configuration](docs/reference/configuration.md) - All config options
- [Diagnostics](docs/reference/diagnostics.md) - Error messages and codes
- [Environment Variables](docs/reference/environment-variables.md)
- [Reporters](docs/reference/reporters.md) - Output formatting
- [VS Code Extension](docs/reference/vscode.md) - VS Code integration
- [Zed Extension](docs/reference/zed.md) - Zed editor integration
- [GritQL](docs/reference/gritql.md) - Pattern matching queries

### Integration Recipes
- [Continuous Integration](docs/recipes/continuous-integration.md) - CI/CD setup
- [Git Hooks](docs/recipes/git-hooks.md) - Pre-commit hooks
- [Renovate](docs/recipes/renovate.md) - Dependency updates
- [Badges](docs/recipes/badges.md) - Project badges

### Editor Integration
- [First-party Extensions](docs/guides/editors_first-party-extensions.md) - Official extensions
- [Third-party Extensions](docs/guides/editors_third-party-extensions.md) - Community extensions
- [Create an Extension](docs/guides/editors_create-an-extension.md) - Build your own

### Advanced Topics
- [Integrate in VCS](docs/guides/integrate-in-vcs.md) - Version control integration
- [Investigate Slowness](docs/guides/investigate-slowness.md) - Performance debugging
- [Analyzer Suppressions](docs/analyzer/suppressions.md) - Disable rules

### Internals
- [Philosophy](docs/internals/philosophy.md) - Project philosophy
- [Architecture](docs/internals/architecture.md) - Technical architecture
- [Language Support](docs/internals/language-support.md) - Supported languages
- [Versioning](docs/internals/versioning.md) - Version strategy
- [Changelog v2](docs/internals/changelog.md) - Version 2.x changes (77 KB)
- [Changelog v1](docs/internals/changelog_v1.md) - Version 1.x history (241 KB)

## File Organization

Documentation is organized into folders by category:
- **assist/** - Code actions and refactoring (10 files)
- **formatter/** - Formatting engine (3 files)
- **guides/** - Getting started and how-to guides (11 files)
- **linter/** - Linting rules and configuration (13 files)
- **reference/** - CLI, configuration, and technical reference (8 files)
- **recipes/** - Integration patterns (4 files)
- **internals/** - Architecture and project information (7 files)
- **analyzer/** - Analysis tools (1 file)

## Search Tips

When searching for specific topics:
- Configuration options: Check `reference/configuration.md`
- CLI commands: Check `reference/cli.md`
- Lint rules: Check `linter/<language>_rules.md`
- Code actions: Check `assist/<language>_actions.md`
- Migration help: Check `guides/migrate-eslint-prettier.md`
- Setup guides: Check `guides/*.md`
