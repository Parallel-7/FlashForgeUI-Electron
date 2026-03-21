# AI Pattern Avoidance

Essential guide to identifying and avoiding telltale AI-generated design patterns. **Read this before starting any project.**

---

## The Emoji Problem

### ❌ NEVER Use Emojis in Designs

**Absolute rule**: No emojis anywhere in professional designs.

```html
<!-- FORBIDDEN -->
<h1>Welcome! 👋</h1>
<button>Get Started 🚀</button>
<p>Success! ✓</p>
<label>Email 📧</label>
<div class="feature">💡 Great idea!</div>
```

**Why emojis are bad**:
- Unprofessional and amateurish
- Inconsistent rendering across platforms
- Accessibility issues
- Signal low-effort, generic design
- Make interfaces look childish

**What to use instead**:

```html
<!-- CORRECT -->
<h1>Welcome!</h1>
<button>Get Started</button>
<p class="success">✓ Success</p>  <!-- HTML entity or text, not emoji -->
<label>Email</label>
<div class="feature">
  <svg><!-- Proper icon from icon library --></svg>
  Great idea!
</div>
```

**Alternatives to emojis**:
- Icon libraries: Lucide, Heroicons, Feather Icons, etc.
- SVG icons (properly designed)
- HTML entities: ✓, ✗, →, •, etc.
- Just text (often the best choice)

**Remember**: If you're tempted to use an emoji, use an actual icon or nothing at all.

---

## The Purple Problem

### Forbidden Colors (Unless Explicitly Requested)

```css
/* NEVER use these without specific user request */
--forbidden-indigo: #6366f1;    /* Tailwind indigo-500 */
--forbidden-violet: #8b5cf6;    /* Tailwind violet-500 */
--forbidden-purple: #a855f7;    /* Tailwind purple-500 */
--forbidden-pink: #ec4899;      /* Tailwind pink-500 */
--forbidden-fuchsia: #d946ef;   /* Tailwind fuchsia-500 */
```

### Why This Happens
- Tailwind CSS used `bg-indigo-500` as default for 5+ years
- Millions of tutorials, templates, and examples
- AI training data heavily over-represents these colors
- "Tech" = "Modern" = "Purple" in training corpus

### What to Use Instead

**Blue family** (professional, trustworthy):
```css
--blue: #2196f3;
--sky: #0ea5e5;
--cyan: #06b6d4;
```

**Green family** (growth, success):
```css
--emerald: #10b981;
--teal: #14b8a6;
--lime: #84cc16;
```

**Warm family** (energy, passion):
```css
--orange: #ff9800;
--amber: #f59e0b;
--red: #ef4444;
```

**Neutral + accent** (sophisticated):
```css
--bg: #0a0a0a;
--accent: #2196f3;  /* Small amount of color goes far */
```

---

## Generic Layout Patterns

### ❌ Three-Column Feature Grid

```html
<!-- NEVER - Generic AI pattern -->
<div class="features-grid">
  <div class="feature">
    <Icon />
    <h3>Feature Title</h3>
    <p>Generic description here</p>
  </div>
  <div class="feature">
    <Icon />
    <h3>Feature Title</h3>
    <p>Generic description here</p>
  </div>
  <div class="feature">
    <Icon />
    <h3>Feature Title</h3>
    <p>Generic description here</p>
  </div>
</div>
```

**Why it's bad:**
- Perfectly symmetrical (boring)
- Stock icons make it worse
- Zero brand personality
- Exact pattern in 10,000+ SaaS sites

### ✅ Alternative Approaches

**Asymmetric grid**:
```css
.features-grid {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr;
  gap: 24px;
}

.feature:first-child {
  grid-row: 1 / 3;  /* First feature spans 2 rows */
}
```

**Bento box layout**:
```css
.bento-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  grid-template-rows: repeat(3, 200px);
  gap: 16px;
}

.large { grid-column: span 2; grid-row: span 2; }
.wide { grid-column: span 2; }
.tall { grid-row: span 2; }
```

