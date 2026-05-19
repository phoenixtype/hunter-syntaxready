# Business Operations Platform - Design System

A comprehensive design system inspired by Resend's glassmorphic minimalistic aesthetic, featuring a sophisticated black/white/grey color palette with subtle glassmorphic effects and functional minimalism.

## Design Philosophy

### Core Principles

1. **Functional Minimalism** - Every element serves a purpose, unnecessary decoration is eliminated
2. **High Contrast Accessibility** - Strong black/white contrast ensures maximum readability
3. **Subtle Glassmorphism** - Gentle transparency and blur effects add depth without distraction  
4. **Developer-First Aesthetics** - Clean, technical appearance that builds trust with business users
5. **Generous Whitespace** - Breathing room creates hierarchy and reduces cognitive load
6. **Consistent Patterns** - Repeated visual patterns create familiarity and usability

---

## Color Palette

### Primary Colors

```css
:root {
  /* Pure Base Colors */
  --color-white: #FFFFFF;
  --color-black: #000000;
  
  /* Primary Grays */
  --color-gray-50: #FAFAFA;
  --color-gray-100: #F4F4F5;
  --color-gray-200: #E4E4E7;
  --color-gray-300: #D4D4D8;
  --color-gray-400: #A1A1AA;
  --color-gray-500: #71717A;
  --color-gray-600: #52525B;
  --color-gray-700: #3F3F46;
  --color-gray-800: #27272A;
  --color-gray-900: #18181B;
  --color-gray-950: #09090B;
}
```

### Accent Colors

```css
:root {
  /* Primary Accent (Blue) */
  --color-blue-500: #00A3FF;
  --color-blue-600: #0073CC;
  --color-blue-700: #005299;
  
  /* Status Colors */
  --color-green-500: #22C55E;
  --color-green-600: #16A34A;
  --color-red-500: #EF4444;
  --color-red-600: #DC2626;
  --color-yellow-500: #EAB308;
  --color-yellow-600: #CA8A04;
}
```

### Color Usage Guidelines

**Backgrounds**
- Primary backgrounds: `--color-white`, `--color-gray-50`
- Secondary backgrounds: `--color-gray-100`, `--color-gray-200`
- Dark mode backgrounds: `--color-gray-900`, `--color-gray-800`

**Text**
- Primary text: `--color-black`, `--color-gray-900`
- Secondary text: `--color-gray-600`, `--color-gray-500`
- Disabled text: `--color-gray-400`

**Borders & Dividers**
- Subtle borders: `--color-gray-200`
- Prominent borders: `--color-gray-300`
- Focus indicators: `--color-blue-500`

---

## Typography

### Font Stacks

```css
:root {
  /* Primary Font - Clean Sans-Serif */
  --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 
               'Roboto', 'Helvetica Neue', Arial, sans-serif;
  
  /* Monospace Font - Code & Technical Content */
  --font-mono: 'JetBrains Mono', 'Fira Code', 'SF Mono', Consolas, 
               'Liberation Mono', Monaco, 'Courier New', monospace;
}
```

### Type Scale

```css
:root {
  /* Font Sizes */
  --text-xs: 0.75rem;    /* 12px */
  --text-sm: 0.875rem;   /* 14px */
  --text-base: 1rem;     /* 16px */
  --text-lg: 1.125rem;   /* 18px */
  --text-xl: 1.25rem;    /* 20px */
  --text-2xl: 1.5rem;    /* 24px */
  --text-3xl: 1.875rem;  /* 30px */
  --text-4xl: 2.25rem;   /* 36px */
  --text-5xl: 3rem;      /* 48px */
  --text-6xl: 3.75rem;   /* 60px */
  
  /* Line Heights */
  --leading-tight: 1.25;
  --leading-snug: 1.375;
  --leading-normal: 1.5;
  --leading-relaxed: 1.625;
  
  /* Font Weights */
  --font-light: 300;
  --font-normal: 400;
  --font-medium: 500;
  --font-semibold: 600;
  --font-bold: 700;
}
```

### Typography Classes

