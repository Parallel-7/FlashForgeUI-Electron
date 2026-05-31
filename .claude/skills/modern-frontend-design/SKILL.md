---
name: modern-frontend-design
description: Create distinctive, production-grade frontend interfaces with high design quality and modern aesthetics. Use when building web components, React/HTML artifacts, landing pages, dashboards, UI libraries, or any frontend interface. Generates creative, polished code with bold aesthetic choices. Specializes in dark themes, glassmorphism, minimalist design, and explicitly avoids generic AI patterns like purple gradients and cookie-cutter layouts.
---

# Modern Frontend Design

This skill combines bold, creative aesthetic thinking with proven design systems to create distinctive, production-grade frontend interfaces that stand out from generic AI-generated designs.

## Design Philosophy

**Core Principle**: Every design should be unique, intentional, and context-specific. There are no "safe defaults" - each project deserves thoughtful creative planning.

### Step 1: Plan Before Coding (CRITICAL)

Before writing ANY code, spend time understanding and planning:

1. **Context Deep Dive**:
   - What is this interface for? Who uses it? What's the business/product?
   - What emotions should it evoke? (Trust? Excitement? Calm? Power?)
   - What industry? (Finance? Gaming? Health? Creative?)
   - Any brand identity to respect or establish?

2. **Commit to a Bold Direction**:
   Pick ONE distinctive aesthetic direction and execute it fully:
   - Brutally minimal (few elements, maximum clarity)
   - Dark & moody (rich blacks, dramatic shadows)
   - Light & airy (whitespace, brightness)
   - Brutalist (raw, bold, structural)
   - Editorial (serif typography, reading-focused)
   - Retro-futuristic (nods to past futures)
   - Organic (natural shapes, earth tones)
   - Industrial (utilitarian, grid-based)
   - Art deco (geometric luxury)
   - Neon cyberpunk (glowing, high-energy)
   - Soft & friendly (rounded, approachable)
   
   These are just examples - create your own unique direction based on context.

3. **Make Distinctive Choices**:
   - **Color**: What color(s) fit the mood? (NOT just blue - be creative!)
   - **Typography**: What font personality matches? (Bold? Elegant? Technical?)
   - **Spacing**: Generous and airy? Dense and controlled?
   - **Effects**: Glassmorphism? Shadows? Borders? Textures?
   - **Movement**: Subtle animations? Bold transitions? Static precision?

4. **The Differentiator**:
   Ask: "What will make this UNFORGETTABLE?"
   - Unique color combination?
   - Unexpected layout?
   - Distinctive typography?
   - Clever micro-interactions?
   - Bold use of whitespace?

**CRITICAL**: No two designs should look the same. Avoid falling back on familiar patterns. Challenge yourself to create something genuinely new each time.

### Step 2: Implement with Precision

After planning, implement production-grade code that:
- Matches your conceptual direction perfectly
- Is visually striking and memorable
- Has a clear aesthetic point-of-view
- Is meticulously refined in every detail
- Functions flawlessly (HTML/CSS/JS, React, Vue, etc.)

## Quick Start

### Planning Phase (Do This First!)

1. **Understand the context** - What are you building? For whom? What's the vibe?
2. **Choose your creative direction** - Don't default to anything. Think fresh.
3. **Pick colors that fit** - Blue? Red? Orange? Teal? Monochrome? Be creative!
4. **Select typography** - Match fonts to the aesthetic and brand personality
5. **Decide on effects** - Glassmorphism? Flat? Shadows? Borders? What fits best?

### Reference Files (Use as Inspiration, Not Templates)

These references provide patterns and examples - NOT defaults to copy:

- **`references/design-presets.md`** - 8 completely different aesthetic directions with full examples
  - Use these for inspiration or as starting points
  - Mix and match elements from different presets
  - Create entirely new combinations
  
- **`references/color-systems.md`** - Comprehensive color science and palettes
  - **OKLCH color space** (perceptually uniform, wider gamut, 93% browser support)
  - HSL comparison and when to use each
  - Mathematical palette generation (Shades Strategy)
  - Dark themes, light themes, specialty palettes
  - 70/20/10 color distribution strategy
  - Shows many color families: blues, greens, oranges, reds, earth tones, neutrals