**List with varied emphasis**:
```html
<div class="features-list">
  <div class="feature-major"><!-- Large, emphasized --></div>
  <div class="feature-minor"><!-- Smaller, supporting --></div>
  <div class="feature-minor"><!-- Smaller, supporting --></div>
</div>
```

---

## Typography Crimes

### ❌ Generic Font Defaults

```css
/* AVOID unless specifically required */
font-family: 'Inter', sans-serif;
font-family: 'Roboto', sans-serif;
font-family: 'Arial', sans-serif;
font-family: system-ui;
```

**Exception**: When user specifically requests these, or when working within an existing design system that uses them.

### ✅ Distinctive Alternatives

**For dark modern interfaces**:
```css
font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif;
```

**For editorial/luxury**:
```css
font-display: 'Playfair Display', 'Georgia', serif;
font-body: 'Crimson Pro', 'Georgia', serif;
```

**For tech/gaming**:
```css
font-display: 'Space Grotesk', sans-serif;
font-body: 'DM Sans', sans-serif;
```

**For bold/statement**:
```css
font-display: 'Archivo Black', 'Arial Black', sans-serif;
font-body: 'Work Sans', sans-serif;
```

---

## The Gradient Problem

### Why Gradients Are AI Slop

**The issue**: Gradients have become the #1 visual indicator of AI-generated designs in 2024-2025. Every generic AI design includes:
- Background gradients
- Button gradients
- Card gradients
- Text gradients

**Result**: Instant recognition as low-effort, AI-generated output.

### ❌ NEVER Use Gradients On

```css
/* FORBIDDEN - These scream "AI-generated" */

/* Background gradients */
body {
  background: linear-gradient(135deg, #667eea, #764ba2); /* ✗ */
}

/* Button gradients */
.button {
  background: linear-gradient(90deg, #6366f1, #8b5cf6); /* ✗ */
}

/* Card gradients */
.card {
  background: linear-gradient(to bottom, rgba(255,255,255,0.1), rgba(255,255,255,0.05)); /* ✗ */
}

/* Text gradients (overused) */
.heading {
  background: linear-gradient(90deg, #667eea, #764ba2);
  -webkit-background-clip: text; /* ✗ */
}

/* Panel backgrounds */
.panel {
  background: linear-gradient(180deg, #1a1a1a, #0a0a0a); /* ✗ */
}
```

### ✅ What to Use Instead

**Solid colors with subtle variations**:
```css
/* Clean, professional */
.button {
  background: var(--accent); /* ✓ Solid color */
}

.button:hover {
  background: var(--accent-hover); /* ✓ Different solid color */
}

/* Card with solid background */
.card {
  background: var(--bg-secondary); /* ✓ Solid */
  border: 1px solid var(--border); /* ✓ Subtle border adds depth */
}

/* Body with single color */
body {
  background: var(--bg-primary); /* ✓ True black or solid color */
}
```

**Add depth with layers, not gradients**:
```css
/* Use transparency and layers */
.elevated {
  background: var(--bg-tertiary);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
  border: 1px solid var(--border);
}

/* Glassmorphism (acceptable) */
.glass {
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(10px);
  border: 1px solid var(--border);
}
```

### ✅ Acceptable Gradient Usage (Rare Exceptions)

**1. Progress bars** (functional):
```css
.progress-fill {
  background: linear-gradient(90deg, var(--accent-dim), var(--accent)); /* ✓ Small functional element */
}
```

**2. When explicitly requested**:
```
User: "Make the button have a gradient from blue to purple"
→ Only then use a gradient
```

**3. Loading indicators** (functional):
```css
.loading-shimmer {
  background: linear-gradient(
    90deg,
    var(--bg-secondary) 0%,
    var(--bg-tertiary) 50%,
    var(--bg-secondary) 100%
  ); /* ✓ Functional shimmer effect */
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}
```

### The Rule

**Default: NO GRADIENTS**

