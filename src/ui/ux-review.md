# 🎨 Mia Companion V2 - UX Review & Design Guidelines

**Review Date:** 2026-02-11  
**Lead UX Designer:** Kimi K2.5  
**Project:** Mia Companion V2 - Obsidian Plugin

---

## 📋 Executive Summary

The Mia Companion plugin has solid foundations but needs significant UI/UX improvements to achieve a polished, modern feel that integrates seamlessly with Obsidian's design language while standing out as a premium companion experience.

### Key Findings
- ✅ Good functional foundation
- ⚠️ Inconsistent spacing and visual hierarchy
- ⚠️ Limited responsive design for mobile
- ⚠️ Missing accessibility features
- ⚠️ Chat UI lacks modern messaging patterns
- ⚠️ No animation/transition polish

---

## 🎯 Design Principles

### 1. **Sakura Aesthetic** 🌸
- Soft, warm pink accents (`--mia-primary: #ffb7c5`)
- Clean, minimal interface
- Gentle animations like falling petals

### 2. **Obsidian Native Integration**
- Respect Obsidian's CSS variables
- Use standard Obsidian spacing (4px base grid)
- Follow Obsidian's icon system (Lucide)

### 3. **Mobile-First Responsive Design**
- Touch-friendly targets (min 44px)
- Collapsible sections for small screens
- Optimized tab navigation

### 4. **Accessibility First**
- WCAG 2.1 AA compliance
- Keyboard navigation support
- High contrast mode support
- Screen reader optimized

### 5. **Progressive Disclosure**
- Show essential info first
- Advanced features behind clicks
- Contextual help tooltips

---

## 📱 Component Reviews

### 1. Chat Panel

#### Current Issues
- Basic layout without message bubbles
- No visual distinction between user/assistant
- Typing indicator is plain text
- Limited markdown rendering styling
- No message actions (copy, edit, delete)

#### Recommended Improvements

**Layout:**
```
┌─────────────────────────┐
│ 🌸 Mia Chat      🟢     │  ← Header with status
├─────────────────────────┤
│                         │
│   ┌─────────────┐       │
│   │ Hi Big Bro! │ ← Mia │  ← Rounded bubble, left
│   │    🌸       │       │     soft pink background
│   └─────────────┘       │
│                         │
│ ┌─────────────────┐     │
│ │ Can you help... │ ← User │  ← Right aligned, accent
│ └─────────────────┘     │     color
│                         │
│    🌸 ●●●               │  ← Animated typing dots
│                         │
├─────────────────────────┤
│ [📎] [Eingabe...] [➤]  │  ← Attachment, input, send
└─────────────────────────┘
```

**Features:**
- Message bubble design with avatars
- Markdown rendering with code highlighting
- Message timestamps (grouped by time)
- Quick actions on hover (copy, retry)
- Auto-resizing textarea
- Drag & drop file support (future)

**Accessibility:**
- ARIA live regions for new messages
- Keyboard shortcuts (Ctrl+Enter to send)
- Focus management
- High contrast message borders

---

### 2. Calendar Panel

#### Current State
- Not yet implemented in V1
- Planned for V2 with Google Calendar integration

#### Design Specification

**Month View:**
```
┌─────────────────────────┐
│ ◀  February 2026   ▶    │  ← Navigation
├─────────────────────────┤
│ Mo Di Mi Do Fr Sa So    │
│          1  2  3  4  5  │
│  6  7  8  9 10 11 12 ⭐ │  ← ⭐ Goal reached
│ 13 14 15 16 17 18 19 📅 │  ← 📅 Has events
│ 20 21 22 23 24 25 26    │
│ 27 28                   │
├─────────────────────────┤
│ 📅 Feb 12, 2026         │  ← Selected date
│                         │
│ • 14:00 Meeting         │
│ • 16:00 Write session   │
│ • 🎉 500 words reached  │
│                         │
│ [+ Add Event]           │
└─────────────────────────┘
```

**Features:**
- Month grid with event indicators
- Goal achievement badges (⭐)
- Event count dots
- Today highlighting
- Quick event list for selected day
- Add event button

**Mobile:**
- Swipe to change months
- Week view option
- Compact day list

---

### 3. Task Panel

#### Current State
- Not yet implemented
- Planned Google Tasks integration

#### Design Specification

**Layout:**
```
┌─────────────────────────┐
│ ✅ Tasks           [+]  │  ← Add button
├─────────────────────────┤
│ 📋 Arbeit (3)           │  ← Collapsible section
│ ☐ Blogpost schreiben    │
│ ☐ Obsidian Plugin       │
│ ☑ Einkaufen            ✓ │  ← Completed (strikethrough)
│                         │
│ 🏠 Privat (2)           │
│ ☐ Mia verbessern        │
│                         │
├─────────────────────────┤
│ 🔍 Filter tasks...      │  ← Search/filter
└─────────────────────────┘
```

