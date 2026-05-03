# Backend + SQLite + Docker — Design Spec

**Date:** 2026-05-02
**Project:** robert-the-framer
**Status:** Approved

---

## Overview

Add a Node.js/Express backend, SQLite persistence, session-cookie auth, and Docker packaging so the app can be shared with contractors on the local network. The existing frontend state model and all views remain unchanged. Frontend changes: replace the two localStorage functions in `store.js` (`load` and `_persist`) with async `fetch()` equivalents, add `initState` for loading without triggering a save, update `main.js` bootstrap, and add a login screen.

---

## Goals

- Store project data in SQLite instead of localStorage so it is accessible from any device on the local network
- Protect the app with a single shared password (no user accounts, no roles)
- Package everything in one Docker container for simple home-machine deployment
- Keep all existing functionality, tests, and the Vite dev workflow intact

---

## Non-Goals

- Multi-user accounts or role-based access
- Cloud / remote deployment
- Mobile-optimized login UI
- Database migrations (one table, one row — no schema evolution needed in v1)
- HTTPS (local network; handled by the router if needed)
- Persistent sessions across container restarts (in-memory session store is fine; users log in again after a restart)

---

## Architecture

One Docker container runs one process: `node server/index.js`. Express serves:

1. `/api/*` — REST endpoints (auth-gated, JSON). **API routes must be registered before the `*` catch-all.**
2. `*` — `dist/index.html` SPA fallback (static files from `dist/`)

SQLite (via `better-sqlite3`) stores one table with one row: the full project JSON blob, identical in shape to today's localStorage value. Sessions are held in Express's default `MemoryStore` — they are lost when the container restarts, requiring users to log in again. This is intentional and acceptable for a home-network tool. The server process runs as root inside the container (Alpine default), which ensures it can write to the volume-mounted `/data` directory regardless of host directory ownership.

---

## File Layout

```
robert-the-framer/
├── server/
│   ├── index.js          # Express app entry: middleware, routes, listen
│   ├── db.js             # better-sqlite3 init, getProject, saveProject
│   └── auth.js           # session middleware, login/logout route handlers
├── docker-compose.yml
├── Dockerfile
├── .dockerignore
├── .env.example          # committed template; .env is gitignored
├── src/
│   ├── state/
│   │   └── store.js      # replace load/_persist with fetchState/initState/_persist
│   └── views/
│       └── login.js      # new: overlay login form
└── src/main.js           # await fetchState(), wire session-expired → login overlay
```

No new frontend dependencies. New backend dependencies: `express`, `better-sqlite3`, `express-session`.

---

## Data Model (Server)

```sql
CREATE TABLE IF NOT EXISTS project (
  id        INTEGER PRIMARY KEY CHECK (id = 1),
  data      TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
```

One row, enforced by `CHECK (id = 1)`. `data` is the project JSON string (same schema as the existing localStorage value). `updated_at` is a Unix timestamp in milliseconds.

The SQLite file is stored at `/data/project.db` inside the container. The `./data` directory on the host is volume-mounted to `/data` — Docker creates the host directory automatically as a bind mount if it does not exist.

On first start with an empty database, `db.js` seeds the row from `public/starter-template.json`. **This file is a required artifact** — the Dockerfile copies `public/` into the image. If `starter-template.json` is absent at seed time, the server logs an error and exits with code 1 (same fail-fast behavior as missing env vars). Path resolution in `db.js` (ESM, `package.json` has `"type": "module"`):

```js
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = '/data/project.db';
const TEMPLATE_PATH = join(__dirname, '..', 'public', 'starter-template.json');
```

---

## API Routes

| Method | Path | Auth required | Description |
|---|---|---|---|
| `POST` | `/api/login` | No | `{ password }` → session cookie or 401 |
| `POST` | `/api/logout` | No | Clears session cookie |
| `GET` | `/api/project` | Yes | Returns full project JSON |
| `PUT` | `/api/project` | Yes | Saves project JSON body; responds `200 { ok: true }` |
| `GET` | `*` | No | Serves `dist/index.html` (registered last) |

Auth failure: `{ error: "Unauthorized" }` with status 401.

`PUT /api/project` uses `express.json({ limit: '10mb' })`. It accepts any syntactically valid JSON without shape validation — the frontend is the only writer and always sends the correct schema. Invalid JSON → 400. Body over 10 MB → 413.

---

## Auth

Startup check — fail fast:

```js
const missing = ['APP_PASSWORD', 'SESSION_SECRET'].filter(k => !process.env[k]);
if (missing.length) {
  console.error(`Missing required env vars: ${missing.join(', ')}`);
  process.exit(1);
}
```