```css
/* Headings */
.heading-1 {
  font-size: var(--text-6xl);
  font-weight: var(--font-bold);
  line-height: var(--leading-tight);
  color: var(--color-gray-900);
}

.heading-2 {
  font-size: var(--text-4xl);
  font-weight: var(--font-bold);
  line-height: var(--leading-tight);
  color: var(--color-gray-900);
}

.heading-3 {
  font-size: var(--text-2xl);
  font-weight: var(--font-semibold);
  line-height: var(--leading-snug);
  color: var(--color-gray-900);
}

/* Body Text */
.body-large {
  font-size: var(--text-lg);
  font-weight: var(--font-normal);
  line-height: var(--leading-relaxed);
  color: var(--color-gray-700);
}

.body-base {
  font-size: var(--text-base);
  font-weight: var(--font-normal);
  line-height: var(--leading-normal);
  color: var(--color-gray-700);
}

.body-small {
  font-size: var(--text-sm);
  font-weight: var(--font-normal);
  line-height: var(--leading-normal);
  color: var(--color-gray-600);
}

/* Specialized Text */
.code {
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  background-color: var(--color-gray-100);
  padding: 0.125rem 0.25rem;
  border-radius: 0.25rem;
  color: var(--color-gray-800);
}

.label {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--color-gray-700);
}
```

---

## Spacing System

### Space Scale

```css
:root {
  /* Spacing Scale (8pt grid system) */
  --space-px: 1px;
  --space-0_5: 0.125rem; /* 2px */
  --space-1: 0.25rem;    /* 4px */
  --space-1_5: 0.375rem; /* 6px */
  --space-2: 0.5rem;     /* 8px */
  --space-2_5: 0.625rem; /* 10px */
  --space-3: 0.75rem;    /* 12px */
  --space-3_5: 0.875rem; /* 14px */
  --space-4: 1rem;       /* 16px */
  --space-5: 1.25rem;    /* 20px */
  --space-6: 1.5rem;     /* 24px */
  --space-7: 1.75rem;    /* 28px */
  --space-8: 2rem;       /* 32px */
  --space-10: 2.5rem;    /* 40px */
  --space-12: 3rem;      /* 48px */
  --space-16: 4rem;      /* 64px */
  --space-20: 5rem;      /* 80px */
  --space-24: 6rem;      /* 96px */
  --space-32: 8rem;      /* 128px */
}
```

### Spacing Guidelines

**Component Padding**
- Tight: `--space-2` (8px)
- Default: `--space-4` (16px)
- Comfortable: `--space-6` (24px)
- Spacious: `--space-8` (32px)

**Section Margins**
- Small sections: `--space-8` to `--space-12`
- Standard sections: `--space-16` to `--space-20`
- Large sections: `--space-24` to `--space-32`

---

## Glassmorphic Effects

### Glass Card Base

```css
.glass-card {
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 12px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
}

.glass-card-dark {
  background: rgba(39, 39, 42, 0.8);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
}
```

### Glassmorphic Variants

```css
/* Subtle Glass (Navigation, Sidebars) */
.glass-subtle {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

/* Prominent Glass (Modals, Cards) */
.glass-prominent {
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.3);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
}

/* Floating Glass (Tooltips, Dropdowns) */
.glass-floating {
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.4);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15);
}
```

---

## Components

### Buttons

```css
/* Primary Button */
.btn-primary {
  background: var(--color-blue-500);
  color: var(--color-white);
  font-weight: var(--font-medium);
  font-size: var(--text-sm);
  padding: var(--space-2_5) var(--space-4);
  border-radius: 0.375rem;
  border: none;
  transition: all 0.2s ease;
  cursor: pointer;
}

.btn-primary:hover {
  background: var(--color-blue-600);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 163, 255, 0.3);
}

/* Secondary Button */
.btn-secondary {
  background: transparent;
  color: var(--color-gray-700);
  font-weight: var(--font-medium);
  font-size: var(--text-sm);
  padding: var(--space-2_5) var(--space-4);
  border-radius: 0.375rem;
  border: 1px solid var(--color-gray-300);
  transition: all 0.2s ease;
  cursor: pointer;
}

.btn-secondary:hover {
  background: var(--color-gray-50);
  border-color: var(--color-gray-400);
}

/* Ghost Button */
.btn-ghost {
  background: transparent;
  color: var(--color-gray-600);
  font-weight: var(--font-medium);
  font-size: var(--text-sm);
  padding: var(--space-2_5) var(--space-4);
  border-radius: 0.375rem;
  border: none;
  transition: all 0.2s ease;
  cursor: pointer;
}

.btn-ghost:hover {
  background: var(--color-gray-100);
  color: var(--color-gray-900);
}
```

### Cards

