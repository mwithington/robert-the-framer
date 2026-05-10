# Budget Allocation Bar Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a thin bar below the sticky header that shows the sum of task budgets vs. the total budget, colored green when under and red when over.

**Architecture:** `renderAllocBar(rootEl, state)` is added to `header.js` and called from `render()` in `main.js` via the existing `header` namespace import. A `<div id="alloc-bar">` is added to `index.html` between `<header>` and `<main>` as a direct child of `#app`. The bar hides itself when `totalBudget` is falsy.

**Tech Stack:** Vanilla JS, CSS custom properties (existing `--green`, `--red`, `--border`, `--text-muted`), no new dependencies.

---

## Chunk 1: All changes

This feature touches 4 files but has a single logical unit of work — there's no state logic to test in isolation, so TDD doesn't apply. All steps are verified via a manual smoke test at the end.

### Task 1: Implement budget allocation bar

**Files:**
- Modify: `index.html` (line 11–12 — between `<header>` and `<main>`)
- Modify: `src/styles/app.css` (append at end)
- Modify: `src/views/header.js` (append new export)
- Modify: `src/main.js` (add one call inside `render()`)

- [ ] **Step 1: Confirm baseline tests pass**

```bash
cd /home/manny/projects/robert-the-framer
npm test
```

Expected: all 22 tests pass. Note the count — it must not drop.

- [ ] **Step 2: Add `#alloc-bar` div to `index.html`**

In `index.html`, insert `<div id="alloc-bar"></div>` between `<header id="header"></header>` and `<main id="main">`. The result should look like:

```html
  <div id="app">
    <header id="header"></header>
    <div id="alloc-bar"></div>
    <main id="main">
      <section id="burndown"></section>
      <section id="gantt"></section>
      <section id="items"></section>
    </main>
  </div>
```

- [ ] **Step 3: Append CSS to `src/styles/app.css`**

Append to the end of `src/styles/app.css` (after the `@keyframes login-shake` block):

```css
/* Budget allocation bar */
/* Note: #alloc-bar is the outer wrapper div; .alloc-bar is the inner progress track — two distinct selectors. */
/* Using var(--green)/#059669 (project design system) instead of spec's #16a34a mockup color. */
#alloc-bar { background: var(--surface); border-bottom: 1px solid var(--border); }
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
.alloc-bar-labels .delta.ok   { color: var(--green); }
.alloc-bar-labels .delta.over { color: var(--red); }
.alloc-bar { height: 6px; border-radius: 3px; background: var(--border); overflow: hidden; }
.alloc-bar-fill { height: 100%; border-radius: 3px; transition: width 0.3s ease; }
.alloc-bar-fill.ok   { background: var(--green); }
.alloc-bar-fill.over { background: var(--red); }
```

- [ ] **Step 4: Add `renderAllocBar` to `src/views/header.js`**

Append the following export to the bottom of `src/views/header.js`. It uses `formatCurrency` which is already imported at the top of the file — no new import needed.

```js
export function renderAllocBar(rootEl, state) {
  const totalBudget = state.meta.totalBudget
  if (!totalBudget) {
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

- [ ] **Step 5: Wire `renderAllocBar` into `render()` in `src/main.js`**

`header` is already imported as a namespace (`import * as header from './views/header.js'`). Inside the `render()` function, add a call to `header.renderAllocBar` after the existing `header.render(...)` call:

```js
function render() {
  const state = getState()
  if (!state) return

  header.render(document.getElementById('header'), state, {
    burndownMode,
    onToggleBurndown: mode => { burndownMode = mode; render() }
  })

  header.renderAllocBar(document.getElementById('alloc-bar'), state)  // ← add this line

  burndown.render(document.getElementById('burndown'), state, { mode: burndownMode })
  // ... rest unchanged
}
```

- [ ] **Step 6: Run tests — must still pass**

```bash
npm test
```

Expected: same count as Step 1 (22 tests). If any fail, fix before continuing.

- [ ] **Step 7: Manual smoke test**

```bash
npm run dev
```

Open `http://localhost:5173`. Clear localStorage if needed (`localStorage.clear()` in console, then refresh).

Verify all four states:

1. **No budget set** — open Settings, clear the Total Budget field, save → bar disappears entirely
2. **Under budget** — set budget to `750,000` → green bar appears, right label shows "unallocated" in green
3. **Over budget** — set budget to `500,000` (task targets sum to ~$592k) → red bar, "over budget" label in red
4. **Live update** — with budget set, open a task and change its budget amount, save → bar width and delta label update immediately without a page reload

Kill the dev server when done.

- [ ] **Step 8: Commit**

```bash
git add index.html src/styles/app.css src/views/header.js src/main.js
git commit -m "feat: add budget allocation bar below header"
```
