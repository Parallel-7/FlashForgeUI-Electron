# Depth & Shadows

Comprehensive guide to creating realistic depth through layering, shadows, borders, and lighting physics. Professional UIs mimic how light interacts with physical surfaces—typically from above.

---

## Core Principle: Light Physics

**The Golden Rule**: In the real world, light comes from above. Elements closer to the light source appear lighter; elements farther away appear darker.

### Dark Mode Physics
- **Top surfaces** = Lighter (closer to overhead light)
- **Bottom surfaces** = Darker (farther from light, in shadow)
- **Elevated elements** = Lighter than their background
- **Sunken elements** = Darker than their background

### Light Mode Physics
- **Top surfaces** = Slightly darker edge (defines boundary)
- **Bottom surfaces** = Cast shadow downward
- **Elevated elements** = Cast shadows below them
- **Cards/Paper** = Lighter than background (paper on desk metaphor)

**Critical Difference**: Light mode uses shadow direction more than color shifts. Dark mode uses color lightness progression more than heavy shadows.

---

## The 2-Step Depth System

### Step 1: Create Layers with Color Lightness

Use mathematical lightness progression to establish visual hierarchy.

#### Dark Mode Layering

**Base System** (starting point):
```css
:root {
  --layer-0-base: oklch(0% 0 0);      /* L: 0% - Deepest background */
  --layer-1-surface: oklch(5% 0 0);   /* L: 5% - Cards, panels */
  --layer-2-raised: oklch(10% 0 0);   /* L: 10% - Elevated elements */
  --layer-3-floating: oklch(15% 0 0); /* L: 15% - Modals, popovers */
}
```

**Progression Rule**: Increase lightness by 5-10% per layer. Elements "closer" to the user are lighter.

**Example Hierarchy**:
```css
body {
  background: var(--layer-0-base); /* 0% - Page background */
}

.card {
  background: var(--layer-1-surface); /* 5% - Elevated from page */
}

.button {
  background: var(--layer-2-raised); /* 10% - Raised on card */
}

.modal {
  background: var(--layer-3-floating); /* 15% - Floating above all */
}
```

#### Light Mode Layering

**Inverted System** (flip the logic):
```css
:root {
  /* Start by subtracting from 100%, then adjust */
  --layer-0-base: oklch(95% 0 0);     /* L: 95% - Page background */
  --layer-1-surface: oklch(100% 0 0); /* L: 100% - White cards (paper) */
  --layer-2-raised: oklch(98% 0 0);   /* L: 98% - Slightly dimmed */
  --layer-3-floating: oklch(100% 0 0);/* L: 100% - Bright modals */
}
```

**Critical Adjustment**: In light mode, cards are often LIGHTER than the base because they mimic paper on a desk (closer to overhead light = brighter). Don't just subtract from 100%—adjust manually for realism.

#### Text Hierarchy

**Dark Mode**:
```css
:root {
  --text-primary: oklch(95% 0 0);   /* High contrast, but not 100% (eye strain) */
  --text-secondary: oklch(70% 0 0); /* Muted for comfort */
  --text-tertiary: oklch(50% 0 0);  /* De-emphasized */
}
```

**Light Mode**:
```css
:root {
  --text-primary: oklch(15% 0 0);   /* Dark, but not 0% (harsh) */
  --text-secondary: oklch(40% 0 0); /* Medium gray */
  --text-tertiary: oklch(60% 0 0);  /* Light gray */
}
```

**Rule**: Never use pure black (0%) or pure white (100%) for text. It causes eye strain.

---

### Step 2: Add Shadows for Definition

Shadows define height and separation between layers.

## Shadow Techniques: 3 Levels

### Level 1: Basic Depth

**Single shadow** with light border accent:

```css
.card-basic {
  background: var(--layer-1-surface);
  
  /* Top highlight (light source hitting top edge) */
  border-top: 1px solid oklch(20% 0 0); /* Lighter than card */
  
  /* Bottom shadow (element blocking light) */
  box-shadow: 0 4px 8px oklch(0% 0 0 / 0.3);
}
```

**Dark Mode Example**:
```css
.button-basic {
  background: oklch(12% 0 0);
  border: 1px solid oklch(20% 0 0); /* Lighter border all around */
  box-shadow: 0 2px 4px oklch(0% 0 0 / 0.4);
}
```

**Light Mode Example**:
```css
.button-basic-light {
  background: oklch(98% 0 0);
  border: 1px solid oklch(85% 0 0); /* Darker border for definition */
  box-shadow: 0 2px 4px oklch(0% 0 0 / 0.15);
}
```

---

### Level 2: Enhanced Depth

**Increased blur and spread** for more prominent elevation:

```css
.card-elevated {
  background: var(--layer-2-raised);
  border-top: 1px solid oklch(25% 0 0);
  
  /* Larger, softer shadow */
  box-shadow: 0 8px 16px oklch(0% 0 0 / 0.4);
}

.card-elevated:hover {
  /* Increase shadow on interaction */
  box-shadow: 0 12px 24px oklch(0% 0 0 / 0.5);
  transform: translateY(-2px);
}
```

---

### Level 3: Advanced Realistic Depth

**Dual shadows** mimicking natural light (directional + ambient):

```css
.card-realistic {
  background: var(--layer-1-surface);
  border-top: 1px solid oklch(18% 0 0);
  
  /* Dual shadow technique */
  box-shadow: 
    /* Directional shadow: dark, short, sharp */
    0 2px 4px oklch(0% 0 0 / 0.6),
    
    /* Ambient shadow: light, long, soft */
    0 8px 24px oklch(0% 0 0 / 0.3);
}
```

**Why dual shadows?**
- **Directional**: Simulates direct overhead light (sharp, close to object)
- **Ambient**: Simulates diffused environmental light (soft, spreads far)
- **Result**: More natural, three-dimensional appearance

#### Advanced: Shadow Color Matching

Match shadow tint to background color for realism:

```css
/* On a blue-tinted background */
.card-on-blue {
  background: oklch(10% 0.02 240); /* Slight blue tint */
  
  box-shadow: 
    0 2px 4px oklch(0% 0.02 240 / 0.6),  /* Blue-tinted dark shadow */
    0 8px 24px oklch(0% 0.01 240 / 0.3); /* Blue-tinted ambient shadow */
}
```

**Technique**: Keep same hue as background, but drop lightness to near-zero and reduce chroma. Creates cohesive depth.

---

### Level 4: Material Design Elevation System

**Structured z-index hierarchy** (0-24dp scale):

```css
:root {
  /* Elevation scale (Material Design inspired) */
  --elevation-0: none;
  --elevation-1: 0 1px 3px oklch(0% 0 0 / 0.12), 0 1px 2px oklch(0% 0 0 / 0.24);
  --elevation-2: 0 3px 6px oklch(0% 0 0 / 0.16), 0 3px 6px oklch(0% 0 0 / 0.23);
  --elevation-3: 0 10px 20px oklch(0% 0 0 / 0.19), 0 6px 6px oklch(0% 0 0 / 0.23);
  --elevation-4: 0 14px 28px oklch(0% 0 0 / 0.25), 0 10px 10px oklch(0% 0 0 / 0.22);
  --elevation-5: 0 19px 38px oklch(0% 0 0 / 0.30), 0 15px 12px oklch(0% 0 0 / 0.22);
}

.card { box-shadow: var(--elevation-2); }
.modal { box-shadow: var(--elevation-4); }
.tooltip { box-shadow: var(--elevation-3); }
```

**Usage Rules**:
- 0dp: Inline with surface (no shadow)
- 1-2dp: Cards, buttons
- 3-4dp: Modals, popovers
- 5dp+: Navigation drawers, full-page overlays

---

## Sunken Elements (Inset Shadows)

For inputs, tables, and recessed UI that should feel "pressed into" the surface:

### Dark Mode Sunken

```css
.input-sunken {
  background: oklch(5% 0 0); /* Darker than surface */
  
  /* Dark shadow on TOP (light blocked from above) */
  box-shadow: 
    inset 0 2px 4px oklch(0% 0 0 / 0.5),
    
    /* Light glow on BOTTOM (light reflecting from below) */
    inset 0 -1px 2px oklch(15% 0 0 / 0.1);
}
```

### Light Mode Sunken

```css
.input-sunken-light {
  background: oklch(95% 0 0); /* Darker than white surface */
  
  /* Shadow on top edge */
  box-shadow: 
    inset 0 2px 4px oklch(0% 0 0 / 0.1);
}
```

**Dense Data Tables** (recessed to reduce visual noise):

```css
.table-dense {
  background: oklch(3% 0 0); /* Darker than page (7%) */
  box-shadow: inset 0 1px 3px oklch(0% 0 0 / 0.4);
}
```

---

## Border & Highlight Techniques

### Top Border Highlights (Dark Mode)

Simulate light hitting the top edge:

```css
.card-highlight {
  background: oklch(10% 0 0);
  
  /* Lighter top border = light reflection */
  border-top: 1px solid oklch(20% 0 0);
  
  /* Darker left/right/bottom = no direct light */
  border-left: 1px solid oklch(8% 0 0);
  border-right: 1px solid oklch(8% 0 0);
  border-bottom: 1px solid oklch(5% 0 0);
  
  box-shadow: 0 4px 8px oklch(0% 0 0 / 0.3);
}
```

**Shortcut** (if uniform is acceptable):
```css
.card-simple {
  border: 1px solid oklch(15% 0 0);
  border-top-color: oklch(20% 0 0); /* Override just top */
}
```

