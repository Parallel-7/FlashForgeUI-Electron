# Layout Patterns

Comprehensive guide to layout systems that break from predictable patterns while maintaining usability.

## Core Layout Principles

1. **Avoid perfect symmetry** - Intentional asymmetry creates interest
2. **Generous spacing** - Let content breathe
3. **Clear hierarchy** - Visual weight guides attention
4. **Responsive by default** - Mobile-first approach
5. **Consistent gaps** - Use spacing system (24px default)

---

## Container Systems

### Standard Container

```css
.container {
  max-width: 1280px;
  margin: 0 auto;
  padding: 0 32px;
}

@media (max-width: 768px) {
  .container {
    padding: 0 20px;
  }
}
```

### Narrow Content Container (Editorial)

```css
.container-narrow {
  max-width: 680px;
  margin: 0 auto;
  padding: 0 20px;
}
```

### Full-Bleed with Content

```css
.full-bleed {
  width: 100vw;
  margin-left: calc(-50vw + 50%);
}

.full-bleed-inner {
  max-width: 1280px;
  margin: 0 auto;
  padding: 0 32px;
}
```

---

## Grid Systems

### 12-Column Grid (Standard)

```css
.grid-12 {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: 24px;
}

.span-6 { grid-column: span 6; }
.span-4 { grid-column: span 4; }
.span-3 { grid-column: span 3; }

@media (max-width: 768px) {
  .grid-12 {
    grid-template-columns: 1fr;
  }
  
  .span-6,
  .span-4,
  .span-3 {
    grid-column: span 1;
  }
}
```

### Asymmetric Grid (Interesting)

```css
/* 2/1 split - Large left, small right */
.grid-asymmetric {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 24px;
}

/* 1/2/1 split - Emphasis in middle */
.grid-sidebar-both {
  display: grid;
  grid-template-columns: 1fr 2fr 1fr;
  gap: 24px;
}
```

### Bento Grid (Modern)

```css
.bento-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  grid-auto-rows: 200px;
  gap: 16px;
}

/* Size variants */
.large {
  grid-column: span 2;
  grid-row: span 2;
}

.wide {
  grid-column: span 2;
}

.tall {
  grid-row: span 2;
}

@media (max-width: 768px) {
  .bento-grid {
    grid-template-columns: 1fr;
    grid-auto-rows: auto;
  }
  
  .large,
  .wide,
  .tall {
    grid-column: span 1;
    grid-row: span 1;
  }
}
```

---

## Navigation Patterns

### Sidebar Navigation

```css
.layout-sidebar {
  display: grid;
  grid-template-columns: 280px 1fr;
  min-height: 100vh;
}

.sidebar {
  background: var(--bg-primary);
  border-right: 1px solid var(--border);
  padding: 24px;
  position: sticky;
  top: 0;
  height: 100vh;
  overflow-y: auto;
}

.main-content {
  padding: 32px;
}

@media (max-width: 1024px) {
  .layout-sidebar {
    grid-template-columns: 1fr;
  }
  
  .sidebar {
    position: static;
    height: auto;
    border-right: none;
    border-bottom: 1px solid var(--border);
  }
}
```

### Top Navigation + Sidebar

```css
.app-layout {
  display: grid;
  grid-template-areas:
    "sidebar header"
    "sidebar main";
  grid-template-columns: 280px 1fr;
  grid-template-rows: auto 1fr;
  min-height: 100vh;
}

.app-sidebar {
  grid-area: sidebar;
  background: var(--bg-primary);
  border-right: 1px solid var(--border);
}

.app-header {
  grid-area: header;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border);
  padding: 16px 32px;
}

.app-main {
  grid-area: main;
  padding: 32px;
}
```

### Floating Navigation (Modern)

```css
.nav-floating {
  position: fixed;
  top: 24px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 100;
  
  background: var(--bg-glass);
  backdrop-filter: blur(10px);
  border: 1px solid var(--border);
  border-radius: 100px;
  padding: 8px 16px;
}
```

