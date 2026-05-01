# Construction Budget Visualizer Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a single-page, localStorage-backed construction budget tracker with burndown chart, interactive Gantt, and vendor quote comparison.

**Architecture:** Vanilla JS + Vite + D3 v7. One state object, full re-render on mutation, no framework. Three D3 views (burndown, gantt, items) plus modal editors all wired in main.js.

**Tech Stack:** Vite, D3 v7, Vitest, plain CSS, localStorage + JSON export/import.

---

## Chunk 1: Foundation — Scaffold, State, Tests, Template

### Task 1: Git init + npm scaffold

**Files:**
- Create: `package.json`
- Create: `vite.config.js`
- Create: `index.html`
- Create: `.gitignore`

- [ ] **Step 1: Init git repo and npm**

```bash
cd /home/manny/projects/robert-the-framer
git init
npm init -y
```

- [ ] **Step 2: Install dependencies**

```bash
npm install d3
npm install --save-dev vite vitest
```

- [ ] **Step 3: Write package.json scripts**

Replace the `scripts` section in `package.json`:
```json
{
  "name": "robert-the-framer",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "test": "vitest run"
  },
  "dependencies": {
    "d3": "^7.9.0"
  },
  "devDependencies": {
    "vite": "^5.0.0",
    "vitest": "^1.0.0"
  }
}
```

- [ ] **Step 4: Write vite.config.js**

```js
import { defineConfig } from 'vite'
export default defineConfig({
  test: {
    environment: 'node'
  }
})
```

- [ ] **Step 5: Write index.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Robert the Framer</title>
  <link rel="stylesheet" href="/src/styles/app.css" />
</head>
<body>
  <div id="app">
    <header id="header"></header>
    <main id="main">
      <section id="burndown"></section>
      <section id="gantt"></section>
      <section id="items"></section>
    </main>
  </div>
  <div id="modal-overlay" class="hidden"></div>
  <div id="toast-container"></div>
  <script type="module" src="/src/main.js"></script>