- **`references/depth-and-shadows.md`** - Realistic depth through lighting physics
  - Layering system (mathematical lightness progression)
  - Advanced shadow techniques (3 levels + Material Design elevation)
  - Border & highlight strategies
  - Sunken elements (inset shadows)
  - Light mode vs dark mode physics
  - Glassmorphism depth techniques
  
- **`references/typography.md`** - Font pairings for every style
  - Modern, editorial, technical, friendly, bold
  - Pairing strategies and type scales
  
- **`references/components.md`** - UI component library
  - Buttons, inputs, cards, modals, etc.
  - Styled for dark themes (easily adaptable)
  
- **`references/layouts.md`** - Layout patterns and responsive design
  - Grid systems, navigation patterns, page layouts
  - Avoid generic three-column grids
  
- **`references/ai-patterns.md`** - **CRITICAL: What NOT to do**
  - Purple problem, gradient overuse, generic layouts
  - Read this to avoid AI tells

### The Process

1. **Read `ai-patterns.md`** first to know what to avoid
2. **Plan your unique direction** based on context
3. **Browse references** for technical patterns (not to copy aesthetic wholesale)
   - `color-systems.md` for OKLCH, palette generation, color science
   - `depth-and-shadows.md` for lighting physics and shadow techniques
   - `typography.md` for font pairings
   - `components.md` for implementation patterns
4. **Implement with creative freedom** - make it distinctive
5. **Verify uniqueness** - Does it look like every other site? If yes, revise.

## Essential Aesthetics Guidelines

### Typography
- Choose distinctive, characterful fonts
- Avoid: Arial, Inter, Roboto (unless specifically required)
- Pair display fonts with refined body fonts
- Establish clear hierarchy