---

## Page Layouts

### Hero Section (Asymmetric)

```css
.hero {
  display: grid;
  grid-template-columns: 1.2fr 1fr;
  gap: 64px;
  min-height: 80vh;
  align-items: center;
  padding: 64px 32px;
}

.hero-content {
  /* Larger left side */
}

.hero-visual {
  /* Smaller right side */
}

@media (max-width: 768px) {
  .hero {
    grid-template-columns: 1fr;
    min-height: auto;
    gap: 32px;
  }
}
```

### Split Screen

```css
.split-screen {
  display: grid;
  grid-template-columns: 1fr 1fr;
  min-height: 100vh;
}

.split-left {
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 80px;
  background: var(--bg-primary);
}

.split-right {
  background: url(...);
  background-size: cover;
  background-position: center;
}

@media (max-width: 768px) {
  .split-screen {
    grid-template-columns: 1fr;
  }
  
  .split-right {
    min-height: 50vh;
  }
}
```

### Dashboard Layout

```css
.dashboard {
  display: grid;
  grid-template-areas:
    "sidebar header header"
    "sidebar main main"
    "sidebar main main";
  grid-template-columns: 280px 1fr;
  grid-template-rows: auto 1fr;
  min-height: 100vh;
  gap: 0;
}

.dashboard-sidebar {
  grid-area: sidebar;
  background: var(--bg-primary);
  border-right: 1px solid var(--border);
  padding: 24px;
}

.dashboard-header {
  grid-area: header;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border);
  padding: 16px 32px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.dashboard-main {
  grid-area: main;
  padding: 32px;
  background: var(--bg-primary);
}
```

### Magazine Layout

```css
.magazine-grid {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  grid-auto-rows: 300px;
  gap: 24px;
}

/* Feature article - Large */
.article-feature {
  grid-column: 1 / 8;
  grid-row: span 2;
}

/* Secondary articles */
.article-secondary {
  grid-column: span 5;
}

/* Small articles */
.article-small {
  grid-column: span 4;
}

@media (max-width: 768px) {
  .magazine-grid {
    grid-template-columns: 1fr;
    grid-auto-rows: auto;
  }
  
  .article-feature,
  .article-secondary,
  .article-small {
    grid-column: 1;
  }
}
```

---

## Card Layouts

### Standard Card Grid

```css
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 24px;
}

@media (max-width: 640px) {
  .card-grid {
    grid-template-columns: 1fr;
  }
}
```

### Masonry Grid (Pinterest-style)

```css
.masonry-grid {
  column-count: 3;
  column-gap: 24px;
}

.masonry-item {
  break-inside: avoid;
  margin-bottom: 24px;
}

@media (max-width: 1024px) {
  .masonry-grid {
    column-count: 2;
  }
}

@media (max-width: 640px) {
  .masonry-grid {
    column-count: 1;
  }
}
```

### Feature + Grid Combo

```css
.feature-grid {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr;
  gap: 24px;
}

.feature-card {
  grid-row: 1 / 3;
}

@media (max-width: 768px) {
  .feature-grid {
    grid-template-columns: 1fr;
  }
  
  .feature-card {
    grid-row: auto;
  }
}
```

---

## Content Layouts

### Article Layout (Editorial)

```css
.article {
  max-width: 680px;
  margin: 120px auto;
}

.article-title {
  font-size: 48px;
  line-height: 1.1;
  margin-bottom: 24px;
}

.article-meta {
  display: flex;
  gap: 16px;
  margin-bottom: 48px;
  color: var(--text-secondary);
  font-size: 14px;
}

.article-body {
  font-size: 21px;
  line-height: 1.8;
}

.article-body p {
  margin-bottom: 32px;
}

.article-body img {
  width: 100%;
  height: auto;
  margin: 48px 0;
  border-radius: 8px;
}
```

### Two-Column Article

