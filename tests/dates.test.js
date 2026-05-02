import { describe, it, expect } from 'vitest'
import { parseDate, formatDate, daysBetween, addDays } from '../src/lib/dates.js'

describe('parseDate', () => {
  it('parses ISO string to Date', () => {
    const d = parseDate('2026-06-01')
    expect(d).toBeInstanceOf(Date)
    expect(d.getUTCFullYear()).toBe(2026)
    expect(d.getUTCMonth()).toBe(5)
    expect(d.getUTCDate()).toBe(1)
  })
  it('returns null for null input', () => {
    expect(parseDate(null)).toBeNull()
  })
})

describe('formatDate', () => {
  it('formats Date to YYYY-MM-DD', () => {
    expect(formatDate(new Date('2026-06-01'))).toBe('2026-06-01')
  })
})

describe('daysBetween', () => {
  it('counts days between two ISO strings', () => {
    expect(daysBetween('2026-06-01', '2026-06-15')).toBe(14)
  })
  it('returns 0 for same date', () => {
    expect(daysBetween('2026-06-01', '2026-06-01')).toBe(0)
  })
})

describe('addDays', () => {
  it('adds days to ISO string', () => {
    expect(addDays('2026-06-01', 7)).toBe('2026-06-08')
  })
  it('handles negative offset', () => {
    expect(addDays('2026-06-08', -7)).toBe('2026-06-01')
  })
})
