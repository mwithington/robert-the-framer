# Backend + SQLite + Docker — Design Spec

**Date:** 2026-05-02
**Project:** robert-the-framer
**Status:** Approved

---

## Overview

Add a Node.js/Express backend, SQLite persistence, session-cookie auth, and Docker packaging so the app can be shared with contractors on the local network. The existing frontend state model and all views remain unchanged. The only frontend changes are swapping two localStorage functions for `fetch()` calls and adding a login screen.

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

---

## Architecture

One Docker container runs one process: `node server/index.js`. Express serves:

1. `/api/*` — REST endpoints (auth-gated, JSON)
2. `*` — `dist/index.html` SPA fallback (static files from `dist/`)

SQLite (via `better-sqlite3`) stores one table with one row: the full project JSON blob, identical in shape to today's localStorage value.

```
┌─────────────────────────────────┐
│           Docker container      │
│  ┌──────────────────────────┐   │
│  │   Express (port 3000)    │   │
│  │   /api/* → handlers      │   │
│  │   /*     → dist/         │   │
│  └──────────┬───────────────┘   │
│             │                   │
│  ┌──────────▼───────────────┐   │
│  │   better-sqlite3         │   │
│  │   /data/project.db       │   │
│  └──────────────────────────┘   │
└─────────────────────────────────┘
         │ volume mount
/home/manny/rtf-data/project.db
```

---

## File Layout

```
robert-the-framer/
├── server/
│   ├── index.js          # Express app entry: middleware, routes, listen
│   ├── db.js             # better-sqlite3 init, getProject, saveProject
│   └── auth.js           # session middleware, login/logout route handlers
├── docker-compose.yml    # env vars (minus APP_PASSWORD), volume, port
├── Dockerfile
├── src/
│   ├── state/
│   │   └── store.js      # replace localStorage with fetch() calls
│   └── views/
│       └── login.js      # new: centered password form
└── src/main.js           # await fetchState(), wire 401 → login screen
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

On first start with an empty database, the server seeds the row from `public/starter-template.json`.

---

## API Routes

| Method | Path | Auth required | Description |
|---|---|---|---|
| `POST` | `/api/login` | No | `{ password }` → sets session cookie or 401 |
| `POST` | `/api/logout` | No | Clears session cookie |
| `GET` | `/api/project` | Yes | Returns project JSON |
| `PUT` | `/api/project` | Yes | Saves project JSON body |
| `GET` | `*` | No | Serves `dist/index.html` |

All API responses are JSON. Auth failure returns `{ error: "Unauthorized" }` with status 401.

---

## Auth

- `express-session` with `SESSION_SECRET` env var (required; server exits if missing)
- `APP_PASSWORD` env var (required; server exits if missing)
- `POST /api/login`: compares submitted password to `APP_PASSWORD` with `timingSafeEqual` to prevent timing attacks; sets `req.session.authenticated = true` on match
- All `/api/*` routes except login/logout check `req.session.authenticated`; return 401 if not set
- Session cookie: `httpOnly: true`, `sameSite: 'lax'`, `secure: false` (local network, no HTTPS)

---

## Docker

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

**docker-compose.yml:**

```yaml
services:
  app:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - ./data:/data
    environment:
      SESSION_SECRET: change-me-to-a-random-string
      # APP_PASSWORD: set this before running
    restart: unless-stopped
```

`APP_PASSWORD` is intentionally omitted from `docker-compose.yml` so it is never accidentally committed. The user sets it via `docker compose run -e APP_PASSWORD=... app` or a local `.env` file (gitignored).

**Build workflow:**

```bash
npm run build          # Vite → dist/
docker compose up -d   # build image, start container
```

---

## Frontend Changes

### `src/state/store.js`

Replace `loadState()` and `saveState()` with async API calls:

```js
export async function fetchState() {
  const res = await fetch('/api/project');
  if (res.status === 401) return null;  // signal: show login
  if (!res.ok) throw new Error('Failed to load project');
  return res.json();
}

export async function persistState(state) {
  const res = await fetch('/api/project', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(state),
  });
  if (!res.ok) throw new Error('Failed to save project');
}
```

Export/import buttons continue to work — they operate on the in-memory state object, not the API directly. Import calls `persistState` after loading the JSON.

### `src/main.js`

```js
const state = await fetchState();
if (state === null) {
  renderLogin(() => init());  // login success → re-run init
  return;
}
// existing init continues...
```

### `src/views/login.js`

Renders a centered card with a password `<input>` and submit button. On submit, `POST /api/login`. On 401, shakes the form and shows "Wrong password." On success, calls the provided callback.

---

## Dev Workflow

No change to daily development:

```bash
npm run dev   # Vite dev server, HMR — localStorage still used in dev mode
npm test      # Vitest — all 22 tests pass, no storage dependency
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
| `APP_PASSWORD` | Yes | Shared password for all users |
| `SESSION_SECRET` | Yes | Random string for signing session cookies |

Server exits with a clear error message if either is missing.

---

## Edge Cases

| Scenario | Handling |
|---|---|
| Empty database on first start | Server seeds from `public/starter-template.json` |
| `APP_PASSWORD` or `SESSION_SECRET` missing | Server logs error and exits with code 1 |
| `PUT /api/project` with invalid JSON body | Express JSON middleware returns 400 |
| Session expires / cookie cleared | Next API call returns 401 → login screen appears |
| Concurrent saves from two browser tabs | Last write wins (same as localStorage behavior today) |

---

## Testing

No new unit tests required. The server logic is thin wrappers around better-sqlite3 and express-session — both are well-tested libraries. Manual smoke testing covers:

- Fresh container: login screen appears, correct password grants access, wrong password shows error
- Project data persists across container restarts (volume mount)
- Export/import still works
- All existing Vitest tests continue to pass (`npm test`)
