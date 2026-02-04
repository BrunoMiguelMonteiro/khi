# Khi - UI Specification

**Document Type:** User Interface & Interaction Design Specification  
**Purpose:** Visual design reference and implementation guide for Khi's Svelte/Tauri application  
**Companion to:** `SPEC.md` (Architecture & Stack)

---

## Overview

This document specifies the complete UI/UX implementation for Khi, a Kobo Highlight Import application. The React prototypes in this repository serve as **visual and behavioral reference** for the Svelte implementation.

**⚠️ IMPORTANT:** See `ASSETS.md` for required icons, SVGs, and other visual assets needed for implementation.

---

## Design System

### Color Palette

**Grayscale Foundation:**
```css
/* Light Theme */
--background: white
--surface: neutral-50 (F9FAFB)
--border: neutral-200 (E5E7EB)
--text-primary: neutral-900 (111827)
--text-secondary: neutral-500 (6B7280)
--text-tertiary: neutral-400 (9CA3AF)

/* Dark Theme */
--background: neutral-950 (0A0A0A)
--surface: neutral-900 (171717)
--border: neutral-800 (262626)
--text-primary: neutral-100 (F5F5F5)
--text-secondary: neutral-500 (6B7280)
--text-tertiary: neutral-600 (525252)
```

**Accent Colors:**
```css
--brand: black (light) / white (dark)
--hover-light: neutral-100
--hover-dark: neutral-900
```

**Book Cover Gradients:**
```css
from-blue-400 to-blue-600
from-green-400 to-green-600
from-purple-400 to-purple-600
from-red-400 to-red-600
from-orange-400 to-orange-600
from-teal-400 to-teal-600
```

### Typography

**Font Stack:** System default (no custom fonts)

**Hierarchy:**
- App branding "khi": 24px, bold, tight tracking
- Page title (H1): 30px, semibold
- Book title (grid): 14px, medium
- Book title (list): 14px, medium
- Author name: 12px, regular
- Highlight count: 12px, regular
- Button labels: 14px, regular
- Toolbar text: 14px, regular
- Highlight text: 16px, regular, relaxed leading
- Page numbers: 12px, regular

### Spacing

**Standard units:** 4px, 8px, 12px, 16px, 24px, 32px, 48px

**Common patterns:**
- Screen padding: 24px (desktop), 16px (mobile)
- Card gap (grid): 24px
- List item gap: 8px
- Header padding: 16px vertical, 24px horizontal
- Toolbar padding: 12px vertical, 24px horizontal

### Iconography

**Library:** Lucide Icons  
**Size:** 16px (w-4 h-4) standard  
**Style:** Outline/stroke

**Icons used:**
- `BookX`: No Kobo connected state
- `Download`: Export actions
- `Settings`: Settings modal
- `Grid3x3`: Grid view toggle
- `List`: List view toggle
- `X`: Clear selection
- `ArrowLeft`: Back navigation
- `FileDown`: Export to Markdown
- `ArrowUpDown`: Sort dropdown
- `FolderOpen`: Browse folder

---

## Application States & Screens

### State Machine

```
[No Kobo Connected] 
    ↓ (connect Kobo device)
[Importing] 
    ↓ (import complete ~3s)
[Books Library] 
    ↓ (click book)
[Book Highlights]
    ↓ (click back)
[Books Library]
```

---

## Screen 1: No Kobo Connected

**Reference Component:** `/src/app/components/NoKoboScreen.tsx`

### Visual Layout

```
┌─────────────────────────────────────┐
│                                     │
│              [Icon]                 │
│         (grayed e-reader)           │
│                                     │
│        No Kobo connected            │
│   Connect your Kobo to view your    │
│            highlights               │
│                                     │
└─────────────────────────────────────┘
```

### Specifications

**Container:**
- Full viewport height (should be dynamic not fixed height)
- Centered content (vertical & horizontal)
- Background: `--background`

