# Construction Budget Visualizer — Design Spec

**Date:** 2026-04-30
**Project:** robert-the-framer
**Status:** Approved

---

## Overview

A personal, single-page web app for tracking a residential home construction project. Combines an itemized budget, a burndown chart, and an interactive Gantt chart into one dashboard. Data lives in `localStorage` with JSON export/import for backup. No backend, no auth, no deployment required.

---

## Goals

- Track phases and tasks with budgets, dates, progress, and status
- Compare vendor quotes per task; feed the selected quote into the budget
- Log payments against tasks; visualize real cash burn over time
- See schedule risk at a glance via Gantt with dependencies and critical path
- Start from a sensible home-construction template, not a blank slate

---

## Non-Goals (v1)

- Multi-user / cloud sync
- Mobile-first layout
- Receipt/photo uploads
- PDF export
- Notifications or reminders

---

## Tech Stack

| Concern | Choice |
|---|---|
| Build tool | Vite |
| Language | Vanilla JS (ES modules) |
| Charts | D3 v7 |
| Styling | Plain CSS with custom properties |
| Tests | Vitest |
| Persistence | localStorage + JSON export/import |

---

## Architecture

### Runtime model

Single-page app. One `state` module owns the full project object. Any user action calls a state mutator → mutator persists to localStorage → calls `render()` → all three views redraw from current state.

No framework, no router, no reactive library. Full re-render on every mutation is imperceptibly fast for the expected dataset size (50–150 tasks).

### Persistence layers

1. **localStorage** — auto-saved on every mutation. The live copy.
2. **JSON export** — header button downloads `robert-budget-YYYY-MM-DD.json`.
3. **JSON import** — header button loads a backup (confirm dialog before overwrite).
4. **Starter template** — `public/starter-template.json` seeds a fresh project on first launch.

### Build

- `npm run dev` — Vite dev server with HMR
- `npm run build` — static `dist/` bundle, opens from disk or any static host
- `npm test` — Vitest for state/data-model unit tests

---

## Data Model

```js
{
  meta: {
    projectName: "Our New Home",
    startDate: "2026-05-15",
    targetEndDate: "2027-03-01",
    totalBudget: 525000,     // null → use sum of task budgets
    currency: "USD",
    createdAt: ISO string,
    updatedAt: ISO string
  },
  phases: [
    { id, name, color, order }
  ],
  tasks: [
    {
      id,
      phaseId,
      name,
      budget,                // syncs from selectedQuoteId when set
      startDate,             // ISO date string or null
      endDate,               // ISO date string or null
      progress,              // 0–100
      status,                // "not_started" | "in_progress" | "done" | "blocked"
      dependsOn: [taskId],   // Gantt arrows + critical path
      notes,
      selectedQuoteId        // null or quote id
    }
  ],
  quotes: [
    {
      id,
      taskId,
      vendor,
      amount,
      notes,
      receivedDate,
      attachmentUrl          // optional link to PDF
    }
  ],
  payments: [
    {
      id,
      taskId,
      amount,
      date,
      notes,
      type                   // "deposit" | "progress" | "final"
    }
  ]
}
```

### Derived values (computed, never stored)

| Value | Computation |
|---|---|
| Phase budget | Sum of child task budgets |
| Phase progress | Budget-weighted average of child task progress |
| Total spent | Sum of all payments |
| Burndown ideal line | Linear from `totalBudget` at `startDate` to `0` at `targetEndDate` |
| Burndown actual line | `totalBudget − cumulative payments` at each payment date |
| Critical path | Longest dependency chain by duration; highlighted in Gantt |

---

## File Layout

