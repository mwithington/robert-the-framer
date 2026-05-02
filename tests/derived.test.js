// tests/derived.test.js
import { describe, it, expect } from 'vitest'
import { totalSpent, phaseBudget, phaseProgress, burndownLines, criticalPath } from '../src/state/derived.js'

const baseState = {
  meta: { startDate: '2026-01-01', targetEndDate: '2026-12-31', totalBudget: 100000, currency: 'USD' },
  phases: [{ id: 'p1', name: 'Foundation', color: '#000', order: 1 }],
  tasks: [
    { id: 't1', phaseId: 'p1', name: 'A', budget: 10000, startDate: '2026-01-01', endDate: '2026-01-10', progress: 100, status: 'done', dependsOn: [] },
    { id: 't2', phaseId: 'p1', name: 'B', budget: 20000, startDate: '2026-01-10', endDate: '2026-01-20', progress: 50, status: 'in_progress', dependsOn: ['t1'] }
  ],
  quotes: [],
  payments: [
    { id: 'pay1', taskId: 't1', amount: 10000, date: '2026-01-10', type: 'final' },
    { id: 'pay2', taskId: 't2', amount: 5000, date: '2026-01-15', type: 'deposit' }
  ]
}

describe('totalSpent', () => {
  it('sums all payments', () => {
    expect(totalSpent(baseState)).toBe(15000)
  })
})

describe('phaseBudget', () => {
  it('sums task budgets in phase', () => {
    expect(phaseBudget(baseState, 'p1')).toBe(30000)
  })
})

describe('phaseProgress', () => {
  it('computes budget-weighted average progress', () => {
    // t1: 10000 * 100 = 1000000, t2: 20000 * 50 = 1000000, total budget 30000
    // (1000000 + 1000000) / 30000 = 66.66...
    expect(phaseProgress(baseState, 'p1')).toBeCloseTo(66.67, 1)
  })
})

describe('burndownLines', () => {
  it('starts ideal at totalBudget', () => {
    const { ideal } = burndownLines(baseState)
    expect(ideal[0].value).toBe(100000)
    expect(ideal[0].date).toBe('2026-01-01')
  })
  it('actual line decrements by payment amounts', () => {
    const { actual } = burndownLines(baseState)
    expect(actual[0].value).toBe(100000)
    expect(actual[1].value).toBe(90000) // after 10000 payment
    expect(actual[2].value).toBe(85000) // after 5000 payment
  })
})

describe('criticalPath', () => {
  it('identifies tasks on the longest dependency chain', () => {
    const cp = criticalPath(baseState)
    // t1 (9 days) → t2 (10 days) = 19 days total, both on critical path
    expect(cp.has('t1')).toBe(true)
    expect(cp.has('t2')).toBe(true)
  })
})