</body>
</html>
```

- [ ] **Step 6: Write .gitignore**

```
node_modules/
dist/
.superpowers/
*.local
```

- [ ] **Step 7: Create directory structure**

```bash
mkdir -p src/state src/views src/editors src/lib src/styles tests public
```

- [ ] **Step 8: Verify dev server starts**

```bash
npm run dev
```
Expected: Vite starts on http://localhost:5173 (blank page, no errors in console).

- [ ] **Step 9: Commit**

```bash
git add .
git commit -m "feat: scaffold vite project with d3"
```

---

### Task 2: lib/ids.js

**Files:**
- Create: `src/lib/ids.js`

- [ ] **Step 1: Write the module**

```js
// src/lib/ids.js
export function newId() {
  return Math.random().toString(36).slice(2, 9) + Date.now().toString(36)
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/ids.js
git commit -m "feat: add id generator"
```

---

### Task 3: lib/dates.js with tests

**Files:**
- Create: `src/lib/dates.js`
- Create: `tests/dates.test.js`

- [ ] **Step 1: Write failing tests**

```js
// tests/dates.test.js
import { describe, it, expect } from 'vitest'
import { parseDate, formatDate, daysBetween, addDays } from '../src/lib/dates.js'

describe('parseDate', () => {
  it('parses ISO string to Date', () => {
    const d = parseDate('2026-06-01')
    expect(d).toBeInstanceOf(Date)
    expect(d.getUTCFullYear()).toBe(2026)
    expect(d.getUTCMonth()).toBe(5)
    expect(d.getUTCDate()).toBe(1)
  })
  it('returns null for null input', () => {
    expect(parseDate(null)).toBeNull()
  })
})

describe('formatDate', () => {
  it('formats Date to YYYY-MM-DD', () => {
    expect(formatDate(new Date('2026-06-01'))).toBe('2026-06-01')
  })
})

describe('daysBetween', () => {
  it('counts days between two ISO strings', () => {
    expect(daysBetween('2026-06-01', '2026-06-15')).toBe(14)
  })
  it('returns 0 for same date', () => {
    expect(daysBetween('2026-06-01', '2026-06-01')).toBe(0)
  })
})

describe('addDays', () => {
  it('adds days to ISO string', () => {
    expect(addDays('2026-06-01', 7)).toBe('2026-06-08')
  })
  it('handles negative offset', () => {
    expect(addDays('2026-06-08', -7)).toBe('2026-06-01')
  })
})
```

- [ ] **Step 2: Run tests — expect failures**

```bash
npm test tests/dates.test.js
```
Expected: FAIL — module not found.

- [ ] **Step 3: Write the module**

```js
// src/lib/dates.js
export function parseDate(str) {
  if (!str) return null
  const d = new Date(str + 'T00:00:00Z')
  return isNaN(d.getTime()) ? null : d
}

export function formatDate(date) {
  return date.toISOString().slice(0, 10)
}

export function daysBetween(isoA, isoB) {
  const a = parseDate(isoA)
  const b = parseDate(isoB)
  return Math.round((b - a) / 86400000)
}

export function addDays(isoStr, n) {
  const d = parseDate(isoStr)
  d.setUTCDate(d.getUTCDate() + n)
  return formatDate(d)
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npm test tests/dates.test.js
```
Expected: 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/dates.js tests/dates.test.js
git commit -m "feat: add date utilities"
```

---

### Task 4: lib/format.js

**Files:**
- Create: `src/lib/format.js`

- [ ] **Step 1: Write the module**

```js
// src/lib/format.js
export function formatCurrency(amount, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0
  }).format(amount ?? 0)
}

export function formatPercent(n) {
  return `${Math.round(n ?? 0)}%`
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/format.js
git commit -m "feat: add format utilities"
```

---

### Task 5: state/store.js

**Files:**
- Create: `src/state/store.js`

- [ ] **Step 1: Write the module**

```js
// src/state/store.js
const STORAGE_KEY = 'robert-the-framer-v1'

let _state = null
let _onChange = null

export function getState() {
  return _state
}

export function setState(next) {
  _state = { ...next, meta: { ...next.meta, updatedAt: new Date().toISOString() } }
  _persist()
  if (_onChange) _onChange(_state)
}

export function setOnChange(fn) {
  _onChange = fn
}

export function load(templateFallback = null) {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (raw) {
    try {
      _state = JSON.parse(raw)
      return
    } catch (_) { /* fall through */ }
  }
  _state = templateFallback ?? _emptyState()
}

export function exportJSON() {
  const date = new Date().toISOString().slice(0, 10)
  const blob = new Blob([JSON.stringify(_state, null, 2)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `robert-budget-${date}.json`
  a.click()
  URL.revokeObjectURL(a.href)
}

export function importJSON(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => {
      try {
        const next = JSON.parse(e.target.result)
        _state = next
        _persist()
        if (_onChange) _onChange(_state)
        resolve()
      } catch (err) {
        reject(new Error('Invalid JSON file'))
      }
    }
    reader.readAsText(file)
  })
}

function _persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(_state))
  } catch (e) {
    window.dispatchEvent(new CustomEvent('storage-quota-exceeded'))
  }
}

function _emptyState() {
  const now = new Date().toISOString()
  return {
    meta: {
      projectName: 'My New Home',
      startDate: null,
      targetEndDate: null,
      totalBudget: null,
      currency: 'USD',
      createdAt: now,
      updatedAt: now
    },
    phases: [],
    tasks: [],
    quotes: [],
    payments: []
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/state/store.js
git commit -m "feat: add state store with localStorage"
```

---

### Task 6: state/mutations.js with tests

**Files:**
- Create: `src/state/mutations.js`
- Create: `tests/mutations.test.js`

- [ ] **Step 1: Write failing tests**

```js
// tests/mutations.test.js
import { describe, it, expect, beforeEach } from 'vitest'

// Mock localStorage for Node
const store = {}
global.localStorage = {
  getItem: k => store[k] ?? null,
  setItem: (k, v) => { store[k] = v },
  removeItem: k => { delete store[k] }
}
global.window = { dispatchEvent: () => {} }

// Must import AFTER mocking globals
const { getState, load, setState } = await import('../src/state/store.js')
const mutations = await import('../src/state/mutations.js')

function freshState() {
  return {
    meta: { projectName: 'Test', startDate: '2026-01-01', targetEndDate: '2026-12-31', totalBudget: 100000, currency: 'USD', createdAt: '', updatedAt: '' },
    phases: [{ id: 'p1', name: 'Foundation', color: '#000', order: 1 }],
    tasks: [],
    quotes: [],
    payments: []
  }
}

beforeEach(() => setState(freshState()))

describe('addTask', () => {
  it('adds a task to state', () => {
    mutations.addTask({ phaseId: 'p1', name: 'Excavation', budget: 5000, startDate: '2026-02-01', endDate: '2026-02-07', progress: 0, status: 'not_started', dependsOn: [], notes: '', selectedQuoteId: null })
    expect(getState().tasks).toHaveLength(1)
    expect(getState().tasks[0].name).toBe('Excavation')
  })
})

describe('updateTask', () => {
  it('updates task fields', () => {
    mutations.addTask({ phaseId: 'p1', name: 'Excavation', budget: 5000, startDate: null, endDate: null, progress: 0, status: 'not_started', dependsOn: [], notes: '', selectedQuoteId: null })
    const id = getState().tasks[0].id
    mutations.updateTask(id, { progress: 50 })
    expect(getState().tasks[0].progress).toBe(50)
  })
})

describe('deleteTask', () => {
  it('removes task and its quotes and payments', () => {
    mutations.addTask({ phaseId: 'p1', name: 'Excavation', budget: 5000, startDate: null, endDate: null, progress: 0, status: 'not_started', dependsOn: [], notes: '', selectedQuoteId: null })
    const taskId = getState().tasks[0].id
    mutations.addQuote({ taskId, vendor: 'ACME', amount: 5000, notes: '', receivedDate: '2026-01-15', attachmentUrl: '' })
    mutations.addPayment({ taskId, amount: 2500, date: '2026-02-01', notes: '', type: 'deposit' })
    mutations.deleteTask(taskId)
    expect(getState().tasks).toHaveLength(0)
    expect(getState().quotes).toHaveLength(0)
    expect(getState().payments).toHaveLength(0)
  })
})

describe('selectQuote', () => {
  it('syncs task budget to selected quote amount', () => {
    mutations.addTask({ phaseId: 'p1', name: 'Slab', budget: 0, startDate: null, endDate: null, progress: 0, status: 'not_started', dependsOn: [], notes: '', selectedQuoteId: null })
    const taskId = getState().tasks[0].id
    mutations.addQuote({ taskId, vendor: 'ACME', amount: 12400, notes: '', receivedDate: '2026-01-15', attachmentUrl: '' })
    const quoteId = getState().quotes[0].id
    mutations.selectQuote(taskId, quoteId)
    expect(getState().tasks[0].budget).toBe(12400)
    expect(getState().tasks[0].selectedQuoteId).toBe(quoteId)
  })
})

describe('addTask circular dependency', () => {
  it('rejects dependsOn that would create a cycle', () => {
    mutations.addTask({ phaseId: 'p1', name: 'A', budget: 0, startDate: null, endDate: null, progress: 0, status: 'not_started', dependsOn: [], notes: '', selectedQuoteId: null })
    const idA = getState().tasks[0].id
    mutations.addTask({ phaseId: 'p1', name: 'B', budget: 0, startDate: null, endDate: null, progress: 0, status: 'not_started', dependsOn: [idA], notes: '', selectedQuoteId: null })
    const idB = getState().tasks[1].id
    expect(() => mutations.updateTask(idA, { dependsOn: [idB] })).toThrow('circular')
  })
})
```

- [ ] **Step 2: Run tests — expect failures**

```bash
npm test tests/mutations.test.js
```
Expected: FAIL — mutations module not found.

- [ ] **Step 3: Write mutations.js**

```js
// src/state/mutations.js
import { getState, setState } from './store.js'
import { newId } from '../lib/ids.js'

export function updateMeta(fields) {
  const s = getState()
  setState({ ...s, meta: { ...s.meta, ...fields } })
}

export function addPhase({ name, color, order }) {
  const s = getState()
  setState({ ...s, phases: [...s.phases, { id: newId(), name, color, order }] })
}

export function updatePhase(id, fields) {
  const s = getState()
  setState({ ...s, phases: s.phases.map(p => p.id === id ? { ...p, ...fields } : p) })
}

export function deletePhase(id) {
  const s = getState()
  const taskIds = s.tasks.filter(t => t.phaseId === id).map(t => t.id)
  setState({
    ...s,
    phases: s.phases.filter(p => p.id !== id),
    tasks: s.tasks.filter(t => t.phaseId !== id),
    quotes: s.quotes.filter(q => !taskIds.includes(q.taskId)),
    payments: s.payments.filter(p => !taskIds.includes(p.taskId))
  })
}

export function addTask(fields) {
  const s = getState()
  setState({ ...s, tasks: [...s.tasks, { id: newId(), ...fields }] })
}

export function updateTask(id, fields) {
  const s = getState()
  if (fields.dependsOn) _assertNoCycle(s, id, fields.dependsOn)
  setState({ ...s, tasks: s.tasks.map(t => t.id === id ? { ...t, ...fields } : t) })
}

export function deleteTask(id) {
  const s = getState()
  setState({
    ...s,
    tasks: s.tasks.filter(t => t.id !== id),
    quotes: s.quotes.filter(q => q.taskId !== id),
    payments: s.payments.filter(p => p.taskId !== id)
  })
}

export function addQuote(fields) {
  const s = getState()
  setState({ ...s, quotes: [...s.quotes, { id: newId(), ...fields }] })
}

export function updateQuote(id, fields) {
  const s = getState()
  const next = { ...s, quotes: s.quotes.map(q => q.id === id ? { ...q, ...fields } : q) }
  // re-sync budget if this quote is selected
  const quote = next.quotes.find(q => q.id === id)
  if (quote && fields.amount !== undefined) {
    const task = next.tasks.find(t => t.selectedQuoteId === id)
    if (task) {
      next.tasks = next.tasks.map(t => t.id === task.id ? { ...t, budget: fields.amount } : t)
    }
  }
  setState(next)
}

export function deleteQuote(id) {
  const s = getState()
  const quote = s.quotes.find(q => q.id === id)
  let tasks = s.tasks
  if (quote) {
    tasks = tasks.map(t => t.selectedQuoteId === id ? { ...t, selectedQuoteId: null } : t)
  }
  setState({ ...s, quotes: s.quotes.filter(q => q.id !== id), tasks })
}

export function selectQuote(taskId, quoteId) {
  const s = getState()
  const quote = s.quotes.find(q => q.id === quoteId)
  setState({
    ...s,
    tasks: s.tasks.map(t =>
      t.id === taskId ? { ...t, selectedQuoteId: quoteId, budget: quote?.amount ?? t.budget } : t
    )
  })
}

export function addPayment(fields) {
  const s = getState()
  setState({ ...s, payments: [...s.payments, { id: newId(), ...fields }] })
}

export function updatePayment(id, fields) {
  const s = getState()
  setState({ ...s, payments: s.payments.map(p => p.id === id ? { ...p, ...fields } : p) })
}

export function deletePayment(id) {
  const s = getState()
  setState({ ...s, payments: s.payments.filter(p => p.id !== id) })
}

function _assertNoCycle(state, taskId, newDeps) {
  const depMap = new Map(state.tasks.map(t => [t.id, t.dependsOn]))
  depMap.set(taskId, newDeps)
  const visited = new Set()
  function visit(id) {
    if (id === taskId && visited.size > 0) throw new Error('circular dependency')
    if (visited.has(id)) return
    visited.add(id)
    for (const dep of (depMap.get(id) || [])) visit(dep)
    visited.delete(id)
  }
  visit(taskId)
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npm test tests/mutations.test.js
```
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/state/mutations.js tests/mutations.test.js
git commit -m "feat: add state mutations with cycle detection"
```

---

### Task 7: state/derived.js with tests

**Files:**
- Create: `src/state/derived.js`
- Create: `tests/derived.test.js`

- [ ] **Step 1: Write failing tests**

```js
// tests/derived.test.js
import { describe, it, expect } from 'vitest'
import { totalSpent, phaseBudget, phaseProgress, burndownLines, criticalPath } from '../src/state/derived.js'

const baseState = {
  meta: { startDate: '2026-01-01', targetEndDate: '2026-12-31', totalBudget: 100000, currency: 'USD' },
  phases: [{ id: 'p1', name: 'Foundation', color: '#000', order: 1 }],
  tasks: [
    { id: 't1', phaseId: 'p1', name: 'A', budget: 10000, startDate: '2026-01-01', endDate: '2026-01-10', progress: 100, status: 'done', dependsOn: [] },
    { id: 't2', phaseId: 'p1', name: 'B', budget: 20000, startDate: '2026-01-10', endDate: '2026-01-20', progress: 50, status: 'in_progress', dependsOn: ['t1'] }
  ],
  quotes: [],
  payments: [
    { id: 'pay1', taskId: 't1', amount: 10000, date: '2026-01-10', type: 'final' },
    { id: 'pay2', taskId: 't2', amount: 5000, date: '2026-01-15', type: 'deposit' }
  ]
}

describe('totalSpent', () => {
  it('sums all payments', () => {
    expect(totalSpent(baseState)).toBe(15000)
  })
})

describe('phaseBudget', () => {
  it('sums task budgets in phase', () => {
    expect(phaseBudget(baseState, 'p1')).toBe(30000)
  })
})

describe('phaseProgress', () => {
  it('computes budget-weighted average progress', () => {
    // t1: 10000 * 100 = 1000000, t2: 20000 * 50 = 1000000, total budget 30000
    // (1000000 + 1000000) / 30000 = 66.66...
    expect(phaseProgress(baseState, 'p1')).toBeCloseTo(66.67, 1)
  })
})

describe('burndownLines', () => {
  it('starts ideal at totalBudget', () => {
    const { ideal } = burndownLines(baseState)
    expect(ideal[0].value).toBe(100000)
    expect(ideal[0].date).toBe('2026-01-01')
  })
  it('actual line decrements by payment amounts', () => {
    const { actual } = burndownLines(baseState)
    expect(actual[0].value).toBe(100000)
    expect(actual[1].value).toBe(90000) // after 10000 payment
    expect(actual[2].value).toBe(85000) // after 5000 payment
  })
})

describe('criticalPath', () => {
  it('identifies tasks on the longest dependency chain', () => {
    const cp = criticalPath(baseState)
    // t1 (9 days) → t2 (10 days) = 19 days total, both on critical path
    expect(cp.has('t1')).toBe(true)
    expect(cp.has('t2')).toBe(true)
  })
})
```

- [ ] **Step 2: Run tests — expect failures**

```bash
npm test tests/derived.test.js
```
Expected: FAIL.

- [ ] **Step 3: Write derived.js**

```js
// src/state/derived.js

export function totalSpent(state) {
  return state.payments.reduce((sum, p) => sum + (p.amount || 0), 0)
}

export function phaseBudget(state, phaseId) {
  return state.tasks
    .filter(t => t.phaseId === phaseId)
    .reduce((sum, t) => sum + (t.budget || 0), 0)
}

export function phaseProgress(state, phaseId) {
  const tasks = state.tasks.filter(t => t.phaseId === phaseId)
  if (!tasks.length) return 0
  const totalBudget = tasks.reduce((s, t) => s + (t.budget || 0), 0)
  if (!totalBudget) {
    return tasks.reduce((s, t) => s + (t.progress || 0), 0) / tasks.length
  }
  return tasks.reduce((s, t) => s + (t.progress || 0) * (t.budget || 0), 0) / totalBudget
}

export function burndownLines(state) {
  const { startDate, targetEndDate, totalBudget } = state.meta
  const budget = totalBudget != null
    ? totalBudget
    : state.tasks.reduce((s, t) => s + (t.budget || 0), 0)

  const ideal = [
    { date: startDate, value: budget },
    { date: targetEndDate, value: 0 }
  ]

  const sorted = [...state.payments]
    .filter(p => p.date)
    .sort((a, b) => a.date.localeCompare(b.date))

  let remaining = budget
  const actual = [{ date: startDate, value: budget }]
  for (const p of sorted) {
    remaining -= p.amount || 0
    actual.push({ date: p.date, value: remaining })
  }

  return { ideal, actual }
}

export function criticalPath(state) {
  const tasks = state.tasks.filter(t => t.startDate && t.endDate)
  if (!tasks.length) return new Set()
  const taskMap = new Map(tasks.map(t => [t.id, t]))

  function duration(t) {
    return Math.max(1, (new Date(t.endDate) - new Date(t.startDate)) / 86400000)
  }

  const ef = new Map()
  function earliestFinish(id) {
    if (ef.has(id)) return ef.get(id)
    const t = taskMap.get(id)
    if (!t) return 0
    const predMax = t.dependsOn.length
      ? Math.max(...t.dependsOn.map(d => earliestFinish(d)))
      : 0
    const result = predMax + duration(t)
    ef.set(id, result)
    return result
  }
  tasks.forEach(t => earliestFinish(t.id))

  const projectFinish = Math.max(...ef.values())

  const successors = new Map(tasks.map(t => [t.id, []]))
  tasks.forEach(t => t.dependsOn.forEach(dep => {
    if (successors.has(dep)) successors.get(dep).push(t.id)
  }))

  const lf = new Map()
  function latestFinish(id) {
    if (lf.has(id)) return lf.get(id)
    const succs = successors.get(id) || []
    const result = succs.length
      ? Math.min(...succs.map(s => latestFinish(s) - duration(taskMap.get(s))))
      : projectFinish
    lf.set(id, result)
    return result
  }
  tasks.forEach(t => latestFinish(t.id))

  return new Set(tasks.filter(t => Math.abs(lf.get(t.id) - ef.get(t.id)) < 0.01).map(t => t.id))
}

export function quotesForTask(state, taskId) {
  return state.quotes.filter(q => q.taskId === taskId)
}

export function paymentsForTask(state, taskId) {
  return state.payments.filter(p => p.taskId === taskId)
}

export function tasksByPhase(state) {
  const map = new Map(state.phases.map(p => [p.id, []]))
  state.tasks.forEach(t => {
    if (map.has(t.phaseId)) map.get(t.phaseId).push(t)
  })
  return map
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npm test tests/derived.test.js
```
Expected: All tests pass.

- [ ] **Step 5: Run all tests**

```bash
npm test
```
Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/state/derived.js tests/derived.test.js
git commit -m "feat: add derived state computations"
```

---

### Task 8: Starter template JSON

**Files:**
- Create: `public/starter-template.json`
- Create: `tests/starter-template.test.js`

- [ ] **Step 1: Write the template**

```json
{
  "meta": {
    "projectName": "My New Home",
    "startDate": null,
    "targetEndDate": null,
    "totalBudget": null,
    "currency": "USD",
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z"
  },
  "phases": [
    { "id": "ph-preconstruction", "name": "Pre-construction", "color": "#6366f1", "order": 1 },
    { "id": "ph-site-prep",       "name": "Site Prep",         "color": "#f59e0b", "order": 2 },
    { "id": "ph-foundation",      "name": "Foundation",        "color": "#0369a1", "order": 3 },
    { "id": "ph-framing",         "name": "Framing",           "color": "#7c3aed", "order": 4 },
    { "id": "ph-exterior",        "name": "Exterior",          "color": "#0891b2", "order": 5 },
    { "id": "ph-mep",             "name": "MEP Rough-in",      "color": "#d97706", "order": 6 },
    { "id": "ph-drywall",         "name": "Drywall & Finishes","color": "#059669", "order": 7 },
    { "id": "ph-fixtures",        "name": "Fixtures & Appliances","color": "#db2777","order": 8 },
    { "id": "ph-punchlist",       "name": "Final & Punch List","color": "#64748b", "order": 9 }
  ],
  "tasks": [
    { "id": "t-permits",    "phaseId": "ph-preconstruction", "name": "Permits & approvals",   "budget": 0, "startDate": null, "endDate": null, "progress": 0, "status": "not_started", "dependsOn": [], "notes": "", "selectedQuoteId": null },
    { "id": "t-survey",     "phaseId": "ph-preconstruction", "name": "Surveying",              "budget": 0, "startDate": null, "endDate": null, "progress": 0, "status": "not_started", "dependsOn": [], "notes": "", "selectedQuoteId": null },
    { "id": "t-siteplan",   "phaseId": "ph-preconstruction", "name": "Site plan & architect",  "budget": 0, "startDate": null, "endDate": null, "progress": 0, "status": "not_started", "dependsOn": [], "notes": "", "selectedQuoteId": null },
    { "id": "t-financing",  "phaseId": "ph-preconstruction", "name": "Financing close",        "budget": 0, "startDate": null, "endDate": null, "progress": 0, "status": "not_started", "dependsOn": [], "notes": "", "selectedQuoteId": null },
    { "id": "t-demo",       "phaseId": "ph-site-prep",       "name": "Demolition / clearing",  "budget": 0, "startDate": null, "endDate": null, "progress": 0, "status": "not_started", "dependsOn": ["t-permits"], "notes": "", "selectedQuoteId": null },
    { "id": "t-grading",    "phaseId": "ph-site-prep",       "name": "Grading",                "budget": 0, "startDate": null, "endDate": null, "progress": 0, "status": "not_started", "dependsOn": ["t-demo"], "notes": "", "selectedQuoteId": null },
    { "id": "t-utilities",  "phaseId": "ph-site-prep",       "name": "Utility hookups",        "budget": 0, "startDate": null, "endDate": null, "progress": 0, "status": "not_started", "dependsOn": ["t-grading"], "notes": "", "selectedQuoteId": null },
    { "id": "t-excavation", "phaseId": "ph-foundation",      "name": "Excavation",             "budget": 0, "startDate": null, "endDate": null, "progress": 0, "status": "not_started", "dependsOn": ["t-grading"], "notes": "", "selectedQuoteId": null },
    { "id": "t-footings",   "phaseId": "ph-foundation",      "name": "Footings",               "budget": 0, "startDate": null, "endDate": null, "progress": 0, "status": "not_started", "dependsOn": ["t-excavation"], "notes": "", "selectedQuoteId": null },
    { "id": "t-slab",       "phaseId": "ph-foundation",      "name": "Slab / basement pour",   "budget": 0, "startDate": null, "endDate": null, "progress": 0, "status": "not_started", "dependsOn": ["t-footings"], "notes": "", "selectedQuoteId": null },
    { "id": "t-waterproof", "phaseId": "ph-foundation",      "name": "Waterproofing",          "budget": 0, "startDate": null, "endDate": null, "progress": 0, "status": "not_started", "dependsOn": ["t-slab"], "notes": "", "selectedQuoteId": null },
    { "id": "t-floor",      "phaseId": "ph-framing",         "name": "Floor system",           "budget": 0, "startDate": null, "endDate": null, "progress": 0, "status": "not_started", "dependsOn": ["t-slab"], "notes": "", "selectedQuoteId": null },
    { "id": "t-walls",      "phaseId": "ph-framing",         "name": "Walls",                  "budget": 0, "startDate": null, "endDate": null, "progress": 0, "status": "not_started", "dependsOn": ["t-floor"], "notes": "", "selectedQuoteId": null },
    { "id": "t-roof",       "phaseId": "ph-framing",         "name": "Roof structure",         "budget": 0, "startDate": null, "endDate": null, "progress": 0, "status": "not_started", "dependsOn": ["t-walls"], "notes": "", "selectedQuoteId": null },
    { "id": "t-sheathing",  "phaseId": "ph-framing",         "name": "Sheathing",              "budget": 0, "startDate": null, "endDate": null, "progress": 0, "status": "not_started", "dependsOn": ["t-roof"], "notes": "", "selectedQuoteId": null },
    { "id": "t-roofing",    "phaseId": "ph-exterior",        "name": "Roofing",                "budget": 0, "startDate": null, "endDate": null, "progress": 0, "status": "not_started", "dependsOn": ["t-sheathing"], "notes": "", "selectedQuoteId": null },
    { "id": "t-windows",    "phaseId": "ph-exterior",        "name": "Windows & doors",        "budget": 0, "startDate": null, "endDate": null, "progress": 0, "status": "not_started", "dependsOn": ["t-sheathing"], "notes": "", "selectedQuoteId": null },
    { "id": "t-siding",     "phaseId": "ph-exterior",        "name": "Siding",                 "budget": 0, "startDate": null, "endDate": null, "progress": 0, "status": "not_started", "dependsOn": ["t-windows"], "notes": "", "selectedQuoteId": null },
    { "id": "t-driveway",   "phaseId": "ph-exterior",        "name": "Driveway rough",         "budget": 0, "startDate": null, "endDate": null, "progress": 0, "status": "not_started", "dependsOn": ["t-grading"], "notes": "", "selectedQuoteId": null },
    { "id": "t-plumbing",   "phaseId": "ph-mep",             "name": "Plumbing rough-in",      "budget": 0, "startDate": null, "endDate": null, "progress": 0, "status": "not_started", "dependsOn": ["t-floor"], "notes": "", "selectedQuoteId": null },
    { "id": "t-electrical", "phaseId": "ph-mep",             "name": "Electrical rough-in",    "budget": 0, "startDate": null, "endDate": null, "progress": 0, "status": "not_started", "dependsOn": ["t-floor"], "notes": "", "selectedQuoteId": null },
    { "id": "t-hvac",       "phaseId": "ph-mep",             "name": "HVAC",                   "budget": 0, "startDate": null, "endDate": null, "progress": 0, "status": "not_started", "dependsOn": ["t-floor"], "notes": "", "selectedQuoteId": null },
    { "id": "t-insulation", "phaseId": "ph-mep",             "name": "Insulation",             "budget": 0, "startDate": null, "endDate": null, "progress": 0, "status": "not_started", "dependsOn": ["t-electrical","t-plumbing","t-hvac"], "notes": "", "selectedQuoteId": null },
    { "id": "t-drywall",    "phaseId": "ph-drywall",         "name": "Drywall",                "budget": 0, "startDate": null, "endDate": null, "progress": 0, "status": "not_started", "dependsOn": ["t-insulation"], "notes": "", "selectedQuoteId": null },
    { "id": "t-painting",   "phaseId": "ph-drywall",         "name": "Painting",               "budget": 0, "startDate": null, "endDate": null, "progress": 0, "status": "not_started", "dependsOn": ["t-drywall"], "notes": "", "selectedQuoteId": null },
    { "id": "t-flooring",   "phaseId": "ph-drywall",         "name": "Flooring",               "budget": 0, "startDate": null, "endDate": null, "progress": 0, "status": "not_started", "dependsOn": ["t-painting"], "notes": "", "selectedQuoteId": null },
    { "id": "t-trim",       "phaseId": "ph-drywall",         "name": "Trim & cabinets",        "budget": 0, "startDate": null, "endDate": null, "progress": 0, "status": "not_started", "dependsOn": ["t-painting"], "notes": "", "selectedQuoteId": null },
    { "id": "t-plfix",      "phaseId": "ph-fixtures",        "name": "Plumbing fixtures",      "budget": 0, "startDate": null, "endDate": null, "progress": 0, "status": "not_started", "dependsOn": ["t-trim"], "notes": "", "selectedQuoteId": null },
    { "id": "t-elfix",      "phaseId": "ph-fixtures",        "name": "Electrical fixtures",    "budget": 0, "startDate": null, "endDate": null, "progress": 0, "status": "not_started", "dependsOn": ["t-trim"], "notes": "", "selectedQuoteId": null },
    { "id": "t-appliances", "phaseId": "ph-fixtures",        "name": "Appliances",             "budget": 0, "startDate": null, "endDate": null, "progress": 0, "status": "not_started", "dependsOn": ["t-trim"], "notes": "", "selectedQuoteId": null },
    { "id": "t-inspect",    "phaseId": "ph-punchlist",       "name": "Final inspections",      "budget": 0, "startDate": null, "endDate": null, "progress": 0, "status": "not_started", "dependsOn": ["t-plfix","t-elfix","t-appliances"], "notes": "", "selectedQuoteId": null },
    { "id": "t-punch",      "phaseId": "ph-punchlist",       "name": "Punch list",             "budget": 0, "startDate": null, "endDate": null, "progress": 0, "status": "not_started", "dependsOn": ["t-inspect"], "notes": "", "selectedQuoteId": null },
    { "id": "t-landscape",  "phaseId": "ph-punchlist",       "name": "Landscaping",            "budget": 0, "startDate": null, "endDate": null, "progress": 0, "status": "not_started", "dependsOn": [], "notes": "", "selectedQuoteId": null },
    { "id": "t-co",         "phaseId": "ph-punchlist",       "name": "Certificate of Occupancy","budget": 0,"startDate": null, "endDate": null, "progress": 0, "status": "not_started", "dependsOn": ["t-punch"], "notes": "", "selectedQuoteId": null }
  ],
  "quotes": [],
  "payments": []
}
```

- [ ] **Step 2: Write starter template test**

```js
// tests/starter-template.test.js
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

describe('starter-template.json', () => {
  it('parses without errors', () => {
    const raw = readFileSync(resolve('public/starter-template.json'), 'utf8')
    expect(() => JSON.parse(raw)).not.toThrow()
  })

  it('has required top-level keys', () => {
    const t = JSON.parse(readFileSync(resolve('public/starter-template.json'), 'utf8'))
    expect(t).toHaveProperty('meta')
    expect(t).toHaveProperty('phases')
    expect(t).toHaveProperty('tasks')
    expect(t).toHaveProperty('quotes')
    expect(t).toHaveProperty('payments')
  })

  it('has 9 phases', () => {
    const t = JSON.parse(readFileSync(resolve('public/starter-template.json'), 'utf8'))
    expect(t.phases).toHaveLength(9)
  })

  it('all task dependsOn IDs exist', () => {
    const t = JSON.parse(readFileSync(resolve('public/starter-template.json'), 'utf8'))
    const ids = new Set(t.tasks.map(task => task.id))
    t.tasks.forEach(task => {
      task.dependsOn.forEach(dep => {
        expect(ids.has(dep), `task ${task.id} depends on unknown id ${dep}`).toBe(true)
      })
    })
  })
})
```

- [ ] **Step 3: Run tests — expect pass**

```bash
npm test tests/starter-template.test.js
```
Expected: 4 tests pass.

- [ ] **Step 4: Run full suite**

```bash
npm test
```
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add public/starter-template.json tests/starter-template.test.js
git commit -m "feat: add starter template with home-build phases"
```

---

## Chunk 2: UI — Views, Editors, Wiring, Deploy

### Task 9: CSS

**Files:**
- Create: `src/styles/app.css`

- [ ] **Step 1: Write base styles**

```css
/* src/styles/app.css */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --bg: #f8fafc;
  --surface: #ffffff;
  --border: #e2e8f0;
  --text: #1e293b;
  --text-muted: #64748b;
  --accent: #d97706;
  --accent-2: #0369a1;
  --green: #059669;
  --red: #dc2626;
  --radius: 6px;
  --shadow: 0 1px 3px rgba(0,0,0,.1);
}

body { font-family: system-ui, sans-serif; background: var(--bg); color: var(--text); font-size: 14px; }

#app { max-width: 1400px; margin: 0 auto; padding: 0 16px 48px; }

/* Header */
#header { position: sticky; top: 0; z-index: 100; background: var(--surface); border-bottom: 1px solid var(--border); padding: 12px 16px; display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
.header-title { font-size: 18px; font-weight: 700; cursor: pointer; border: 1px solid transparent; border-radius: 4px; padding: 2px 6px; }
.header-title:hover { border-color: var(--border); }
.header-title[contenteditable="true"] { border-color: var(--accent); outline: none; }
.header-stats { display: flex; gap: 24px; margin-left: auto; }
.stat { text-align: right; }
.stat-label { font-size: 11px; color: var(--text-muted); text-transform: uppercase; letter-spacing: .04em; }
.stat-value { font-size: 16px; font-weight: 600; }
.header-actions { display: flex; gap: 8px; }

/* Buttons */
button { cursor: pointer; border: 1px solid var(--border); border-radius: var(--radius); padding: 6px 12px; background: var(--surface); color: var(--text); font-size: 13px; transition: background .1s; }
button:hover { background: var(--bg); }
button.primary { background: var(--accent); border-color: var(--accent); color: white; }
button.primary:hover { opacity: .9; }
button.danger { color: var(--red); }
button.small { padding: 3px 8px; font-size: 12px; }
button.icon { padding: 4px 8px; font-size: 16px; border: none; background: none; }

/* Sections */
section { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); box-shadow: var(--shadow); margin-top: 16px; padding: 16px; }
.section-title { font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: .05em; color: var(--text-muted); margin-bottom: 12px; display: flex; align-items: center; gap: 8px; }

/* Burndown toggle */
.toggle-group { display: flex; border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; }
.toggle-group button { border: none; border-radius: 0; border-right: 1px solid var(--border); }
.toggle-group button:last-child { border-right: none; }
.toggle-group button.active { background: var(--accent); color: white; }

/* Chart containers */
.chart-container { overflow-x: auto; }
svg text { font-family: system-ui, sans-serif; }

/* Gantt */
.gantt-phase-label { font-weight: 600; fill: var(--text); }
.gantt-task-label { fill: var(--text); }
.gantt-bar { cursor: grab; }
.gantt-bar:active { cursor: grabbing; }
.gantt-bar-bg { opacity: .25; }
.gantt-critical { stroke: var(--red); stroke-width: 2; }
.dep-arrow { stroke: var(--text-muted); fill: none; }
.dep-handle { cursor: crosshair; fill: var(--text-muted); opacity: 0; }
.dep-handle:hover, .gantt-bar:hover + .dep-handle { opacity: 1; }
.gantt-resize-handle { cursor: ew-resize; fill: transparent; }

/* Items panel */
.phase-row { border-bottom: 1px solid var(--border); }
.phase-header { display: flex; align-items: center; gap: 8px; padding: 10px 8px; cursor: pointer; user-select: none; font-weight: 600; }
.phase-header:hover { background: var(--bg); }
.phase-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
.phase-meta { margin-left: auto; font-size: 12px; color: var(--text-muted); display: flex; gap: 16px; }
.phase-tasks { display: none; padding: 0 8px 8px; }
.phase-tasks.open { display: block; }
.task-row { display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-radius: 4px; cursor: pointer; }
.task-row:hover { background: var(--bg); }
.task-row.active { background: #fff7ed; }
.task-row.highlighted { box-shadow: inset 0 0 0 2px var(--accent); }
.task-name { flex: 1; }
.task-status-badge { font-size: 11px; padding: 1px 6px; border-radius: 10px; font-weight: 500; }
.status-not_started { background: #f1f5f9; color: #64748b; }
.status-in_progress { background: #dbeafe; color: #1d4ed8; }
.status-done { background: #dcfce7; color: #16a34a; }
.status-blocked { background: #fee2e2; color: #dc2626; }
.no-dates-badge { font-size: 11px; color: var(--text-muted); background: var(--bg); border: 1px solid var(--border); border-radius: 4px; padding: 1px 6px; }

/* Task drawer */
.task-drawer { border: 1px solid var(--border); border-radius: var(--radius); background: var(--surface); margin: 4px 0 8px; padding: 16px; }
.drawer-tabs { display: flex; gap: 0; border-bottom: 1px solid var(--border); margin-bottom: 16px; }
.drawer-tab { padding: 6px 14px; cursor: pointer; border: none; background: none; color: var(--text-muted); border-bottom: 2px solid transparent; margin-bottom: -1px; }
.drawer-tab.active { color: var(--accent); border-bottom-color: var(--accent); font-weight: 500; }
.drawer-panel { display: none; }
.drawer-panel.active { display: block; }

/* Quote rows */
.quote-row { display: flex; align-items: center; gap: 8px; padding: 8px; border: 1px solid var(--border); border-radius: var(--radius); margin-bottom: 6px; }
.quote-row.selected { border-color: var(--green); background: #f0fdf4; }
.quote-vendor { font-weight: 500; flex: 1; }
.quote-amount { font-weight: 600; color: var(--accent); }

/* Payment rows */
.payment-row { display: flex; gap: 8px; align-items: center; padding: 6px 0; border-bottom: 1px solid var(--border); }
.payment-amount { font-weight: 600; }
.payment-type-badge { font-size: 11px; padding: 1px 6px; border-radius: 10px; background: #e0f2fe; color: #0369a1; }

/* Forms */
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.form-group { display: flex; flex-direction: column; gap: 4px; }
.form-group.full { grid-column: 1 / -1; }
label { font-size: 12px; font-weight: 500; color: var(--text-muted); }
input, select, textarea { border: 1px solid var(--border); border-radius: var(--radius); padding: 7px 10px; font-size: 14px; font-family: inherit; background: var(--surface); color: var(--text); width: 100%; }
input:focus, select:focus, textarea:focus { outline: none; border-color: var(--accent); }
textarea { resize: vertical; min-height: 60px; }
.form-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 16px; }

/* Modal */
#modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.4); z-index: 200; display: flex; align-items: center; justify-content: center; }
#modal-overlay.hidden { display: none; }
.modal { background: var(--surface); border-radius: var(--radius); box-shadow: 0 8px 32px rgba(0,0,0,.2); padding: 24px; width: 480px; max-width: 95vw; max-height: 90vh; overflow-y: auto; }
.modal-title { font-size: 16px; font-weight: 700; margin-bottom: 16px; }

/* Toast */
#toast-container { position: fixed; bottom: 24px; right: 24px; z-index: 300; display: flex; flex-direction: column; gap: 8px; }
.toast { background: var(--text); color: white; padding: 10px 16px; border-radius: var(--radius); font-size: 13px; animation: slide-up .2s ease; }
.toast.error { background: var(--red); }
@keyframes slide-up { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }

/* Utilities */
.hidden { display: none !important; }
.flex { display: flex; }
.gap-8 { gap: 8px; }
.ml-auto { margin-left: auto; }
.text-muted { color: var(--text-muted); }
.text-sm { font-size: 12px; }
.progress-bar { height: 4px; background: var(--border); border-radius: 2px; overflow: hidden; }
.progress-fill { height: 100%; background: var(--green); border-radius: 2px; transition: width .3s; }
```

- [ ] **Step 2: Commit**

```bash
git add src/styles/app.css
git commit -m "feat: add base CSS styles"
```

---

### Task 10: Toast + modal utilities

**Files:**
- Create: `src/lib/ui.js`

- [ ] **Step 1: Write the module**

```js
// src/lib/ui.js

export function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container')
  const toast = document.createElement('div')
  toast.className = `toast${type === 'error' ? ' error' : ''}`
  toast.textContent = message
  container.appendChild(toast)
  setTimeout(() => toast.remove(), 3500)
}

let _currentModal = null
export function openModal(renderFn) {
  const overlay = document.getElementById('modal-overlay')
  overlay.classList.remove('hidden')
  const box = document.createElement('div')
  box.className = 'modal'
  overlay.appendChild(box)
  _currentModal = box
  renderFn(box)
  overlay.onclick = e => { if (e.target === overlay) closeModal() }
}

export function closeModal() {
  const overlay = document.getElementById('modal-overlay')
  overlay.classList.add('hidden')
  overlay.innerHTML = ''
  _currentModal = null
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/ui.js
git commit -m "feat: add toast and modal utilities"
```

---

### Task 11: views/header.js

**Files:**
- Create: `src/views/header.js`

- [ ] **Step 1: Write the view**

```js
// src/views/header.js
import { formatCurrency, formatPercent } from '../lib/format.js'
import { totalSpent } from '../state/derived.js'
import { updateMeta } from '../state/mutations.js'
import { exportJSON, importJSON } from '../state/store.js'
import { showToast } from '../lib/ui.js'

export function render(rootEl, state, { burndownMode, onToggleBurndown }) {
  const spent = totalSpent(state)
  const budget = state.meta.totalBudget ?? state.tasks.reduce((s, t) => s + (t.budget || 0), 0)
  const pct = budget ? Math.round((spent / budget) * 100) : 0

  rootEl.innerHTML = `
    <span class="header-title" id="project-name-el">${state.meta.projectName}</span>
    <div class="header-stats">
      <div class="stat">
        <div class="stat-label">Total Budget</div>
        <div class="stat-value">${formatCurrency(budget)}</div>
      </div>
      <div class="stat">
        <div class="stat-label">Spent</div>
        <div class="stat-value">${formatCurrency(spent)}</div>
      </div>
      <div class="stat">
        <div class="stat-label">Progress</div>
        <div class="stat-value">${formatPercent(pct)}</div>
      </div>
    </div>
    <div class="header-actions">
      <div class="toggle-group">
        <button class="${burndownMode === '$' ? 'active' : ''}" data-mode="$">$</button>
        <button class="${burndownMode === '%' ? 'active' : ''}" data-mode="%">%</button>
      </div>
      <button id="btn-export">Export</button>
      <button id="btn-import">Import</button>
      <input type="file" id="import-input" accept=".json" class="hidden" />
    </div>
  `

  const nameEl = rootEl.querySelector('#project-name-el')
  nameEl.addEventListener('click', () => {
    nameEl.contentEditable = 'true'
    nameEl.focus()
  })
  nameEl.addEventListener('blur', () => {
    nameEl.contentEditable = 'false'
    const name = nameEl.textContent.trim()
    if (name && name !== state.meta.projectName) updateMeta({ projectName: name })
  })
  nameEl.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); nameEl.blur() }
  })

  rootEl.querySelector('.toggle-group').addEventListener('click', e => {
    const btn = e.target.closest('[data-mode]')
    if (btn) onToggleBurndown(btn.dataset.mode)
  })

  rootEl.querySelector('#btn-export').addEventListener('click', exportJSON)

  const importInput = rootEl.querySelector('#import-input')
  rootEl.querySelector('#btn-import').addEventListener('click', () => importInput.click())
  importInput.addEventListener('change', async e => {
    const file = e.target.files[0]
    if (!file) return
    if (!confirm('This will replace all current data. Continue?')) { importInput.value = ''; return }
    try {
      await importJSON(file)
      showToast('Data imported successfully')
    } catch {
      showToast('Import failed — invalid JSON file', 'error')
    }
    importInput.value = ''
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add src/views/header.js
git commit -m "feat: add header view"
```

---

### Task 12: views/burndown.js

**Files:**
- Create: `src/views/burndown.js`

- [ ] **Step 1: Write the D3 burndown chart**

```js
// src/views/burndown.js
import * as d3 from 'd3'
import { burndownLines, phaseProgress } from '../state/derived.js'
import { formatCurrency, formatPercent } from '../lib/format.js'

export function render(rootEl, state, { mode }) {
  const { ideal, actual } = burndownLines(state)
  const { startDate, targetEndDate, totalBudget } = state.meta

  if (!startDate || !targetEndDate) {
    rootEl.innerHTML = '<div class="section-title">Burndown</div><p class="text-muted" style="padding:24px 0;text-align:center">Set a project start and end date to see the burndown chart.</p>'
    return
  }

  rootEl.innerHTML = '<div class="section-title">Burndown</div><div class="chart-container" id="burndown-svg-wrap"></div>'

  const wrap = rootEl.querySelector('#burndown-svg-wrap')
  const W = wrap.clientWidth || 800
  const H = 260
  const margin = { top: 16, right: 24, bottom: 32, left: 72 }
  const w = W - margin.left - margin.right
  const h = H - margin.top - margin.bottom

  const svg = d3.select(wrap).append('svg').attr('width', W).attr('height', H)
  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)

  const x = d3.scaleTime().domain([new Date(startDate), new Date(targetEndDate)]).range([0, w])
  const budget = totalBudget ?? state.tasks.reduce((s, t) => s + (t.budget || 0), 0)

  let yDomain, yFmt, yLine
  if (mode === '$') {
    yDomain = [0, budget * 1.05]
    yFmt = v => formatCurrency(v)
    yLine = d => ({ date: d.date, y: d.value })
  } else {
    const spent = actual.length > 1 ? actual[actual.length - 1].value : budget
    yDomain = [0, 105]
    yFmt = v => `${v}%`
    yLine = d => ({ date: d.date, y: budget ? (d.value / budget) * 100 : 0 })
  }

  const y = d3.scaleLinear().domain(yDomain).range([h, 0]).nice()

  g.append('g').attr('transform', `translate(0,${h})`).call(d3.axisBottom(x).ticks(6).tickFormat(d3.timeFormat('%b %y')))
  g.append('g').call(d3.axisLeft(y).ticks(5).tickFormat(yFmt))

  const lineGen = d3.line().x(d => x(new Date(d.date))).y(d => y(d.y)).curve(d3.curveLinear)

  // Ideal line
  g.append('path')
    .datum(ideal.map(yLine))
    .attr('fill', 'none')
    .attr('stroke', '#94a3b8')
    .attr('stroke-width', 1.5)
    .attr('stroke-dasharray', '6,4')
    .attr('d', lineGen)

  // Actual line
  if (actual.length > 1) {
    g.append('path')
      .datum(actual.map(yLine))
      .attr('fill', 'none')
      .attr('stroke', '#d97706')
      .attr('stroke-width', 2.5)
      .attr('d', lineGen)

    g.selectAll('.actual-dot')
      .data(actual.slice(1).map(yLine))
      .join('circle')
      .attr('class', 'actual-dot')
      .attr('cx', d => x(new Date(d.date)))
      .attr('cy', d => y(d.y))
      .attr('r', 4)
      .attr('fill', '#d97706')
  }

  // Phase milestone ticks
  state.phases.forEach(phase => {
    const phaseTasks = state.tasks.filter(t => t.phaseId === phase.id && t.endDate)
    if (!phaseTasks.length) return
    const lastEnd = phaseTasks.map(t => t.endDate).sort().at(-1)
    const xPos = x(new Date(lastEnd))
    g.append('line').attr('x1', xPos).attr('x2', xPos).attr('y1', 0).attr('y2', h)
      .attr('stroke', phase.color).attr('stroke-width', 1).attr('stroke-dasharray', '3,3').attr('opacity', .5)
    g.append('text').attr('x', xPos + 3).attr('y', 12).attr('font-size', 9).attr('fill', phase.color).text(phase.name)
  })

  // Hover tooltip
  const tooltip = d3.select(wrap).append('div')
    .style('position', 'absolute').style('background', '#1e293b').style('color', '#fff')
    .style('padding', '6px 10px').style('border-radius', '4px').style('font-size', '12px')
    .style('pointer-events', 'none').style('opacity', 0)

  svg.on('mousemove', function(event) {
    const [mx] = d3.pointer(event, g.node())
    const date = x.invert(mx)
    const dateStr = date.toISOString().slice(0, 10)
    // find closest actual point
    const closest = actual.reduce((prev, cur) =>
      Math.abs(new Date(cur.date) - date) < Math.abs(new Date(prev.date) - date) ? cur : prev
    )
    const idealVal = mode === '$'
      ? budget - (budget * d3.timeDay.count(new Date(startDate), date) / d3.timeDay.count(new Date(startDate), new Date(targetEndDate)))
      : 100 - (100 * d3.timeDay.count(new Date(startDate), date) / d3.timeDay.count(new Date(startDate), new Date(targetEndDate)))
    const actualVal = mode === '$' ? closest.value : (budget ? (closest.value / budget) * 100 : 0)
    const variance = actualVal - idealVal
    tooltip.style('opacity', 1)
      .html(`<b>${dateStr}</b><br>Actual: ${mode === '$' ? formatCurrency(actualVal) : formatPercent(actualVal)}<br>Ideal: ${mode === '$' ? formatCurrency(idealVal) : formatPercent(idealVal)}<br>Variance: ${variance >= 0 ? '+' : ''}${mode === '$' ? formatCurrency(variance) : formatPercent(variance)}`)
      .style('left', (event.offsetX + 12) + 'px').style('top', (event.offsetY - 40) + 'px')
  })
  svg.on('mouseleave', () => tooltip.style('opacity', 0))
}
```

- [ ] **Step 2: Commit**

```bash
git add src/views/burndown.js
git commit -m "feat: add D3 burndown chart"
```

---

### Task 13: views/gantt.js

**Files:**
- Create: `src/views/gantt.js`

- [ ] **Step 1: Write the D3 Gantt chart**

```js
// src/views/gantt.js
import * as d3 from 'd3'
import { criticalPath } from '../state/derived.js'
import { updateTask, addTask } from '../state/mutations.js'
import { formatDate } from '../lib/dates.js'

const ROW_H = 28
const LABEL_W = 180
const PHASE_H = 24

export function render(rootEl, state, { onTaskClick }) {
  const { phases, tasks, meta } = state
  if (!meta.startDate || !meta.targetEndDate) {
    rootEl.innerHTML = '<div class="section-title">Gantt</div><p class="text-muted" style="padding:24px 0;text-align:center">Set a project start and end date to see the Gantt chart.</p>'
    return
  }

  rootEl.innerHTML = '<div class="section-title">Gantt <span class="text-sm text-muted">(drag bars to reschedule · drag right edge to resize · drag circle at right to add dependency)</span></div><div class="chart-container" id="gantt-wrap"></div>'

  const wrap = rootEl.querySelector('#gantt-wrap')
  const W = Math.max(wrap.clientWidth || 800, 800)
  const chartW = W - LABEL_W

  const domainStart = new Date(meta.startDate)
  const domainEnd = new Date(meta.targetEndDate)

  const xScale = d3.scaleTime().domain([domainStart, domainEnd]).range([0, chartW])

  // Build rows
  const sortedPhases = [...phases].sort((a, b) => a.order - b.order)
  const rows = []
  sortedPhases.forEach(phase => {
    const phaseTasks = tasks.filter(t => t.phaseId === phase.id).sort((a, b) => {
      if (!a.startDate) return 1
      if (!b.startDate) return -1
      return a.startDate.localeCompare(b.startDate)
    })
    rows.push({ type: 'phase', phase, tasks: phaseTasks })
    phaseTasks.forEach(task => rows.push({ type: 'task', task, phase }))
  })

  const totalH = rows.reduce((h, r) => h + (r.type === 'phase' ? PHASE_H : ROW_H), 0) + 40
  const svgH = totalH + 24

  const svg = d3.select(wrap).append('svg')
    .attr('width', W).attr('height', svgH)
    .attr('style', 'display:block')

  // Arrow marker
  svg.append('defs').append('marker')
    .attr('id', 'arrow').attr('viewBox', '0 -5 10 10').attr('refX', 8).attr('refY', 0)
    .attr('markerWidth', 6).attr('markerHeight', 6).attr('orient', 'auto')
    .append('path').attr('d', 'M0,-5L10,0L0,5').attr('fill', '#94a3b8')

  // Clip path for chart area
  svg.append('defs').append('clipPath').attr('id', 'chart-clip')
    .append('rect').attr('width', chartW).attr('height', svgH)

  // Left label area
  const labelG = svg.append('g')
  // Right chart area
  const chartG = svg.append('g').attr('transform', `translate(${LABEL_W},0)`)
    .attr('clip-path', 'url(#chart-clip)')

  // Time axis
  const axisG = chartG.append('g').attr('transform', 'translate(0,20)')
  axisG.call(d3.axisTop(xScale).ticks(d3.timeWeek.every(2)).tickFormat(d3.timeFormat('%b %d')))

  // Grid lines
  xScale.ticks(d3.timeWeek.every(2)).forEach(tick => {
    chartG.append('line')
      .attr('x1', xScale(tick)).attr('x2', xScale(tick))
      .attr('y1', 24).attr('y2', svgH)
      .attr('stroke', '#f1f5f9').attr('stroke-width', 1)
  })

  const cp = criticalPath(state)

  let y = 24
  const taskYMap = new Map()

  rows.forEach(row => {
    if (row.type === 'phase') {
      // Phase header row
      labelG.append('rect').attr('x', 0).attr('y', y).attr('width', LABEL_W).attr('height', PHASE_H)
        .attr('fill', row.phase.color).attr('opacity', .12)
      labelG.append('text').attr('x', 8).attr('y', y + PHASE_H / 2 + 5)
        .attr('class', 'gantt-phase-label').attr('font-size', 12).text(row.phase.name)
        .attr('fill', row.phase.color)
      chartG.append('rect').attr('x', 0).attr('y', y).attr('width', chartW).attr('height', PHASE_H)
        .attr('fill', row.phase.color).attr('opacity', .04)
      y += PHASE_H
    } else {
      const { task, phase } = row
      taskYMap.set(task.id, y)

      // Label
      const lrow = labelG.append('g').attr('transform', `translate(0,${y})`).style('cursor', 'pointer')
      lrow.append('rect').attr('width', LABEL_W).attr('height', ROW_H).attr('fill', 'transparent')
      lrow.append('text').attr('x', 16).attr('y', ROW_H / 2 + 4).attr('font-size', 12)
        .attr('class', 'gantt-task-label').text(task.name.length > 22 ? task.name.slice(0, 22) + '…' : task.name)
      lrow.on('click', () => onTaskClick(task.id))

      if (task.startDate && task.endDate) {
        const bx = xScale(new Date(task.startDate))
        const bw = Math.max(4, xScale(new Date(task.endDate)) - xScale(new Date(task.startDate)))
        const by = y + 4
        const bh = ROW_H - 8

        const barG = chartG.append('g').datum({ task })

        // Background bar
        barG.append('rect').attr('class', 'gantt-bar-bg')
          .attr('x', bx).attr('y', by).attr('width', bw).attr('height', bh)
          .attr('fill', phase.color).attr('rx', 3)

        // Progress fill
        barG.append('rect').attr('class', 'gantt-bar')
          .attr('x', bx).attr('y', by)
          .attr('width', bw * ((task.progress || 0) / 100))
          .attr('height', bh)
          .attr('fill', phase.color).attr('rx', 3)

        // Critical path ring
        if (cp.has(task.id)) {
          barG.append('rect').attr('class', 'gantt-critical')
            .attr('x', bx).attr('y', by).attr('width', bw).attr('height', bh)
            .attr('fill', 'none').attr('rx', 3)
        }

        // Drag: move whole bar
        const moveDrag = d3.drag()
          .on('start', function(event) {
            this._x0 = event.x
            this._start0 = task.startDate
            this._end0 = task.endDate
          })
          .on('drag', function(event) {
            const dx = event.x - this._x0
            const totalDays = d3.timeDay.count(domainStart, domainEnd)
            const daysDx = Math.round(dx / (chartW / totalDays))
            const newStartD = d3.timeDay.offset(new Date(this._start0), daysDx)
            barG.select('.gantt-bar-bg').attr('x', xScale(newStartD))
            barG.select('.gantt-bar').attr('x', xScale(newStartD))
            if (cp.has(task.id)) barG.select('.gantt-critical').attr('x', xScale(newStartD))
          })
          .on('end', function(event) {
            const dx = event.x - this._x0
            const totalDays = d3.timeDay.count(domainStart, domainEnd)
            const daysDx = Math.round(dx / (chartW / totalDays))
            if (daysDx !== 0) {
              const newStart = formatDate(d3.timeDay.offset(new Date(this._start0), daysDx))
              const newEnd = formatDate(d3.timeDay.offset(new Date(this._end0), daysDx))
              updateTask(task.id, { startDate: newStart, endDate: newEnd })
            }
          })

        barG.select('.gantt-bar-bg').call(moveDrag)
        barG.select('.gantt-bar').call(moveDrag)

        // Right resize handle
        const resizeHandle = chartG.append('rect').attr('class', 'gantt-resize-handle')
          .attr('x', bx + bw - 6).attr('y', by).attr('width', 8).attr('height', bh)
          .datum({ task })

        const resizeDrag = d3.drag()
          .on('start', function(event) { this._x0 = event.x; this._end0 = task.endDate })
          .on('drag', function(event) {
            const dx = event.x - this._x0
            const totalDays = d3.timeDay.count(domainStart, domainEnd)
            const daysDx = Math.round(dx / (chartW / totalDays))
            const newEnd = d3.timeDay.offset(new Date(this._end0), daysDx)
            const newW = Math.max(4, xScale(newEnd) - bx)
            barG.select('.gantt-bar-bg').attr('width', newW)
            resizeHandle.attr('x', bx + newW - 6)
          })
          .on('end', function(event) {
            const dx = event.x - this._x0
            const totalDays = d3.timeDay.count(domainStart, domainEnd)
            const daysDx = Math.round(dx / (chartW / totalDays))
            if (daysDx !== 0) {
              const newEnd = formatDate(d3.timeDay.offset(new Date(this._end0), daysDx))
              updateTask(task.id, { endDate: newEnd })
            }
          })
        resizeHandle.call(resizeDrag)

        // Dependency handle (circle at right edge)
        let dragLine = null
        const depHandle = chartG.append('circle').attr('class', 'dep-handle')
          .attr('cx', bx + bw).attr('cy', by + bh / 2).attr('r', 5)
          .datum({ task })

        depHandle.call(d3.drag()
          .on('start', function(event) {
            dragLine = chartG.append('line').attr('class', 'dep-arrow')
              .attr('x1', bx + bw).attr('y1', by + bh / 2)
              .attr('x2', event.x).attr('y2', event.y)
              .attr('stroke-dasharray', '4,3')
          })
          .on('drag', function(event) {
            if (dragLine) dragLine.attr('x2', event.x).attr('y2', event.y)
          })
          .on('end', function(event) {
            if (dragLine) { dragLine.remove(); dragLine = null }
            // Find target task bar under cursor
            const targetEl = document.elementFromPoint(
              event.sourceEvent.clientX, event.sourceEvent.clientY
            )
            const targetDatum = targetEl && d3.select(targetEl).datum()
            if (targetDatum?.task && targetDatum.task.id !== task.id) {
              const existing = task.dependsOn || []
              if (!existing.includes(targetDatum.task.id)) {
                try {
                  updateTask(task.id, { dependsOn: [...existing, targetDatum.task.id] })
                } catch (e) {
                  import('../lib/ui.js').then(({ showToast }) => showToast(e.message, 'error'))
                }
              }
            }
          })
        )

        // Show dep handle on bar hover
        barG.on('mouseenter', () => depHandle.attr('opacity', .8))
          .on('mouseleave', () => depHandle.attr('opacity', 0))
      }

      y += ROW_H
    }
  })

  // Dependency arrows
  tasks.forEach(task => {
    if (!task.startDate) return
    const ty = taskYMap.get(task.id)
    if (ty === undefined) return
    task.dependsOn.forEach(depId => {
      const dep = tasks.find(t => t.id === depId)
      if (!dep || !dep.endDate) return
      const dy = taskYMap.get(dep.id)
      if (dy === undefined) return
      const sx = xScale(new Date(dep.endDate))
      const sy = dy + ROW_H / 2
      const tx = xScale(new Date(task.startDate))
      const tyc = ty + ROW_H / 2
      chartG.insert('path', ':first-child')
        .attr('class', 'dep-arrow')
        .attr('d', `M${sx},${sy} C${(sx + tx) / 2},${sy} ${(sx + tx) / 2},${tyc} ${tx},${tyc}`)
        .attr('marker-end', 'url(#arrow)')
        .attr('stroke', cp.has(task.id) && cp.has(depId) ? '#dc2626' : '#94a3b8')
        .attr('stroke-width', cp.has(task.id) && cp.has(depId) ? 2 : 1)
    })
  })
}

export function highlightTask(taskId) {
  document.querySelectorAll('.gantt-task-highlight').forEach(el => el.classList.remove('gantt-task-highlight'))
}
```

- [ ] **Step 2: Commit**

```bash
git add src/views/gantt.js
git commit -m "feat: add interactive D3 Gantt with drag and dependencies"
```

---

### Task 14: Editors

**Files:**
- Create: `src/editors/task-editor.js`
- Create: `src/editors/quote-editor.js`
- Create: `src/editors/payment-editor.js`

- [ ] **Step 1: Write task-editor.js**

```js
// src/editors/task-editor.js
import { openModal, closeModal } from '../lib/ui.js'
import { addTask, updateTask } from '../state/mutations.js'
import { getState } from '../state/store.js'

export function open(taskId = null) {
  const state = getState()
  const task = taskId ? state.tasks.find(t => t.id === taskId) : null
  const isNew = !task

  openModal(box => {
    box.innerHTML = `
      <div class="modal-title">${isNew ? 'Add Task' : 'Edit Task'}</div>
      <div class="form-grid">
        <div class="form-group full">
          <label>Task Name</label>
          <input id="f-name" value="${task?.name ?? ''}" placeholder="e.g. Slab pour" />
        </div>
        <div class="form-group">
          <label>Phase</label>
          <select id="f-phase">
            ${state.phases.sort((a, b) => a.order - b.order).map(p =>
              `<option value="${p.id}" ${task?.phaseId === p.id ? 'selected' : ''}>${p.name}</option>`
            ).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Budget ($)</label>
          <input id="f-budget" type="number" value="${task?.budget ?? 0}" />
        </div>
        <div class="form-group">
          <label>Start Date</label>
          <input id="f-start" type="date" value="${task?.startDate ?? ''}" />
        </div>
        <div class="form-group">
          <label>End Date</label>
          <input id="f-end" type="date" value="${task?.endDate ?? ''}" />
        </div>
        <div class="form-group">
          <label>Status</label>
          <select id="f-status">
            ${['not_started','in_progress','done','blocked'].map(s =>
              `<option value="${s}" ${task?.status === s ? 'selected' : ''}>${s.replace('_',' ')}</option>`
            ).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Progress (%)</label>
          <input id="f-progress" type="number" min="0" max="100" value="${task?.progress ?? 0}" />
        </div>
        <div class="form-group full">
          <label>Notes</label>
          <textarea id="f-notes">${task?.notes ?? ''}</textarea>
        </div>
      </div>
      <div class="form-actions">
        <button id="btn-cancel">Cancel</button>
        <button class="primary" id="btn-save">Save</button>
      </div>
    `

    box.querySelector('#btn-cancel').addEventListener('click', closeModal)
    box.querySelector('#btn-save').addEventListener('click', () => {
      const fields = {
        phaseId: box.querySelector('#f-phase').value,
        name: box.querySelector('#f-name').value.trim(),
        budget: Number(box.querySelector('#f-budget').value) || 0,
        startDate: box.querySelector('#f-start').value || null,
        endDate: box.querySelector('#f-end').value || null,
        status: box.querySelector('#f-status').value,
        progress: Number(box.querySelector('#f-progress').value) || 0,
        notes: box.querySelector('#f-notes').value,
        dependsOn: task?.dependsOn ?? [],
        selectedQuoteId: task?.selectedQuoteId ?? null
      }
      if (!fields.name) { box.querySelector('#f-name').focus(); return }
      if (isNew) addTask(fields)
      else updateTask(taskId, fields)
      closeModal()
    })
  })
}
```

- [ ] **Step 2: Write quote-editor.js**

```js
// src/editors/quote-editor.js
import { openModal, closeModal } from '../lib/ui.js'
import { addQuote, updateQuote } from '../state/mutations.js'
import { getState } from '../state/store.js'

export function open(taskId, quoteId = null) {
  const state = getState()
  const quote = quoteId ? state.quotes.find(q => q.id === quoteId) : null

  openModal(box => {
    box.innerHTML = `
      <div class="modal-title">${quote ? 'Edit Quote' : 'Add Quote'}</div>
      <div class="form-grid">
        <div class="form-group full">
          <label>Vendor</label>
          <input id="f-vendor" value="${quote?.vendor ?? ''}" placeholder="Company name" />
        </div>
        <div class="form-group">
          <label>Amount ($)</label>
          <input id="f-amount" type="number" value="${quote?.amount ?? ''}" />
        </div>
        <div class="form-group">
          <label>Date Received</label>
          <input id="f-date" type="date" value="${quote?.receivedDate ?? ''}" />
        </div>
        <div class="form-group full">
          <label>Notes</label>
          <textarea id="f-notes">${quote?.notes ?? ''}</textarea>
        </div>
        <div class="form-group full">
          <label>Attachment URL (optional)</label>
          <input id="f-url" value="${quote?.attachmentUrl ?? ''}" placeholder="https://..." />
        </div>
      </div>
      <div class="form-actions">
        <button id="btn-cancel">Cancel</button>
        <button class="primary" id="btn-save">Save</button>
      </div>
    `
    box.querySelector('#btn-cancel').addEventListener('click', closeModal)
    box.querySelector('#btn-save').addEventListener('click', () => {
      const fields = {
        taskId,
        vendor: box.querySelector('#f-vendor').value.trim(),
        amount: Number(box.querySelector('#f-amount').value) || 0,
        receivedDate: box.querySelector('#f-date').value || null,
        notes: box.querySelector('#f-notes').value,
        attachmentUrl: box.querySelector('#f-url').value.trim()
      }
      if (!fields.vendor) { box.querySelector('#f-vendor').focus(); return }
      if (quote) updateQuote(quoteId, fields)
      else addQuote(fields)
      closeModal()
    })
  })
}
```

- [ ] **Step 3: Write payment-editor.js**

```js
// src/editors/payment-editor.js
import { openModal, closeModal } from '../lib/ui.js'
import { addPayment, updatePayment } from '../state/mutations.js'
import { getState } from '../state/store.js'

export function open(taskId, paymentId = null) {
  const state = getState()
  const payment = paymentId ? state.payments.find(p => p.id === paymentId) : null

  openModal(box => {
    box.innerHTML = `
      <div class="modal-title">${payment ? 'Edit Payment' : 'Log Payment'}</div>
      <div class="form-grid">
        <div class="form-group">
          <label>Amount ($)</label>
          <input id="f-amount" type="number" value="${payment?.amount ?? ''}" />
        </div>
        <div class="form-group">
          <label>Date</label>
          <input id="f-date" type="date" value="${payment?.date ?? new Date().toISOString().slice(0,10)}" />
        </div>
        <div class="form-group">
          <label>Type</label>
          <select id="f-type">
            ${['deposit','progress','final'].map(t =>
              `<option value="${t}" ${payment?.type === t ? 'selected' : ''}>${t}</option>`
            ).join('')}
          </select>
        </div>
        <div class="form-group full">
          <label>Notes</label>
          <textarea id="f-notes">${payment?.notes ?? ''}</textarea>
        </div>
      </div>
      <div class="form-actions">
        <button id="btn-cancel">Cancel</button>
        <button class="primary" id="btn-save">Save</button>
      </div>
    `
    box.querySelector('#btn-cancel').addEventListener('click', closeModal)
    box.querySelector('#btn-save').addEventListener('click', () => {
      const fields = {
        taskId,
        amount: Number(box.querySelector('#f-amount').value) || 0,
        date: box.querySelector('#f-date').value || null,
        type: box.querySelector('#f-type').value,
        notes: box.querySelector('#f-notes').value
      }
      if (!fields.amount) { box.querySelector('#f-amount').focus(); return }
      if (payment) updatePayment(paymentId, fields)
      else addPayment(fields)
      closeModal()
    })
  })
}
```

- [ ] **Step 4: Commit**

```bash
git add src/editors/
git commit -m "feat: add task, quote, and payment editor modals"
```

---

### Task 15: views/items.js

**Files:**
- Create: `src/views/items.js`

- [ ] **Step 1: Write the view**

```js
// src/views/items.js
import { formatCurrency, formatPercent } from '../lib/format.js'
import { phaseBudget, phaseProgress, quotesForTask, paymentsForTask, totalSpent } from '../state/derived.js'
import { deleteTask, deleteQuote, deletePayment, selectQuote } from '../state/mutations.js'
import { open as openTask } from '../editors/task-editor.js'
import { open as openQuote } from '../editors/quote-editor.js'
import { open as openPayment } from '../editors/payment-editor.js'

let _openPhases = new Set()
let _openTaskId = null
let _openDrawerTab = {}

export function render(rootEl, state, { highlightedTaskId } = {}) {
  const { phases, tasks } = state
  const sortedPhases = [...phases].sort((a, b) => a.order - b.order)

  const html = `
    <div class="section-title">
      Items
      <button class="small primary" id="btn-add-task">+ Add Task</button>
    </div>
    ${sortedPhases.map(phase => {
      const pTasks = tasks.filter(t => t.phaseId === phase.id)
      const budget = phaseBudget(state, phase.id)
      const progress = phaseProgress(state, phase.id)
      const isOpen = _openPhases.has(phase.id)
      return `
        <div class="phase-row" data-phase-id="${phase.id}">
          <div class="phase-header" data-toggle="${phase.id}">
            <span class="phase-dot" style="background:${phase.color}"></span>
            <span>${phase.name}</span>
            <span class="phase-meta">
              <span>${formatCurrency(budget)}</span>
              <span>${formatPercent(progress)}</span>
              <span>${pTasks.length} tasks</span>
            </span>
            <span>${isOpen ? '▲' : '▼'}</span>
          </div>
          <div class="phase-tasks ${isOpen ? 'open' : ''}">
            ${pTasks.map(task => renderTaskRow(task, state, highlightedTaskId)).join('')}
          </div>
        </div>
      `
    }).join('')}
  `

  rootEl.innerHTML = html

  rootEl.querySelector('#btn-add-task').addEventListener('click', () => openTask())

  rootEl.querySelectorAll('[data-toggle]').forEach(el => {
    el.addEventListener('click', () => {
      const phaseId = el.dataset.toggle
      if (_openPhases.has(phaseId)) _openPhases.delete(phaseId)
      else _openPhases.add(phaseId)
      const tasksEl = el.nextElementSibling
      tasksEl.classList.toggle('open', _openPhases.has(phaseId))
      el.querySelector('span:last-child').textContent = _openPhases.has(phaseId) ? '▲' : '▼'
    })
  })

  rootEl.querySelectorAll('[data-task-id]').forEach(el => {
    el.addEventListener('click', e => {
      if (e.target.closest('button')) return
      const taskId = el.dataset.taskId
      _openTaskId = _openTaskId === taskId ? null : taskId
      const drawer = el.nextElementSibling
      if (drawer?.classList.contains('task-drawer')) {
        if (_openTaskId === taskId) {
          renderDrawer(drawer, taskId, state)
        } else {
          drawer.innerHTML = ''
        }
      }
    })
  })
}

function renderTaskRow(task, state, highlightedTaskId) {
  const isHighlighted = task.id === highlightedTaskId
  const hasNoDates = !task.startDate || !task.endDate
  const quotes = quotesForTask(state, task.id)
  const payments = paymentsForTask(state, task.id)
  const spent = payments.reduce((s, p) => s + p.amount, 0)

  return `
    <div class="task-row ${isHighlighted ? 'highlighted' : ''} ${_openTaskId === task.id ? 'active' : ''}" data-task-id="${task.id}">
      <span class="task-name">${task.name}</span>
      ${hasNoDates ? '<span class="no-dates-badge">no dates</span>' : ''}
      <span class="task-status-badge status-${task.status}">${task.status.replace('_',' ')}</span>
      <span class="text-muted text-sm">${formatCurrency(task.budget)}</span>
      ${spent > 0 ? `<span class="text-sm" style="color:var(--green)">${formatCurrency(spent)} paid</span>` : ''}
      ${quotes.length ? `<span class="text-sm text-muted">${quotes.length} quote${quotes.length > 1 ? 's' : ''}</span>` : ''}
      <button class="icon" title="Edit" onclick="event.stopPropagation();window.__openTask('${task.id}')">✏️</button>
    </div>
    <div class="task-drawer" id="drawer-${task.id}" style="display:${_openTaskId === task.id ? 'block' : 'none'}"></div>
  `
}

function renderDrawer(el, taskId, state) {
  el.style.display = 'block'
  const tab = _openDrawerTab[taskId] || 'quotes'
  const task = state.tasks.find(t => t.id === taskId)
  const quotes = quotesForTask(state, taskId)
  const payments = paymentsForTask(state, taskId)

  el.innerHTML = `
    <div class="drawer-tabs">
      <button class="drawer-tab ${tab === 'quotes' ? 'active' : ''}" data-tab="quotes">Quotes (${quotes.length})</button>
      <button class="drawer-tab ${tab === 'payments' ? 'active' : ''}" data-tab="payments">Payments (${payments.length})</button>
    </div>
    <div class="drawer-panel ${tab === 'quotes' ? 'active' : ''}" id="panel-quotes">
      ${quotes.map(q => `
        <div class="quote-row ${task.selectedQuoteId === q.id ? 'selected' : ''}">
          <input type="radio" name="quote-${taskId}" value="${q.id}" ${task.selectedQuoteId === q.id ? 'checked' : ''} data-quote-select="${q.id}" />
          <span class="quote-vendor">${q.vendor}</span>
          <span class="quote-amount">${formatCurrency(q.amount)}</span>
          ${q.notes ? `<span class="text-muted text-sm">${q.notes}</span>` : ''}
          ${q.attachmentUrl ? `<a href="${q.attachmentUrl}" target="_blank" class="text-sm">📎</a>` : ''}
          <button class="small" onclick="window.__openQuote('${taskId}','${q.id}')">Edit</button>
          <button class="small danger" data-delete-quote="${q.id}">×</button>
        </div>
      `).join('')}
      <button class="small" style="margin-top:8px" onclick="window.__openQuote('${taskId}')">+ Add Quote</button>
    </div>
    <div class="drawer-panel ${tab === 'payments' ? 'active' : ''}" id="panel-payments">
      ${payments.map(p => `
        <div class="payment-row">
          <span class="payment-amount">${formatCurrency(p.amount)}</span>
          <span class="payment-type-badge">${p.type}</span>
          <span class="text-muted text-sm">${p.date ?? ''}</span>
          ${p.notes ? `<span class="text-muted text-sm">${p.notes}</span>` : ''}
          <button class="small" onclick="window.__openPayment('${taskId}','${p.id}')">Edit</button>
          <button class="small danger" data-delete-payment="${p.id}">×</button>
        </div>
      `).join('')}
      <button class="small" style="margin-top:8px" onclick="window.__openPayment('${taskId}')">+ Log Payment</button>
    </div>
  `

  el.querySelectorAll('.drawer-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      _openDrawerTab[taskId] = tab.dataset.tab
      el.querySelectorAll('.drawer-tab').forEach(t => t.classList.toggle('active', t === tab))
      el.querySelectorAll('.drawer-panel').forEach(p => p.classList.toggle('active', p.id === `panel-${tab.dataset.tab}`))
    })
  })

  el.querySelectorAll('[data-quote-select]').forEach(radio => {
    radio.addEventListener('change', () => selectQuote(taskId, radio.dataset.quoteSelect))
  })

  el.querySelectorAll('[data-delete-quote]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (confirm('Delete this quote?')) deleteQuote(btn.dataset.deleteQuote)
    })
  })

  el.querySelectorAll('[data-delete-payment]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (confirm('Delete this payment?')) deletePayment(btn.dataset.deletePayment)
    })
  })
}

