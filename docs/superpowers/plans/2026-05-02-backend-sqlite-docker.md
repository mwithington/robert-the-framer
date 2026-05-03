# Backend + SQLite + Docker Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an Express/SQLite backend and Docker packaging so the construction budget app can be shared with contractors on the local network behind a single shared password.

**Architecture:** One Express process serves the Vite-built `dist/` as static files and five REST API routes backed by better-sqlite3 (one table, one JSON blob row). Auth is an `express-session` cookie checked against `APP_PASSWORD`. The frontend replaces its two localStorage calls with `fetch()` calls and gains a login overlay. Dev mode keeps localStorage; production uses the API.

**Tech Stack:** Node.js 22, Express 4, better-sqlite3, express-session, Docker (node:22-alpine), Vite (build only, no change).

---

## Chunk 1: Server

### Task 1: Install backend dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install express, better-sqlite3, express-session**

```bash
cd /home/manny/projects/robert-the-framer
npm install express better-sqlite3 express-session
```

Expected: `package.json` now lists `express`, `better-sqlite3`, `express-session` under `"dependencies"`.

- [ ] **Step 2: Verify all three packages installed**

```bash
ls node_modules/express node_modules/better-sqlite3 node_modules/express-session
```

Expected: three directory listings with no errors. `better-sqlite3` requires a native C++ build — if it's missing or shows a build error, re-run `npm install` before continuing.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add express, better-sqlite3, express-session"
```

---

### Task 2: Create server/db.js

**Files:**
- Create: `server/db.js`

`db.js` owns everything SQLite: open the database, create the table, seed from the starter template on first run, and export `getProject` / `saveProject`.

- [ ] **Step 1: Create `server/` directory and `db.js`**

```bash
mkdir -p /home/manny/projects/robert-the-framer/server
```

Create `/home/manny/projects/robert-the-framer/server/db.js`:

```js
import Database from 'better-sqlite3'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DB_PATH = process.env.DB_PATH || '/data/project.db'
const TEMPLATE_PATH = join(__dirname, '..', 'public', 'starter-template.json')

let db

export function initDb() {
  db = new Database(DB_PATH)
  db.exec(`
    CREATE TABLE IF NOT EXISTS project (
      id         INTEGER PRIMARY KEY CHECK (id = 1),
      data       TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `)
  const row = db.prepare('SELECT id FROM project WHERE id = 1').get()
  if (!row) {
    let template
    try {
      template = readFileSync(TEMPLATE_PATH, 'utf8')
    } catch (err) {
      console.error('Failed to read starter template:', err.message)
      process.exit(1)
    }
    db.prepare('INSERT INTO project (id, data, updated_at) VALUES (1, ?, ?)').run(template, Date.now())
  }
}

export function getProject() {
  const row = db.prepare('SELECT data FROM project WHERE id = 1').get()
  return JSON.parse(row.data)
}

export function saveProject(data) {
  db.prepare('UPDATE project SET data = ?, updated_at = ? WHERE id = 1')
    .run(JSON.stringify(data), Date.now())
}
```

- [ ] **Step 2: Smoke-test db.js in isolation**

Use `--input-type=module` so `import.meta.url` inside `db.js` resolves correctly to the file path (not an eval context):

```bash
DB_PATH=/tmp/test-rtf.db node --input-type=module <<'EOF'
import { initDb, getProject, saveProject } from './server/db.js'
initDb()
const p = getProject()
console.log('phases:', p.phases.length)
saveProject({ ...p, meta: { ...p.meta, projectName: 'Test' } })
const p2 = getProject()
console.log('name after save:', p2.meta.projectName)
EOF
```

Expected output:
```
phases: 9
name after save: Test
```

- [ ] **Step 3: Clean up test db**

```bash
rm /tmp/test-rtf.db
```

- [ ] **Step 4: Commit**

```bash
git add server/db.js
git commit -m "feat: add server/db.js — SQLite init, getProject, saveProject"
```

---

### Task 3: Create server/auth.js

**Files:**
- Create: `server/auth.js`

`auth.js` exports three things: the `login` route handler, the `logout` route handler, and the `requireAuth` middleware. It has no knowledge of Express app setup — just pure handler functions.

- [ ] **Step 1: Create `server/auth.js`**

```js
import { createHash, timingSafeEqual } from 'crypto'

