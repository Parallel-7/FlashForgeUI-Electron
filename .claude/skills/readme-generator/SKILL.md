---
name: readme-generator
description: Generate professionally formatted README.md files following a specific centered table-based structure. Use when creating or reformatting README files for GitHub repositories, particularly for Ghost's projects across 48hour-solutions, Automotive-9, LLMTooling, MCDxAI, Orbital-8, Parallel-7, and GhostTypes organizations. Triggers include "create a readme", "reformat this readme", "update the readme", or any request to document a repository.
---

# README Generator

This skill generates README.md files following a specific centered, table-based structure with strict formatting rules.

## Core Layout Structure

Every README follows this exact top section structure:

```markdown
<div align="center">

# Project Title

![Icon](icon-url-here)
_if icon available_

**One-line summary/tagline describing the project**

![Badge1](shield-url) ![Badge2](shield-url) ![Badge3](shield-url)

**Bold statement highlighting the core value proposition**

</div>
```

## Strict Formatting Rules

### NEVER USE
- ❌ Emojis (anywhere in the document)
- ❌ Standalone bulleted lists (bullets within table cells are OK)
- ❌ Horizontal rule separators (`---`) between sections

### ALWAYS USE
- ✓ Centered layout for all elements except standalone code blocks
- ✓ Tables for all feature lists, steps, workflows, and organized content
- ✓ Markdown formatting within table cells
- ✓ shields.io badges with appropriate colors matching the tech stack

### Special Rules for Code Blocks

**CRITICAL**: Markdown code blocks CANNOT be placed inside `<div align="center">` tags as it breaks GitHub rendering.

- If a code block is needed outside a table → place it WITHOUT center tags
- All other elements → MUST be centered
- Code blocks within table cells → perfectly fine

## Badge Generation

### Always Use shields.io

Format: `https://img.shields.io/badge/{LABEL}-{MESSAGE}-{COLOR}?style=flat`

### Color Selection Strategy

Match colors to the technology/library branding:
- **Status badges**: `purple` for preview/beta, `brightgreen` for stable, `yellow` for experimental
- **Minecraft**: `0ea5e9` (light blue)
- **Fabric Loader**: `f59e0b` (amber)
- **Java**: `orange` or `007396`
- **Python**: `3776ab` or `yellow`
- **TypeScript**: `3178c6`
- **Node.js**: `339933`
- **Vue**: `4fc08d`
- **React**: `61dafb`

### Version Discovery Process

**REQUIRED**: Before generating badges, examine the codebase:

1. **JavaScript/TypeScript projects**: Check `package.json` for dependencies
2. **Java projects**: Check `build.gradle`, `build.gradle.kts`, `pom.xml`
3. **Python projects**: Check `pyproject.toml`, `requirements.txt`, `setup.py`
4. **Other languages**: Look for standard dependency files

**If you cannot find version information → ASK before generating the README**

Use actual version numbers when found, or "latest" as fallback only if user confirms.

## Content Structure

All content sections use clean, centered tables with two columns:

```markdown
<div align="center">

| Category/Label | Details/Description |
| --- | --- |
| **First Item** | Detailed information with **markdown** and `code` |
| **Second Item** | More details • Sub-bullets OK here • Another point |

</div>
```

### Standard Section Pattern

Follow this structure closely (based on meteor-client-webgui):

1. **Feature Highlights** - Key capabilities in table format
2. **Quick Start** - Installation and setup steps in table format  
3. **Development Workflow** - Commands and development info in table format

### Table Design Guidelines

- **Left column**: Short, bold labels or categories (1-3 words)
- **Right column**: Detailed information with full markdown support
- **Within cells**: Use `•` for sub-points, `**bold**` for emphasis, `` `code` `` for commands
- **Multi-line content**: Perfectly fine within cells
- **Code blocks in cells**: Use triple backticks with language identifier

### Formatting Lists Within Table Cells

**CRITICAL**: When adding lists or multi-line content within table cells, use these exact patterns for proper rendering:

**Numbered lists with line breaks:**
```markdown
| **Step** | 1. First action<br>2. Second action<br>3. Third action |
```

**Indented bullets under numbered items:**
```markdown
| **Step** | 1. Main instruction<br>&nbsp;&nbsp;&nbsp;• **Sub-item**: Detail<br>&nbsp;&nbsp;&nbsp;• **Another**: More detail<br>2. Next step |
```

**Simple bullet lists (inline):**
```markdown
| **Feature** | Main description • First point • Second point • Third point |
```

**Multi-line bullet lists (each bullet on its own line):**
```markdown
| **Issue** | Problem description | • First solution item<br>• Second solution item<br>• Third solution item<br>• Fourth solution item |
```

This renders as a clean vertical list within the cell, like:
- • First solution item
- • Second solution item
- • Third solution item
- • Fourth solution item