**Icon:**
- Component: kobo-icon-dashed.svg
- Size: 112px × 144px
- Color: neutral-300 (light) / neutral-700 (dark)
- Margin bottom: 32px

**Text:**
- Title: "No Kobo connected"
  - Size: 24px
  - Weight: semibold
  - Color: `--text-primary`
  - Margin bottom: 12px
- Subtitle: "Connect your Kobo to view your highlights"
  - Size: 16px
  - Weight: regular
  - Color: `--text-secondary`
  - Max width: 320px
  - Text align: center

### Behavior

- **Static state** - no user interaction except theme toggle
- In production: Listens for Kobo device connection via Tauri
- On device connect → transition to Importing screen

---

## Screen 2: Importing

**Reference Component:** `/src/app/components/ImportingScreen.tsx`

### Visual Layout

```
┌─────────────────────────────────────┐
│                                     │
│              [Icon]                 │
│       (pulsing animation)           │
│                                     │
│      Importing highlights...        │
│                                     │
└─────────────────────────────────────┘
```

### Specifications

**Container:**
- Full viewport height
- Centered content (vertical & horizontal)
- Background: `--background`

**Icon:**
- Component: kobo-icon-disabled.svg & kobo-icon-solid.svg
- Size: 112px × 144px
- Color: `--brand` (black in light, white in dark)
- **Animation:** Continuous pulse
  - Scale: 1.0 → 1.05 → 1.0
  - Duration: 2s
  - Easing: ease-in-out
  - Loop: infinite

**Text:**
- "Importing highlights..."
- Size: 24px
- Weight: semibold
- Color: `--text-primary`
- Margin top: 32px

### Behavior

- **Automatic transition** after import completes (typically 2-5 seconds)
- No user interaction
- In production: Displays while Tauri backend reads Kobo database
- On import complete → transition to Books Library

### Animation Implementation

**CSS/Svelte:**
```css
@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}

.importing-icon {
  animation: pulse 2s ease-in-out infinite;
}
```

---

## Screen 3: Books Library

**Reference Component:** `/src/app/components/BooksLibrary.tsx`

### Visual Layout