const hash = s => createHash('sha256').update(s).digest()

export function login(req, res) {
  const { password } = req.body ?? {}
  if (typeof password !== 'string') {
    return res.status(400).json({ error: 'Bad request' })
  }
  let match = false
  try {
    match = timingSafeEqual(hash(password), hash(process.env.APP_PASSWORD))
  } catch {
    // Should never happen — SHA-256 always produces 32 bytes
    return res.status(500).json({ error: 'Internal error' })
  }
  if (!match) return res.status(401).json({ error: 'Wrong password' })
  req.session.authenticated = true
  req.session.save(err => {
    if (err) return res.status(500).json({ error: 'Session error' })
    res.json({ ok: true })
  })
}

export function logout(req, res) {
  req.session.destroy(() => res.json({ ok: true }))
}

export function requireAuth(req, res, next) {
  if (req.session?.authenticated) return next()
  res.status(401).json({ error: 'Unauthorized' })
}
```

- [ ] **Step 2: Verify the file parses without errors**

`auth.js` only imports from Node built-ins (`crypto`), so this check works regardless of whether Task 1 ran first.

```bash
node --input-type=module <<'EOF'
import './server/auth.js'
console.log('auth.js OK')
EOF
```

Expected: `auth.js OK`

- [ ] **Step 3: Commit**

```bash
git add server/auth.js
git commit -m "feat: add server/auth.js — login, logout, requireAuth"
```

---

### Task 4: Create server/index.js

**Files:**
- Create: `server/index.js`

`index.js` is the Express entry point: env check, session middleware, API routes (registered before the catch-all), static file serving, and `app.listen`. API routes are registered in this order: `POST /api/login`, `POST /api/logout`, `GET /api/project`, `PUT /api/project`, then `GET *` catch-all last.

- [ ] **Step 1: Create `server/index.js`**

```js
import express from 'express'
import session from 'express-session'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { initDb, getProject, saveProject } from './db.js'
import { login, logout, requireAuth } from './auth.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Fail fast if required env vars are missing
const missing = ['APP_PASSWORD', 'SESSION_SECRET'].filter(k => !process.env[k])
if (missing.length) {
  console.error(`Missing required env vars: ${missing.join(', ')}`)
  process.exit(1)
}

initDb()

const app = express()

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    maxAge: 7 * 24 * 60 * 60 * 1000
  }
}))

// API routes — must be before static/catch-all
app.post('/api/login', express.json(), login)
app.post('/api/logout', logout)
app.get('/api/project', requireAuth, (_req, res) => res.json(getProject()))
app.put('/api/project', requireAuth, express.json({ limit: '10mb' }), (req, res) => {
  saveProject(req.body)
  res.json({ ok: true })
})

// Static files + SPA catch-all (last)
const distDir = join(__dirname, '..', 'dist')
app.use(express.static(distDir))
app.get('*', (_req, res) => res.sendFile(join(distDir, 'index.html')))

const PORT = process.env.PORT || 3000
app.listen(PORT, () => console.log(`Robert the Framer running on http://localhost:${PORT}`))
```

- [ ] **Step 2: Verify env-check exits with code 1 when vars are missing**

```bash
node server/index.js; echo "exit code: $?"
```

Expected output:
```
Missing required env vars: APP_PASSWORD, SESSION_SECRET
exit code: 1
```

- [ ] **Step 3: Build frontend, start server, verify full auth flow**

```bash
npm run build
DB_PATH=/tmp/rtf-smoke.db APP_PASSWORD=test SESSION_SECRET=dev node server/index.js &
SERVER_PID=$!

