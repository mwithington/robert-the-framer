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
    if (res.ok) template = await res.json()
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
      // After re-render, scroll to and open the task drawer
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