// Global hooks for inline onclick handlers
if (typeof window !== 'undefined') {
  window.__openTask = id => openTask(id)
  window.__openQuote = (taskId, quoteId) => openQuote(taskId, quoteId)
  window.__openPayment = (taskId, paymentId) => openPayment(taskId, paymentId)
}
```

- [ ] **Step 2: Commit**

```bash
git add src/views/items.js
git commit -m "feat: add items panel with phase accordion and task drawers"
```

---

### Task 16: src/main.js — wire everything

**Files:**
- Create: `src/main.js`

- [ ] **Step 1: Write main.js**

```js
// src/main.js
import { load, setOnChange } from './state/store.js'
import * as header from './views/header.js'
import * as burndown from './views/burndown.js'
import * as gantt from './views/gantt.js'
import * as items from './views/items.js'
import { showToast } from './lib/ui.js'

let burndownMode = '$'
let highlightedTaskId = null

async function init() {
  // Load starter template for first-time users
  let template = null
  try {
    const res = await fetch('/starter-template.json')
    template = await res.json()
  } catch (_) { /* no template, use empty state */ }

  load(template)
  setOnChange(render)

  window.addEventListener('storage-quota-exceeded', () => {
    showToast('Save failed — export your data as a backup now', 'error')
  })

  render()
}

