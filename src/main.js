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
