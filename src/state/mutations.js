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
