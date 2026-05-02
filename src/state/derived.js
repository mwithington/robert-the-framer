// src/state/derived.js

export function totalSpent(state) {
  return state.payments.reduce((sum, p) => sum + (p.amount || 0), 0)
}

export function phaseBudget(state, phaseId) {
  return state.tasks
    .filter(t => t.phaseId === phaseId)
    .reduce((sum, t) => sum + (t.budget || 0), 0)
}

export function phaseProgress(state, phaseId) {
  const tasks = state.tasks.filter(t => t.phaseId === phaseId)
  if (!tasks.length) return 0
  const totalBudget = tasks.reduce((s, t) => s + (t.budget || 0), 0)
  if (!totalBudget) {
    return tasks.reduce((s, t) => s + (t.progress || 0), 0) / tasks.length
  }
  return tasks.reduce((s, t) => s + (t.progress || 0) * (t.budget || 0), 0) / totalBudget
}

export function burndownLines(state) {
  const { startDate, targetEndDate, totalBudget } = state.meta
  if (!startDate || !targetEndDate) return { ideal: [], actual: [] }
  const budget = totalBudget != null
    ? totalBudget
    : state.tasks.reduce((s, t) => s + (t.budget || 0), 0)

  const ideal = [
    { date: startDate, value: budget },
    { date: targetEndDate, value: 0 }
  ]

  const sorted = [...state.payments]
    .filter(p => p.date)
    .sort((a, b) => a.date.localeCompare(b.date))

  let remaining = budget
  const actual = [{ date: startDate, value: budget }]
  for (const p of sorted) {
    remaining -= p.amount || 0
    actual.push({ date: p.date, value: remaining })
  }

  return { ideal, actual }
}

export function criticalPath(state) {
  const tasks = state.tasks.filter(t => t.startDate && t.endDate)
  if (!tasks.length) return new Set()
  const taskMap = new Map(tasks.map(t => [t.id, t]))

  function duration(t) {
    return Math.max(1, (new Date(t.endDate) - new Date(t.startDate)) / 86400000)
  }

  const ef = new Map()
  function earliestFinish(id) {
    if (ef.has(id)) return ef.get(id)
    const t = taskMap.get(id)
    if (!t) return 0
    const predMax = t.dependsOn.length
      ? Math.max(...t.dependsOn.map(d => earliestFinish(d)))
      : 0
    const result = predMax + duration(t)
    ef.set(id, result)
    return result
  }
  tasks.forEach(t => earliestFinish(t.id))

  const projectFinish = Math.max(...ef.values())

  const successors = new Map(tasks.map(t => [t.id, []]))
  tasks.forEach(t => t.dependsOn.forEach(dep => {
    if (successors.has(dep)) successors.get(dep).push(t.id)
  }))

  const lf = new Map()
  function latestFinish(id) {
    if (lf.has(id)) return lf.get(id)
    const succs = successors.get(id) || []
    const result = succs.length
      ? Math.min(...succs.map(s => latestFinish(s) - duration(taskMap.get(s))))
      : projectFinish
    lf.set(id, result)
    return result
  }
  tasks.forEach(t => latestFinish(t.id))

  return new Set(tasks.filter(t => Math.abs(lf.get(t.id) - ef.get(t.id)) < 0.01).map(t => t.id))
}

export function quotesForTask(state, taskId) {
  return state.quotes.filter(q => q.taskId === taskId)
}

export function paymentsForTask(state, taskId) {
  return state.payments.filter(p => p.taskId === taskId)
}

export function tasksByPhase(state) {
  const map = new Map(state.phases.map(p => [p.id, []]))
  state.tasks.forEach(t => {
    if (map.has(t.phaseId)) map.get(t.phaseId).push(t)
  })
  return map
}
