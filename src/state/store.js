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
        if (!Array.isArray(next.phases) || !Array.isArray(next.tasks) ||
            !Array.isArray(next.quotes) || !Array.isArray(next.payments)) {
          reject(new Error('Invalid project file: missing required fields'))
          return
        }
        setState(next)
        resolve()
      } catch (err) {
        reject(new Error('Invalid JSON file'))
      }
    }
    reader.onerror = () => reject(new Error('Failed to read file'))
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
