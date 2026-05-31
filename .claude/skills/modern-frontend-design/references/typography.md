# Typography Systems

Complete guide to typography choices that avoid generic AI patterns and create distinctive interfaces.

## Font Selection Philosophy

**Core principle**: Fonts establish personality and context. Generic fonts (Inter, Roboto) signal generic AI output unless specifically required by an existing design system.

---

## Modern Dark Interfaces

### Apple System Stack (Ghost Dark)

```css
:root {
  --font-display: -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif;
  --font-body: -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif;
  --font-mono: 'SF Mono', 'Monaco', 'Cascadia Code', 'Courier New', monospace;
}
```

**Characteristics**:
- Clean, modern, professional
- Excellent legibility on dark backgrounds
- System-native feel
- Zero web font loading time

**When to use**: Developer tools, productivity apps, dashboards, modern SaaS

**Type scale**:
```css
--text-xs: 11px;
--text-sm: 13px;
--text-base: 15px;
--text-lg: 17px;
--text-xl: 20px;
--text-2xl: 24px;
--text-3xl: 30px;
--text-4xl: 36px;
--text-5xl: 48px;
--text-6xl: 60px;
```

---

### Tech/Gaming Stack

```css
:root {
  --font-display: 'Space Grotesk', 'Arial Black', sans-serif;
  --font-body: 'DM Sans', 'Helvetica Neue', sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', monospace;
}
```

**Characteristics**:
- Bold, geometric headlines
- Clean body text
- Excellent code display

**When to use**: Gaming interfaces, tech products, developer tools

---

### Minimal Swiss Style

```css
:root {
  --font-display: 'Helvetica Neue', 'Arial', sans-serif;
  --font-body: 'Helvetica Neue', 'Arial', sans-serif;
}
```

**Characteristics**:
- Brutally minimal
- Timeless
- Maximum legibility

**When to use**: Portfolios, art projects, intentionally minimal interfaces

---

## Editorial & Content

### Classic Editorial

```css
:root {
  --font-display: 'Playfair Display', 'Georgia', serif;
  --font-body: 'Crimson Pro', 'Georgia', serif;
  --font-sans: 'Manrope', 'Helvetica Neue', sans-serif;
}
```

**Characteristics**:
- Elegant serif for headlines
- Readable serif for body
- Sans-serif for UI elements

**When to use**: Publishing platforms, magazines, content-focused sites

**Type scale** (generous for reading):
```css
--text-body: 21px;
--text-h1: 48px;
--text-h2: 36px;
--text-h3: 28px;
--text-display: 72px;
line-height: 1.8;
```

---

### Modern Editorial

```css
:root {
  --font-display: 'Fraunces', 'Georgia', serif;
  --font-body: 'Inter', 'Helvetica Neue', sans-serif;  /* Exception: good for editorial body */
  --font-caption: 'IBM Plex Sans', 'Arial', sans-serif;
}
```

**Characteristics**:
- Distinctive variable serif for headlines
- Clean sans for body (Inter works here)
- Technical sans for captions

**When to use**: Modern magazines, design blogs, creative portfolios

---

## Friendly & Approachable

### Soft SaaS

```css
:root {
  --font-display: 'DM Sans', 'Helvetica Neue', sans-serif;
  --font-body: 'Inter', 'Helvetica Neue', sans-serif;  /* Exception: works for soft aesthetic */
}
```

**Characteristics**:
- Rounded, friendly
- Excellent legibility
- Professional but approachable

**When to use**: Consumer SaaS, wellness apps, education platforms

---

### Playful Consumer

```css
:root {
  --font-display: 'Quicksand', 'Comic Sans MS', sans-serif;
  --font-body: 'Nunito', 'Arial', sans-serif;
}
```

**Characteristics**:
- Rounded, fun
- Casual but readable

**When to use**: Kids apps, casual games, friendly brands

---

## Technical & Industrial

### Industrial Monospace

```css
:root {
  --font-display: 'JetBrains Mono', 'Consolas', monospace;
  --font-body: 'Work Sans', 'Arial', sans-serif;
  --font-mono: 'JetBrains Mono', 'Consolas', monospace;
}
```

**Characteristics**:
- Technical precision
- Clear hierarchy
- Functional focus

**When to use**: B2B software, enterprise tools, logistics platforms

---

### Developer-First

```css
:root {
  --font-display: 'Fira Code', 'Courier New', monospace;
  --font-body: 'IBM Plex Sans', 'Arial', sans-serif;
  --font-mono: 'Fira Code', 'Courier New', monospace;
}
```

**Characteristics**:
- Code-focused
- Ligature support
- Technical aesthetic

**When to use**: Developer tools, code editors, technical docs

---

## Distinctive & Bold

### Brutalist

```css
:root {
  --font-display: 'Archivo Black', 'Arial Black', sans-serif;
  --font-body: 'IBM Plex Mono', 'Courier New', monospace;
}
```

**Characteristics**:
- Extremely bold headlines
- Monospace body
- Raw, unpolished aesthetic

**When to use**: Portfolios, statement pieces, experimental sites

---

### Art Deco

