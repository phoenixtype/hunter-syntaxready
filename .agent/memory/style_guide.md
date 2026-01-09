# UI/UX Style Guide

## Design Philosophy
**"Apple-esque Minimalist"**
- Clean, breathable interfaces with generous whitespace.
- Sharp typography and high contrast.
- Subtle depth using shadows and glassmorphism.
- Smooth, physics-based animations.

## Design Tokens

### Typography
**Font Family**: `Inter` (Google Fonts)
- **Weights**:
    - Regular (400): Body text
    - Medium (500): Labels, Subheadings
    - Semibold (600): Headings, Buttons
    - Bold (700): Hero text, Numbers

### Color Palette (HSL)
All colors are defined as CSS variables in `index.css` and mapped in `tailwind.config.ts`.

- **Primary**: `hsl(240 5.9% 10%)` (Deep Black/Gray)
- **Background**: `hsl(0 0% 100%)` (Pure White)
- **Muted**: `hsl(240 4.8% 95.9%)` (Light Gray for backgrounds)
- **Accent**: `hsl(240 4.8% 95.9%)` (Interactive elements)
- **Destructive**: `hsl(0 84.2% 60.2%)` (Red)

**Dark Mode**:
- **Background**: `hsl(240 10% 3.9%)` (Deep Charcoal)
- **Foreground**: `hsl(0 0% 98%)` (White)

### Effects & Utilities
**Glassmorphism**:
Use the `.glass` class for panels floating above content.
```css
.glass {
  @apply bg-white/70 dark:bg-black/70 backdrop-blur-lg border border-white/20 dark:border-white/10;
}
```

**Rounded Corners**:
- `--radius`: `0.75rem` (12px) standard.

**Animations**:
- `animate-fade-in`: Simple entry animation.
- `transition-all duration-300`: Standard hover state transition.

## UI Components
- **Buttons**:
    - `default`: Primary action (Black bg, White text).
    - `outline`: Secondary action (Border only).
    - `ghost`: Tertiary action (No border, hover bg).
- **Cards**:
    - Use `Card` (Shadcn) with `glass-card` utility for dashboard widgets.
- **Inputs**:
    - Minimal borders, clear focus ring (`ring-2 ring-ring`).

## Accessibility Rules
- **Touch Targets**: Minimum 44x44px for all clickable elements.
- **Contrast**: Ensure text passes WCAG A/AA against background.
- **Focus**: Never remove focus outlines without providing a custom alternative (`focus-visible`).