### Gradient Borders (Subtle)

**When to use**: For glassmorphism effects or sophisticated edge highlights.

```css
.card-gradient-border {
  background: oklch(10% 0 0);
  border: 1px solid transparent;
  
  /* Gradient border (top to bottom: light to dark) */
  background-image: 
    linear-gradient(oklch(10% 0 0), oklch(10% 0 0)), /* Inner background */
    linear-gradient(to bottom, oklch(25% 0 0), oklch(5% 0 0)); /* Border gradient */
  
  background-origin: border-box;
  background-clip: padding-box, border-box;
}
```

**Technique**: Uses double background to create gradient border effect. Outer gradient defines border, inner solid color fills content area.

---

## Light Mode Border Strategy

**Problem**: In light mode, a bright "highlight" border looks like a mistake.

**Solution**: Use darker borders for definition, rely on shadows for depth.

```css
/* Light mode card */
.card-light {
  background: oklch(100% 0 0); /* White */
  border: 1px solid oklch(85% 0 0); /* Medium-dark gray */
  box-shadow: 0 2px 8px oklch(0% 0 0 / 0.08);
}

/* Alternative: Blend border with background */
.card-light-subtle {
  background: oklch(98% 0 0);
  border: 1px solid oklch(92% 0 0); /* Barely darker */
  box-shadow: 0 4px 12px oklch(0% 0 0 / 0.1);
}
```

**Rule**: Light mode borders should define edges, not simulate light reflection.

---

## Glassmorphism Depth

**Technique**: Semi-transparent layers + blur + light borders.

```css
.glass-card {
  background: oklch(10% 0 0 / 0.6); /* 60% opacity */
  backdrop-filter: blur(12px);
  
  /* Thin, semi-transparent light border */
  border: 1px solid oklch(40% 0 0 / 0.2);
  
  /* Soft shadow */
  box-shadow: 0 8px 32px oklch(0% 0 0 / 0.4);
}

.glass-card-light {
  background: oklch(100% 0 0 / 0.7);
  backdrop-filter: blur(12px);
  border: 1px solid oklch(100% 0 0 / 0.3);
  box-shadow: 0 8px 32px oklch(0% 0 0 / 0.1);
}
```

**Best practices**:
- Background opacity: 60-80%
- Blur: 10-20px
- Border: Thin (1px), semi-transparent, lighter than background
- Use when layering over complex backgrounds

---

## Subtle Lighting Gradients

**Policy**: Gradients allowed ONLY for subtle lighting effects—not as primary styling.

### Hover Reveal Technique

```css
.card-shimmer {
  background: oklch(10% 0 0);
  position: relative;
  overflow: hidden;
}

.card-shimmer::before {
  content: '';
  position: absolute;
  inset: 0;
  
  /* Barely visible gradient */
  background: linear-gradient(
    135deg,
    oklch(10% 0 0) 0%,
    oklch(15% 0 0) 50%,
    oklch(10% 0 0) 100%
  );
  
  opacity: 0;
  transition: opacity 300ms ease;
}

.card-shimmer:hover::before {
  opacity: 1; /* Reveal gradient on hover */
}
```

**Effect**: Flat surface at rest, subtle "shiny" gradient revealed on interaction.

### Vertical Lighting Gradient (Minimal)

```css
.surface-lit {
  /* Subtle top-to-bottom gradient (simulates overhead light) */
  background: linear-gradient(
    to bottom,
    oklch(12% 0 0),  /* Slightly lighter at top */
    oklch(10% 0 0)   /* Base color at bottom */
  );
}
```

**Rule**: Gradient should be BARELY perceptible (2-5% lightness difference max). If it's obvious, you've gone too far.

---

## Hierarchy in Dense UIs

**Problem**: Dashboards with graphs, tables, and sidebars look cluttered.

**Solution**: Use depth to control visual attention.

### Pop Important Content

```css
.dashboard-page {
  background: oklch(7% 0 0); /* Darker base */
}

.dashboard-card-primary {
  background: oklch(12% 0 0); /* Lighter = "lifts off" page */
  box-shadow: 0 4px 16px oklch(0% 0 0 / 0.4);
}

.dashboard-sidebar {
  background: oklch(10% 0 0); /* Medium elevation */
}
```

### Recess Secondary Data

```css
.data-table-dense {
  background: oklch(5% 0 0); /* Darker = "sinks into" page */
  box-shadow: inset 0 1px 3px oklch(0% 0 0 / 0.3);
}
```

**Strategy**:
- **Primary content**: Lightest layer (most elevated)
- **Navigation/Sidebars**: Medium layer
- **Dense data/tables**: Darkest layer (recessed)

---

## Interactive Depth

Increase depth perception on hover/active states:

### Hover States

