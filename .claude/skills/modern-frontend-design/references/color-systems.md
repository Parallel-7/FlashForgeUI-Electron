# Color Systems

Curated color palettes and advanced color theory for professional UI design. Move beyond generic defaults with mathematical, perceptually-accurate color systems.

---

## Table of Contents

1. [Color Space Fundamentals](#color-space-fundamentals)
2. [Systematic Palette Generation](#systematic-palette-generation)
3. [Dark Theme Palettes](#dark-theme-palettes)
4. [Light Theme Palettes](#light-theme-palettes)
5. [Specialty Palettes](#specialty-palettes)
6. [Color Usage Patterns](#color-usage-patterns)
7. [Gradient Policy](#gradient-policy)
8. [Color Accessibility](#color-accessibility)
9. [Contextual Color Selection](#contextual-color-selection)

---

## Color Space Fundamentals

### Why Color Format Matters

**Problem with Hex/RGB**: These formats are device-centric (how screens emit light) rather than human-centric (how we perceive color). Creating consistent color palettes is guesswork.

**Solution: Perceptual Color Spaces** (HSL, OKLCH) separate lightness from color, allowing mathematical palette generation.

---

### OKLCH: The Modern Standard

**OKLCH** (Oklab color space in cylindrical coordinates) is a perceptually uniform color space designed for UI work.

#### What is OKLCH?

```
oklch(L C H)
```

- **L (Lightness)**: 0-100% or 0-1
  - 0% = Pure black
  - 50% = Middle gray
  - 100% = Pure white
  - **Perceptually uniform**: 50% looks halfway between black and white to human eyes

- **C (Chroma)**: 0-0.4 (typically)
  - 0 = No color (grayscale)
  - 0.1 = Subtle tint
  - 0.2 = Moderate saturation (most UI colors)
  - 0.3+ = Highly saturated (use sparingly)
  - **Rule**: Keep under 0.2 for professional UIs, under 0.15 for accessibility

- **H (Hue)**: 0-360 degrees
  - 0° = Red
  - 120° = Green
  - 240° = Blue
  - 300° = Magenta

#### Why OKLCH is Revolutionary

**1. Perceptual Uniformity**

In HSL, adjusting lightness causes dramatic hue shifts in certain ranges (especially blues 270-330°). OKLCH maintains perceived lightness consistently across all hues.

```css
/* HSL Problem: Same "lightness" looks different */
hsl(240, 100%, 50%) /* Blue - looks darker */
hsl(60, 100%, 50%)  /* Yellow - looks brighter */

/* OKLCH Solution: Same lightness = same perceived brightness */
oklch(60% 0.2 240) /* Blue - perceives as 60% bright */
oklch(60% 0.2 60)  /* Yellow - perceives as 60% bright */
```

**2. Wider Gamut**

OKLCH supports Display P3 color space (50% more colors than sRGB). Modern screens can display these richer colors.

```css
/* sRGB-limited blue (HSL) */
hsl(240, 100%, 50%)

/* Display P3 blue (OKLCH) - richer, more vibrant */
oklch(50% 0.3 240)
```

**3. Mathematical Predictability**

Creating shades is simple: lock C and H, adjust L linearly.

```css
:root {
  /* Lock chroma and hue, only change lightness */
  --blue-900: oklch(20% 0.15 240);
  --blue-700: oklch(40% 0.15 240);
  --blue-500: oklch(60% 0.15 240);
  --blue-300: oklch(80% 0.15 240);
  --blue-100: oklch(95% 0.15 240);
}
```

**Result**: Visually consistent progression from dark to light.

#### Browser Support

- **Chrome/Edge**: 111+ (March 2023)
- **Safari**: 15.4+ (March 2022)
- **Firefox**: 113+ (May 2023)

**Current adoption**: 93.1% of users globally (as of 2024)

**Fallback strategy**:
```css
.element {
  background: #2196f3; /* Fallback for old browsers */
  background: oklch(60% 0.15 240); /* Modern browsers */
}
```

---

### HSL: The Compromise

**HSL** (Hue, Saturation, Lightness) is more intuitive than Hex/RGB but has perceptual issues.

```
hsl(H S% L%)
```

- **H (Hue)**: 0-360 degrees (same as OKLCH)
- **S (Saturation)**: 0-100%
- **L (Lightness)**: 0-100% (NOT perceptually uniform)

#### When to Use HSL

**Use HSL when**:
- Working with legacy browsers (<7% of users)
- Quick prototyping (more familiar to most developers)
- Converting existing designs (many tools export HSL)

**Avoid HSL for**:
- Creating precise color scales (perceptual issues)
- Accessibility-critical projects (unpredictable contrast)
- Display P3 colors (HSL is sRGB-limited)

#### HSL Problems

**Problem 1: Hue Shift**

Changing lightness in HSL causes hue shifts in blue range:

```css
/* Same saturation/lightness, different hues - look very different */
hsl(270, 50%, 50%) /* Looks purple */
hsl(300, 50%, 50%) /* Looks pink */
hsl(240, 50%, 50%) /* Looks dark blue */
```

**Problem 2: Brightness Inconsistency**

```css
/* All at 50% lightness, but appear different brightness */
hsl(60, 100%, 50%)  /* Yellow - very bright */
hsl(240, 100%, 50%) /* Blue - much darker */
```

#### When HSL is Acceptable

For simple UIs where perfect color science isn't critical:

```css
:root {
  /* HSL neutral palette (saturation = 0, no hue shift) */
  --bg-0: hsl(0, 0%, 7%);
  --bg-1: hsl(0, 0%, 10%);
  --bg-2: hsl(0, 0%, 15%);
}
```

**Rule**: Use HSL for neutrals (S=0%) or when precision doesn't matter. Use OKLCH for color scales and accessibility.

---

### Color Space Decision Tree

```
Do you need Display P3 colors (wider gamut)?
├─ YES → Use OKLCH
└─ NO → Continue

Do you need precise color scales with consistent brightness?
├─ YES → Use OKLCH
└─ NO → Continue

Is browser support under 93% acceptable?
├─ YES → Use OKLCH (with HSL/Hex fallback)
└─ NO → Use HSL

Is this a grayscale palette?
├─ YES → HSL is fine (S=0%, no hue shift)
└─ NO → Prefer OKLCH
```

---

## Systematic Palette Generation

### The "Shades" Strategy

You need THREE categories of colors:

1. **Neutrals**: Backgrounds, text, borders (grayscale or subtly tinted)
2. **Brand/Primary**: Main actions, character, identity
3. **Semantic**: Success, error, warning, info states

---

### Generating Neutrals (Grayscale)

#### Dark Mode Neutral Scale (OKLCH)

**Method**: Set C (chroma) to 0, adjust L (lightness) mathematically.

```css
:root {
  /* Pure grayscale: C=0, no hue */
  --neutral-0: oklch(0% 0 0);     /* Pure black - deepest layer */
  --neutral-5: oklch(5% 0 0);     /* Slightly lifted - cards */
  --neutral-10: oklch(10% 0 0);   /* Raised - buttons, panels */
  --neutral-15: oklch(15% 0 0);   /* Elevated - modals */
  --neutral-20: oklch(20% 0 0);   /* Floating - tooltips */
  
  /* Text colors */
  --text-primary: oklch(95% 0 0);   /* High contrast, not 100% (eye strain) */
  --text-secondary: oklch(70% 0 0); /* Muted */
  --text-tertiary: oklch(50% 0 0);  /* De-emphasized */
  
  /* Borders */
  --border-subtle: oklch(15% 0 0);
  --border-strong: oklch(25% 0 0);
}
```

**Progression Rule**: Increase lightness by 5% per layer.

#### Dark Mode Neutral Scale (HSL Alternative)

```css
:root {
  /* HSL grayscale: S=0% */
  --neutral-0: hsl(0, 0%, 0%);
  --neutral-5: hsl(0, 0%, 7%);
  --neutral-10: hsl(0, 0%, 10%);
  --neutral-15: hsl(0, 0%, 15%);
  --neutral-20: hsl(0, 0%, 20%);
  
  --text-primary: hsl(0, 0%, 95%);
  --text-secondary: hsl(0, 0%, 70%);
  --text-tertiary: hsl(0, 0%, 50%);
}
```

**Note**: HSL works well for pure grayscale (S=0%) because there's no hue shift issue.

---

#### Light Mode Neutral Scale

**Method**: Start by subtracting dark mode values from 100%, then manually adjust.

```css
:root {
  /* Inverted, then adjusted */
  --neutral-base: oklch(95% 0 0);   /* Page background (95%, not 100%) */
  --neutral-surface: oklch(100% 0 0); /* Cards (white, "paper on desk") */
  --neutral-raised: oklch(98% 0 0);  /* Slightly dimmed */
  
  /* Text colors */
  --text-primary: oklch(15% 0 0);   /* Dark gray, not 0% (harsh) */
  --text-secondary: oklch(40% 0 0);
  --text-tertiary: oklch(60% 0 0);
  
  /* Borders */
  --border-subtle: oklch(90% 0 0);
  --border-strong: oklch(80% 0 0);
}
```

**Critical Insight**: In light mode, cards are often LIGHTER than the base. This mimics paper on a desk (closer to overhead light = brighter). Don't just flip the numbers—adjust for lighting physics.

---

### Adding Character with Tinted Neutrals

**Technique**: Add subtle hue/chroma to neutrals for warmer/cooler feel.

#### Cool Tinted (Blue)

```css
:root {
  /* OKLCH: Slight blue tint */
  --neutral-0: oklch(0% 0.01 240);   /* C=0.01 = barely visible blue */
  --neutral-5: oklch(5% 0.01 240);
  --neutral-10: oklch(10% 0.01 240);
  --neutral-15: oklch(15% 0.01 240);
  
  --text-primary: oklch(95% 0.005 240);
}
```

**Effect**: Cooler, tech-forward aesthetic without being obviously blue.

#### Warm Tinted (Orange)

```css
:root {
  /* OKLCH: Slight orange tint */
  --neutral-0: oklch(0% 0.01 30);
  --neutral-5: oklch(5% 0.01 30);
  --neutral-10: oklch(10% 0.01 30);
  --neutral-15: oklch(15% 0.01 30);
}
```

**Effect**: Warmer, inviting aesthetic.

**Rule**: Keep chroma under 0.02 for neutrals. Any higher and they stop feeling "neutral."

---

### Generating Brand/Primary Colors

#### OKLCH Method

**Step 1**: Choose your hue (0-360°)

- Red: 0-30°
- Orange: 30-60°
- Yellow: 60-90°
- Green: 90-180°
- Cyan: 180-210°
- Blue: 210-270°
- Purple: 270-330°
- Magenta: 330-360°

**Step 2**: Lock chroma at 0.15-0.2 (moderate saturation)

**Step 3**: Generate shades by varying lightness

```css
:root {
  /* Blue primary scale (H=240°, C=0.15) */
  --blue-900: oklch(20% 0.15 240);
  --blue-800: oklch(30% 0.15 240);
  --blue-700: oklch(40% 0.15 240);
  --blue-600: oklch(50% 0.15 240);
  --blue-500: oklch(60% 0.15 240); /* Primary color */
  --blue-400: oklch(70% 0.15 240);
  --blue-300: oklch(80% 0.15 240);
  --blue-200: oklch(90% 0.15 240);
  --blue-100: oklch(95% 0.15 240);
}
```

**Result**: Perfectly consistent blue scale from dark to light.

#### Teal Example

```css
:root {
  /* Teal scale (H=180°, C=0.15) */
  --teal-900: oklch(20% 0.15 180);
  --teal-700: oklch(40% 0.15 180);
  --teal-500: oklch(60% 0.15 180);
  --teal-300: oklch(80% 0.15 180);
  --teal-100: oklch(95% 0.15 180);
}
```

---

### Generating Semantic Colors

**Success** (Green):
```css
:root {
  --success-dark: oklch(35% 0.15 140);
  --success: oklch(60% 0.15 140);
  --success-light: oklch(90% 0.1 140);
}
```

**Error** (Red):
```css
:root {
  --error-dark: oklch(35% 0.2 20);
  --error: oklch(60% 0.2 20);
  --error-light: oklch(90% 0.12 20);
}
```

**Warning** (Amber):
```css
:root {
  --warning-dark: oklch(40% 0.15 60);
  --warning: oklch(70% 0.15 60);
  --warning-light: oklch(92% 0.1 60);
}
```

**Info** (Cyan):
```css
:root {
  --info-dark: oklch(40% 0.15 200);
  --info: oklch(65% 0.15 200);
  --info-light: oklch(92% 0.1 200);
}
```

---

## Dark Theme Palettes

### Ghost Dark (Blue Accent)

```css
:root {
  /* Backgrounds (OKLCH) */
  --bg-primary: oklch(0% 0 0);      /* True black */
  --bg-secondary: oklch(7% 0 0);    /* Slightly lifted */
  --bg-tertiary: oklch(12% 0 0);    /* Cards, elevated */
  --bg-glass: oklch(10% 0 0 / 0.6); /* Glassmorphism */
  
  /* Borders */
  --border: oklch(15% 0 0 / 0.5);
  --border-focus: oklch(60% 0.15 240 / 0.4);
  
  /* Text */
  --text-primary: oklch(95% 0 0);
  --text-secondary: oklch(70% 0 0);
  --text-tertiary: oklch(50% 0 0);
  
  /* Accent - Blue */
  --accent: oklch(60% 0.15 240);
  --accent-hover: oklch(65% 0.17 240);
  --accent-dim: oklch(60% 0.15 240 / 0.1);
  
  /* Status colors */
  --success: oklch(60% 0.15 140);
  --warning: oklch(70% 0.15 60);
  --error: oklch(60% 0.2 20);
  --info: oklch(65% 0.15 200);
}
```

**When to use**: Developer tools, dashboards, productivity apps, modern interfaces

---

### Midnight Navy (Teal Accent)

```css
:root {
  /* Navy-tinted backgrounds */
  --bg-primary: oklch(12% 0.02 240);
  --bg-secondary: oklch(18% 0.02 240);
  --bg-tertiary: oklch(24% 0.02 240);
  
  --text-primary: oklch(92% 0 0);
  --text-secondary: oklch(70% 0 0);
  
  /* Teal accent */
  --accent: oklch(60% 0.15 180);
  --accent-hover: oklch(65% 0.17 180);
  --accent-dim: oklch(60% 0.15 180 / 0.1);
}
```

**When to use**: Financial apps, professional tools, trustworthy interfaces

---

### Obsidian Green (Emerald Accent)

```css
:root {
  --bg-primary: oklch(8% 0 0);
  --bg-secondary: oklch(12% 0 0);
  --bg-tertiary: oklch(17% 0 0);
  
  --text-primary: oklch(95% 0 0);
  --text-secondary: oklch(68% 0 0);
  
  /* Emerald accent */
  --accent: oklch(60% 0.15 150);
  --accent-hover: oklch(65% 0.17 150);
  --accent-dim: oklch(60% 0.15 150 / 0.1);
}
```

**When to use**: Gaming, entertainment, creative tools

---

### Charcoal Amber (Orange Accent)

```css
:root {
  /* Warm-tinted backgrounds */
  --bg-primary: oklch(10% 0.01 30);
  --bg-secondary: oklch(15% 0.01 30);
  --bg-tertiary: oklch(22% 0.01 30);
  
  --text-primary: oklch(96% 0 0);
  --text-secondary: oklch(72% 0 0);
  
  /* Orange accent */
  --accent: oklch(65% 0.18 40);
  --accent-hover: oklch(70% 0.2 40);
  --accent-dim: oklch(65% 0.18 40 / 0.1);
}
```

**When to use**: Content platforms, creative apps, warm interfaces

---

## Light Theme Palettes

### Minimal White (Blue Accent)

```css
:root {
  --bg-primary: oklch(98% 0 0);
  --bg-secondary: oklch(95% 0 0);
  --bg-tertiary: oklch(92% 0 0);
  
  --border: oklch(85% 0 0);
  
  --text-primary: oklch(15% 0 0);
  --text-secondary: oklch(45% 0 0);
  --text-tertiary: oklch(65% 0 0);
  
  --accent: oklch(50% 0.15 240);
  --accent-hover: oklch(45% 0.17 240);
  --accent-dim: oklch(50% 0.15 240 / 0.1);
}
```

---

### Cream Editorial (Burgundy Accent)

```css
:root {
  /* Warm off-white */
  --bg-primary: oklch(97% 0.01 60);
  --bg-secondary: oklch(95% 0.01 60);
  --bg-tertiary: oklch(92% 0.01 60);
  
  --text-primary: oklch(15% 0 0);
  --text-secondary: oklch(45% 0 0);
  
  /* Burgundy accent */
  --accent: oklch(40% 0.15 10);
  --accent-gold: oklch(65% 0.15 80); /* Secondary accent */
}
```

---

### Soft Pastel (Multi-Accent)

```css
:root {
  --bg: oklch(99% 0.01 60);
  --surface: oklch(100% 0 0);
  
  --primary: oklch(75% 0.08 240);   /* Soft blue */
  --secondary: oklch(80% 0.08 350); /* Soft pink */
  --tertiary: oklch(82% 0.08 40);   /* Soft peach */
  
  --text: oklch(20% 0 0);
}
```

---

## Specialty Palettes

### Neon Cyberpunk

```css
:root {
  --bg: oklch(8% 0.02 260);
  --surface: oklch(15% 0.02 260);
  
  /* High chroma neons (C=0.3+) */
  --neon-pink: oklch(65% 0.35 350);
  --neon-blue: oklch(70% 0.30 220);
  --neon-purple: oklch(65% 0.30 300); /* Exception: intentional cyberpunk */
  --neon-green: oklch(75% 0.30 130);
  
  --text: oklch(92% 0.02 260);
}
```

---

### Earth Tones (Organic)

```css
:root {
  --earth-dark: oklch(20% 0.04 30);
  --earth-brown: oklch(35% 0.06 30);
  --earth-tan: oklch(75% 0.03 40);
  --earth-cream: oklch(95% 0.01 50);
  --earth-green: oklch(55% 0.12 130);
  --earth-terracotta: oklch(50% 0.15 25);
  
  --text-dark: oklch(20% 0 0);
  --text-light: oklch(95% 0 0);
}
```

---

### Industrial Gray

```css
:root {
  --steel: oklch(35% 0.02 240);
  --iron: oklch(45% 0.02 240);
  --concrete: oklch(60% 0.02 240);
  --silver: oklch(80% 0.01 240);
  --white: oklch(100% 0 0);
  
  --warning: oklch(65% 0.18 50);
  --success: oklch(55% 0.15 140);
  --error: oklch(55% 0.2 20);
}
```

---

## Color Usage Patterns

### 70/20/10 Rule

**70% - Dominant**
- Background colors
- Most UI surfaces
- Text color

**20% - Secondary**
- Secondary surfaces
- Secondary text
- Borders and dividers

**10% - Accent**
- Buttons, links
- Interactive elements
- Important highlights

```css
/* Example distribution */
.page {
  background: var(--bg-primary);     /* 70% */
}

.card {
  background: var(--bg-secondary);   /* 20% */
  border: 1px solid var(--border);   /* 20% */
}

.button {
  background: var(--accent);         /* 10% */
}
```

---

## Gradient Policy

### **DEFAULT: MINIMAL GRADIENTS**

❌ **Never use gradients for primary styling**:
```css
/* FORBIDDEN - Overused AI pattern */
background: linear-gradient(135deg, #667eea, #764ba2);
background: linear-gradient(to right, #8b5cf6, #ec4899);

/* NO gradients as main button/card/panel background */
.button { background: linear-gradient(...); } /* ✗ */
.card { background: linear-gradient(...); } /* ✗ */
```

**Why**: Gradients are the #1 telltale sign of AI-generated designs.

---

### ✅ **Use solid colors for primary styling**:

```css
/* Professional and modern */
.button {
  background: var(--accent); /* Solid color */
}

.button:hover {
  background: var(--accent-hover); /* Different solid color */
}

.card {
  background: var(--bg-secondary); /* Solid */
  border: 1px solid var(--border); /* Depth from borders */
}
```

---

### ✅ **Allowed: Subtle lighting-effect gradients** (SPARINGLY)

**1. Hover reveal technique** (barely visible at rest):
```css
.card-shimmer {
  background: oklch(10% 0 0);
  position: relative;
}

.card-shimmer::before {
  content: '';
  position: absolute;
  inset: 0;
  
  /* Barely visible gradient (2% lightness difference max) */
  background: linear-gradient(
    135deg,
    oklch(10% 0 0) 0%,
    oklch(12% 0 0) 50%,
    oklch(10% 0 0) 100%
  );
  
  opacity: 0;
  transition: opacity 300ms ease;
}

.card-shimmer:hover::before {
  opacity: 1; /* Reveal gradient on hover */
}
```

**2. Vertical lighting gradient** (minimal, 2-5% lightness difference):
```css
.surface-lit {
  /* Simulates overhead light - BARELY perceptible */
  background: linear-gradient(
    to bottom,
    oklch(12% 0 0),  /* Slightly lighter at top */
    oklch(10% 0 0)   /* Base color at bottom */
  );
}
```

**Rule**: If the gradient is obvious, you've gone too far. Should be nearly imperceptible.

---

### ✅ **Allowed: Functional gradients**

**Progress bars**:
```css
.progress-fill {
  background: linear-gradient(90deg, var(--accent-dim), var(--accent));
}
```

**Loading shimmers**:
```css
.loading-shimmer {
  background: linear-gradient(
    90deg,
    var(--bg-secondary) 0%,
    var(--bg-tertiary) 50%,
    var(--bg-secondary) 100%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}
```

---

### ✅ **Allowed: Explicit user request**

```
User: "Add a blue to purple gradient on the button"
→ Only then use a gradient
```

---

## Color Accessibility

### Contrast Requirements (WCAG AA)

- **Normal text**: 4.5:1 minimum
- **Large text** (18px+ or 14px+ bold): 3:1 minimum
- **UI components**: 3:1 minimum

### OKLCH Contrast Advantages

OKLCH's perceptual uniformity makes contrast more predictable:

```css
/* Predictable contrast */
color: oklch(90% 0 0);      /* Light text */
background: oklch(10% 0 0); /* Dark background */
/* Contrast ratio: ~18:1 */

color: oklch(70% 0.15 240);  /* Blue text */
background: oklch(10% 0 0);  /* Dark background */
/* Contrast ratio: ~8:1 */
```

**Rule**: For guaranteed WCAG AA compliance:
- **Dark mode**: Text lightness ≥ 70%, background lightness ≤ 20%
- **Light mode**: Text lightness ≤ 30%, background lightness ≥ 90%

### Testing Combinations

```css
/* Good: High contrast */
color: oklch(95% 0 0);
background: oklch(5% 0 0);
/* Ratio: ~19:1 ✓ */

color: oklch(60% 0.15 240);
background: oklch(5% 0 0);
/* Ratio: ~8.5:1 ✓ */

/* Bad: Low contrast */
color: oklch(50% 0 0);
background: oklch(10% 0 0);
/* Ratio: ~3:1 ✗ (fails for normal text) */
```

### Accessibility-Safe Chroma Limits

**For text** (must maintain contrast):
- Backgrounds: C ≤ 0.05 (nearly grayscale)
- Headings: C ≤ 0.1
- Body text: C ≤ 0.05

**For UI elements**:
- Buttons/Accents: C ≤ 0.2 (moderate saturation)
- Semantic indicators: C ≤ 0.15

**Exception**: Decorative elements with no text can use higher chroma (C ≤ 0.3).

---

## Contextual Color Selection

### By Industry

| Context | Recommended Palette | Accent Color |
|---------|---------------------|--------------|
| Developer tools | Ghost Dark | Blue (240°) |
| Financial apps | Midnight Navy | Teal (180°) |
| Gaming/Entertainment | Obsidian Green or Neon | Emerald (150°) or Neons |
| Content/Publishing | Cream Editorial | Burgundy (10°) |
| Health/Wellness | Soft Pastel or Organic | Soft blue (240°) or Earth green |
| B2B/Enterprise | Industrial Gray | Steel blue (240°) |
| Luxury/Premium | Editorial with Gold | Burgundy (10°) + Gold (80°) |
| Creative tools | Charcoal Amber | Orange (40°) |

---

### Quick Color Picker (OKLCH)

**Don't default to blue!** Here are excellent options:

**Cool & Professional**:
- Blue: `oklch(60% 0.15 240)`
- Teal: `oklch(60% 0.15 180)`
- Cyan: `oklch(65% 0.15 200)`
- Sky: `oklch(65% 0.15 230)`
- Indigo: `oklch(50% 0.15 260)` - *Not forbidden, different from AI purple*

**Warm & Energetic**:
- Orange: `oklch(65% 0.18 40)`
- Amber: `oklch(70% 0.15 60)`
- Red: `oklch(60% 0.2 20)`
- Coral: `oklch(70% 0.15 30)`
- Rose: `oklch(65% 0.18 350)`

**Nature & Growth**:
- Emerald: `oklch(60% 0.15 150)`
- Lime: `oklch(70% 0.18 130)`
- Forest: `oklch(45% 0.15 140)`
- Jade: `oklch(60% 0.15 170)`

**Earth & Organic**:
- Terracotta: `oklch(55% 0.15 25)`
- Brown: `oklch(40% 0.06 30)`
- Olive: `oklch(55% 0.12 120)`
- Sand: `oklch(75% 0.03 50)`

**Bold & Distinctive**:
- Magenta: `oklch(65% 0.25 330)` - *Use sparingly, not as primary*
- Electric Blue: `oklch(65% 0.2 220)`
- Chartreuse: `oklch(75% 0.18 125)`
- Deep Red: `oklch(45% 0.18 15)`

---

## Advanced: Relative Color Syntax

OKLCH supports relative colors in modern CSS:

```css
:root {
  --accent: oklch(60% 0.15 240);
}

.button {
  background: var(--accent);
}

.button:hover {
  /* Automatically calculate lighter version */
  background: oklch(from var(--accent) calc(l + 0.05) c h);
}

.button-dim {
  /* Add transparency */
  background: oklch(from var(--accent) l c h / 0.2);
}

.button-desaturated {
  /* Reduce chroma */
  background: oklch(from var(--accent) l calc(c * 0.5) h);
}
```

**Browser support**: Chrome 119+, Safari 16.4+, Firefox 128+

---

## Practical Examples

### Complete Dark Mode System (OKLCH)

```css
:root {
  /* Neutrals */
  --bg-base: oklch(0% 0 0);
  --bg-surface: oklch(7% 0 0);
  --bg-raised: oklch(12% 0 0);
  --bg-overlay: oklch(17% 0 0);
  
  --text-primary: oklch(95% 0 0);
  --text-secondary: oklch(70% 0 0);
  --text-tertiary: oklch(50% 0 0);
  
  --border: oklch(15% 0 0);
  --border-strong: oklch(25% 0 0);
  
  /* Brand - Blue */
  --primary-900: oklch(20% 0.15 240);
  --primary-700: oklch(40% 0.15 240);
  --primary-500: oklch(60% 0.15 240);
  --primary-300: oklch(80% 0.15 240);
  --primary-100: oklch(95% 0.15 240);
  
  /* Semantic */
  --success: oklch(60% 0.15 140);
  --success-bg: oklch(20% 0.08 140);
  
  --error: oklch(60% 0.2 20);
  --error-bg: oklch(20% 0.1 20);
  
  --warning: oklch(70% 0.15 60);
  --warning-bg: oklch(25% 0.08 60);
  
  --info: oklch(65% 0.15 200);
  --info-bg: oklch(20% 0.08 200);
}
```

### Complete Light Mode System (OKLCH)

```css
:root {
  /* Neutrals */
  --bg-base: oklch(95% 0 0);
  --bg-surface: oklch(100% 0 0);
  --bg-raised: oklch(98% 0 0);
  --bg-overlay: oklch(100% 0 0);
  
  --text-primary: oklch(15% 0 0);
  --text-secondary: oklch(45% 0 0);
  --text-tertiary: oklch(65% 0 0);
  
  --border: oklch(85% 0 0);
  --border-strong: oklch(75% 0 0);
  
  /* Brand - Blue */
  --primary-900: oklch(25% 0.15 240);
  --primary-700: oklch(35% 0.15 240);
  --primary-500: oklch(50% 0.15 240);
  --primary-300: oklch(70% 0.15 240);
  --primary-100: oklch(92% 0.1 240);
  
  /* Semantic */
  --success: oklch(45% 0.15 140);
  --success-bg: oklch(92% 0.08 140);
  
  --error: oklch(50% 0.2 20);
  --error-bg: oklch(95% 0.1 20);
  
  --warning: oklch(50% 0.15 60);
  --warning-bg: oklch(93% 0.08 60);
  
  --info: oklch(50% 0.15 200);
  --info-bg: oklch(92% 0.08 200);
}
```

---

## Key Takeaways

1. **Use OKLCH for modern projects** - Perceptually uniform, wider gamut, better accessibility
2. **HSL is acceptable for grayscale** - Works fine when S=0%
3. **Generate palettes mathematically** - Lock C/H, vary L linearly
4. **Keep chroma moderate** - C ≤ 0.2 for UI, ≤ 0.15 for accessibility
5. **Avoid pure extremes** - Never 0% or 100% lightness for text
6. **Gradients are for lighting effects only** - Not primary styling (SPARINGLY)
7. **Context drives color choice** - Not habit or defaults

**Remember**: Color is math. Use perceptual color spaces (OKLCH preferred) to create systematic, accessible, beautiful palettes.