function render() {
  const { getState } = window.__store || {}
  // Import state inline to avoid circular dep at module load time
  import('./state/store.js').then(({ getState }) => {
    const state = getState()
    if (!state) return

    header.render(document.getElementById('header'), state, {
      burndownMode,
      onToggleBurndown: mode => { burndownMode = mode; render() }
    })

    burndown.render(document.getElementById('burndown'), state, { mode: burndownMode })

    gantt.render(document.getElementById('gantt'), state, {
      onTaskClick: taskId => {
        highlightedTaskId = taskId
        // Scroll items panel to task row and open drawer
        const taskRow = document.querySelector(`[data-task-id="${taskId}"]`)
        if (taskRow) {
          taskRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
          taskRow.classList.add('highlighted')
          taskRow.click()
        }
      }
    })

    items.render(document.getElementById('items'), state, { highlightedTaskId })
  })
}

init()
```

- [ ] **Step 2: Fix the render function — dynamic import pattern is awkward. Simplify:**

Replace `src/main.js` with:

```js
// src/main.js
import { load, setOnChange, getState } from './state/store.js'
import * as header from './views/header.js'
import * as burndown from './views/burndown.js'
import * as gantt from './views/gantt.js'
import * as items from './views/items.js'
import { showToast } from './lib/ui.js'