Only use when:
1. User explicitly asks for one
2. Small functional element (progress bar, shimmer effect)
3. Never use on: backgrounds, cards, buttons, panels, modals, hero sections

### Why This Matters

Before gradients were overused:
- Subtle depth enhancement
- Visual interest

After AI overuse (2023-2025):
- Immediate "AI-generated" tell
- Lazy design signal
- Reduces professionalism

**Modern approach**: Solid colors, subtle borders, clever use of transparency and layers.

---

## Color Palette Mistakes

### ❌ Timid, Evenly-Distributed Palettes

```css
/* AVOID - No dominant color, everything equal */
:root {
  --color-1: #6366f1;  /* 25% usage */
  --color-2: #8b5cf6;  /* 25% usage */
  --color-3: #ec4899;  /* 25% usage */
  --color-4: #f97316;  /* 25% usage */
}
```

**Why it's bad:**
- No clear hierarchy
- Visual confusion
- Looks like a color picker demo
- No brand identity

### ✅ Dominant Color Strategy (70/20/10 Rule)

```css
/* BETTER - Clear hierarchy */
:root {
  /* Primary (70%) */
  --bg-primary: #0a0a0a;
  --bg-secondary: #121212;
  --text: #ffffff;
  
  /* Secondary (20%) */
  --bg-tertiary: #1a1a1a;
  --text-secondary: #a0a0a0;
  
  /* Accent (10%) */
  --accent: #2196f3;
  --accent-hover: #1e88e5;
}
```

---

## Border Radius Overload

### ❌ Too Rounded

```css
/* AVOID - Looks like a blob */
border-radius: 24px;  /* On small elements */
border-radius: 32px;  /* On medium cards */
border-radius: 50px;  /* On everything */
```

**When it looks bad:**
- Small buttons (looks like pills)
- Standard cards (loses structure)
- Input fields (feels unprofessional)

### ✅ Intentional Rounding

```css
/* BETTER - Context-appropriate */
.button {
  border-radius: 4px;   /* Subtle, professional */
}

.card {
  border-radius: 8px;   /* Balanced */
}

.avatar {
  border-radius: 50%;   /* Appropriate for circular */
}

.pill-button {
  border-radius: 100px; /* Intentional pill shape */
}
```

**Rule**: Keep radius ≤ 16px unless specifically going for a "soft" aesthetic or creating circular elements.

---

## Shadow Sins

### ❌ Heavy Drop Shadows

```css
/* AVOID - Looks like 2010 */
box-shadow: 0 10px 50px rgba(0, 0, 0, 0.5);
box-shadow: 0 20px 80px rgba(0, 0, 0, 0.4);
```

### ❌ Glow Effects Everywhere

```css
/* AVOID - Overused */
box-shadow: 0 0 20px var(--primary);
text-shadow: 0 0 10px var(--primary);
```

### ✅ Subtle Shadows

```css
/* BETTER - Minimal depth */
box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);      /* Subtle */
box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);      /* Moderate */

/* Or prefer borders */
border: 1px solid rgba(255, 255, 255, 0.08);
```

**Reserve glows for**:
- Neon/cyberpunk aesthetic (intentional)
- Active states (focused input)
- Loading/processing indicators

---

## Cookie-Cutter Hero Sections

### ❌ Generic Template

```html
<section class="hero" style="
  background: linear-gradient(135deg, #667eea, #764ba2);
  text-align: center;
  padding: 120px 20px;
">
  <h1>Transform Your [Something]</h1>
  <p>The ultimate solution for [generic problem]</p>
  <button>Get Started</button>
</section>
```

**Telltale signs:**
- Purple gradient background
- Centered text
- "Transform Your" or "The Ultimate" heading
- Single CTA button
- Stock illustration

### ✅ Distinctive Alternatives