```css
.card-interactive {
  background: oklch(10% 0 0);
  box-shadow: 0 4px 8px oklch(0% 0 0 / 0.3);
  transition: all 200ms ease;
}

.card-interactive:hover {
  background: oklch(12% 0 0); /* Slightly lighter */
  box-shadow: 0 8px 16px oklch(0% 0 0 / 0.4); /* Larger shadow */
  transform: translateY(-2px); /* Lift up */
}
```

### Active/Pressed States

```css
.button-interactive {
  background: oklch(15% 0 0);
  box-shadow: 0 2px 4px oklch(0% 0 0 / 0.4);
  transition: all 100ms ease;
}

.button-interactive:active {
  background: oklch(10% 0 0); /* Darker (pressed down) */
  box-shadow: 0 1px 2px oklch(0% 0 0 / 0.3); /* Smaller shadow */
  transform: translateY(1px); /* Press down */
}
```

---

## Alpha Transparency for Blending

**Technique**: Use alpha values so shadows blend naturally with any background.

```css
/* Bad: Solid shadow color */
box-shadow: 0 4px 8px #000000; /* Doesn't blend */

/* Good: Alpha transparency */
box-shadow: 0 4px 8px oklch(0% 0 0 / 0.3); /* Blends with any bg */
```

**Rule**: Always use alpha (0-1) in shadows for natural blending.

**Multiple backgrounds**:
```css
.card-on-pattern {
  /* Shadow adapts to whatever background is behind it */
  box-shadow: 0 8px 24px oklch(0% 0 0 / 0.4);
}
```

---

## Implementation Checklist

Before finalizing depth/shadow implementation:

- [ ] Layers use mathematical lightness progression (5-10% increments)
- [ ] Light source is consistent (top-down in dark mode)
- [ ] Shadows use alpha transparency for blending
- [ ] Text never uses pure black (0%) or pure white (100%)
- [ ] Important content is lighter (elevated), secondary content is darker (recessed)
- [ ] Hover states increase perceived elevation
- [ ] Active states decrease perceived elevation
- [ ] Gradients (if used) are barely visible and only for lighting effects
- [ ] Border highlights match lighting direction (light on top, dark on bottom)
- [ ] Light mode uses shadows for depth, not just color shifts

---

## Common Patterns Quick Reference

### Standard Card (Dark Mode)
```css
.card {
  background: oklch(10% 0 0);
  border-top: 1px solid oklch(18% 0 0);
  border: 1px solid oklch(12% 0 0);
  box-shadow: 0 4px 8px oklch(0% 0 0 / 0.3);
}
```

### Floating Modal (Dark Mode)
```css
.modal {
  background: oklch(15% 0 0);
  border: 1px solid oklch(25% 0 0);
  box-shadow: 
    0 4px 8px oklch(0% 0 0 / 0.6),
    0 16px 48px oklch(0% 0 0 / 0.4);
}
```

### Input Field (Dark Mode Sunken)
```css
.input {
  background: oklch(5% 0 0);
  border: 1px solid oklch(10% 0 0);
  box-shadow: inset 0 2px 4px oklch(0% 0 0 / 0.4);
}

.input:focus {
  border-color: var(--accent);
  box-shadow: 
    inset 0 2px 4px oklch(0% 0 0 / 0.3),
    0 0 0 3px oklch(from var(--accent) l c h / 0.2);
}
```

### Button with Depth (Dark Mode)
```css
.button {
  background: oklch(15% 0 0);
  border: 1px solid oklch(20% 0 0);
  box-shadow: 0 2px 4px oklch(0% 0 0 / 0.4);
}

.button:hover {
  background: oklch(18% 0 0);
  box-shadow: 0 4px 8px oklch(0% 0 0 / 0.5);
}

.button:active {
  background: oklch(12% 0 0);
  box-shadow: 0 1px 2px oklch(0% 0 0 / 0.3);
}
```

### Glass Card
```css
.glass {
  background: oklch(10% 0 0 / 0.6);
  backdrop-filter: blur(12px);
  border: 1px solid oklch(40% 0 0 / 0.2);
  box-shadow: 0 8px 32px oklch(0% 0 0 / 0.4);
}
```

---

## Advanced: Tinted Shadows

Match shadow color to UI accent for cohesive design:

```css
:root {
  --accent: oklch(60% 0.15 240); /* Blue accent */
}

.card-tinted {
  background: oklch(10% 0 0);
  
  /* Shadow with same hue as accent, but very dark and desaturated */
  box-shadow: 
    0 4px 8px oklch(5% 0.02 240 / 0.6),
    0 12px 24px oklch(5% 0.01 240 / 0.3);
}
```

**Effect**: Shadows feel integrated with the color palette rather than pure black.

---

**Remember**: Depth is about creating visual hierarchy through light physics simulation. Every layer, shadow, and border should answer: "How would light interact with this in the real world?"