**Features:**
- Task lists (sections from Google Tasks)
- Checkbox with custom animation
- Drag to reorder (future)
- Swipe to complete (mobile)
- Priority indicators (color coded)
- Due date badges

**Interactions:**
- Click checkbox to toggle
- Long press for context menu
- Pull to refresh

---

### 4. Dashboard

#### Current Issues
- Basic stat cards
- Limited visual appeal
- No trend indicators
- Static display

#### Recommended Improvements

**Layout:**
```
┌─────────────────────────┐
│ 🌸 Mia Dashboard        │
│ Your writing companion   │
├─────────────────────────┤
│ 📝 Daily Goal           │
│ ━━━━━━━━━━━━══════ 67%  │  ← Animated progress
│ 334 / 500 words         │
│ "You're on fire! 🔥"     │  ← Dynamic message
│                         │
│ ┌──────┐ ┌──────┐       │
│ │ 📊   │ │ 📅   │       │
│ │2,847 │ │  12  │       │  ← Stat cards
│ │Total │ │Days  │       │
│ └──────┘ └──────┘       │
│ ┌──────┐ ┌──────┐       │
│ │ 🔥   │ │ 🌸   │       │
│ │  5   │ │Online│       │
│ │Streak│ │Status│       │
│ └──────┘ └──────┘       │
│                         │
│ 📈 Weekly Trend         │
│ ▁▄▆███▃▂                │  ← Sparkline
│                         │
│ ⚡ Quick Actions        │
│ [💬 Chat] [📊 Stats]    │
└─────────────────────────┘
```

**Features:**
- Animated progress bar with gradient
- Dynamic encouragement messages
- Stat cards with icons
- Weekly trend sparkline
- Quick action buttons
- Responsive grid (2 cols mobile, 4 desktop)

---

### 5. Status Bar

#### Current Issues
- Plain text display
- Limited information
- No interaction

#### Recommended Design

```
Normal:     📝 334/500 words  🔥 5  🌸
Goal reached: 🎉 500/500 words!  🔥 5  🌸
Hover:      [Progress mini-bar]  [Streak info]  [Mia menu]
```

**Features:**
- Progress indicator emoji changes
- Streak counter with fire animation
- Mia avatar/status
- Click for quick menu
- Tooltip with detailed stats

---

## 🎨 Visual Design System

### Color Palette

```css
/* Primary - Sakura Pink */
--mia-primary: #ffb7c5;
--mia-primary-light: #ffd1dc;
--mia-primary-dark: #e89aa8;
--mia-primary-transparent: rgba(255, 183, 197, 0.2);

/* Semantic Colors */
--mia-success: #4ade80;
--mia-warning: #fbbf24;
--mia-error: #f87171;
--mia-info: #60a5fa;

/* Neutral - Obsidian Compatible */
--mia-bg-primary: var(--background-primary);
--mia-bg-secondary: var(--background-secondary);
--mia-bg-tertiary: var(--background-modifier-hover);
--mia-text-primary: var(--text-normal);
--mia-text-muted: var(--text-muted);
--mia-border: var(--background-modifier-border);

/* Message Bubble Colors */
--mia-bubble-user: var(--interactive-accent);
--mia-bubble-assistant: var(--background-secondary-alt);
--mia-bubble-system: rgba(255, 183, 197, 0.15);
```

### Typography

```css
/* Font Stack - Obsidian Compatible */
--mia-font-primary: var(--font-interface);
--mia-font-mono: var(--font-mono);

/* Sizes */
--mia-text-xs: 0.75rem;    /* 12px */
--mia-text-sm: 0.875rem;   /* 14px */
--mia-text-base: 1rem;     /* 16px */
--mia-text-lg: 1.125rem;   /* 18px */
--mia-text-xl: 1.25rem;    /* 20px */

/* Weights */
--mia-font-normal: 400;
--mia-font-medium: 500;
--mia-font-semibold: 600;
--mia-font-bold: 700;
```

### Spacing System (4px base)

```css
--mia-space-1: 0.25rem;   /* 4px */
--mia-space-2: 0.5rem;    /* 8px */
--mia-space-3: 0.75rem;   /* 12px */
--mia-space-4: 1rem;      /* 16px */
--mia-space-5: 1.25rem;   /* 20px */
--mia-space-6: 1.5rem;    /* 24px */
--mia-space-8: 2rem;      /* 32px */
--mia-space-10: 2.5rem;   /* 40px */
```

### Border Radius