let burndownMode = '$'
let highlightedTaskId = null

async function init() {
  let template = null
  try {
    const res = await fetch('/starter-template.json')
    template = await res.json()
  } catch (_) {}

  load(template)
  setOnChange(render)
  window.addEventListener('storage-quota-exceeded', () =>
    showToast('Save failed — export your data now', 'error')
  )
  render()
}

function render() {
  const state = getState()
  if (!state) return

  header.render(document.getElementById('header'), state, {
    burndownMode,
    onToggleBurndown: mode => { burndownMode = mode; render() }
  })

  burndown.render(document.getElementById('burndown'), state, { mode: burndownMode })

  gantt.render(document.getElementById('gantt'), state, {
    onTaskClick: taskId => {
      highlightedTaskId = taskId
      render()
      setTimeout(() => {
        const row = document.querySelector(`[data-task-id="${taskId}"]`)
        if (row) { row.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); row.click() }
      }, 50)
    }
  })

  items.render(document.getElementById('items'), state, { highlightedTaskId })
}

init()
```

- [ ] **Step 3: Start dev server and verify in browser**

```bash
npm run dev
```

Open http://localhost:5173. Expected:
- Header shows "My New Home" with $0 budget stats
- Burndown shows "Set a project start and end date" message
- Gantt shows the same message
- Items panel shows all 9 phases collapsed
- Expand Foundation → 4 tasks listed
- Click a task → drawer opens with Quotes and Payments tabs
- + Add Task → modal opens, fill in, save → task appears

- [ ] **Step 4: Set project dates in browser and verify charts render**

Click project name → edit it. Then open browser console and run:
```js
import('/src/state/mutations.js').then(m => m.updateMeta({ startDate: '2026-06-01', targetEndDate: '2027-05-31', totalBudget: 450000 }))
```
Expected: Burndown and Gantt sections now show charts (Gantt is empty until tasks have dates).

- [ ] **Step 5: Run full test suite**

```bash
npm test
```
Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/main.js
git commit -m "feat: wire up main entry point and render loop"
```