# Poll until server is ready (avoids flaky sleep)
until curl -s http://localhost:3000/api/project >/dev/null 2>&1; do sleep 0.2; done

# Should 401 without auth
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/project
echo ""

# Login and capture session cookie
curl -s -c /tmp/rtf-smoke-cookies.txt -X POST http://localhost:3000/api/login \
  -H 'Content-Type: application/json' \
  -d '{"password":"test"}'
echo ""

# Should now 200 with cookie
curl -s -o /dev/null -w "%{http_code}" -b /tmp/rtf-smoke-cookies.txt http://localhost:3000/api/project
echo ""

kill $SERVER_PID
rm /tmp/rtf-smoke.db /tmp/rtf-smoke-cookies.txt
```

Expected output:
```
401
{"ok":true}
200
```

- [ ] **Step 4: Commit**

```bash
git add server/index.js
git commit -m "feat: add server/index.js — Express app with auth and API routes"
```

---

## Chunk 2: Frontend

### Task 5: Update src/state/store.js

**Files:**
- Modify: `src/state/store.js`

Replace `load()` and the synchronous `_persist()` with `fetchState()`, `initState()`, and async `_persist(state)`. `setState` stays synchronous and fire-and-forgets `_persist`. The existing `exportJSON` and `importJSON` functions are unchanged. `STORAGE_KEY` is preserved for the DEV/test localStorage path.

The existing unit tests in `tests/mutations.test.js` must still pass after this change — they run in DEV mode (`import.meta.env.DEV === true` in Vitest) and use the localStorage branch.

- [ ] **Step 1: Run existing tests to confirm baseline**

```bash
npm test
```

Expected: all tests pass. Note the count.

- [ ] **Step 2: Replace `src/state/store.js`**

```js
// src/state/store.js
const DEV = import.meta.env.DEV
const STORAGE_KEY = 'robert-the-framer-v1'

let _state = null
let _onChange = null

export function getState() {
  return _state
}

export function setOnChange(fn) {
  _onChange = fn
}

// Load state from the server (production) or localStorage (dev/test).
// Returns null if unauthenticated (401 in prod) or if localStorage is empty (dev).
// Throws on other non-ok responses.
export async function fetchState() {
  if (DEV) {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  }
  const res = await fetch('/api/project')
  if (res.status === 401) return null
  if (!res.ok) throw new Error(`Failed to load project: HTTP ${res.status}`)
  return res.json()
}

// Set in-memory state without persisting.
// Use after loading from the server so we don't immediately write back what we just read.
// INTENTIONAL DIVERGENCE FROM SPEC: The spec code sample stamps updatedAt here, but the
// plan does not — stamping on every load would overwrite the stored "last modified" time
// with the current time, making the timestamp meaningless. The plan's version is correct.
export function initState(raw) {
  _state = { ...raw, meta: { ...raw.meta } }
  _onChange?.(_state)
}

// Set state and persist. Use for all user mutations.
export function setState(next) {
  _state = { ...next, meta: { ...next.meta, updatedAt: new Date().toISOString() } }
  _persist(_state) // fire-and-forget; errors surface via 'persist-failed' event
  _onChange?.(_state)
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
        if (!Array.isArray(next.phases) || !Array.isArray(next.tasks) ||
            !Array.isArray(next.quotes) || !Array.isArray(next.payments)) {
          reject(new Error('Invalid project file: missing required fields'))
          return
        }
        setState(next) // import is a user action; it should persist
        resolve()
      } catch {
        reject(new Error('Invalid JSON file'))
      }
    }
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsText(file)
  })
}

