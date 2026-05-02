export function parseDate(str) {
  if (!str) return null
  const d = new Date(str + 'T00:00:00Z')
  return isNaN(d.getTime()) ? null : d
}

export function formatDate(date) {
  return date.toISOString().slice(0, 10)
}

export function daysBetween(isoA, isoB) {
  const a = parseDate(isoA)
  const b = parseDate(isoB)
  return Math.round((b - a) / 86400000)
}

export function addDays(isoStr, n) {
  const d = parseDate(isoStr)
  d.setUTCDate(d.getUTCDate() + n)
  return formatDate(d)
}
