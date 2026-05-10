# Budget Allocation Bar — Design Spec

**Date:** 2026-05-10
**Project:** robert-the-framer
**Status:** Approved

---

## Overview

Add a thin allocation bar directly below the sticky header that shows how the sum of all task budget targets compares to the user's total budget. This gives an immediate visual answer to "am I planning to spend more or less than I budgeted?"

---

## Goals

- Show task target total vs. total budget at a glance
- Color-code the bar: green when under budget, red when over
- Display the dollar delta (unallocated or over budget) as a label
- Hide the bar entirely when no total budget is set

---

## Non-Goals

- No per-phase breakdown in the bar (that's the burndown chart's job)
- No animation or transitions beyond what CSS provides naturally
- No changes to the burndown chart, Gantt, or items views
- No new state fields or mutations

---

## Design

### Layout

The bar sits between the sticky header (`#header`) and the burndown chart (`#burndown`), in its own `<div id="alloc-bar">`. It is rendered by `header.js` immediately after the header HTML, or as a separate render call in `main.js` targeting a dedicated root element.

**Preferred approach:** Add `<div id="alloc-bar"></div>` to `index.html` as a direct child of `<div id="app">`, between `<header id="header">` and `<main id="main">`. (`#burndown` is nested inside `<main>`, not a sibling of `#header`.) Render it from `header.js` since it reads the same state.

### Visual anatomy

```
[ Task targets: $592,450                    $157,550 unallocated ]
[████████████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░]  ← 6px bar
```

- Left label: `Task targets: <bold>$X</bold>`
- Right label: delta amount + "unallocated" or "over budget"
- Bar: fills proportionally; capped at 100% width when over budget

### States

| Condition | Bar color | Right label |
|---|---|---|
| `totalBudget` is null or 0 | Bar hidden entirely | — |
| `projected <= totalBudget` | `#16a34a` (green) | `$X unallocated` in green |
| `projected > totalBudget` | `#dc2626` (red) | `$X over budget` in red |

When over budget, the bar fills to 100% width (clipped by `overflow: hidden`) rather than overflowing the container.

### Derived values

```js
const projected = state.tasks.reduce((s, t) => s + (t.budget || 0), 0)
const totalBudget = state.meta.totalBudget  // null means "not set"
const delta = totalBudget != null ? totalBudget - projected : null
const pct = totalBudget ? Math.min(projected / totalBudget, 1) : 0
const over = delta != null && delta < 0
```

These are computed inline in the render function — no changes to `derived.js` needed.

---

## Files

| File | Change |
|---|---|
| `index.html` | Add `<div id="alloc-bar"></div>` between `<header id="header">` and `<main id="main">` (direct child of `#app`) |
| `src/views/header.js` | Export `renderAllocBar(rootEl, state)` (uses existing `formatCurrency` import) |
| `src/styles/app.css` | Append styles for `#alloc-bar`, `.alloc-bar-wrap`, `.alloc-bar`, `.alloc-bar-fill` |
| `src/main.js` | Call `header.renderAllocBar(...)` in `render()` via existing namespace import |

No new files. No changes to state, mutations, or derived.

---

## CSS

```css
#alloc-bar { background: #fff; border-bottom: 1px solid var(--border); }

.alloc-bar-wrap { padding: 7px 16px; }
.alloc-bar-labels {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  font-size: 11px;
  color: var(--text-muted);
  margin-bottom: 5px;
}
.alloc-bar-labels strong { color: var(--text); font-weight: 600; }
.alloc-bar-labels .delta { font-weight: 600; }
.alloc-bar-labels .delta.ok  { color: #16a34a; }
.alloc-bar-labels .delta.over { color: #dc2626; }
.alloc-bar {
  height: 6px;
  border-radius: 3px;
  background: var(--border);
  overflow: hidden;
}
.alloc-bar-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.3s ease;
}
.alloc-bar-fill.ok   { background: #16a34a; }
.alloc-bar-fill.over { background: #dc2626; }
```

---

## Implementation

### `index.html`

Add between `<header id="header">` and `<main id="main">` as a direct child of `<div id="app">`:

```html
<div id="alloc-bar"></div>
```

### `src/views/header.js`

Export a new `renderAllocBar(rootEl, state)` function and call it from `main.js`:

```js
// Uses formatCurrency already imported at the top of header.js — no additional import needed.
export function renderAllocBar(rootEl, state) {
  const totalBudget = state.meta.totalBudget
  if (!totalBudget) {  // null, undefined, or 0 — treat as "not set"
    rootEl.innerHTML = ''
    return
  }
  const projected = state.tasks.reduce((s, t) => s + (t.budget || 0), 0)
  const delta = totalBudget - projected
  const over = delta < 0
  const pct = Math.min(projected / totalBudget, 1) * 100

  rootEl.innerHTML = `
    <div class="alloc-bar-wrap">
      <div class="alloc-bar-labels">
        <span>Task targets: <strong>${formatCurrency(projected)}</strong></span>
        <span class="delta ${over ? 'over' : 'ok'}">
          ${formatCurrency(Math.abs(delta))} ${over ? 'over budget' : 'unallocated'}
        </span>
      </div>
      <div class="alloc-bar">
        <div class="alloc-bar-fill ${over ? 'over' : 'ok'}" style="width:${pct}%"></div>
      </div>
    </div>
  `
}
```

### `src/main.js`

`header` is already imported as a namespace (`import * as header from './views/header.js'`). Call `renderAllocBar` through that namespace — no second import needed:

```js
function render() {
  const state = getState()
  if (!state) return
  // ... existing render calls ...
  header.renderAllocBar(document.getElementById('alloc-bar'), state)
}
```

---

## Edge Cases

| Scenario | Behavior |
|---|---|
| `totalBudget` is null or 0 | `renderAllocBar` clears the element and returns — no bar |
| All task budgets are 0 | Bar shows 0% fill, delta = total budget (fully unallocated) |
| `projected === totalBudget` | Exactly 100% fill, green, "$0 unallocated" |
| `projected` > `totalBudget` | Bar fills 100% (clipped), red, shows overage |

---

## Testing

No new unit tests (pure rendering, no state logic). Manual smoke test:

- Set a budget above task total → green bar, "unallocated" label
- Set a budget below task total → red bar, "over budget" label
- Clear budget in settings → bar disappears
- Change a task budget → bar updates immediately on re-render