async function _persist(state) {
  if (DEV) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      window.dispatchEvent(new CustomEvent('persist-failed', { detail: 'localStorage quota exceeded' }))
    }
    return
  }
  try {
    const res = await fetch('/api/project', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state)
    })
    if (res.status === 401) {
      window.dispatchEvent(new CustomEvent('session-expired'))
      return
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
  } catch (err) {
    window.dispatchEvent(new CustomEvent('persist-failed', { detail: err.message }))
  }
}
```

- [ ] **Step 3: Run tests — must still pass**

```bash
npm test
```

Expected: same number of tests pass as Step 1. If any fail, fix before continuing.

- [ ] **Step 4: Commit**

```bash
git add src/state/store.js
git commit -m "feat: replace localStorage persistence with fetch API in store.js"
```

---

### Task 6: Create src/views/login.js and add shake animation

**Files:**
- Create: `src/views/login.js`
- Modify: `src/styles/app.css`

`login.js` renders a full-screen overlay that covers any already-rendered app content. It has no dependency on app state — it's a self-contained DOM module.

- [ ] **Step 1: Add shake animation to `src/styles/app.css`**

Append to the end of `src/styles/app.css`:

```css
/* Login overlay */
@keyframes login-shake {
  0%, 100% { transform: translateX(0); }
  20%       { transform: translateX(-8px); }
  40%       { transform: translateX(8px); }
  60%       { transform: translateX(-6px); }
  80%       { transform: translateX(6px); }
}
```

- [ ] **Step 2: Create `src/views/login.js`**

```js
// src/views/login.js

export function renderLogin(onSuccess) {
  document.getElementById('login-overlay')?.remove()

  const overlay = document.createElement('div')
  overlay.id = 'login-overlay'
  overlay.style.cssText = [
    'position:fixed', 'inset:0', 'z-index:9999',
    'background:rgba(0,0,0,0.65)',
    'display:flex', 'align-items:center', 'justify-content:center'
  ].join(';')

  overlay.innerHTML = `
    <div id="login-card" style="
      background:#fff;border-radius:8px;padding:2rem;
      width:320px;box-shadow:0 8px 32px rgba(0,0,0,0.3);
      display:flex;flex-direction:column;gap:1rem;
    ">
      <h2 style="margin:0;font-size:1.25rem;color:#1a1a1a">Robert the Framer</h2>
      <p style="margin:0;color:#6b7280;font-size:0.875rem">Enter the project password to continue.</p>
      <input id="login-pw" type="password" placeholder="Password" autocomplete="current-password"
        style="padding:0.5rem 0.75rem;border:1px solid #d1d5db;border-radius:4px;font-size:1rem;width:100%;box-sizing:border-box"/>
      <button id="login-btn" style="
        padding:0.5rem 1rem;background:#d97706;color:#fff;border:none;border-radius:4px;
        font-size:1rem;cursor:pointer;width:100%;font-weight:500;
      ">Sign in</button>
      <p id="login-err" style="margin:0;color:#dc2626;font-size:0.875rem;min-height:1.25rem"></p>
    </div>
  `

  document.body.appendChild(overlay)

  const pw  = overlay.querySelector('#login-pw')
  const btn = overlay.querySelector('#login-btn')
  const err = overlay.querySelector('#login-err')
  const card = overlay.querySelector('#login-card')

  function shake() {
    card.style.animation = 'none'
    void card.offsetWidth // force reflow
    card.style.animation = 'login-shake 0.4s ease'
  }

  function showError(msg) {
    err.textContent = msg
    shake()
  }

  async function submit() {
    btn.disabled = true
    err.textContent = ''
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pw.value })
      })
      if (res.ok) {
        overlay.remove()
        onSuccess()
      } else if (res.status === 401) {
        showError('Wrong password.')
      } else {
        showError('Connection failed — check server.')
      }
    } catch {
      showError('Connection failed — check server.')
    } finally {
      btn.disabled = false
      pw.value = ''
      pw.focus()
    }
  }

  btn.addEventListener('click', submit)
  pw.addEventListener('keydown', e => { if (e.key === 'Enter') submit() })
  pw.focus()
}
```

- [ ] **Step 3: Verify no syntax errors**

```bash
node --input-type=module --eval "import('./src/views/login.js').then(() => console.log('login.js OK')).catch(e => { console.error(e); process.exit(1) })"
```

Expected: `login.js OK`

- [ ] **Step 4: Commit**

```bash
git add src/views/login.js src/styles/app.css
git commit -m "feat: add login overlay view with shake animation"
```

---

### Task 7: Update src/main.js

**Files:**
- Modify: `src/main.js`

Replace `load()` with `fetchState()` + `initState()`. Extract `setupListeners()` so it runs exactly once. In dev mode (`import.meta.env.DEV`), fall back to the starter template when localStorage is empty — same behavior as before. In production, show the login overlay on 401.

- [ ] **Step 1: Replace `src/main.js`**

```js
// src/main.js
import { fetchState, initState, setOnChange, getState } from './state/store.js'
import { renderLogin } from './views/login.js'
import * as header from './views/header.js'
import * as burndown from './views/burndown.js'
import * as gantt from './views/gantt.js'
import * as items from './views/items.js'
import { showToast } from './lib/ui.js'