`POST /api/login` uses SHA-256 to normalize buffer lengths before `timingSafeEqual` (avoids `RangeError` on unequal-length inputs):

```js
import { createHash, timingSafeEqual } from 'crypto';
const hash = s => createHash('sha256').update(s).digest();
const match = timingSafeEqual(hash(submitted), hash(process.env.APP_PASSWORD));
```

On match: `req.session.authenticated = true`, respond `200 { ok: true }`.
On mismatch: respond 401.

All `/api/*` routes except `/api/login` and `/api/logout` require `req.session.authenticated`.

`express-session` configuration:

```js
session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    maxAge: 7 * 24 * 60 * 60 * 1000,  // 7 days within container uptime
  },
})
```

---

## Docker

**`.dockerignore`** — `dist/` is **not** excluded (the Dockerfile uses explicit `COPY dist/ ./dist/`, not `COPY . .`):

```
node_modules
.env
.git
.superpowers
tests
docs
```

**Prerequisite:** `npm run build` must run on the host before `docker compose up --build`. If `dist/` does not exist, the Docker build fails: `COPY failed: file not found in build context`.

**Dockerfile:**

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

**docker-compose.yml** — uses `env_file`, no secrets hardcoded:

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

**`.env.example`** (committed to repo; `.env` is gitignored):

```
# Copy to .env and fill in values — never commit .env
APP_PASSWORD=
SESSION_SECRET=
```

**Build workflow:**

```bash
npm run build
cp .env.example .env && vim .env    # fill APP_PASSWORD and SESSION_SECRET
docker compose up -d --build
```

---

## Frontend Changes

### `src/state/store.js`

The current `store.js` has:
- `STORAGE_KEY = 'robert-the-framer-v1'`
- `load(template)` — reads localStorage, falls back to template
- `_persist()` — synchronous localStorage write, called inside `setState()`
- `setState(next)` — spreads `next`, calls `_persist()`, fires `onChange`

