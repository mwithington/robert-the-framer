// src/lib/ui.js

export function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container')
  const toast = document.createElement('div')
  toast.className = `toast${type === 'error' ? ' error' : ''}`
  toast.textContent = message
  container.appendChild(toast)
  setTimeout(() => toast.remove(), 3500)
}

let _currentModal = null
export function openModal(renderFn) {
  const overlay = document.getElementById('modal-overlay')
  overlay.classList.remove('hidden')
  const box = document.createElement('div')
  box.className = 'modal'
  overlay.appendChild(box)
  _currentModal = box
  renderFn(box)
  overlay.onclick = e => { if (e.target === overlay) closeModal() }
}

export function closeModal() {
  const overlay = document.getElementById('modal-overlay')
  overlay.classList.add('hidden')
  overlay.innerHTML = ''
  _currentModal = null
}