let burndownMode = '$'
let highlightedTaskId = null

// Register all event listeners exactly once.
// Do NOT call this again on session re-auth — it would double-register listeners.
function setupListeners() {
  setOnChange(render)

  window.addEventListener('persist-failed', e =>
    showToast(`Save failed: ${e.detail}`, 'error')
  )

  window.addEventListener('session-expired', () => {
    // Session expired mid-session. Show login overlay.
    // Listeners are already registered; do not call setupListeners() again.
    renderLogin(async () => {
      let loaded
      try { loaded = await fetchState() }
      catch (err) { showToast(`Reconnect failed: ${err.message}`, 'error'); return }
      if (!loaded) return // still 401 — overlay stays
      initState(loaded)
      render()
    })
  })
}

async function init() {
  let state
  try {
    state = await fetchState()
  } catch (err) {
    showToast(`Failed to load project: ${err.message}`, 'error')
    return
  }

  if (state === null) {
    if (import.meta.env.DEV) {
      // Dev mode: localStorage empty — seed from starter template (same as before)
      setupListeners()
      try {
        const tmpl = await fetch('/starter-template.json').then(r => r.json())
        initState(tmpl)
      } catch {
        initState({
          meta: { projectName: 'My New Home', startDate: null, targetEndDate: null,
                  totalBudget: null, currency: 'USD', createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString() },
          phases: [], tasks: [], quotes: [], payments: []
        })
      }
      render()
      return
    }

    // Production: 401 — show login overlay
    renderLogin(async () => {
      let loaded
      try { loaded = await fetchState() }
      catch (err) { showToast(`Failed to load project: ${err.message}`, 'error'); return }
      if (!loaded) return // still 401 — overlay stays
      initState(loaded)
      setupListeners()
      render()
    })
    return
  }

  // Authenticated load — set state without persisting, then start
  initState(state)
  setupListeners()
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
        if (row) {
          row.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
          row.click()
        }
      }, 50)
    }
  })

  items.render(document.getElementById('items'), state, { highlightedTaskId })
}

init()
```

- [ ] **Step 2: Run all tests — must still pass**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 3: Smoke test dev mode**

```bash
npm run dev
```

Open `http://localhost:5173`. Expected: app loads with starter template data, no login screen, all three views render. Ctrl+C to stop.

- [ ] **Step 4: Commit**

```bash
git add src/main.js
git commit -m "feat: replace localStorage bootstrap with fetch API in main.js"
```

---

## Chunk 3: Docker + Deployment

### Task 8: Create Docker and deployment files

**Files:**
- Create: `Dockerfile`
- Create: `docker-compose.yml`
- Create: `.dockerignore`
- Create: `.env.example`
- Modify: `.gitignore`

- [ ] **Step 1: Create `.gitignore` additions**

Add these lines to `.gitignore` if not already present:

```
.env
data/
```

Verify:

```bash
grep -E "^\.env$|^data/$" .gitignore && echo "already present" || echo "add them"
```

If not present, append them:

```bash
echo ".env" >> .gitignore
echo "data/" >> .gitignore
```