```css
/* Standard Card */
.card {
  background: var(--color-white);
  border: 1px solid var(--color-gray-200);
  border-radius: 0.75rem;
  padding: var(--space-6);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
  transition: all 0.2s ease;
}

.card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  transform: translateY(-2px);
}

/* Glass Card */
.card-glass {
  @apply glass-card;
  padding: var(--space-6);
}

/* Metric Card */
.card-metric {
  @apply card;
  text-align: center;
  padding: var(--space-5);
}

.card-metric .metric-value {
  font-size: var(--text-3xl);
  font-weight: var(--font-bold);
  color: var(--color-gray-900);
  margin-bottom: var(--space-1);
}

.card-metric .metric-label {
  font-size: var(--text-sm);
  color: var(--color-gray-600);
  font-weight: var(--font-medium);
}

.card-metric .metric-change {
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  margin-top: var(--space-2);
}

.card-metric .metric-change.positive {
  color: var(--color-green-600);
}

.card-metric .metric-change.negative {
  color: var(--color-red-600);
}
```

### Form Elements

```css
/* Input Field */
.input {
  width: 100%;
  padding: var(--space-3) var(--space-4);
  font-size: var(--text-sm);
  line-height: var(--leading-normal);
  color: var(--color-gray-900);
  background: var(--color-white);
  border: 1px solid var(--color-gray-300);
  border-radius: 0.375rem;
  transition: all 0.2s ease;
}

.input:focus {
  outline: none;
  border-color: var(--color-blue-500);
  box-shadow: 0 0 0 3px rgba(0, 163, 255, 0.1);
}

.input::placeholder {
  color: var(--color-gray-400);
}

/* Textarea */
.textarea {
  @apply input;
  min-height: 6rem;
  resize: vertical;
}

/* Select */
.select {
  @apply input;
  background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236B7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e");
  background-position: right 0.5rem center;
  background-repeat: no-repeat;
  background-size: 1.5em 1.5em;
  padding-right: 2.5rem;
  appearance: none;
}

/* Label */
.label {
  display: block;
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--color-gray-700);
  margin-bottom: var(--space-2);
}

/* Helper Text */
.helper-text {
  font-size: var(--text-xs);
  color: var(--color-gray-500);
  margin-top: var(--space-1);
}

.helper-text.error {
  color: var(--color-red-600);
}
```

### Navigation

```css
/* Navigation Bar */
.navbar {
  @apply glass-subtle;
  padding: var(--space-4) var(--space-6);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

/* Sidebar */
.sidebar {
  @apply glass-subtle;
  width: 16rem;
  min-height: 100vh;
  padding: var(--space-6) var(--space-4);
  border-right: 1px solid var(--color-gray-200);
}

/* Navigation Link */
.nav-link {
  display: flex;
  align-items: center;
  padding: var(--space-3) var(--space-4);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--color-gray-600);
  text-decoration: none;
  border-radius: 0.375rem;
  transition: all 0.2s ease;
  margin-bottom: var(--space-1);
}

.nav-link:hover {
  background: var(--color-gray-100);
  color: var(--color-gray-900);
}

.nav-link.active {
  background: var(--color-blue-500);
  color: var(--color-white);
}

.nav-link .icon {
  width: 1.25rem;
  height: 1.25rem;
  margin-right: var(--space-3);
}
```

---

## Layout System

### Grid System

```css
/* Container */
.container {
  width: 100%;
  max-width: 1280px;
  margin: 0 auto;
  padding: 0 var(--space-4);
}

.container-sm {
  max-width: 640px;
}

.container-md {
  max-width: 768px;
}

.container-lg {
  max-width: 1024px;
}

.container-xl {
  max-width: 1280px;
}

/* Grid */
.grid {
  display: grid;
  gap: var(--space-6);
}

.grid-cols-1 { grid-template-columns: repeat(1, minmax(0, 1fr)); }
.grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.grid-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.grid-cols-4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }
.grid-cols-12 { grid-template-columns: repeat(12, minmax(0, 1fr)); }

/* Responsive Grid */
@media (min-width: 768px) {
  .md\\:grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .md\\:grid-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .md\\:grid-cols-4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }
}

@media (min-width: 1024px) {
  .lg\\:grid-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .lg\\:grid-cols-4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }
  .lg\\:grid-cols-6 { grid-template-columns: repeat(6, minmax(0, 1fr)); }
}
```

### Flexbox Utilities

