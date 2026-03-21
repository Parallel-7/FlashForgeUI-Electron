# Design Presets

**IMPORTANT**: These are complete examples showing different aesthetic directions. They are **INSPIRATION and STARTING POINTS**, not defaults to copy blindly. Mix elements, create variations, or design something entirely new.

**Your goal**: Use these to understand how complete design systems work, then create your own unique direction based on your specific context.

**DON'T default to any of these** - choose colors, typography, and effects based on what fits YOUR specific project.

---

## Core Concepts

### Dark Themes vs. Glassmorphism

These are **separate, independent concepts** that can be combined or used alone:

**Dark Themes**:
- True blacks (#0a0a0a) or near-blacks
- High contrast with white/light text
- Professional, modern aesthetic
- Good for: Developer tools, entertainment, focus-heavy apps

**Glassmorphism**:
- Semi-transparent backgrounds with blur effects
- `backdrop-filter: blur(10px)` is the key
- Works on BOTH dark and light themes
- Apple-inspired, modern feel
- Good for: Modern apps, overlays, elevated surfaces

**You can mix and match**:
- Dark + Glass (modern, Apple-style)
- Dark + Flat (bold, high contrast)
- Light + Glass (soft, ethereal)
- Light + Flat (clean, minimal)

---

## Example 1: Dark + Blue Accent

**Characteristics**: Clean, professional, high contrast

```css
:root {
  /* Dark theme */
  --bg-primary: #0a0a0a;
  --bg-secondary: #121212;
  --border: rgba(255, 255, 255, 0.08);
  --text-primary: #ffffff;
  --text-secondary: #a0a0a0;
  
  /* Blue accent - could be ANY color! */
  --accent: #2196f3;
  --accent-hover: #1e88e5;
}

.card-flat {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
}

.card-glass {
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(10px);
  border: 1px solid var(--border);
}
```

---

## Example 2: Dark + Orange Accent

**Characteristics**: Warm, energetic, creative

```css
:root {
  --bg-primary: #1c1917;
  --bg-secondary: #292524;
  --text-primary: #fafaf9;
  
  /* Orange - different from blue! */
  --accent: #f97316;
  --accent-hover: #ea580c;
}
```

---

## Example 3: Light + Teal Accent

**Characteristics**: Professional, trustworthy, clean

```css
:root {
  --bg-primary: #ffffff;
  --bg-secondary: #f8f9fa;
  --text-primary: #1a1a1a;
  
  /* Teal - also not blue! */
  --accent: #14b8a6;
  --accent-hover: #0d9488;
}
```

---

## Example 4: Editorial (Light + Burgundy)

**Characteristics**: Elegant, reading-focused, luxurious

```css
:root {
  --bg-cream: #faf8f5;
  --text-primary: #1a1a1a;
  --accent-burgundy: #8b2635;
  --accent-gold: #d4af37;
  
  --font-display: 'Playfair Display', serif;
  --font-body: 'Crimson Pro', serif;
}

.article-title {
  font-family: var(--font-display);
  font-size: 48px;
  line-height: 1.1;
  color: var(--accent-burgundy);
}
```

---

## Example 5: Brutalist (High Contrast)

**Characteristics**: Bold, raw, structural

```css
:root {
  --bg: #ffffff;
  --text: #000000;
  --accent: #ff0000;
  --border: #000000;
  
  --font-display: 'Space Grotesk', sans-serif;
  --font-mono: 'IBM Plex Mono', monospace;
}

.brutalist-card {
  border: 4px solid var(--border);
  background: var(--bg);
  box-shadow: 8px 8px 0 var(--accent);
}

.brutalist-heading {
  font-size: 64px;
  font-weight: 900;
  text-transform: uppercase;
}
```

---

## Example 6: Soft Pastel (Light + Multi-Color)

**Characteristics**: Gentle, approachable, friendly

```css
:root {
  --bg: #fdfbf9;
  --surface: #ffffff;
  
  --primary: #a8d5e2;    /* Soft blue */
  --secondary: #f9c5d5;  /* Soft pink */
  --accent: #fed9b7;     /* Soft peach */
  
  --font-display: 'DM Sans', sans-serif;
}

.soft-card {
  background: var(--surface);
  border: 2px solid var(--primary);
  border-radius: 24px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.08);
}
```

---

## Example 7: Neon Cyberpunk

**Characteristics**: Futuristic, high-energy, gaming

```css
:root {
  --bg: #0a0e27;
  --surface: #1a1f3a;
  
  --neon-pink: #ff006e;
  --neon-blue: #00f5ff;
  --neon-green: #39ff14;
}

.neon-card {
  background: var(--surface);
  border: 2px solid var(--neon-blue);
  box-shadow: 0 0 10px var(--neon-blue);
  clip-path: polygon(0 0, calc(100% - 20px) 0, 100% 20px, 100% 100%, 20px 100%, 0 calc(100% - 20px));
}

.neon-text {
  color: var(--neon-pink);
  text-shadow: 0 0 10px var(--neon-pink);
}
```

---

## Example 8: Organic Earth Tones

**Characteristics**: Natural, warm, sustainable

```css
:root {
  --earth-dark: #3e2723;
  --earth-brown: #6d4c41;
  --earth-cream: #f5f5f5;
  --earth-green: #7cb342;
  --earth-terracotta: #d84315;
  
  --font-display: 'Merriweather', serif;
}

.organic-card {
  background: var(--earth-cream);
  border-radius: 40px 8px 40px 8px;  /* Asymmetric organic */
  box-shadow: 0 8px 32px rgba(62, 39, 35, 0.12);
}
```

---

## Example 9: Industrial Utilitarian

**Characteristics**: Functional, grid-based, no-nonsense

```css
:root {
  --steel: #455a64;
  --concrete: #90a4ae;
  --white: #ffffff;
  --warning: #ff9800;
  
  --font-mono: 'JetBrains Mono', monospace;
}

.industrial-panel {
  background: var(--white);
  border-left: 4px solid var(--steel);
  padding: 24px;
}

.industrial-label {
  font-family: var(--font-mono);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}
```

---

## Example 10: Art Deco Geometric

**Characteristics**: Luxurious, geometric, symmetrical

```css
:root {
  --gold: #d4af37;
  --black: #000000;
  --cream: #f5e6d3;
  --navy: #1a2332;
  
  --font-display: 'Cinzel', serif;
}

.deco-card {
  background: var(--cream);
  border: 3px solid var(--gold);
}

/* Decorative corners */
.deco-card::before,
.deco-card::after {
  content: '';
  position: absolute;
  width: 40px;
  height: 40px;
  border: 3px solid var(--gold);
}
```

---

## Color Variety Examples

**Don't default to blue!** Here are colors that work great:

**Cool tones**:
- Blue: `#2196f3` (classic, trustworthy)
- Teal: `#14b8a6` (modern, fresh)
- Cyan: `#06b6d4` (tech, bright)
- Mint: `#10b981` (calm, growth)

**Warm tones**:
- Orange: `#ff9800` (energetic, creative)
- Amber: `#f59e0b` (warm, inviting)
- Red: `#ef4444` (bold, urgent)
- Coral: `#ff6b6b` (friendly, vibrant)

**Earth tones**:
- Forest: `#059669` (natural, stable)
- Terracotta: `#d84315` (warm, earthy)
- Brown: `#6d4c41` (organic, grounded)
- Olive: `#7cb342` (natural, sustainable)

**Neutrals + Accent**:
- Pure black + any single color
- True white + any single color
- Monochrome with subtle accent

**The key**: Match color to context, brand, and emotion - not habit.

---

## Mixing & Matching

**Example combinations**:

- Dark theme + Orange accent + Sans-serif = Creative tech tool
- Light theme + Teal accent + Serif = Professional publishing
- Dark + Glass + Blue = Modern productivity app
- Light + Flat + Burgundy = Luxury editorial
- Dark + Flat + Red = Bold gaming interface

**Remember**: These presets show WHAT'S POSSIBLE. Your job is to create something unique for your specific context.