```
┌─────────────────────────────────────────────────────────┐
│ khi                                                     │
├─────────────────────────────────────────────────────────┤
│ [Export All] [Export Selected] [Clear]  [Grid][List][⚙]│
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──┐  ┌──┐  ┌──┐  ┌──┐  ┌──┐   (Grid View)           │
│  │☐ │  │☐ │  │☐ │  │☐ │  │☐ │                         │
│  └──┘  └──┘  └──┘  └──┘  └──┘                         │
│  Title  Title Title Title Title                        │
│  Author Author...                                       │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Header Section

**Brand:**
- Text: "khi"
- Font size: 24px
- Font weight: bold
- Tracking: tight
- Position: Left aligned, 16px padding vertical

**Styling:**
- Background: `--background`
- Border bottom: 1px `--border`

### Toolbar Section

**Background:** neutral-50 (light) / neutral-900 (dark)  
**Border bottom:** 1px `--border`  
**Padding:** 12px vertical, 24px horizontal

**Left Side Actions:**

1. **Export All Button**
   - Icon: Download (16px)
   - Label: "Export All"
   - State: Always enabled
   - Action: Exports all books to selected format

2. **Export Selected Button**
   - Icon: Download (16px)
   - Label: "Export Selected"
   - State: Disabled when no selection
   - Disabled opacity: 0.4
   - Action: Exports only selected books

3. **Clear Selection Button** (conditional)
   - Icon: X (16px)
   - Label: "Clear Selection"
   - Visibility: Only when `selectedBooks.length > 0`
   - Action: Clears all checkbox selections

**Right Side Actions:**

1. **Sort Dropdown**
   - Button: Icon: ArrowUpDown (16px), Label shows current sort, ChevronDown icon (12px)
   - Container: Pill with 1px border, white background (light) / neutral-950 (dark)
   - Dropdown menu: 
     - Width: 192px
     - Position: Right-aligned below button
     - Options: Title (A-Z), Title (Z-A), Author (A-Z), Most Highlights, Least Highlights
     - Active option: Neutral-100 (light) / neutral-800 (dark) background with indicator dot
     - Hover: neutral-50 (light) / neutral-900 (dark)
   - Click outside to close

2. **View Mode Toggle**
   - Container: Pill shape with 1px border
   - Background: `--background`
   - Two buttons: Grid icon / List icon
   - Active state: Black background (light) / White background (dark)
   - Inactive state: Transparent, hover neutral-100/900

3. **Settings Button**
   - Icon: Settings gear (16px)
   - No label
   - Rounded: 8px
   - Hover: neutral-200 / neutral-800

**Button Hover States:**
- All buttons: 8px border radius
- Hover background: neutral-200 (light) / neutral-800 (dark)
- Transition: 150ms ease

### Books Grid View

**Container:**
- Max width: 1280px (max-w-7xl)
- Padding: 32px vertical, 24px horizontal
- Centered on page

**Grid:**
- Columns: 3 (mobile) → 4 (md) → 5 (lg) → 6 (xl)
- Gap: 24px
- Note: Reduced from original spec for ~30% smaller covers

**Book Card:**

```
┌─────────────┐
│ ☐           │
│             │
│  [Gradient] │
│   Cover     │
│             │
│             │
└─────────────┘
Book Title Here
Author Name
12 highlights
```

**Book Cover:**
- Aspect ratio: 2:3 (portrait)
- Border radius: 8px
- Background: Gradient (assigned per book)
- Cursor: pointer
- Hover: scale(1.05), 200ms ease
- Click: Navigate to Book Highlights

**Checkbox:**
- Position: Absolute, top-left (8px margin)
- Background: white (light) / neutral-900 (dark)
- Border: 2px
- Size: 20px
- Click: Toggle selection (event.stopPropagation)

**Book Info:**
- Spacing: 12px top margin
- Title:
  - Size: 14px, medium weight
  - Line clamp: 2 lines
  - Leading: tight
- Author:
  - Size: 12px
  - Color: `--text-secondary`
  - Margin top: 4px
- Highlight count:
  - Size: 12px
  - Color: `--text-tertiary`
  - Margin top: 4px

### Books List View

**Container:** Same as grid

**List Items:**

```
┌────────────────────────────────────────────────┐
│ ☐  [Cover]  Book Title Here    12 highlights  │
│             Author Name                        │
└────────────────────────────────────────────────┘
```

**Layout:**
- Display: flex, items centered
- Gap: 16px
- Padding: 16px
- Border radius: 8px
- Hover background: neutral-50 (light) / neutral-900 (dark)

**Checkbox:**
- Flex: none
- Border: 2px

**Cover:**
- Width: 48px
- Height: 64px (maintains 2:3 ratio)
- Border radius: 4px
- Gradient background
- Cursor: pointer
- Flex: none

**Book Info:**
- Flex: 1
- Min width: 0 (for text truncation)
- Title: 14px medium, truncate
- Author: 12px, `--text-secondary`, truncate

**Highlight Count:**
- Flex: none
- Size: 12px
- Color: `--text-tertiary`

### Behavior

**Selection State:**
- Clicking checkbox: Toggles selection, does NOT navigate
- Clicking cover/title: Navigates to Book Highlights
- Selection persists until "Clear Selection" or navigation

**View Toggle:**
- State preserved in localStorage (optional)
- Instant transition between grid/list

**Export Actions:**
- Show native file picker (Tauri dialog)
- Default format: Markdown (.md)
- Settings modal can change default format

---

## Screen 4: Book Highlights

**Reference Component:** `/src/app/components/BookHighlights.tsx`

### Visual Layout

```
┌─────────────────────────────────────────────────┐
│ khi                                             │
├─────────────────────────────────────────────────┤
│ [← Back]                    [Export to Markdown]│
├─────────────────────────────────────────────────┤
│                                                 │
│  ┌────┐  The Design of Everyday Things         │
│  │    │  Don Norman                             │
│  │    │  12 highlights                          │
│  └────┘                                         │
│                                                 │
│  │ "Good design is actually a lot harder       │
│  │  to notice than poor design..."             │
│    Page 23                                      │
│                                                 │
│  │ "The design of everyday things is in        │
│  │  great danger..."                            │
│    Page 45                                      │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Header & Toolbar

