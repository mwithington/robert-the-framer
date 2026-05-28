// src/views/header.js
import { formatCurrency, formatPercent } from '../lib/format.js'
import { escapeHtml } from '../lib/escape.js'
import { totalSpent } from '../state/derived.js'
import { updateMeta } from '../state/mutations.js'
import { exportJSON, importJSON } from '../state/store.js'
import { showToast } from '../lib/ui.js'
import { open as openSettings } from '../editors/settings-editor.js'

export function render(rootEl, state, { burndownMode, onToggleBurndown }) {
  const spent = totalSpent(state)
  const budget = state.meta.totalBudget ?? state.tasks.reduce((s, t) => s + (t.budget || 0), 0)
  const pct = budget ? Math.round((spent / budget) * 100) : 0
  const sqFt = state.meta.sqFt
  const costPerSqFt = sqFt ? Math.round(budget / sqFt) : null

  rootEl.innerHTML = `
    <span class="header-title" id="project-name-el">${escapeHtml(state.meta.projectName)}</span>
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
      ${costPerSqFt != null ? `
      <div class="stat">
        <div class="stat-label">$/sqft</div>
        <div class="stat-value">${formatCurrency(costPerSqFt)}</div>
      </div>` : ''}
    </div>
    <div class="header-actions">
      <div class="toggle-group">
        <button class="${burndownMode === '$' ? 'active' : ''}" data-mode="$">$</button>
        <button class="${burndownMode === '%' ? 'active' : ''}" data-mode="%">%</button>
      </div>
      <button id="btn-settings">⚙ Settings</button>
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

  rootEl.querySelector('#btn-settings').addEventListener('click', openSettings)
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
    } catch (err) {
      showToast(err.message || 'Import failed', 'error')
    }
    importInput.value = ''
  })
}

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
