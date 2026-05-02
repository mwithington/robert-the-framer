// tests/starter-template.test.js
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

describe('starter-template.json', () => {
  it('parses without errors', () => {
    const raw = readFileSync(resolve('public/starter-template.json'), 'utf8')
    expect(() => JSON.parse(raw)).not.toThrow()
  })

  it('has required top-level keys', () => {
    const t = JSON.parse(readFileSync(resolve('public/starter-template.json'), 'utf8'))
    expect(t).toHaveProperty('meta')
    expect(t).toHaveProperty('phases')
    expect(t).toHaveProperty('tasks')
    expect(t).toHaveProperty('quotes')
    expect(t).toHaveProperty('payments')
  })

  it('has 9 phases', () => {
    const t = JSON.parse(readFileSync(resolve('public/starter-template.json'), 'utf8'))
    expect(t.phases).toHaveLength(9)
  })

  it('all task dependsOn IDs exist', () => {
    const t = JSON.parse(readFileSync(resolve('public/starter-template.json'), 'utf8'))
    const ids = new Set(t.tasks.map(task => task.id))
    t.tasks.forEach(task => {
      task.dependsOn.forEach(dep => {
        expect(ids.has(dep), `task ${task.id} depends on unknown id ${dep}`).toBe(true)
      })
    })
  })
})