### Color & Theme
- **Use OKLCH** (perceptually uniform color space) for modern projects - see `references/color-systems.md`
- Generate palettes mathematically: lock chroma/hue, adjust lightness linearly
- Commit to a cohesive palette using CSS variables
- Use dominant colors (70%) with sharp accents (20/10)
- **NEVER**: Purple gradients (#6366f1, #8b5cf6, #a855f7) unless explicitly requested
- See `references/color-systems.md` for OKLCH guide, HSL comparison, and palette generation

### Motion & Animation
- Focus on high-impact moments (page load, state changes)
- Use staggered reveals (animation-delay) for orchestrated feel
- CSS-only solutions preferred (GPU-accelerated: `transform`, `opacity`)
- Duration: Fast (150-200ms), Standard (200-300ms), Complex (300-500ms max)

### Spatial Composition
- Embrace asymmetry and unexpected layouts
- Use overlap, diagonal flow, grid-breaking elements
- Balance: Generous negative space OR controlled density
- Avoid perfectly symmetrical three-column grids

### Visual Details & Depth
- Create atmosphere: noise textures, patterns, layered effects
- Add depth: layered transparencies, realistic shadows, borders
- Context-specific effects: grain overlays, decorative borders, custom cursors
- **Glassmorphism** (for dark themes): `backdrop-filter: blur(10px)` with subtle backgrounds
- **Lighting Physics**: Mimic real-world light from above (see `references/depth-and-shadows.md`)
- **Shadow Techniques**: Use dual shadows (directional + ambient) for realistic depth
- **GRADIENTS**: Minimal use - only for subtle lighting effects, NEVER for primary styling (see Critical Rules)

## Critical Rules

### **Absolute Prohibitions (NEVER)**:

1. **NO EMOJIS** - Never use emojis anywhere in designs (🚫 ❌ ✓ ✗ 💡 🎨 etc.)
   - Not in headings, buttons, labels, placeholders, content, or anywhere else
   - Use icon libraries, SVGs, or text instead
   - Emojis look unprofessional and amateurish

2. **NO Purple/Indigo defaults** - (#6366f1, #8b5cf6, #a855f7)
   - Purple is THE most overused AI color
   - Use it ONLY if explicitly requested or fits brand
   - Otherwise: Choose blues, greens, oranges, reds, earth tones, or monochrome

3. **MINIMAL Gradients** - On backgrounds, cards, buttons, panels
   - Massively overused in AI designs
   - **Default to solid colors** + borders/shadows/layers for depth
   - **Allowed**: Subtle lighting-effect gradients (barely visible, 2-5% lightness difference max)
   - **Allowed**: Functional elements (progress bars, loading shimmers)
   - **Allowed**: When user explicitly requests
   - See `references/color-systems.md` for gradient policy details

4. **NO Generic layouts** - Three-column feature grids
   - Avoid perfectly symmetrical, predictable patterns
   - Use asymmetry, varied sizing, unexpected layouts

5. **NO Generic fonts without intention** - Inter, Roboto, Arial
   - These signal "I didn't think about typography"
   - Choose fonts that match your aesthetic
   - Exception: When specifically required by existing system

6. **NO Cookie-cutter patterns** - "Transform Your [X]" hero sections
   - Avoid templates that appear in thousands of sites
   - Create context-specific, unique layouts

### **Color Freedom**:

You have FULL creative freedom with colors - just avoid:
- Purple defaults (#6366f1, #8b5cf6, #a855f7) unless requested
- Timid, evenly-distributed multi-color palettes

**Great color options** (use any that fit your vision):
- Blues: #2196f3, #0ea5e9, #06b6d4
- Greens: #10b981, #14b8a6, #84cc16
- Oranges/Warm: #ff9800, #f59e0b, #ef4444
- Earth tones: #6d4c41, #7cb342, #d84315
- Neutrals with accent: Black/white + any single color
- Monochrome: Shades of one color
- Brand-specific: Use company colors

**Choose based on context**, not habit. Finance app? Maybe teal. Gaming? Maybe red or green. Wellness? Earth tones or soft blues. Creative tool? Orange or unique combination.

### **Check Before Shipping**:

- [ ] No emojis anywhere
- [ ] Colors chosen intentionally using OKLCH or HSL (not just defaulting to blue)
- [ ] Palette generated mathematically (consistent lightness progression)
- [ ] No purple unless requested or brand-appropriate
- [ ] No gradients for primary styling (only subtle lighting effects if needed)
- [ ] Depth created through layering and realistic shadows
- [ ] Typography is distinctive
- [ ] Layout breaks from predictable patterns
- [ ] Design looks unique, not like every other AI site

**Always check `references/ai-patterns.md`** for complete avoidance guide.

## Implementation Checklist

Before completing any design:
- [ ] Clear aesthetic direction chosen and executed
- [ ] Typography is distinctive and intentional
- [ ] Color palette avoids generic defaults (especially purple)
- [ ] Animations enhance, not distract
- [ ] Layout breaks from predictable patterns
- [ ] Visual details add atmosphere
- [ ] Accessibility considered (WCAG AA minimum)
- [ ] Responsive design implemented
- [ ] No AI pattern violations

## Production Standards

- **Functional code**: HTML/CSS/JS, React, Vue, etc.
- **Accessibility**: WCAG 2.1 Level AA minimum
- **Performance**: GPU-accelerated animations, optimized assets
- **Responsive**: Mobile-first approach
- **Browser support**: Modern evergreen browsers

## References Guide

- **`design-presets.md`** → Complete examples of 8+ aesthetic directions (START HERE for quick implementation)
- **`color-systems.md`** → OKLCH guide, HSL comparison, mathematical palette generation, curated palettes
- **`depth-and-shadows.md`** → Lighting physics, layering system, advanced shadow techniques, glassmorphism
- **`components.md`** → Buttons, inputs, cards, modals, etc. with code examples
- **`layouts.md`** → Grid systems, navigation patterns, page layouts
- **`typography.md`** → Font pairings and hierarchy systems
- **`ai-patterns.md`** → Essential guide on what to avoid

## Remember: Planning Creates Excellence

1. **Plan before coding** - Understand context, choose direction, make intentional decisions
2. **Be creative** - Don't default to blue, don't default to any preset, think fresh
3. **Every design should be unique** - No two projects should look the same
4. **Avoid AI patterns** - Read ai-patterns.md, avoid purple/emojis/gradients/generic layouts
5. **Choose colors contextually** - Finance? Maybe teal. Gaming? Maybe red. Creative? Maybe orange.
6. **Typography matters** - Match fonts to the aesthetic and brand personality
7. **Test uniqueness** - If it looks like every other AI site, start over

Claude is capable of extraordinary creative work. Take the time to plan, make bold choices, and create something genuinely distinctive.
