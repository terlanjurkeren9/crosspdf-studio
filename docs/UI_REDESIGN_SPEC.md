# UI Redesign Spec - CrosspdfStudio

> **Author:** Implementor2  
> **Date:** 2026-06-14  
> **Status:** Draft  
> **Inspired by:** Adobe Acrobat, Foxit Phantom

---

## 1. Current Problems

| Problem                                                  | Impact                                       |
| -------------------------------------------------------- | -------------------------------------------- |
| 30+ buttons visible simultaneously in one horizontal bar | Visually overwhelming, "AI slop" look        |
| 15 annotation tools all visible at once in the toolbar   | User paralysis — too many choices            |
| 7 page operations all visible at once                    | Unnecessary clutter for primary workflow     |
| 7 convert/security tools all visible at once             | Rarely used tools taking equal space         |
| No visual hierarchy                                      | All buttons look the same, no grouping hints |
| No collapsibility                                        | Cannot reduce toolbar to save vertical space |
| User difficulty finding specific tools                   | Tools buried among 30 peers                  |

---

## 2. Design Direction

- **Adobe Acrobat / Foxit Phantom inspired** — ribbon-style categorical grouping with collapsible/expandable palettes
- **Clean & professional** — NOT AI slop. Intentional spacing, clear visual hierarchy, muted color palette
- **Collapsible groups** with clear visual hierarchy via dropdown palettes for dense tool sets
- **Contextual awareness** — active tool is visually highlighted, dropdowns show checkmark on active item
- **Consistent iconography** — Lucide icons with 16x16 sizing throughout
- **Dark mode support** — CSS custom properties with `dark:` variants

---

## 3. New Layout Structure

### Always-Visible Elements (primary workflow)

```
┌──────────────────────────────────────────────────────────────┐
│ [File] [View] [Annotate ▾] [Pages ▾] [Tools ▾]  │  [Nav] [Zoom] │
└──────────────────────────────────────────────────────────────┘
```

These stay visible at all times because they represent **navigation, file operations, and state awareness**:

| Section  | Contents                                          | Rationale                |
| -------- | ------------------------------------------------- | ------------------------ |
| **File** | Open, Save, Save As, Print, filename              | Core document operations |
| **View** | Single/Continuous toggle, Fit Width/Fit Page/100% | Reading mode switching   |
| **Nav**  | First, Prev, `[page input]` / `total`, Next, Last | Page navigation          |
| **Zoom** | −, slider, percentage, +                          | Quick zoom access        |

### Collapsible Dropdown Palettes

| Trigger        | Dropdown Contents              | Groups                                 |
| -------------- | ------------------------------ | -------------------------------------- |
| **Annotate ▾** | Categorized annotation palette | Text Markup, Shapes, Drawing, Advanced |
| **Pages ▾**    | Page operation commands        | Page Actions (flat list)               |
| **Tools ▾**    | Convert & security commands    | Convert & Secure (flat list)           |

---

## 4. Grouping Strategy

### Annotate Group — Categorized Sub-Palette

Split 15 annotation tools into logical categories (Adobe-inspired):

| Group                        | Tools                           | Icon                                  |
| ---------------------------- | ------------------------------- | ------------------------------------- |
| **Selection** (quick access) | select, hand                    | MousePointer2, Hand                   |
| **Text Markup** (palette)    | highlight, underline, strikeout | Highlighter, Underline, Strikethrough |
| **Notes** (palette)          | sticky-note, free-text          | StickyNote, Type                      |
| **Shapes** (palette)         | rectangle, ellipse, line, arrow | Square, Circle, Minus, ArrowRight     |
| **Drawing** (palette)        | freehand                        | Pencil                                |
| **Advanced** (palette)       | stamp, redaction, form-field    | ImagePlus, ShieldOff, TextCursorInput |

> **UI Pattern:** Pointer and Hand stay as quick-access IconButtons in the Annotate ToolbarGroup. All other tools are behind a single dropdown palette trigger button.

### Pages Group — Dropdown Commands

| Command     | Handler        |
| ----------- | -------------- |
| Delete Page | `onDeletePage` |
| Rotate CCW  | `onRotateCCW`  |
| Rotate CW   | `onRotateCW`   |
| Merge       | `onMerge`      |
| Split       | `onSplit`      |
| Reorder     | `onReorder`    |
| Extract     | `onExtract`    |

> **UI Pattern:** Delete Page stays as quick-access (most common operation). All other page ops in dropdown.

### Convert/Security Group — Dropdown Commands

| Command             | Handler         |
| ------------------- | --------------- |
| OCR                 | `onOcr`         |
| Forms               | `onForms`       |
| Password Protection | `onPassword`    |
| PDF → Images        | `onPdfToImages` |
| Images → PDF        | `onImagesToPdf` |
| Signature           | `onSignature`   |