---

### Task 17: Set up project settings editor

**Files:**
- Create: `src/editors/settings-editor.js`

The header needs a way to set start/end dates and total budget. Currently only project name is editable inline.

- [ ] **Step 1: Write settings-editor.js**

```js
// src/editors/settings-editor.js
import { openModal, closeModal } from '../lib/ui.js'
import { updateMeta } from '../state/mutations.js'
import { getState } from '../state/store.js'

export function open() {
  const { meta } = getState()
  openModal(box => {
    box.innerHTML = `
      <div class="modal-title">Project Settings</div>
      <div class="form-grid">
        <div class="form-group full">
          <label>Project Name</label>
          <input id="f-name" value="${meta.projectName}" />
        </div>
        <div class="form-group">
          <label>Start Date</label>
          <input id="f-start" type="date" value="${meta.startDate ?? ''}" />
        </div>
        <div class="form-group">
          <label>Target End Date</label>
          <input id="f-end" type="date" value="${meta.targetEndDate ?? ''}" />
        </div>
        <div class="form-group">
          <label>Total Budget ($) — leave blank to sum tasks</label>
          <input id="f-budget" type="number" value="${meta.totalBudget ?? ''}" placeholder="e.g. 450000" />
        </div>
        <div class="form-group">
          <label>Currency</label>
          <input id="f-currency" value="${meta.currency ?? 'USD'}" />
        </div>
      </div>
      <div class="form-actions">
        <button id="btn-cancel">Cancel</button>
        <button class="primary" id="btn-save">Save</button>
      </div>
    `
    box.querySelector('#btn-cancel').addEventListener('click', closeModal)
    box.querySelector('#btn-save').addEventListener('click', () => {
      const budgetVal = box.querySelector('#f-budget').value
      updateMeta({
        projectName: box.querySelector('#f-name').value.trim() || meta.projectName,
        startDate: box.querySelector('#f-start').value || null,
        targetEndDate: box.querySelector('#f-end').value || null,
        totalBudget: budgetVal ? Number(budgetVal) : null,
        currency: box.querySelector('#f-currency').value.trim() || 'USD'
      })
      closeModal()
    })
  })
}
```

