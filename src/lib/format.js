export function formatCurrency(amount, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0
  }).format(amount ?? 0)
}

export function formatPercent(n) {
  return `${Math.round(n ?? 0)}%`
}