**Asymmetric with visual**:
```html
<section class="hero">
  <div class="hero-content">
    <h1>Specific, Context-Driven Headline</h1>
    <p>Concrete value proposition</p>
    <div class="hero-actions">
      <button>Primary CTA</button>
      <a href="#">Secondary action</a>
    </div>
  </div>
  <div class="hero-visual">
    <!-- Custom illustration or screenshot -->
  </div>
</section>
```

**Split screen**:
```css
.hero {
  display: grid;
  grid-template-columns: 1fr 1fr;
  min-height: 100vh;
}

.hero-left {
  background: var(--dark);
  padding: 80px;
}

.hero-right {
  background: url(...);
  background-size: cover;
}
```

---

## Animation Patterns to Avoid

### ❌ Generic Fade-Only Hovers

```css
/* BORING */
.element:hover {
  opacity: 0.8;
  transition: opacity 200ms;
}
```

### ✅ Purposeful Micro-Interactions

```css
/* BETTER - Intentional movement */
.card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.2);
  transition: transform 200ms ease, box-shadow 200ms ease;
}

.button:active {
  transform: scale(0.98);
}

/* Strategic stagger */
.list-item {
  animation: slideIn 300ms ease;
  animation-fill-mode: backwards;
}

.list-item:nth-child(1) { animation-delay: 0ms; }
.list-item:nth-child(2) { animation-delay: 100ms; }
.list-item:nth-child(3) { animation-delay: 200ms; }
```

---

## Stock Icon Overuse

### ❌ Untouched Icon Libraries

```jsx
// AVOID - Default icons with no customization
<CheckCircleIcon className="icon" />
<UserIcon className="icon" />
<MailIcon className="icon" />
```

**Why it's bad:**
- Everyone recognizes default icon sets
- No brand customization
- Often paired with generic layouts

### ✅ Custom or Styled Icons

```css
/* Customize size, color, stroke */
.icon {
  width: 24px;
  height: 24px;
  stroke: var(--accent);
  stroke-width: 1.5;
  fill: none;
}

/* Or use custom graphics */
.icon-custom {
  background: url('custom-icon.svg');
  width: 32px;
  height: 32px;
}
```

---

## Detection Checklist

Before shipping, ask yourself:

1. **Color check**:
   - [ ] Is purple (#6366f1, #8b5cf6, etc.) the primary color? ❌
   - [ ] Do I have a dominant color (70%) with strategic accents? ✅

2. **Layout check**:
   - [ ] Is it a perfect three-column grid? ❌
   - [ ] Does it use asymmetry or varied sizing? ✅

3. **Typography check**:
   - [ ] Am I using Inter/Roboto without intention? ❌
   - [ ] Did I choose fonts that fit the aesthetic? ✅

4. **Pattern check**:
   - [ ] Could this be mistaken for a Tailwind UI demo? ❌
   - [ ] Does it have a clear, distinctive aesthetic? ✅

5. **Effort check**:
   - [ ] Did I spend < 5 minutes on this design? ❌
   - [ ] Did I make intentional choices throughout? ✅

---

## The Golden Rule

**If someone sees it and says "this looks AI-generated," you've failed.**

The solution isn't to avoid AI assistance—it's to make intentional choices that reflect the specific context, brand, and purpose of what you're building.

## Quick Fixes for Common AI Patterns

| If you have... | Quick fix |
|----------------|-----------|
| Purple primary color | Change to blue (#2196f3), teal (#14b8a6), or brand color |
| Three-column grid | Make one column larger, or use 2+1 layout |
| Inter/Roboto font | Switch to Apple system fonts or distinctive alternative |
| Generic gradients | Use solid colors, or create custom gradient with brand colors |
| Opacity hover only | Add transform, shadow, or color change |
| Perfectly centered hero | Make it asymmetric or split-screen |
| Stock icons | Customize size, color, stroke-width, or create custom |
| Heavy shadows | Use subtle shadows or borders instead |
| Rounded everything | Use sharper 4-8px radius for most elements |

Remember: These patterns became generic because they work—but that doesn't mean you should use them. Find what works for your specific context.