```css
--mia-radius-sm: 4px;
--mia-radius-md: 8px;
--mia-radius-lg: 12px;
--mia-radius-xl: 16px;
--mia-radius-full: 9999px;
```

### Shadows

```css
--mia-shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
--mia-shadow-md: 0 4px 6px rgba(0, 0, 0, 0.1);
--mia-shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.1);
--mia-shadow-glow: 0 0 20px rgba(255, 183, 197, 0.3);
```

---

## ✨ Animations & Micro-interactions

### Animation Timing

```css
--mia-duration-fast: 150ms;
--mia-duration-normal: 250ms;
--mia-duration-slow: 350ms;
--mia-easing-default: cubic-bezier(0.4, 0, 0.2, 1);
--mia-easing-bounce: cubic-bezier(0.68, -0.55, 0.265, 1.55);
--mia-easing-spring: cubic-bezier(0.175, 0.885, 0.32, 1.275);
```

### Key Animations

1. **Message Appear**
   - Scale from 0.95 to 1
   - Fade in
   - Slight translate Y

2. **Typing Indicator**
   - Three dots with staggered pulse
   - Mia avatar gentle bounce

3. **Progress Bar Fill**
   - Smooth width transition
   - Glow effect on completion
   - Celebration particles at 100%

4. **Button Hover**
   - Scale 1.02
   - Shadow increase
   - Color shift

5. **Goal Achievement**
   - 🎉 Confetti burst
   - Progress bar flash
   - Streak counter increment animation

---

## ♿ Accessibility Requirements

### Keyboard Navigation
- All interactive elements focusable
- Tab order follows visual flow
- Escape closes modals/panels
- Ctrl/Cmd+Enter to send messages

### ARIA Labels
- `aria-label` on icon buttons
- `aria-live="polite"` for new messages
- `aria-expanded` on collapsible sections
- `aria-current="page"` on active nav items

### Color Contrast
- Minimum 4.5:1 for normal text
- Minimum 3:1 for large text
- Non-color indicators for status

### Reduced Motion
- Respect `prefers-reduced-motion`
- Disable non-essential animations
- Keep functional transitions

---

## 📱 Responsive Breakpoints

```css
/* Mobile (default) */
/* Single column, full-width cards */

/* Tablet */
@media (min-width: 768px) {
  /* 2-column grids */
  /* Side-by-side panels */
}

/* Desktop */
@media (min-width: 1024px) {
  /* 4-column stats grid */
  /* Larger chat bubbles */
  /* Expanded calendar */
}
```

### Mobile-Specific
- Bottom sheet for actions
- Swipe gestures
- Larger touch targets (44px minimum)
- Collapsible sections default closed

---

## 🔧 Implementation Priority

### Phase 1: Foundation (Critical)
1. CSS design system variables
2. Base component styles
3. Accessibility improvements
4. Dark/light mode support

### Phase 2: Chat Enhancement (High)
1. Message bubble redesign
2. Typing indicator animation
3. Markdown styling
4. Quick actions

### Phase 3: Dashboard Polish (High)
1. Animated progress bar
2. Stat card redesign
3. Trend visualization
4. Encouragement messages

### Phase 4: New Panels (Medium)
1. Calendar view
2. Task panel
3. Status bar enhancement

### Phase 5: Polish (Low)
1. Advanced animations
2. Petal fall effects
3. Sound effects (optional)
4. Custom themes

---

## 📊 Success Metrics

- **User Engagement:** Chat session duration, messages per session
- **Task Completion:** Dashboard interactions, goal achievement rate
- **Accessibility:** Lighthouse score >95, keyboard navigation success
- **Performance:** First paint <1s, animation 60fps
- **Satisfaction:** Visual appeal rating, ease of use feedback

---

## 📝 Notes for Implementation Team

### To: Claude (Calendar Agent)
- Use `src/ui/calendar-panel.ts` as base
- Implement month grid with CSS Grid
- Event indicators as small dots
- Mobile: consider week view option

### To: GPT-4 (Task Panel Agent)
- Use `src/ui/task-panel.ts` as base
- Implement collapsible sections
- Custom checkbox with animation
- Drag-to-reorder future feature

### To: Gemini (Integration Agent)
- Ensure CSS variables are loaded first
- Test all animations with reduced motion
- Verify ARIA labels throughout
- Mobile testing on Obsidian mobile app

---

## ✅ Checklist

- [x] Visual design system defined
- [x] Color palette specified
- [x] Typography scale established
- [x] Spacing system defined
- [x] Animation guidelines created
- [x] Accessibility requirements documented
- [x] Responsive breakpoints set
- [x] Component specifications written
- [x] Implementation priority outlined

---

*Next Steps: Review with team, create component prototypes, implement Phase 1 foundation.*
