import { createHash, timingSafeEqual } from 'crypto'

const hash = s => createHash('sha256').update(s).digest()

export function login(req, res) {
  const { password } = req.body ?? {}
  if (typeof password !== 'string') {
    return res.status(400).json({ error: 'Bad request' })
  }
  let match = false
  try {
    match = timingSafeEqual(hash(password), hash(process.env.APP_PASSWORD))
  } catch {
    // Should never happen — SHA-256 always produces 32 bytes
    return res.status(500).json({ error: 'Internal error' })
  }
  if (!match) return res.status(401).json({ error: 'Wrong password' })
  req.session.authenticated = true
  req.session.save(err => {
    if (err) return res.status(500).json({ error: 'Session error' })
    res.json({ ok: true })
  })
}

export function logout(req, res) {
  req.session.destroy(() => res.json({ ok: true }))
}

export function requireAuth(req, res, next) {
  if (req.session?.authenticated) return next()
  res.status(401).json({ error: 'Unauthorized' })
}
