/**
 * hunter.ai Design System
 * Consistent design tokens for spacing, typography, colors, and touch targets
 */

// Spacing System (8px grid)
export const spacing = {
  xs: '4px',
  sm: '8px',
  md: '16px',
  lg: '24px',
  xl: '32px',
  '2xl': '48px',
  '3xl': '64px',
  '4xl': '96px',
} as const;

// Typography
export const typography = {
  sizes: {
    xs: '12px',
    sm: '14px',
    base: '16px',    // Minimum for body text (WCAG)
    lg: '18px',
    xl: '20px',
    '2xl': '24px',
    '3xl': '30px',
    '4xl': '36px',
    '5xl': '48px',
    '6xl': '60px',
  },
  lineHeights: {
    tight: 1.25,
    normal: 1.5,     // Default for body
    relaxed: 1.75,
  },
  fontWeights: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
} as const;

// Touch Targets (WCAG 2.1 Level AAA)
export const touchTargets = {
  minimum: '44px',      // WCAG 2.1 AAA minimum
  comfortable: '48px',  // Recommended
  large: '56px',       // For primary actions
} as const;

// Semantic Colors (for consistent usage)
export const semanticColors = {
  success: {
    light: 'hsl(142, 76%, 36%)',
    DEFAULT: 'hsl(142, 71%, 45%)',
    dark: 'hsl(142, 76%, 36%)',
  },
  error: {
    light: 'hsl(0, 84%, 60%)',
    DEFAULT: 'hsl(0, 72%, 51%)',
    dark: 'hsl(0, 74%, 42%)',
  },
  warning: {
    light: 'hsl(38, 92%, 50%)',
    DEFAULT: 'hsl(32, 95%, 44%)',
    dark: 'hsl(25, 95%, 39%)',
  },
  info: {
    light: 'hsl(199, 89%, 48%)',
    DEFAULT: 'hsl(199, 89%, 48%)',
    dark: 'hsl(199, 89%, 38%)',
  },
} as const;

// Animation Durations
export const animations = {
  fast: '150ms',
  normal: '250ms',
  slow: '350ms',
} as const;

// Border Radius
export const borderRadius = {
  sm: '4px',
  md: '8px',
  lg: '12px',
  xl: '16px',
  '2xl': '24px',
  full: '9999px',
} as const;

// Shadows
export const shadows = {
  sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
  lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
  xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
} as const;

// Z-Index Scale
export const zIndex = {
  dropdown: 1000,
  sticky: 1020,
  fixed: 1030,
  modalBackdrop: 1040,
  modal: 1050,
  popover: 1060,
  tooltip: 1070,
} as const;

// Breakpoints
export const breakpoints = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
} as const;