- [ ] **Step 2: Add settings button to header.js**

In `src/views/header.js`, add `⚙` button to header-actions and import+wire it:

```js
// Add to imports at top:
import { open as openSettings } from '../editors/settings-editor.js'

// Add to header-actions HTML (inside the template string):
// <button id="btn-settings">⚙ Settings</button>

// Add after other event listeners:
rootEl.querySelector('#btn-settings').addEventListener('click', openSettings)
```

- [ ] **Step 3: Verify in browser**

Click ⚙ Settings → modal opens → fill in dates and budget → save → burndown and Gantt charts appear.

- [ ] **Step 4: Commit**

```bash
git add src/editors/settings-editor.js src/views/header.js
git commit -m "feat: add project settings editor"
```

---

### Task 18: Git remote + GitHub push

- [ ] **Step 1: Create GitHub repo via gh CLI**

```bash
gh repo create robert-the-framer --public --description "Construction budget visualizer with burndown chart and interactive Gantt" --source=. --remote=origin
```

If `gh` is not installed or authenticated:
```bash
# Install gh: https://cli.github.com/
# Authenticate:
gh auth login
```

- [ ] **Step 2: Push**

```bash
git push -u origin main
```

- [ ] **Step 3: Verify**

```bash
gh repo view --web
```
Expected: GitHub page opens showing the repo with all commits.

- [ ] **Step 4: Final test run**

```bash
npm test
```
Expected: All tests pass.

---

## Done

The app is live at `http://localhost:5173` (dev) and pushed to GitHub. Key flows to manually verify before wrapping up:

1. First load → starter template appears with 9 phases
2. Set project dates + budget via ⚙ Settings → charts appear
3. Set dates on a task → it appears in Gantt
4. Drag a Gantt bar → dates update in Items panel
5. Drag right edge of bar → end date updates
6. Add a quote, select it → task budget syncs
7. Log a payment → burndown actual line updates
8. Export JSON → downloads a file; re-import it → data round-trips