**Same structure as Books Library:**
- "khi" branding in header
- Toolbar with actions

**Toolbar Actions:**

**Left:**
- Back Button
  - Icon: ArrowLeft (16px)
  - Label: "Back"
  - Action: Return to Books Library

**Right:**
- Export to Markdown Button
  - Icon: FileDown (16px)
  - Label: "Export to Markdown"
  - Action: Export this book's highlights

### Book Header

**Container:**
- Max width: 896px (max-w-4xl)
- Padding: 32px vertical, 24px horizontal
- Centered on page

**Layout:** Flex row, gap 24px

**Book Cover:**
- Width: 128px
- Height: 192px (2:3 ratio)
- Border radius: 8px
- Gradient background (same as library)
- Flex: none

**Book Info:**
- Flex: 1
- Padding top: 8px

**Elements:**
- Title: 30px, semibold, margin bottom 8px
- Author: 18px, `--text-secondary`, margin bottom 16px
- Highlight count: 14px, `--text-tertiary`

**Spacing:**
- Margin bottom: 48px (before highlights list)

### Highlights List

**Container:**
- Max width: 896px (max-w-4xl)
- Padding: 0 24px
- Centered on page

**Highlight Card:**

```
│ "Quote text here with comfortable
│  line height for reading..."
  Page 23
  
  (32px gap)
  
│ "Next highlight..."
  Page 45
```

**Styling:**
- Gap between highlights: 32px

**Quote:**
- Border left: 4px solid neutral-300 (light) / neutral-700 (dark)
- Padding left: 16px
- Padding vertical: 4px
- Font size: 16px
- Line height: relaxed (1.625)
- Color: `--text-primary`

**Page Number:**
- Font size: 12px
- Color: `--text-tertiary`
- Margin top: 8px
- Padding left: 16px (aligned with quote)

**Empty State:**
- Center aligned
- Padding vertical: 64px
- Text: "No highlights available for this book."
- Color: `--text-tertiary`

### Behavior

**Navigation:**
- Back button: Returns to Books Library (preserves view mode & selection)
- Scroll position: Resets to top on entry

**Export:**
- Opens file save dialog (Tauri)
- Format: Markdown with book metadata
- Structure:
  ```markdown
  # Book Title
  *Author Name*
  
  ## Highlights
  
  > Quote text here
  
  *Page 23*
  
  > Next quote
  
  *Page 45*
  ```

---

## Settings Modal

**Reference Component:** `/src/app/components/SettingsModal.tsx`

### Visual Layout

```
┌─────────────────────────────────────┐
│  Settings                      [×]  │
├─────────────────────────────────────┤
│ [Export] [Appearance]               │
├─────────────────────────────────────┤
│                                     │
│  Export Tab:                        │
│  Export Folder                      │
│  Path                               │
│  [Read-only input] [Browse]         │
│  Helper text                        │
│  Metadata to Include                │
│  Select which metadata to include   │
│  [Custom checkboxes]                │
│  Date Format                        │
│  [Custom radio buttons]             │
│                                     │
│  Appearance Tab:                    │
│  Theme: ( ) Light (•) Dark ( ) Auto│
│  Library View Mode                  │
│  [Segmented button group]           │
│                                     │
│                    [Save]  [Cancel] │
└─────────────────────────────────────┘
```

### Modal Structure