> **UI Pattern:** All tools in dropdown. Edit Mode toggle stays as quick-access IconButton since it signals mode state.

---

## 5. Component Changes

### 5.1 New Component: `ToolPaletteDropdown.tsx`

```
src/renderer/components/ui/ToolPaletteDropdown.tsx (NEW)
```

**Props:**

```typescript
interface ToolPaletteItem {
  id: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  disabled?: boolean;
  active?: boolean;
}

interface ToolPaletteGroup {
  label: string; // Category header text
  items: ToolPaletteItem[];
}

interface ToolPaletteDropdownProps {
  triggerIcon: ComponentType<{ className?: string }>;
  triggerLabel: string;
  activeTool?: string;
  groups: ToolPaletteGroup[];
  onSelect: (id: string) => void;
  disabled?: boolean;
  align?: 'left' | 'right';
  active?: boolean;
}
```

**States:**

| State                | Visual                                        |
| -------------------- | --------------------------------------------- |
| **Closed (default)** | Icon button with tooltip                      |
| **Closed + active**  | Brand-colored icon button (e.g., brand-50 bg) |
| **Open**             | Floating dropdown panel with tool palette     |
| **Disabled**         | 30% opacity, no hover state                   |
| **Dropdown closed**  | Fade transition 150ms                         |
| **Dropdown open**    | `animate-slide-down` entry animation          |

**Behavior:**

- Click to toggle open/close
- Click outside or Escape to close
- Click a tool item → calls `onSelect(id)` and closes dropdown
- Auto-open: if another palette in the same toolbar is open, hovering this trigger auto-opens it (Adobe ribbon pattern)
- Category headers are uppercase, text-xs, text-surface-400, non-interactive
- Tool items render in a 4-column grid with icon + small label
- Active tool shows brand-50 background with checkmark

### 5.2 Modified: `ViewerToolbar.tsx`

**Changes:**

- Remove flat button listing for annotation tools (keep select + hand)
- Add `ToolPaletteDropdown` for annotation palette
- Add `ToolPaletteDropdown` for page operations
- Add `ToolPaletteDropdown` for convert/security tools
- Reorder sections: File → View → Annotate → Pages → Tools → [spacer] → Nav → Zoom
- Preserve all existing callback props (no prop API changes)

**New import:**

```typescript
import { ToolPaletteDropdown } from '../ui/ToolPaletteDropdown';
import type { ToolPaletteGroup, ToolPaletteItem } from '../ui/ToolPaletteDropdown';
```

### 5.3 Modified: `ToolbarGroup.tsx`

**Changes:** (if any needed)

- Ensure proper z-index stacking for dropdowns (dropdown panel needs z-50+)
- No structural changes needed — current ToolbarGroup already provides label + border separator

### 5.4 Modified: `IconButton.tsx`

**Changes:** (if any needed)

- Already supports `active` state and `disabled` state
- No changes needed

---

## 6. Visual Specs

### Color Tokens

| Token       | Light     | Dark      | Usage                         |
| ----------- | --------- | --------- | ----------------------------- |
| brand-50    | `#eef2ff` | `#1e1b4b` | Active dropdown trigger bg    |
| brand-600   | `#4f46e5` | `#818cf8` | Active tool icon              |
| surface-50  | `#f8fafc` | —         | Tool hover bg                 |
| surface-200 | `#e2e8f0` | `#334155` | Borders, separators           |
| surface-400 | `#94a3b8` | `#64748b` | Category headers, helper text |
| surface-500 | `#64748b` | `#475569` | Inactive icons                |
| surface-600 | `#475569` | `#334155` | Primary labels                |

### Spacing System

| Element                  | Size                              |
| ------------------------ | --------------------------------- |
| Toolbar height           | 44px (h-11)                       |
| Trigger button           | 32x32px (h-8 w-8)                 |
| Dropdown min-width       | 200px                             |
| Category header padding  | `px-3.5 pb-0.5 pt-1`              |
| Tool item padding        | `px-1.5 py-2`                     |
| Gap between groups       | 2px (`gap-0.5` in grid)           |
| Gap between sections     | 8px (`gap-2` on toolbar)          |
| Dropdown shadow          | `shadow-lg shadow-surface-900/10` |
| Dropdown border radius   | 12px (rounded-xl)                 |
| Dropdown padding (inner) | `py-1.5`                          |
| Separator margin         | `mx-2 my-1`                       |

### Typography

| Element              | Size               | Weight         | Transform |
| -------------------- | ------------------ | -------------- | --------- |
| Category header      | 10px (text-[10px]) | 600 (semibold) | Uppercase |
| Tool item label      | 9px (text-[9px])   | 400 (normal)   | None      |
| Toolbar filename     | 12px (text-xs)     | 500 (medium)   | None      |
| Dropdown button icon | 16px (h-4 w-4)     | —              | —         |

### Interaction States