- [ ] **Step 2: Create `.env.example`**

```
# Copy to .env and fill in values — never commit .env
APP_PASSWORD=
SESSION_SECRET=
```

- [ ] **Step 3: Create `.dockerignore`**

Note: `dist/` is intentionally NOT excluded — the Dockerfile uses explicit `COPY dist/ ./dist/`, not `COPY . .`.

```
node_modules
.env
.git
.superpowers
tests
docs
```

- [ ] **Step 4: Create `Dockerfile`**

```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY dist/ ./dist/
COPY server/ ./server/
COPY public/ ./public/
RUN mkdir -p /data
EXPOSE 3000
CMD ["node", "server/index.js"]
```

- [ ] **Step 5: Create `docker-compose.yml`**

```yaml
services:
  app:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - ./data:/data
    env_file:
      - .env
    restart: unless-stopped
```

- [ ] **Step 6: Commit**

```bash
git add Dockerfile docker-compose.yml .dockerignore .env.example .gitignore
git commit -m "chore: add Docker build files and .env.example"
```

---

### Task 9: End-to-end Docker smoke test

No code changes — verify the full build and container work correctly.

- [ ] **Step 1: Set up .env**

```bash
echo "APP_PASSWORD=testpass" > .env
echo "SESSION_SECRET=devdevdevdevdevdevdevdevdevdevdev" >> .env
```

- [ ] **Step 2: Build frontend**

```bash
npm run build
```

Expected: `dist/` directory created with `index.html` and assets.

- [ ] **Step 3: Verify prerequisites, then build and start container**

```bash
# Confirm starter template exists (required for first-run seeding)
ls public/starter-template.json
```

Expected: file listed. If missing, something has gone wrong — do not proceed until it exists.

```bash
docker compose up -d --build
```

Expected: image builds, container starts. No error messages.

- [ ] **Step 4: Verify container is running**

```bash
docker compose ps
```

Expected: `app` service shows `running`.

- [ ] **Step 5: Verify 401 without auth**

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/project
```

Expected: `401`

- [ ] **Step 6: Login and fetch project — capture phase count for Step 8**

```bash
# Login and capture cookie
curl -s -c /tmp/rtf-cookies.txt -X POST http://localhost:3000/api/login \
  -H 'Content-Type: application/json' -d '{"password":"testpass"}'
echo ""

# Fetch project, confirm structure, capture phase count
PHASE_COUNT_BEFORE=$(curl -s -b /tmp/rtf-cookies.txt http://localhost:3000/api/project | \
  python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d['phases']))")
echo "phases before restart: $PHASE_COUNT_BEFORE"
rm /tmp/rtf-cookies.txt
```

Expected: first line `{"ok":true}`, second line shows a non-zero phase count (9 if this is a fresh data volume). Save this count — Step 8 will compare against it.

- [ ] **Step 7: Open app in browser**

Open `http://localhost:3000`. Expected: login overlay appears. Enter `testpass`. App loads with project data. All three views (burndown, Gantt, items) render.

- [ ] **Step 8: Test data persistence across restart**

```bash
docker compose restart

# Wait for server to accept connections (401 means it's up)
until curl -s -o /dev/null http://localhost:3000/api/project; do sleep 0.2; done

curl -s -c /tmp/rtf-cookies.txt -X POST http://localhost:3000/api/login \
  -H 'Content-Type: application/json' -d '{"password":"testpass"}'
PHASE_COUNT_AFTER=$(curl -s -b /tmp/rtf-cookies.txt http://localhost:3000/api/project | \
  python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d['phases']))")
echo "phases after restart: $PHASE_COUNT_AFTER"
rm /tmp/rtf-cookies.txt
```

Expected: `phases after restart: $PHASE_COUNT_BEFORE` (same count as Step 6 — confirming SQLite data survived the container restart).

- [ ] **Step 9: Stop container and clean up test .env**

```bash
docker compose down
rm .env
```