```css
.flex { display: flex; }
.flex-col { flex-direction: column; }
.flex-row { flex-direction: row; }

.items-start { align-items: flex-start; }
.items-center { align-items: center; }
.items-end { align-items: flex-end; }
.items-stretch { align-items: stretch; }

.justify-start { justify-content: flex-start; }
.justify-center { justify-content: center; }
.justify-end { justify-content: flex-end; }
.justify-between { justify-content: space-between; }
.justify-around { justify-content: space-around; }

.flex-1 { flex: 1 1 0%; }
.flex-auto { flex: 1 1 auto; }
.flex-none { flex: none; }
```

---

## Animation & Transitions

### Transition System

```css
:root {
  --transition-fast: 0.15s ease;
  --transition-base: 0.2s ease;
  --transition-slow: 0.3s ease;
}

/* Base Transitions */
.transition {
  transition-property: color, background-color, border-color, text-decoration-color, fill, stroke, opacity, box-shadow, transform, filter, backdrop-filter;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  transition-duration: var(--transition-base);
}

.transition-fast {
  transition-duration: var(--transition-fast);
}

.transition-slow {
  transition-duration: var(--transition-slow);
}
```

### Hover Effects

```css
/* Subtle Hover Lift */
.hover-lift {
  transition: transform var(--transition-base), box-shadow var(--transition-base);
}

.hover-lift:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

/* Glow Effect */
.hover-glow {
  transition: box-shadow var(--transition-base);
}

.hover-glow:hover {
  box-shadow: 0 0 20px rgba(0, 163, 255, 0.3);
}

/* Scale Effect */
.hover-scale {
  transition: transform var(--transition-base);
}

.hover-scale:hover {
  transform: scale(1.02);
}
```

### Loading States

```css
/* Skeleton Loader */
.skeleton {
  background: linear-gradient(90deg, var(--color-gray-200) 25%, var(--color-gray-100) 50%, var(--color-gray-200) 75%);
  background-size: 200% 100%;
  animation: skeleton-loading 1.5s ease-in-out infinite;
}

@keyframes skeleton-loading {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* Pulse Effect */
.pulse {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* Spin Animation */
.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
```

---

## Dark Mode

### Dark Theme Variables

```css
[data-theme="dark"] {
  /* Override colors for dark mode */
  --color-white: #000000;
  --color-black: #FFFFFF;
  
  --color-gray-50: #09090B;
  --color-gray-100: #18181B;
  --color-gray-200: #27272A;
  --color-gray-300: #3F3F46;
  --color-gray-400: #52525B;
  --color-gray-500: #71717A;
  --color-gray-600: #A1A1AA;
  --color-gray-700: #D4D4D8;
  --color-gray-800: #E4E4E7;
  --color-gray-900: #F4F4F5;
  --color-gray-950: #FAFAFA;
}
```

### Dark Mode Components

```css
/* Dark Glass Effects */
[data-theme="dark"] .glass-card {
  background: rgba(39, 39, 42, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
}

[data-theme="dark"] .glass-subtle {
  background: rgba(24, 24, 27, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.05);
}

/* Dark Form Elements */
[data-theme="dark"] .input {
  background: var(--color-gray-800);
  border-color: var(--color-gray-700);
  color: var(--color-gray-100);
}

[data-theme="dark"] .input:focus {
  border-color: var(--color-blue-500);
  box-shadow: 0 0 0 3px rgba(0, 163, 255, 0.2);
}
```

---

## Responsive Design

### Breakpoints

```css
:root {
  --breakpoint-sm: 640px;
  --breakpoint-md: 768px;
  --breakpoint-lg: 1024px;
  --breakpoint-xl: 1280px;
  --breakpoint-2xl: 1536px;
}

/* Mobile First Media Queries */
@media (min-width: 640px) { /* sm */ }
@media (min-width: 768px) { /* md */ }
@media (min-width: 1024px) { /* lg */ }
@media (min-width: 1280px) { /* xl */ }
@media (min-width: 1536px) { /* 2xl */ }
```

### Responsive Utilities

```css
/* Hide/Show at different breakpoints */
.hidden { display: none; }
.block { display: block; }
.inline { display: inline; }
.inline-block { display: inline-block; }

@media (min-width: 768px) {
  .md\\:hidden { display: none; }
  .md\\:block { display: block; }
  .md\\:flex { display: flex; }
  .md\\:grid { display: grid; }
}

@media (min-width: 1024px) {
  .lg\\:hidden { display: none; }
  .lg\\:block { display: block; }
  .lg\\:flex { display: flex; }
  .lg\\:grid { display: grid; }
}
```