**Backdrop:**
- Background: rgba(0, 0, 0, 0.5)
- Blur: 4px (backdrop-filter)
- Full viewport
- Click to close

**Modal:**
- Width: 480px max
- Background: `--background`
- Border radius: 12px
- Shadow: Large elevation
- Padding: 0 (header/content have own padding)

### Header

**Layout:**
- Padding: 20px 24px
- Border bottom: 1px `--border`
- Flex: space-between

**Title:**
- "Settings"
- Size: 18px
- Weight: semibold

**Close Button:**
- Icon: X (20px)
- No border
- Size: 32px × 32px
- Hover: neutral-100 / neutral-900
- Border radius: 6px

### Tabs

**Container:**
- Padding: 16px 24px 0
- Border bottom: 1px `--border`
- Display: flex
- Gap: 8px

**Tab Button:**
- Padding: 12px 16px
- Border bottom: 2px solid transparent
- Font size: 14px
- Font weight: medium
- Color: `--text-secondary`
- Transition: 200ms

**Active Tab:**
- Border bottom: 2px solid `--brand`
- Color: `--text-primary`

**Hover:**
- Background: neutral-50 / neutral-900

### Content Area

**Padding:** 24px

**Export Tab:**

1. **Export Folder**
   - Label: "Export Folder" heading
   - Sub-label: "Path"
   - Layout: Flex row with read-only input + Browse button
   - Input:
     - Read-only text input displaying current path
     - Default: "~/Documents/Kobo Highlights"
     - Background: neutral-100 (light) / neutral-800 (dark)
     - Border: 1px neutral-200 / neutral-700
     - Cursor: default (not editable)
   - Browse Button:
     - Icon: FolderOpen (16px)
     - Label: "Browse"
     - Background: neutral-200 (light) / neutral-800 (dark)
     - Hover: neutral-300 (light) / neutral-700 (dark)
     - Action: Opens Tauri folder picker dialog
   - Helper text: "Markdown files will be saved in this folder."
   - Margin bottom: 32px

2. **Metadata to Include**
   - Label: "Metadata to Include" heading
   - Sub-label: "Select which metadata to include in the exported files."
   - Layout: Grid, 2 columns
   - Custom checkboxes (not native browser inputs):
     - Unchecked: White/neutral-800 background, neutral-300/neutral-600 border
     - Checked: Black/white background with Check icon (lucide-react)
     - Size: 16px
     - Border: 2px
   - Options: Author, ISBN, Publisher, Last Read Date, Language, Description
   - Margin bottom: 32px

3. **Date Format**
   - Label: "Date Format" heading
   - Custom radio buttons (not native browser inputs):
     - Unchecked: Hollow circle with neutral border
     - Checked: Outer circle with filled inner dot (black/white)
     - Size: 16px
   - Options:
     - DD/MM/YYYY (24/01/2025)
     - 24 January 2025
     - ISO 8601 (2025-01-24)
   - Display: Vertical stack, gap 10px

**Appearance Tab:**

1. **Theme Toggle**
   - Label: "Theme" heading
   - Layout: Segmented button group (pill shape with border)
   - Three buttons: System, Light, Dark
   - Icons: Monitor, Sun, Moon (16px each)
   - Active state: Black background (light) / White background (dark)
   - Inactive state: Transparent with hover
   - Margin bottom: 32px

2. **Library View Mode**
   - Label: "Library View Mode" heading
   - Layout: Segmented button group (pill shape with border)
   - Two buttons: Grid, List
   - Icons: Grid3x3, List (16px each)
   - Active state: Black background (light) / White background (dark)
   - Inactive state: Transparent with hover
   - Note: Controls default view mode when opening app

### Footer

**Container:**
- Padding: 16px 24px
- Border top: 1px `--border`
- Flex: end
- Gap: 12px

**Buttons:**

1. **Cancel Button**
   - Label: "Cancel"
   - Style: Ghost (transparent)
   - Hover: neutral-100 / neutral-900
   - Action: Close modal, discard changes

