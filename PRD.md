# Khi UI Redesign - Product Requirements Document

> **For Ralphy:** Execute with `ralphy --opencode --prd PRD.md --branch feature/ui-redesign`

## Overview

Complete UI redesign of the Khi Kobo Highlight Import application, migrating from custom CSS to Tailwind CSS with a new minimal grayscale design system.

**Repository:** /Users/bruno/Documents/khi-project  
**Base Branch:** main  
**Work Branch:** feature/ui-redesign  
**Approach:** Keep all existing store logic, only redesign UI components

**Reference Materials:**
- `khi-ui-redesign/UI-SPEC.md` - Complete visual specifications
- `khi-ui-redesign/react-reference/` - React prototypes for visual reference

---

## Design System Quick Reference

### Tailwind Classes
- Background: `bg-white dark:bg-neutral-950`
- Surface: `bg-neutral-50 dark:bg-neutral-900`  
- Border: `border-neutral-200 dark:border-neutral-800`
- Text Primary: `text-neutral-900 dark:text-neutral-100`
- Text Secondary: `text-neutral-500`
- Text Tertiary: `text-neutral-400 dark:text-neutral-600`
- Brand: `bg-black dark:bg-white`

### Icons (Lucide Svelte)
Download, Settings, Grid3x3, List, X, ArrowLeft, FileDown, Check

---

## Prerequisites

- [x] Node.js v22+ installed
- [x] Git repository initialized
- [x] Ralphy installed

---

## Phase 1: Setup

### Task 1: Install Tailwind CSS
**Priority:** Critical
**Files:** Create tailwind.config.js, src/app.css
**Steps:**
1. npm install -D tailwindcss postcss autoprefixer
2. npx tailwindcss init -p
3. Configure tailwind.config.js with neutral colors
4. Create src/app.css with @tailwind directives
5. Update src/routes/+layout.svelte to import app.css

### Task 2: Install Lucide Svelte
**Priority:** Critical
**Command:** npm install lucide-svelte

### Task 3: Create KoboIcon Component
**Priority:** High
**File:** src/lib/components/KoboIcon.svelte
**Requirements:**
- SVG viewBox 0 0 140 180
- Props: disabled (boolean), size (number)
- Uses currentColor for theming
- Disabled: text-neutral-300 / dark:text-neutral-700

---

## Phase 2: Foundation Components

### Task 4: Create CustomCheckbox
**Priority:** High
**File:** src/lib/components/CustomCheckbox.svelte
**Requirements:** 20px, custom styled, Check icon when checked

### Task 5: Create CustomRadio
**Priority:** Medium
**File:** src/lib/components/CustomRadio.svelte
**Requirements:** 16px circular, filled dot when checked

### Task 6: Create Modal
**Priority:** High
**File:** src/lib/components/Modal.svelte
**Requirements:** Backdrop blur, scale animation, close on escape/click outside

---

## Phase 3: Screen Components

### Task 7: Redesign NoKoboScreen
**Priority:** High
**File:** src/lib/components/EmptyStateNoDevice.svelte
**Requirements:** Centered, KoboIcon disabled, new text styling

### Task 8: Redesign ImportingScreen
**Priority:** High
**File:** src/lib/components/ImportingState.svelte
**Requirements:** Pulse animation on icon, centered text

### Task 9: Redesign BooksLibrary
**Priority:** Critical
**File:** src/lib/components/LibraryView.svelte
**Major changes:**
- New toolbar with sorting dropdown
- View toggle (Grid/List)
- Custom checkboxes for selection
- 30% smaller book covers
- Responsive grid columns

### Task 10: Redesign BookCard
**Priority:** High
**File:** src/lib/components/BookCard.svelte
**Requirements:**
- Gradient backgrounds
- Hover scale effect
- Custom checkbox positioning
- 30% smaller than current

### Task 11: Redesign BookHighlights
**Priority:** High
**File:** src/lib/components/BookDetailsView.svelte
**Requirements:**
- New header layout with larger cover
- Quotes with border-left
- Page numbers styling

---

## Phase 4: Settings

### Task 12: Redesign SettingsPanel
**Priority:** High
**File:** src/lib/components/SettingsPanel.svelte
**Requirements:**
- Convert to Modal
- 2 tabs (Export, Appearance)
- Custom checkboxes for metadata
- Custom radios for date format
- Theme toggle with icons

---

## Phase 5: Integration

### Task 13: Update +page.svelte
**Priority:** Critical
**File:** src/routes/+page.svelte
**Requirements:**
- Import new components
- Add theme toggle in header
- Wire up modal open/close

### Task 14: Add Responsive Breakpoints
**Priority:** Medium
**Requirements:** Mobile adaptations for all screens

### Task 15: Final Verification
**Priority:** Critical
**Requirements:**
- Test all screens
- Verify light/dark themes
- Check all interactions
- Run build successfully


---

## Detailed Implementation Notes

### Task 1: Tailwind Configuration

tailwind.config.js:
```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        neutral: {
          50: '#F9FAFB', 100: '#F3F4F6', 200: '#E5E7EB',
          300: '#D1D5DB', 400: '#9CA3AF', 500: '#6B7280',
          600: '#525252', 700: '#404040', 800: '#262626',
          900: '#171717', 950: '#0A0A0A',
        }
      }
    }
  },
  plugins: []
}
```

src/app.css:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

### Task 3: KoboIcon Implementation

Key props:
- disabled: boolean (default false)
- size: number (default 128)
- class: string (optional)

SVG structure:
- Device outline rect (rounded corners)
- Screen rect inside
- 7 horizontal lines representing text

### Task 9: BooksLibrary Toolbar

Left side buttons:
- Export All (always enabled)
- Export Selected (disabled opacity-40 when no selection)
- Clear Selection (only visible when selection exists)

Right side:
- Sort dropdown (pill shape, 5 options)
- View toggle Grid/List (pill with 2 buttons)
- Settings button (gear icon)

Grid responsive columns:
- Mobile (<640px): 2 columns
- md (768px): 4 columns  
- lg (1024px): 5 columns
- xl (1280px): 6 columns

### Task 12: Settings Modal Structure

Modal width: max-w-[480px]
Backdrop: bg-black/50 backdrop-blur-sm

Tabs:
1. Export tab:
   - Export folder path (read-only input + Browse button)
   - Metadata checkboxes (Author, ISBN, Publisher, Last Read, Language, Description)
   - Date format radios (3 options)

2. Appearance tab:
   - Theme toggle (System/Light/Dark with icons)
   - Library view mode (Grid/List)

Footer buttons:
- Cancel (ghost style)
- Save Changes (solid brand color)

### Task 13: +page.svelte Updates

Need to:
1. Import new component names if changed
2. Add theme toggle button in header
3. Pass new props to redesigned components
4. Keep all existing event handlers and store integration

---

## Testing Checklist

Before marking each task complete:
- [x] Component renders without console errors
- [x] Light theme looks correct
- [x] Dark theme looks correct
- [x] All interactions work (clicks, hovers, toggles)
- [x] Responsive design works on different sizes
- [x] Build completes successfully

---

## References

UI Specifications: khi-ui-redesign/UI-SPEC.md
React Prototypes: khi-ui-redesign/react-reference/
SVG Assets: khi-ui-redesign/svgs/

