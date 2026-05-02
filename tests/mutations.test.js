// tests/mutations.test.js
import { describe, it, expect, beforeEach } from 'vitest'

// Mock localStorage for Node
const store = {}
global.localStorage = {
  getItem: k => store[k] ?? null,
  setItem: (k, v) => { store[k] = v },
  removeItem: k => { delete store[k] }
}
global.window = { dispatchEvent: () => {} }

// Must import AFTER mocking globals
const { getState, setState } = await import('../src/state/store.js')
const mutations = await import('../src/state/mutations.js')

function freshState() {
  return {
    meta: { projectName: 'Test', startDate: '2026-01-01', targetEndDate: '2026-12-31', totalBudget: 100000, currency: 'USD', createdAt: '', updatedAt: '' },
    phases: [{ id: 'p1', name: 'Foundation', color: '#000', order: 1 }],
    tasks: [],
    quotes: [],
    payments: []
  }
}

beforeEach(() => setState(freshState()))

describe('addTask', () => {
  it('adds a task to state', () => {
    mutations.addTask({ phaseId: 'p1', name: 'Excavation', budget: 5000, startDate: '2026-02-01', endDate: '2026-02-07', progress: 0, status: 'not_started', dependsOn: [], notes: '', selectedQuoteId: null })
    expect(getState().tasks).toHaveLength(1)
    expect(getState().tasks[0].name).toBe('Excavation')
  })
})

describe('updateTask', () => {
  it('updates task fields', () => {
    mutations.addTask({ phaseId: 'p1', name: 'Excavation', budget: 5000, startDate: null, endDate: null, progress: 0, status: 'not_started', dependsOn: [], notes: '', selectedQuoteId: null })
    const id = getState().tasks[0].id
    mutations.updateTask(id, { progress: 50 })
    expect(getState().tasks[0].progress).toBe(50)
  })
})

describe('deleteTask', () => {
  it('removes task and its quotes and payments', () => {
    mutations.addTask({ phaseId: 'p1', name: 'Excavation', budget: 5000, startDate: null, endDate: null, progress: 0, status: 'not_started', dependsOn: [], notes: '', selectedQuoteId: null })
    const taskId = getState().tasks[0].id
    mutations.addQuote({ taskId, vendor: 'ACME', amount: 5000, notes: '', receivedDate: '2026-01-15', attachmentUrl: '' })
    mutations.addPayment({ taskId, amount: 2500, date: '2026-02-01', notes: '', type: 'deposit' })
    mutations.deleteTask(taskId)
    expect(getState().tasks).toHaveLength(0)
    expect(getState().quotes).toHaveLength(0)
    expect(getState().payments).toHaveLength(0)
  })
})

describe('selectQuote', () => {
  it('syncs task budget to selected quote amount', () => {
    mutations.addTask({ phaseId: 'p1', name: 'Slab', budget: 0, startDate: null, endDate: null, progress: 0, status: 'not_started', dependsOn: [], notes: '', selectedQuoteId: null })
    const taskId = getState().tasks[0].id
    mutations.addQuote({ taskId, vendor: 'ACME', amount: 12400, notes: '', receivedDate: '2026-01-15', attachmentUrl: '' })
    const quoteId = getState().quotes[0].id
    mutations.selectQuote(taskId, quoteId)
    expect(getState().tasks[0].budget).toBe(12400)
    expect(getState().tasks[0].selectedQuoteId).toBe(quoteId)
  })
})

describe('addTask circular dependency', () => {
  it('rejects dependsOn that would create a cycle', () => {
    mutations.addTask({ phaseId: 'p1', name: 'A', budget: 0, startDate: null, endDate: null, progress: 0, status: 'not_started', dependsOn: [], notes: '', selectedQuoteId: null })
    const idA = getState().tasks[0].id
    mutations.addTask({ phaseId: 'p1', name: 'B', budget: 0, startDate: null, endDate: null, progress: 0, status: 'not_started', dependsOn: [idA], notes: '', selectedQuoteId: null })
    const idB = getState().tasks[1].id
    expect(() => mutations.updateTask(idA, { dependsOn: [idB] })).toThrow('circular')
  })
})