```
robert-the-framer/
├── index.html
├── package.json
├── vite.config.js
├── public/
│   └── starter-template.json
├── src/
│   ├── main.js                  # entry: load state, wire events, first render
│   ├── state/
│   │   ├── store.js             # state object, localStorage load/save
│   │   ├── mutations.js         # all state-changing operations
│   │   └── derived.js           # computed values
│   ├── views/
│   │   ├── header.js            # project name, totals, export/import, toggle
│   │   ├── burndown.js          # D3 burndown chart
│   │   ├── gantt.js             # D3 interactive Gantt
│   │   └── items.js             # phase/task accordion with quotes + payments
│   ├── editors/
│   │   ├── task-editor.js       # add/edit task modal
│   │   ├── quote-editor.js      # add/edit quote modal
│   │   └── payment-editor.js    # add/edit payment modal
│   ├── lib/
│   │   ├── ids.js               # short id generation
│   │   ├── dates.js             # date math helpers
│   │   └── format.js            # currency + percent formatters
│   └── styles/
│       └── app.css
└── tests/
    ├── derived.test.js
    ├── mutations.test.js
    └── starter-template.test.js
```

**Dependency rule:** `views/*` and `editors/*` may import from `state/*` and `lib/*` only. `state/*` modules never import from `views/*`. No circular deps.

---

## UI Layout — Dashboard (top to bottom)

### 1. Header bar
Project name (editable inline), total budget, total spent, % complete, export button, import button, $/% burndown toggle.

### 2. Burndown chart
Full width, ~280px tall. D3 line chart.
- Dashed gray line: ideal (linear `totalBudget → 0` over project duration)
- Orange line: actual (cumulative payments subtracted from budget)
- Vertical tick marks at phase completion milestones
- Hover tooltip: date, remaining budget, variance from ideal

### 3. Gantt chart
Full width, horizontally scrollable for long projects. D3 chart.
- Rows grouped by phase (phase headers are collapsible)
- Each task bar: drag edges to resize duration, drag body to reschedule
- Drag from bar endpoint to another bar to draw a dependency arrow
- Progress fill: darker left-to-right fill based on `task.progress`
- Critical path: red highlight ring on critical-path bars
- Status color coding: gray=not started, blue=in progress, green=done, red=blocked

### 4. Items panel
Phase accordion. Each phase shows rollup budget and % complete.

Expand phase → task rows. Click task → inline drawer:
- Edit fields: name, dates, status, progress %, notes
- Quote list: vendor, amount, notes, date, attachment link; radio to select active quote; Add quote button
- Payment log: list of payments; Add payment button

### Gantt ↔ Items sync
Clicking a task in Items scrolls Gantt to its bar and pulses it. Dragging a Gantt bar updates start/end in Items immediately.

---

## Starter Template Phases

| Phase | Representative tasks |
|---|---|
| Pre-construction | Permits, surveying, site plan, financing close |
| Site prep | Demolition, grading, utility hookups |
| Foundation | Excavation, footings, slab/basement pour, waterproofing |
| Framing | Floor system, walls, roof structure, sheathing |
| Exterior | Roofing, windows/doors, siding, driveway rough |
| MEP rough-in | Plumbing, electrical, HVAC, insulation |
| Drywall & finishes | Drywall, painting, flooring, trim, cabinets |
| Fixtures & appliances | Plumbing fixtures, electrical fixtures, appliances |
| Final & punch list | Inspections, punch list, landscaping, CO |

All amounts default to `0`. Dates are `null` in the template — the user fills them in after setting their project start date. No quotes pre-attached.

---

## Edge Cases

| Scenario | Handling |
|---|---|
| No payments logged yet | Burndown actual = single dot at `totalBudget` on `startDate`; chart renders normally |
| Task with no dates | Excluded from Gantt; shown in Items with "no dates" badge |
| Circular dependency | Mutation rejects it; inline error shown in dependency field |
| Import overwrites data | Confirm dialog required before proceeding |
| localStorage quota exceeded | Caught; toast shown: "Save failed — export your data as a backup" |

---

## Testing Plan

Vitest unit tests for pure logic only:

- `derived.test.js` — rollup calculations, burndown line math, critical path algorithm
- `mutations.test.js` — state mutations maintain invariants (no orphaned quotes/payments after task delete, circular dep rejection)
- `starter-template.test.js` — template JSON parses and loads without errors

View modules (D3/DOM) are not unit-tested in v1. Manual smoke testing in browser covers the golden path.

---

## Git & Deployment

- Initialize as a git repo, push to user's GitHub account
- Add `.superpowers/` and `dist/` to `.gitignore`
- `budget.json` exports can be committed to the repo for an audit trail of spend history
