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