| Element           | Normal             | Hover                             | Active                       | Disabled     |
| ----------------- | ------------------ | --------------------------------- | ---------------------------- | ------------ |
| Trigger button    | `text-surface-500` | `bg-surface-100 text-surface-700` | `bg-brand-50 text-brand-600` | `opacity-30` |
| Tool item         | `text-surface-600` | `bg-surface-50 text-surface-900`  | `bg-brand-50 text-brand-600` | `opacity-30` |
| Dropdown backdrop | —                  | —                                 | Click outside → close        | —            |

### Collapsed vs Expanded States

| State                       | Visual                                                                                      |
| --------------------------- | ------------------------------------------------------------------------------------------- |
| **All collapsed** (default) | Toolbar shows: File buttons + View controls + [Annotate ▾] [Pages ▾] [Tools ▾] + Nav + Zoom |
| **Annotate expanded**       | Floating dropdown panel with 4-column grid of tools                                         |
| **Pages expanded**          | Floating dropdown panel with list of page commands                                          |
| **Tools expanded**          | Floating dropdown panel with list of convert/security commands                              |
| **Multiple open**           | Only one palette open at a time (auto-close behavior like Adobe ribbon)                     |

---

## 7. Mockup (Text-Based)

```
┌─ Toolbar (44px) ─────────────────────────────────────────────────────────────────┐
│                                                                                   │
│  [×] [📂] [💾] [📄+] [🖨️]  my_document.pdf                                      │
│                                                                                   │
│  ─────────── VIEW ───────────  ─────── ANNOTATE ───────  ─── PAGES ───  ── TOOLS ─│
│  [Single▾] [Fit Width▾]      │  [🖱️][✋][🖍 ▾]           │  [🗑][📄+ ▾] │  [🔍 ▾][✏️]│
│                                                                                   │
│  ──────────────────────────────────────  ──────── NAV ─────────  ───── ZOOM ──────│
│                                        │  [⏮][◀][ 4/32 ][▶][⏭] │  [−][=====][+]│
│                                                                                   │
└───────────────────────────────────────────────────────────────────────────────────┘

=== Annotate Dropdown (expanded) ===
┌─────────────────────────────────────────┐
│ TEXT MARKUP                             │
│ ┌──────┐ ┌──────┐ ┌──────┐             │
│ │🖍 hi│ │uline│ │strik│             │
│ │High- │ │Under-│ │Strike│             │
│ │light │ │line  │ │out   │             │
│ └──────┘ └──────┘ └──────┘             │
│ ─────────────────────────────────────── │
│ NOTES                                   │
│ ┌──────┐ ┌──────┐                      │
│ │📝    │ │🔤   │                      │
│ │Sticky│ │Text  │                      │
│ │Note  │ │      │                      │
│ └──────┘ └──────┘                      │
│ ─────────────────────────────────────── │
│ SHAPES                                  │
│ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐   │
│ │▬ Rect│ │⬭ Elli│ │— Line│ │➜ Arrow│   │
│ └──────┘ └──────┘ └──────┘ └──────┘   │
│ ─────────────────────────────────────── │
│ ADVANCED                                │
│ ┌──────┐ ┌──────┐ ┌──────┐             │
│ │📎    │ │🛡️   │ │📝   │             │
│ │Stamp │ │Redact│ │Form  │             │
│ └──────┘ └──────┘ └──────┘             │
└─────────────────────────────────────────┘
```

---

## 8. Files to Create / Modify

| Action     | File                                                 | Description                                    |
| ---------- | ---------------------------------------------------- | ---------------------------------------------- |
| **CREATE** | `docs/UI_REDESIGN_SPEC.md`                           | This design specification document             |
| **CREATE** | `src/renderer/components/ui/ToolPaletteDropdown.tsx` | New reusable dropdown palette component        |
| **MODIFY** | `src/renderer/components/viewer/ViewerToolbar.tsx`   | Restructure with collapsible dropdown palettes |
| **MODIFY** | `src/renderer/i18n/locales/en.json`                  | Add `viewer.tools` translation key             |

---

## 9. Acceptance Criteria

- [ ] All 15 annotation tools accessible through Annotate dropdown palette
- [ ] Annotation tools categorized into Text Markup, Shapes, Drawing, Advanced groups
- [ ] Select + Hand tools remain as quick-access buttons outside dropdown
- [ ] Page operations accessible through Pages dropdown
- [ ] Convert/security tools accessible through Tools dropdown
- [ ] Edit Mode toggle stays as quick-access IconButton
- [ ] TypeScript compiles with zero errors
- [ ] Dark mode supported
- [ ] Dropdown closes on click-outside and Escape key
- [ ] Active tool visually indicated in dropdown
- [ ] 4-column grid layout for annotation palette
- [ ] No regression on File, View, Navigation, Zoom sections
- [ ] Z-index stacking correct (dropdowns above all content)
