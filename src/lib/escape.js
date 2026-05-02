// src/lib/escape.js
export function escapeHtml(str) {
  if (str == null) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function safeUrl(url) {
  if (!url) return ''
  const s = String(url).trim()
  return s.startsWith('http://') || s.startsWith('https://') ? s : ''
}
