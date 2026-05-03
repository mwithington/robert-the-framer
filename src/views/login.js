// src/views/login.js

export function renderLogin(onSuccess) {
  document.getElementById('login-overlay')?.remove()

  const overlay = document.createElement('div')
  overlay.id = 'login-overlay'
  overlay.style.cssText = [
    'position:fixed', 'inset:0', 'z-index:9999',
    'background:rgba(0,0,0,0.65)',
    'display:flex', 'align-items:center', 'justify-content:center'
  ].join(';')

  overlay.innerHTML = `
    <div id="login-card" style="
      background:#fff;border-radius:8px;padding:2rem;
      width:320px;box-shadow:0 8px 32px rgba(0,0,0,0.3);
      display:flex;flex-direction:column;gap:1rem;
    ">
      <h2 style="margin:0;font-size:1.25rem;color:#1a1a1a">Robert the Framer</h2>
      <p style="margin:0;color:#6b7280;font-size:0.875rem">Enter the project password to continue.</p>
      <input id="login-pw" type="password" placeholder="Password" autocomplete="current-password"
        style="padding:0.5rem 0.75rem;border:1px solid #d1d5db;border-radius:4px;font-size:1rem;width:100%;box-sizing:border-box"/>
      <button id="login-btn" style="
        padding:0.5rem 1rem;background:#d97706;color:#fff;border:none;border-radius:4px;
        font-size:1rem;cursor:pointer;width:100%;font-weight:500;
      ">Sign in</button>
      <p id="login-err" style="margin:0;color:#dc2626;font-size:0.875rem;min-height:1.25rem"></p>
    </div>
  `

  document.body.appendChild(overlay)

  const pw  = overlay.querySelector('#login-pw')
  const btn = overlay.querySelector('#login-btn')
  const err = overlay.querySelector('#login-err')
  const card = overlay.querySelector('#login-card')

  function shake() {
    card.style.animation = 'none'
    void card.offsetWidth // force reflow
    card.style.animation = 'login-shake 0.4s ease'
  }

  function showError(msg) {
    err.textContent = msg
    shake()
  }

  async function submit() {
    btn.disabled = true
    err.textContent = ''
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pw.value })
      })
      if (res.ok) {
        overlay.remove()
        onSuccess()
      } else if (res.status === 401) {
        showError('Wrong password.')
      } else {
        showError('Connection failed — check server.')
      }
    } catch {
      showError('Connection failed — check server.')
    } finally {
      btn.disabled = false
      pw.value = ''
      pw.focus()
    }
  }

  btn.addEventListener('click', submit)
  pw.addEventListener('keydown', e => { if (e.key === 'Enter') submit() })
  pw.focus()
}
