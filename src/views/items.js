// src/views/items.js
import { formatCurrency, formatPercent } from '../lib/format.js'
import { phaseBudget, phaseProgress, quotesForTask, paymentsForTask } from '../state/derived.js'
import { deleteTask, deleteQuote, deletePayment, selectQuote } from '../state/mutations.js'
import { open as openTask } from '../editors/task-editor.js'
import { open as openQuote } from '../editors/quote-editor.js'
import { open as openPayment } from '../editors/payment-editor.js'
import { safeUrl } from '../lib/escape.js'

let _openPhases = new Set()
let _openTaskId = null
let _openDrawerTab = {}

export function render(rootEl, state, { highlightedTaskId } = {}) {
  const { phases, tasks } = state
  const sortedPhases = [...phases].sort((a, b) => a.order - b.order)

  rootEl.innerHTML = `
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
              <span>${pTasks.length} task${pTasks.length !== 1 ? 's' : ''}</span>
            </span>
            <span>${isOpen ? '▲' : '▼'}</span>
          </div>
          <div class="phase-tasks ${isOpen ? 'open' : ''}">
            ${pTasks.map(task => _renderTaskRow(task, state, highlightedTaskId)).join('')}
          </div>
        </div>
      `
    }).join('')}
  `

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
      const drawer = document.getElementById(`drawer-${taskId}`)
      if (drawer) {
        if (_openTaskId === taskId) {
          drawer.style.display = 'block'
          _renderDrawer(drawer, taskId, state)
        } else {
          drawer.style.display = 'none'
          drawer.innerHTML = ''
        }
      }
      el.classList.toggle('active', _openTaskId === taskId)
    })
  })

  // Restore open drawer if any
  if (_openTaskId) {
    const drawer = document.getElementById(`drawer-${_openTaskId}`)
    if (drawer) {
      drawer.style.display = 'block'
      _renderDrawer(drawer, _openTaskId, state)
      const row = document.querySelector(`[data-task-id="${_openTaskId}"]`)
      if (row) row.classList.add('active')
    } else {
      _openTaskId = null
    }
  }

  // Wire global handlers for inline onclick
  window.__openTask = id => openTask(id)
  window.__openQuote = (taskId, quoteId) => openQuote(taskId, quoteId || undefined)
  window.__openPayment = (taskId, paymentId) => openPayment(taskId, paymentId || undefined)
}

function _renderTaskRow(task, state, highlightedTaskId) {
  const isHighlighted = task.id === highlightedTaskId
  const hasNoDates = !task.startDate || !task.endDate
  const quotes = quotesForTask(state, task.id)
  const payments = paymentsForTask(state, task.id)
  const spent = payments.reduce((s, p) => s + (p.amount || 0), 0)

  return `
    <div class="task-row${isHighlighted ? ' highlighted' : ''}${_openTaskId === task.id ? ' active' : ''}" data-task-id="${task.id}">
      <span class="task-name">${task.name}</span>
      ${hasNoDates ? '<span class="no-dates-badge">no dates</span>' : ''}
      <span class="task-status-badge status-${task.status}">${task.status.replace(/_/g,' ')}</span>
      <span class="text-muted text-sm">${formatCurrency(task.budget)}</span>
      ${spent > 0 ? `<span class="text-sm" style="color:var(--green)">${formatCurrency(spent)} paid</span>` : ''}
      ${quotes.length ? `<span class="text-sm text-muted">${quotes.length} quote${quotes.length !== 1 ? 's' : ''}</span>` : ''}
      <button class="icon" title="Edit" onclick="event.stopPropagation();window.__openTask('${task.id}')">✏️</button>
    </div>
    <div class="task-drawer" id="drawer-${task.id}" style="display:none"></div>
  `
}

function _renderDrawer(el, taskId, state) {
  const tab = _openDrawerTab[taskId] || 'quotes'
  const task = state.tasks.find(t => t.id === taskId)
  if (!task) return
  const quotes = quotesForTask(state, taskId)
  const payments = paymentsForTask(state, taskId)

  el.innerHTML = `
    <div class="drawer-tabs">
      <button class="drawer-tab ${tab === 'quotes' ? 'active' : ''}" data-tab="quotes">Quotes (${quotes.length})</button>
      <button class="drawer-tab ${tab === 'payments' ? 'active' : ''}" data-tab="payments">Payments (${payments.length})</button>
    </div>
    <div class="drawer-panel ${tab === 'quotes' ? 'active' : ''}" id="panel-quotes-${taskId}">
      ${quotes.map(q => `
        <div class="quote-row ${task.selectedQuoteId === q.id ? 'selected' : ''}">
          <input type="radio" name="quote-${taskId}" value="${q.id}" ${task.selectedQuoteId === q.id ? 'checked' : ''} data-quote-select="${q.id}" />
          <span class="quote-vendor">${q.vendor}</span>
          <span class="quote-amount">${formatCurrency(q.amount)}</span>
          ${q.notes ? `<span class="text-muted text-sm">${q.notes}</span>` : ''}
          ${q.attachmentUrl ? `<a href="${safeUrl(q.attachmentUrl)}" target="_blank" rel="noopener" class="text-sm">📎</a>` : ''}
          <button class="small" onclick="window.__openQuote('${taskId}','${q.id}')">Edit</button>
          <button class="small danger" data-delete-quote="${q.id}">×</button>
        </div>
      `).join('')}
      <button class="small" style="margin-top:8px" onclick="window.__openQuote('${taskId}')">+ Add Quote</button>
    </div>
    <div class="drawer-panel ${tab === 'payments' ? 'active' : ''}" id="panel-payments-${taskId}">
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

  el.querySelectorAll('.drawer-tab').forEach(tabBtn => {
    tabBtn.addEventListener('click', () => {
      _openDrawerTab[taskId] = tabBtn.dataset.tab
      el.querySelectorAll('.drawer-tab').forEach(t => t.classList.toggle('active', t === tabBtn))
      el.querySelectorAll('.drawer-panel').forEach(p => {
        p.classList.toggle('active', p.id === `panel-${tabBtn.dataset.tab}-${taskId}`)
      })
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