2. **Save Button**
   - Label: "Save"
   - Style: Solid `--brand` background
   - Text color: Inverse of background
   - Action: Save preferences, close modal

### Behavior

**Opening:**
- Fade in: 200ms
- Scale: 0.95 → 1.0

**Closing:**
- Fade out: 150ms
- Click backdrop, click close, press Escape, click Cancel

**Saving:**
- Persist to localStorage
- Apply theme immediately
- Close modal

---

## Responsive Behavior

### Breakpoints

```css
sm: 640px
md: 768px
lg: 1024px
xl: 1280px
```

### Mobile Adaptations (< 640px)

**All Screens:**
- Horizontal padding: 16px (reduced from 24px)
- Font sizes: Reduce by 2px where appropriate

**Books Library:**
- Grid: Fixed 2 columns (no responsive increase)
- Toolbar: Stack vertically if needed
- Button labels: Keep full text (don't abbreviate)

**Book Highlights:**
- Cover: Reduce to 96px × 144px
- Title: 24px (reduced from 30px)
- Header: Stack vertically (cover top, info below)

**Settings Modal:**
- Width: calc(100vw - 32px)
- Max width: 480px

### Tablet (640px - 1024px)

- Books grid: 3 columns
- All other specs: Desktop spec

### Desktop (> 1024px)

- Books grid: 4-5 columns
- Full specs as defined

---

## Theme Implementation

### Theme Toggle

**Location:** Settings Modal → Appearance tab  
**Options:** Light / Dark / Auto

**Auto Mode:**
- Follows system preference via `prefers-color-scheme`
- Updates in real-time when system changes

### CSS Variables Approach

```css
:root {
  --bg-primary: white;
  --bg-secondary: #F9FAFB;
  --border: #E5E7EB;
  /* ... */
}

.dark {
  --bg-primary: #0A0A0A;
  --bg-secondary: #171717;
  --border: #262626;
  /* ... */
}
```

### Svelte Implementation

```svelte
<script>
  let theme = 'light'; // or 'dark' or 'auto'
  
  $: {
    if (theme === 'auto') {
      // Use system preference
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.classList.toggle('dark', isDark);
    } else {
      document.documentElement.classList.toggle('dark', theme === 'dark');
    }
  }
</script>
```

---

## Data Structure

### Book Object

```typescript
interface Book {
  id: string;
  title: string;
  author: string;
  gradient: string; // Tailwind class e.g. "from-blue-400 to-blue-600"
  highlightCount: number;
  highlights: Highlight[];
}
```

### Highlight Object

```typescript
interface Highlight {
  id: string;
  text: string;
  page: number;
}
```

### Mock Data Example

See `/src/app/App.tsx` lines 15-71 for complete mock data structure.

**Book gradients are assigned deterministically** (not random) - same book always has same color.

---

## Interactions Summary

### Click Targets

| Element | Action | Notes |
|---------|--------|-------|
| Book cover (grid/list) | Navigate to highlights | Whole cover clickable |
| Book checkbox | Toggle selection | Stops propagation |
| Back button | Return to library | Preserves state |
| Export All | Export all books | Always enabled |
| Export Selected | Export checked books | Disabled when none selected |
| Clear Selection | Deselect all | Only visible when selection exists |
| Grid/List toggle | Change view mode | Instant transition |
| Settings button | Open modal | Animated entrance |
| Theme radio | Change theme | Immediate apply |

### Keyboard Shortcuts (Optional)

- `Escape`: Close Settings modal
- `Cmd/Ctrl + ,`: Open Settings
- `Cmd/Ctrl + E`: Export All (when on Library)
- `Backspace`: Back (when on Book Highlights)

---

## Animations & Transitions

### Standard Transitions

```css
transition: all 150ms ease;
```

**Applied to:**
- Button hovers
- Modal backdrop
- Theme changes

### Specific Animations

**Importing Pulse:**
```css
animation: pulse 2s ease-in-out infinite;
```

**Book Cover Hover:**
```css
transition: transform 200ms ease;
transform: scale(1.05);
```

**Modal Entrance:**
```css
animation: fadeIn 200ms ease-out;
transform: scale(0.95) → scale(1);
```

**Settings Modal:**
```css
animation: slideUp 200ms ease-out;
```

---

## File Structure Reference

React prototype component mapping for Svelte implementation:

```
/src/app/components/
├── NoKoboScreen.tsx       → NoKoboScreen.svelte
├── ImportingScreen.tsx    → ImportingScreen.svelte
├── BooksLibrary.tsx       → BooksLibrary.svelte
├── BookHighlights.tsx     → BookHighlights.svelte
├── SettingsModal.tsx      → SettingsModal.svelte
└── KoboIcon.tsx           → KoboIcon.svelte
```

**Icon component** should be reusable with props:
```typescript
interface KoboIconProps {
  size?: number; // default 128
  className?: string;
}
```

---

## Implementation Checklist

### Phase 1: Core Screens
- [ ] Create Svelte component structure
- [ ] Implement NoKoboScreen with icon
- [ ] Implement ImportingScreen with pulse animation
- [ ] Build BooksLibrary (grid view first)
- [ ] Build BookHighlights page

### Phase 2: Interactions
- [ ] Add view mode toggle (grid/list)
- [ ] Implement checkbox selection logic
- [ ] Add navigation between screens
- [ ] Wire up Back button

### Phase 3: Settings & Theme
- [ ] Build SettingsModal component
- [ ] Implement Export tab controls
- [ ] Implement Appearance tab with theme toggle
- [ ] Add theme persistence (localStorage)
- [ ] Implement auto theme (system preference)

### Phase 4: Tauri Integration
- [ ] Connect to Tauri device detection
- [ ] Implement actual Kobo database reading
- [ ] Wire up export functionality (file save dialog)
- [ ] Add real highlight data parsing

### Phase 5: Polish
- [ ] Add keyboard shortcuts
- [ ] Responsive breakpoints
- [ ] Loading states
- [ ] Error handling UI
- [ ] Empty states

---

## Notes for Svelte Implementation

### React → Svelte Equivalents

**State:**
```javascript
// React
const [selected, setSelected] = useState(new Set());

// Svelte
let selected = new Set();
```

**Props:**
```javascript
// React
interface Props { book: Book; onBack: () => void; }

// Svelte
export let book: Book;
export let onBack: () => void;
```

**Conditional Rendering:**
```javascript
// React
{isOpen && <Modal />}

// Svelte
{#if isOpen}<Modal />{/if}
```

**Loops:**
```javascript
// React
{books.map(book => <Card key={book.id} {book} />)}

// Svelte
{#each books as book (book.id)}
  <Card {book} />
{/each}
```

### Tailwind in Svelte

- Use `class:` directive for conditional classes
- Keep same Tailwind classes as React prototype
- Example:
  ```svelte
  <button
    class="px-3 py-2 rounded"
    class:bg-black={viewMode === 'grid'}
    class:bg-neutral-200={viewMode !== 'grid'}
  >
  ```

### Component Communication

Use Svelte stores for global state:
```javascript
// stores.js
export const theme = writable('light');
export const selectedBooks = writable(new Set());
```

---

## Visual Reference

All visual specifications described in this document can be seen running in this React prototype. To view:

```bash
npm install
npm run dev
```

Use the dev navigation bar at the top to switch between screens and toggle themes.

---

## Questions & Clarifications

For implementation questions, refer to:
1. This UI-SPEC.md for all visual/interaction details
2. SPEC.md for architecture and Tauri/Svelte technical details
3. React component source code for logic reference

**Key principle:** The React prototype is the **visual truth**. Match the look, feel, and behavior exactly in Svelte.