```css
.article-two-col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 48px;
  max-width: 1200px;
  margin: 0 auto;
}

@media (max-width: 768px) {
  .article-two-col {
    grid-template-columns: 1fr;
    gap: 24px;
  }
}
```

---

## Spacing System

### Consistent Spacing

```css
:root {
  /* 4px base unit */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-6: 24px;    /* Default gap */
  --space-8: 32px;
  --space-12: 48px;
  --space-16: 64px;
  --space-20: 80px;
  --space-24: 96px;
  --space-32: 128px;
}

/* Utility classes */
.p-4 { padding: var(--space-4); }
.p-6 { padding: var(--space-6); }
.p-8 { padding: var(--space-8); }

.gap-4 { gap: var(--space-4); }
.gap-6 { gap: var(--space-6); }
.gap-8 { gap: var(--space-8); }
```

---

## Z-Index Scale

```css
:root {
  --z-base: 0;
  --z-dropdown: 100;
  --z-sticky: 200;
  --z-fixed: 300;
  --z-modal-backdrop: 400;
  --z-modal: 500;
  --z-popover: 600;
  --z-tooltip: 700;
}
```

---

## Responsive Breakpoints

```css
/* Mobile-first approach */

/* Extra small devices (phones) */
/* No media query needed - this is default */

/* Small devices (tablets) */
@media (min-width: 640px) {
  /* sm */
}

/* Medium devices (tablets landscape) */
@media (min-width: 768px) {
  /* md */
}

/* Large devices (laptops) */
@media (min-width: 1024px) {
  /* lg */
}

/* Extra large devices (desktops) */
@media (min-width: 1280px) {
  /* xl */
}

/* 2x large devices (large desktops) */
@media (min-width: 1536px) {
  /* 2xl */
}
```

---

## Layout Best Practices

### Do's

✅ Start with mobile layout, enhance for larger screens
✅ Use CSS Grid for 2D layouts (rows + columns)
✅ Use Flexbox for 1D layouts (single direction)
✅ Let content determine height when possible
✅ Limit text width to 65-80 characters for readability
✅ Use consistent spacing from your spacing system
✅ Embrace asymmetry for visual interest
✅ Use sticky positioning for persistent navigation

### Don'ts

❌ Don't force perfect symmetry everywhere
❌ Don't use fixed heights unnecessarily
❌ Don't create three-column grids without variation
❌ Don't crowd elements - spacing is design
❌ Don't nest grids excessively
❌ Don't ignore mobile users
❌ Don't use `position: absolute` as primary layout tool

---

## Common Layout Mistakes

### ❌ Perfect Three-Column Grid

```css
.features {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 24px;
}
```

**Problem**: Predictable, boring, seen everywhere

### ✅ Varied Grid

```css
.features {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr;
  gap: 24px;
}

.features > :first-child {
  grid-row: 1 / 3;
}
```

**Better**: First item spans more space, creates interest

---

## Quick Layout Decision Tree

1. **One dimension** (row OR column)? → Flexbox
2. **Two dimensions** (rows AND columns)? → Grid
3. **Need overlap**? → Grid with explicit placement
4. **Side-by-side equal items**? → Grid with `auto-fit` or `auto-fill`
5. **Complex magazine layout**? → Grid with named areas
6. **Simple stack**? → Flexbox column
7. **Navigation bar**? → Flexbox row
8. **Dashboard**? → Grid with template areas

---

## Layout Patterns by Context

| Context | Recommended Layout |
|---------|-------------------|
| Landing page | Hero (asymmetric) + Feature grid (varied) |
| Dashboard | Sidebar + Header + Main (grid areas) |
| Article | Narrow container (680px max) |
| Portfolio | Masonry grid or Bento grid |
| SaaS features | Varied card grid (not 3-column) |
| Gallery | Grid with auto-fill + masonry |
| Documentation | Sidebar + Content (2-column) |
| E-commerce | Grid with featured + regular items |

Remember: Layout should support content, not fight it. Choose patterns that make sense for your specific use case, not just what looks "designed."