---

## Usage Examples

### Dashboard Layout

```html
<div class="min-h-screen bg-gray-50">
  <!-- Navigation -->
  <nav class="navbar">
    <div class="flex items-center">
      <h1 class="heading-3">Business Operations</h1>
    </div>
    <div class="flex items-center space-x-4">
      <button class="btn-ghost">Settings</button>
      <button class="btn-primary">Get Started</button>
    </div>
  </nav>

  <div class="flex">
    <!-- Sidebar -->
    <aside class="sidebar">
      <nav class="space-y-2">
        <a href="#" class="nav-link active">
          <span class="icon">📊</span>
          Dashboard
        </a>
        <a href="#" class="nav-link">
          <span class="icon">🤖</span>
          AI Communication
        </a>
        <a href="#" class="nav-link">
          <span class="icon">📅</span>
          Scheduling
        </a>
      </nav>
    </aside>

    <!-- Main Content -->
    <main class="flex-1 p-8">
      <div class="container">
        <!-- Metrics Grid -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div class="card-metric">
            <div class="metric-value">247</div>
            <div class="metric-label">AI Interactions</div>
            <div class="metric-change positive">+12% from last month</div>
          </div>
          <!-- More metrics... -->
        </div>

        <!-- Glass Card Example -->
        <div class="card-glass">
          <h2 class="heading-3 mb-4">Recent Activity</h2>
          <div class="space-y-4">
            <!-- Activity items... -->
          </div>
        </div>
      </div>
    </main>
  </div>
</div>
```

### Form Example

```html
<div class="card max-w-md mx-auto">
  <h2 class="heading-3 mb-6">Business Setup</h2>
  <form class="space-y-6">
    <div>
      <label class="label">Business Name</label>
      <input 
        type="text" 
        class="input" 
        placeholder="Enter your business name"
      />
      <div class="helper-text">This will appear on customer communications</div>
    </div>
    
    <div>
      <label class="label">Business Type</label>
      <select class="select">
        <option>Choose business type</option>
        <option>Home Services</option>
        <option>Restaurant</option>
        <option>Professional Services</option>
      </select>
    </div>
    
    <div>
      <label class="label">Description</label>
      <textarea 
        class="textarea" 
        placeholder="Describe your business..."
      ></textarea>
    </div>
    
    <div class="flex space-x-4">
      <button type="button" class="btn-secondary flex-1">Cancel</button>
      <button type="submit" class="btn-primary flex-1">Create Business</button>
    </div>
  </form>
</div>
```

---

## Implementation Guide

### 1. CSS Custom Properties Setup

Add the CSS variables to your root stylesheet or CSS-in-JS configuration:

```css
/* styles/globals.css */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');

:root {
  /* Include all CSS custom properties from above sections */
}

* {
  box-sizing: border-box;
}

body {
  font-family: var(--font-sans);
  color: var(--color-gray-900);
  background-color: var(--color-gray-50);
  line-height: var(--leading-normal);
}
```

### 2. Tailwind CSS Configuration

If using Tailwind CSS, extend the configuration:

```javascript
// tailwind.config.js
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        gray: {
          50: '#FAFAFA',
          100: '#F4F4F5',
          // ... rest of gray scale
        },
        blue: {
          500: '#00A3FF',
          600: '#0073CC',
          700: '#005299',
        },
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      backdropBlur: {
        xs: '2px',
      },
      animation: {
        'skeleton-loading': 'skeleton-loading 1.5s ease-in-out infinite',
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
}
```

### 3. React Component Examples

```tsx
// components/ui/GlassCard.tsx
import { cn } from '@/lib/utils'

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'subtle' | 'prominent' | 'floating'
  children: React.ReactNode
}

export const GlassCard = ({ 
  variant = 'subtle', 
  className, 
  children, 
  ...props 
}: GlassCardProps) => {
  return (
    <div
      className={cn(
        'glass-card',
        {
          'glass-subtle': variant === 'subtle',
          'glass-prominent': variant === 'prominent',
          'glass-floating': variant === 'floating',
        },
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}
```

---

This design system provides a comprehensive foundation for building the Business Operations Platform with Resend's sophisticated glassmorphic aesthetic. The system emphasizes functional minimalism, high contrast accessibility, and subtle visual effects that enhance rather than distract from the user experience.