```css
:root {
  --font-display: 'Cinzel', 'Georgia', serif;
  --font-body: 'Montserrat', 'Helvetica Neue', sans-serif;
}
```

**Characteristics**:
- Geometric elegance
- Luxury feel
- Classic refinement

**When to use**: Luxury brands, events, upscale products

---

## Font Pairing Rules

### Contrast is Key

✅ **Good pairings**:
- Serif display + Sans body (Classic)
- Heavy sans display + Light sans body (Modern)
- Display font + Monospace body (Technical)
- Decorative display + Simple body (Artistic)

❌ **Avoid**:
- Similar fonts (Roboto + Inter)
- Too many fonts (>3 families)
- Competing display fonts

### Example Pairings

**Elegant**:
```css
--display: 'Playfair Display';  /* Serif, elegant */
--body: 'Manrope';              /* Sans, clean */
```

**Technical**:
```css
--display: 'Space Grotesk';     /* Geometric, bold */
--body: 'DM Mono';              /* Monospace, precise */
```

**Friendly**:
```css
--display: 'DM Sans';           /* Rounded, friendly */
--body: 'DM Sans';              /* Same family, different weights */
```

---

## Typography Hierarchy

### Standard Scale (15px base)

```css
:root {
  --text-xs: 11px;
  --text-sm: 13px;
  --text-base: 15px;    /* Body text */
  --text-lg: 17px;
  --text-xl: 20px;
  --text-2xl: 24px;     /* H4 */
  --text-3xl: 30px;     /* H3 */
  --text-4xl: 36px;     /* H2 */
  --text-5xl: 48px;     /* H1 */
  --text-6xl: 60px;     /* Display */
  
  /* Line heights */
  --leading-tight: 1.25;   /* Headlines */
  --leading-normal: 1.5;   /* Body */
  --leading-relaxed: 1.75; /* Long-form */
}
```

### Editorial Scale (21px base)

```css
:root {
  --text-base: 21px;    /* Body text */
  --text-h3: 28px;
  --text-h2: 36px;
  --text-h1: 48px;
  --text-display: 72px;
  
  --leading-body: 1.8;  /* Generous for reading */
}
```

---

## Font Weight Strategy

```css
:root {
  --weight-light: 300;
  --weight-regular: 400;
  --weight-medium: 500;
  --weight-semibold: 600;
  --weight-bold: 700;
  --weight-black: 900;
}

/* Usage patterns */
.display {
  font-weight: var(--weight-bold);
}

.heading {
  font-weight: var(--weight-semibold);
}

.body {
  font-weight: var(--weight-regular);
}

.caption {
  font-weight: var(--weight-medium);
  font-size: var(--text-sm);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
```

---

## Special Typography Techniques

### Drop Cap (Editorial)

```css
.article p:first-of-type::first-letter {
  font-family: var(--font-display);
  font-size: 4em;
  float: left;
  line-height: 0.8;
  margin: 0.1em 0.15em 0 0;
  color: var(--accent);
}
```

### Small Caps (Elegant)

```css
.small-caps {
  font-variant: small-caps;
  letter-spacing: 0.05em;
}
```

### Monospace Numbers (Technical)

```css
.tabular-numbers {
  font-variant-numeric: tabular-nums;
}
```

---

## Responsive Typography

### Fluid Type Scale

```css
:root {
  --text-base: clamp(14px, 1vw + 12px, 16px);
  --text-lg: clamp(16px, 1.2vw + 14px, 20px);
  --text-xl: clamp(20px, 1.5vw + 16px, 24px);
  --text-2xl: clamp(24px, 2vw + 18px, 32px);
  --text-3xl: clamp(30px, 3vw + 20px, 48px);
}
```

### Breakpoint Adjustments

```css
.heading {
  font-size: var(--text-3xl);
  line-height: 1.2;
}

@media (max-width: 768px) {
  .heading {
    font-size: var(--text-2xl);
  }
}
```

---

## Common Mistakes to Avoid

❌ **Generic Font Stack**:
```css
font-family: 'Inter', 'Roboto', 'Arial', sans-serif;
```

❌ **No hierarchy**:
```css
h1, h2, h3, p { font-size: 16px; }
```

❌ **Inconsistent line height**:
```css
p { line-height: 1.2; }  /* Too tight for body text */
```

✅ **Distinctive + Hierarchical**:
```css
:root {
  --font-display: 'Space Grotesk', sans-serif;
  --font-body: 'DM Sans', sans-serif;
}

h1 { 
  font-size: 48px; 
  line-height: 1.1; 
  font-weight: 700;
}

p { 
  font-size: 16px; 
  line-height: 1.6; 
  font-weight: 400;
}
```

---

## Quick Reference: When to Use What

| Context | Display Font | Body Font |
|---------|--------------|-----------|
| Dark minimal | Apple System | Apple System |
| Editorial luxury | Playfair Display | Crimson Pro |
| Tech/Gaming | Space Grotesk | DM Sans |
| Brutalist | Archivo Black | IBM Plex Mono |
| Industrial | JetBrains Mono | Work Sans |
| Art Deco | Cinzel | Montserrat |
| Soft SaaS | DM Sans | Inter (ok here) |

Remember: Typography is 95% of design. Make it count.