**Important notes:**
- Use `<br>` for line breaks within cells (NOT actual newlines)
- Use `&nbsp;&nbsp;&nbsp;•` for indented bullets (3 non-breaking spaces + bullet character)
- Bold labels within bullets: `• **Label**: description`
- For vertical lists, place `<br>` BETWEEN bullet items (after item, before next bullet)
- The pattern MUST be exact or GitHub won't render it correctly

**Real-world example from troubleshooting table:**

```markdown
| **Discovery Not Finding Printer** | Automatic discovery doesn't detect your printer | • Ensure printer is on the same network/subnet as Home Assistant<br>• Check firewall settings (UDP port 18007 must be open)<br>• Verify LAN mode is enabled on the printer<br>• Try manual configuration with IP address |
```

This renders as a clean, readable vertical list in the Solutions column.

**Complex example with numbered steps and sub-bullets:**

```markdown
| **Installation** | 1. Open **HACS** in Home Assistant<br>2. Click on **Integrations**<br>3. Add repository:<br>&nbsp;&nbsp;&nbsp;• **URL**: `https://github.com/user/repo`<br>&nbsp;&nbsp;&nbsp;• **Category**: `Integration`<br>4. Click **Download** |
```

## Codebase Analysis Process

### When NO existing README exists

**REQUIRED**: Thoroughly analyze the codebase before writing:

1. **Identify the project type** (library, application, tool, addon, etc.)
2. **Find the tech stack** (languages, frameworks, dependencies)
3. **Discover features** by examining:
   - Main source files and their public APIs
   - Configuration files and what they configure
   - Build scripts and what they produce
   - Documentation comments in code
   - Example/test files showing usage
4. **Extract version information** from dependency files
5. **Identify setup requirements** (install steps, dependencies, system requirements)
6. **Note any special considerations** (permissions, compatibility, known issues)

**Never guess or hallucinate features** - only document what's actually in the code.

### When existing README exists

**Default behavior**: Reformat to the centered table structure while preserving factual content

Process:
1. Extract all factual information (features, versions, installation steps, etc.)
2. Strip out emojis completely
3. Convert bulleted lists to centered tables
4. Reorganize into the standard section structure
5. Update badge formatting to shields.io style
6. Ensure all elements are properly centered (except standalone code blocks)
7. Keep the same level of technical detail

**Exception**: If user says "rewrite" or indicates content changes needed, then also revise the content itself.

## Section Guidelines

### Features/Highlights Section

Format as a table with specific feature areas:

```markdown
<div align="center">

| Capability | Details |
| --- | --- |
| **Feature Name** | Clear description of what it does and why it matters |
| **Another Feature** | Technical details with code examples if needed |

</div>
```

### Quick Start Section

Format as a table with numbered steps or clear categories:

```markdown
<div align="center">

| Step | Instructions |
| --- | --- |
| **1. Requirements** | List dependencies • version requirements • system requirements |
| **2. Installation** | Download, install, setup commands |
| **3. First Run** | How to verify it works |

</div>
```

### Development Workflow Section

Format as a table organizing by component or task:

```markdown
<div align="center">

| Component | Commands / Actions |
| --- | --- |
| **Build** | `./gradlew build` – Compiles and packages |
| **Test** | `npm test` – Runs test suite |
| **Dev Server** | `npm run dev` – Hot reload on localhost:3000 |

</div>
```

## Tone and Style

- **Professional and technical**: Direct, clear, factual
- **No fluff**: Every sentence should provide value
- **Scannable**: Users should quickly find what they need
- **Complete but concise**: Include necessary details without verbosity

## Contributing Section

**DO NOT INCLUDE** a Contributing section unless explicitly requested.

Ghost adds this manually when needed.

## Example References

### Primary Reference: Home Assistant Integration

See `references/homeassistant-example.md` for a comprehensive, perfect example demonstrating:
- Multi-column tables with rowspan for categorization
- Section headers as centered H2 (`<h2>`) elements
- Complex table cells with rich formatting (line breaks, bullets, bold, code)
- Subsections within centered divs using H3
- Varied table structures (2-column, 3-column, 4-column)
- Code blocks properly placed outside center tags
- Professional technical documentation for a real-world project

### Additional Reference

https://github.com/MCDxAI/meteor-client-webgui/blob/main/README.md

Study these examples closely for:
- Exact centering approach
- Table structure and formatting
- Badge selection and colors
- Section organization
- Markdown within tables
- Professional technical tone

## Validation Checklist

Before presenting the README, verify:

- [ ] All elements centered (except standalone code blocks)
- [ ] Zero emojis anywhere
- [ ] No standalone bulleted lists
- [ ] No horizontal rule separators (`---`) between sections
- [ ] All features/steps in table format
- [ ] Lists within table cells use `<br>` and `&nbsp;&nbsp;&nbsp;•` formatting
- [ ] Badges use shields.io with appropriate colors
- [ ] Version numbers are real (from codebase) or confirmed with user
- [ ] Code blocks outside tables are NOT in center tags
- [ ] Professional, technical tone maintained
- [ ] Contributing section NOT included
