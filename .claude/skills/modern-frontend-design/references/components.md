# Component Library

Complete collection of UI components with code examples. All components follow the modern design principles and avoid AI patterns.

## Buttons

### Primary Button (Ghost Dark Style)

```css
.btn-primary {
  background: var(--accent, #2196f3);
  color: white;
  border: none;
  border-radius: 4px;
  padding: 12px 24px;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  transition: background 200ms ease;
}

.btn-primary:hover {
  background: var(--accent-hover, #1e88e5);
}

.btn-primary:active {
  transform: scale(0.98);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

### Secondary Button

```css
.btn-secondary {
  background: transparent;
  color: var(--accent, #2196f3);
  border: 1px solid var(--accent, #2196f3);
  border-radius: 4px;
  padding: 12px 24px;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  transition: all 200ms ease;
}

.btn-secondary:hover {
  background: var(--accent-dim, rgba(33, 150, 243, 0.1));
}
```

### Ghost Button

```css
.btn-ghost {
  background: transparent;
  color: var(--text-primary, white);
  border: none;
  padding: 12px 24px;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  transition: background 200ms ease;
}

.btn-ghost:hover {
  background: var(--bg-tertiary, rgba(255, 255, 255, 0.05));
}
```

### Icon Button

```css
.btn-icon {
  background: transparent;
  border: none;
  padding: 8px;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  cursor: pointer;
  transition: background 200ms ease;
}

.btn-icon:hover {
  background: var(--bg-tertiary, rgba(255, 255, 255, 0.05));
}

.btn-icon svg {
  width: 20px;
  height: 20px;
  stroke: currentColor;
}
```

---

## Form Elements

### Input Field

```css
.input {
  background: var(--bg-secondary, #121212);
  border: 1px solid var(--border, rgba(255, 255, 255, 0.08));
  border-radius: 4px;
  padding: 12px 16px;
  font-size: 15px;
  color: var(--text-primary, white);
  width: 100%;
  transition: border-color 200ms ease;
}

.input:focus {
  outline: none;
  border-color: var(--accent, #2196f3);
}

.input::placeholder {
  color: var(--text-tertiary, #6b6b6b);
}

.input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

### Textarea

```css
.textarea {
  background: var(--bg-secondary, #121212);
  border: 1px solid var(--border, rgba(255, 255, 255, 0.08));
  border-radius: 4px;
  padding: 12px 16px;
  font-size: 15px;
  color: var(--text-primary, white);
  width: 100%;
  min-height: 120px;
  resize: vertical;
  font-family: inherit;
  transition: border-color 200ms ease;
}

.textarea:focus {
  outline: none;
  border-color: var(--accent, #2196f3);
}
```

### Select Dropdown

```css
.select {
  background: var(--bg-secondary, #121212);
  border: 1px solid var(--border, rgba(255, 255, 255, 0.08));
  border-radius: 4px;
  padding: 12px 16px;
  padding-right: 40px;
  font-size: 15px;
  color: var(--text-primary, white);
  width: 100%;
  cursor: pointer;
  appearance: none;
  background-image: url("data:image/svg+xml,..."); /* Chevron icon */
  background-repeat: no-repeat;
  background-position: right 12px center;
  background-size: 16px;
}

.select:focus {
  outline: none;
  border-color: var(--accent, #2196f3);
}
```

### Label

```css
.label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary, #a0a0a0);
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
```

---

## Toggle & Checkboxes

### Toggle Switch

```css
.toggle {
  position: relative;
  width: 48px;
  height: 24px;
  background: var(--bg-tertiary, #1a1a1a);
  border-radius: 100px;
  cursor: pointer;
  transition: background 200ms ease;
}

.toggle.active {
  background: var(--accent, #2196f3);
}

.toggle::after {
  content: '';
  position: absolute;
  left: 2px;
  top: 2px;
  width: 20px;
  height: 20px;
  background: white;
  border-radius: 50%;
  transition: transform 200ms ease;
}

.toggle.active::after {
  transform: translateX(24px);
}
```

### Checkbox

```css
.checkbox {
  appearance: none;
  width: 20px;
  height: 20px;
  border: 2px solid var(--border, rgba(255, 255, 255, 0.08));
  border-radius: 4px;
  background: var(--bg-secondary, #121212);
  cursor: pointer;
  position: relative;
  transition: all 200ms ease;
}

.checkbox:checked {
  background: var(--accent, #2196f3);
  border-color: var(--accent, #2196f3);
}

.checkbox:checked::after {
  content: '';
  position: absolute;
  left: 5px;
  top: 2px;
  width: 6px;
  height: 10px;
  border: solid white;
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}
```

### Radio Button

```css
.radio {
  appearance: none;
  width: 20px;
  height: 20px;
  border: 2px solid var(--border, rgba(255, 255, 255, 0.08));
  border-radius: 50%;
  background: var(--bg-secondary, #121212);
  cursor: pointer;
  position: relative;
  transition: all 200ms ease;
}

.radio:checked {
  border-color: var(--accent, #2196f3);
}

.radio:checked::after {
  content: '';
  position: absolute;
  left: 4px;
  top: 4px;
  width: 8px;
  height: 8px;
  background: var(--accent, #2196f3);
  border-radius: 50%;
}
```

---

## Cards

### Basic Card (Glassmorphic)

```css
.card {
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(10px) saturate(180%);
  border: 1px solid var(--border, rgba(255, 255, 255, 0.08));
  border-radius: 12px;
  padding: 24px;
}
```

### Card with Hover

```css
.card-interactive {
  background: var(--bg-secondary, #121212);
  border: 1px solid var(--border, rgba(255, 255, 255, 0.08));
  border-radius: 8px;
  padding: 24px;
  cursor: pointer;
  transition: all 200ms ease;
}

.card-interactive:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.3);
  border-color: var(--accent, #2196f3);
}
```

### Card with Header

```html
<div class="card">
  <div class="card-header">
    <h3>Card Title</h3>
    <button class="btn-icon">⋮</button>
  </div>
  <div class="card-body">
    Content goes here
  </div>
  <div class="card-footer">
    <button class="btn-secondary">Action</button>
  </div>
</div>
```

```css
.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border, rgba(255, 255, 255, 0.08));
}

.card-body {
  margin-bottom: 16px;
}

.card-footer {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}
```

---

## Modals

### Modal Overlay & Container

```css
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: fadeIn 200ms ease;
}

.modal {
  background: var(--bg-primary, #0a0a0a);
  border: 1px solid var(--border, rgba(255, 255, 255, 0.08));
  border-radius: 12px;
  max-width: 600px;
  width: 90%;
  max-height: 90vh;
  overflow-y: auto;
  animation: slideUp 300ms ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideUp {
  from { 
    opacity: 0;
    transform: translateY(20px);
  }
  to { 
    opacity: 1;
    transform: translateY(0);
  }
}
```

---

## Badges & Tags

### Badge

```css
.badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 12px;
  border-radius: 100px;
  font-size: 12px;
  font-weight: 500;
  background: var(--accent-dim, rgba(33, 150, 243, 0.1));
  color: var(--accent, #2196f3);
}

.badge-success {
  background: rgba(16, 185, 129, 0.1);
  color: #10b981;
}

.badge-warning {
  background: rgba(245, 158, 11, 0.1);
  color: #f59e0b;
}

.badge-error {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}
```

---

## Progress Indicators

### Progress Bar

```css
.progress-bar {
  width: 100%;
  height: 8px;
  background: var(--bg-tertiary, #1a1a1a);
  border-radius: 100px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--accent, #2196f3);
  border-radius: 100px;
  transition: width 300ms ease;
}
```

### Spinner

```css
.spinner {
  width: 24px;
  height: 24px;
  border: 3px solid var(--bg-tertiary, #1a1a1a);
  border-top-color: var(--accent, #2196f3);
  border-radius: 50%;
  animation: spin 600ms linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
```

### Loading Skeleton

```css
.skeleton {
  /* Exception: Shimmer effect is functional, not decorative */
  background: linear-gradient(
    90deg,
    var(--bg-secondary, #121212) 0%,
    var(--bg-tertiary, #1a1a1a) 50%,
    var(--bg-secondary, #121212) 100%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 4px;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.skeleton-text {
  height: 16px;
  margin-bottom: 8px;
}

.skeleton-title {
  height: 24px;
  width: 60%;
  margin-bottom: 16px;
}
```

---

## Tooltips

```css
.tooltip-container {
  position: relative;
  display: inline-block;
}

.tooltip {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
  padding: 8px 12px;
  background: var(--bg-primary, #0a0a0a);
  border: 1px solid var(--border, rgba(255, 255, 255, 0.08));
  border-radius: 4px;
  font-size: 13px;
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  transition: opacity 200ms ease;
}

.tooltip-container:hover .tooltip {
  opacity: 1;
}

.tooltip::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 4px solid transparent;
  border-top-color: var(--border, rgba(255, 255, 255, 0.08));
}
```

---

## Tabs

```css
.tabs {
  display: flex;
  gap: 4px;
  border-bottom: 1px solid var(--border, rgba(255, 255, 255, 0.08));
  margin-bottom: 24px;
}

.tab {
  padding: 12px 20px;
  background: transparent;
  border: none;
  color: var(--text-secondary, #a0a0a0);
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  position: relative;
  transition: color 200ms ease;
}

.tab:hover {
  color: var(--text-primary, white);
}

.tab.active {
  color: var(--accent, #2196f3);
}

.tab.active::after {
  content: '';
  position: absolute;
  bottom: -1px;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--accent, #2196f3);
}
```

---

## Avatars

```css
.avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  overflow: hidden;
  background: var(--bg-tertiary, #1a1a1a);
  display: flex;
  align-items: center;
  justify-content: center;
}

.avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-initials {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary, white);
}

/* Size variants */
.avatar-sm { width: 32px; height: 32px; font-size: 14px; }
.avatar-md { width: 40px; height: 40px; font-size: 16px; }
.avatar-lg { width: 56px; height: 56px; font-size: 20px; }
.avatar-xl { width: 80px; height: 80px; font-size: 28px; }
```

---

## Dividers

```css
.divider {
  height: 1px;
  background: var(--border, rgba(255, 255, 255, 0.08));
  margin: 24px 0;
}

.divider-text {
  display: flex;
  align-items: center;
  gap: 16px;
  margin: 24px 0;
  color: var(--text-secondary, #a0a0a0);
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.divider-text::before,
.divider-text::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--border, rgba(255, 255, 255, 0.08));
}
```

---

## Usage Notes

1. **CSS Variables**: All components use CSS variables for easy theming
2. **Dark-first**: Designed for dark themes, easily adaptable to light
3. **Consistent Spacing**: Uses 4px base unit (12px, 16px, 24px, etc.)
4. **Minimal Borders**: Subtle borders, no heavy shadows
5. **Smooth Transitions**: 200-300ms for most interactions
6. **Accessibility**: Proper focus states, keyboard navigation support

Remember to customize these components to match your specific aesthetic direction while maintaining consistency within your design system.