Replace the persistence layer. Add `initState` for loading without triggering a save (used after fetching from the server so we don't immediately write back what we just read). Keep `STORAGE_KEY` unchanged:

```js
const DEV = import.meta.env.DEV;
const STORAGE_KEY = 'robert-the-framer-v1';

// Load state from server (production) or localStorage (dev).
// Returns null if unauthenticated (401) or if localStorage is empty.
// Throws on other non-ok responses.
export async function fetchState() {
  if (DEV) {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  }
  const res = await fetch('/api/project');
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(`Failed to load project: HTTP ${res.status}`);
  return res.json();
}

// Set in-memory state without persisting — use after loading from server.
// Stamps updatedAt and fires onChange.
export function initState(raw) {
  _state = { ...raw, meta: { ...raw.meta, updatedAt: new Date().toISOString() } };
  _onChange?.(_state);
}

async function _persist(state) {
  if (DEV) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return;
  }
  try {
    const res = await fetch('/api/project', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state),
    });
    if (res.status === 401) {
      window.dispatchEvent(new CustomEvent('session-expired'));
      return;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  } catch (err) {
    window.dispatchEvent(new CustomEvent('persist-failed', { detail: err.message }));
  }
}

// setState triggers a save; use for user mutations.
export function setState(next) {
  _state = { ...next, meta: { ...next.meta, updatedAt: new Date().toISOString() } };
  _persist(_state);
  _onChange?.(_state);
}
```

`importJSON` calls `setState(next)` internally — no change needed (import is a user action and should persist).

**Vitest compatibility:** In Vitest, `import.meta.env.DEV` is `true` by default (development mode). The localStorage branch is always taken in tests — `fetch` and `CustomEvent` are never exercised. The existing `global.window = { dispatchEvent: () => {} }` mock remains sufficient. `CustomEvent` is available as a global in Node 22 and would not be reached in the test path anyway. No changes to `vite.config.js` or test files are required.

### `src/main.js`

Remove `load()` and the starter-template fetch. Update imports. Extract `setupListeners()` so listeners register exactly once — **do not call `setupListeners()` again on session re-auth** (it would double-register `persist-failed` and `session-expired` listeners):

```js
import { fetchState, initState, setState, setOnChange } from './state/store.js';
import { renderLogin } from './views/login.js';
import { showToast } from './lib/ui.js';
// other existing imports unchanged

function setupListeners() {
  setOnChange(render);
  window.addEventListener('persist-failed', e =>
    showToast(`Save failed: ${e.detail}`, 'error'));
  window.addEventListener('session-expired', () => {
    // Listeners are already registered; do not call setupListeners() again.
    renderLogin(async () => {
      let loaded;
      try { loaded = await fetchState(); }
      catch (err) { showToast(`Reconnect failed: ${err.message}`, 'error'); return; }
      if (!loaded) return;   // still 401 — login overlay stays
      initState(loaded);
      render();
    });
  });
}

async function init() {
  let state;
  try { state = await fetchState(); }
  catch (err) { showToast(`Failed to load project: ${err.message}`, 'error'); return; }

  if (state === null) {
    if (import.meta.env.DEV) {
      // Dev: empty localStorage — seed from starter template
      setupListeners();  // register first so _onChange is set before initState fires
      try {
        const tmpl = await fetch('/starter-template.json').then(r => r.json());
        initState(tmpl);
      } catch {
        initState({ meta: {}, phases: [], tasks: [], quotes: [], payments: [] });
      }
      render();
      return;
    }
    // Production: 401 — show login overlay
    renderLogin(async () => {
      let loaded;
      try { loaded = await fetchState(); }
      catch (err) { showToast(`Failed to load project: ${err.message}`, 'error'); return; }
      if (!loaded) return;   // still 401 — login overlay stays
      initState(loaded);
      setupListeners();
      render();
    });
    return;
  }

  initState(state);   // use initState, not setState — don't write back what we just read
  setupListeners();
  render();
}
```

Remove the `storage-quota-exceeded` listener. `persist-failed` and `session-expired` replace it.

### `src/views/login.js`

Exported function: `renderLogin(onSuccess)`. Renders a full-screen overlay (fixed position, full viewport, high z-index, semi-transparent dark background) with a centered card containing a `<input type="password">` and a submit button. The overlay covers the app content that may already be rendered behind it. On submit, `POST /api/login` with `{ password }`:

- **200:** removes overlay from DOM, calls `onSuccess`
- **401:** shakes card, shows "Wrong password."
- **Network error / other non-200:** shakes card, shows "Connection failed — check server."

---

## Dev Workflow

```bash
npm run dev   # Vite dev server, HMR, localStorage — no server needed
npm test      # Vitest — all existing tests pass
```

For end-to-end server testing locally:

```bash
npm run build
APP_PASSWORD=test SESSION_SECRET=dev node server/index.js
# open http://localhost:3000
```

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `APP_PASSWORD` | Yes | Shared password for all users. Set in `.env`. |
| `SESSION_SECRET` | Yes | Cookie signing string (≥ 32 chars recommended). Set in `.env`. |

Server startup checks both; exits code 1 with `"Missing required env vars: <names>"` if either is absent.

---

## Edge Cases

| Scenario | Handling |
|---|---|
| Empty database on first start | Seeds from `/app/public/starter-template.json` (required artifact) |
| `starter-template.json` missing at seed time | Server logs error and exits code 1 |
| `APP_PASSWORD` or `SESSION_SECRET` missing on startup | Exits code 1: `"Missing required env vars: ..."` |
| `dist/` missing before docker build | Build fails: `COPY failed: file not found`. Run `npm run build` first. |
| `PUT /api/project` invalid JSON body | 400 |
| `PUT /api/project` body exceeds 10 MB | 413; `_persist` sees `!res.ok`, throws `"HTTP 413"`, fires `persist-failed` → toast |
| `_persist` fetch fails (network, server crash) | `persist-failed` event → toast: "Save failed: ..." |
| `_persist` receives 401 mid-session | `session-expired` event → login overlay appears; in-memory state preserved |
| Re-auth `fetchState` returns null (still 401) | Login callback returns early — overlay stays |
| Re-auth `fetchState` throws (non-401 error) | Shows "Reconnect failed: ..." toast |
| Boot-time `fetchState` throws (non-401 error) | `init()` catches, shows error toast, returns — app does not crash |
| Session cleared / container restarted | Next API call returns 401 → `session-expired` → login overlay |
| Concurrent saves from two browser tabs | Last write wins (same as localStorage behavior today) |
| `POST /api/login` network failure | Card shakes, shows "Connection failed — check server." |
| DEV: `/starter-template.json` fetch fails | Catches error, initializes with empty state; app renders without data |

---

## Testing

No new unit tests. Manual smoke testing covers:

- Fresh container (no `./data` volume): login overlay appears; correct password → access; wrong → shake/error; network failure → connection error
- SQLite file persists across `docker compose restart`; users must log in again after restart
- Export/import works from any browser on the local network
- `persist-failed` toast appears when server is unreachable mid-session
- Session expiry mid-session shows login overlay; in-memory state is preserved (no data loss)
- All existing Vitest tests pass (`npm test`)
- Dev mode (`npm run dev`) works with localStorage, no server required
