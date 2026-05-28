import express from 'express'
import session from 'express-session'
import helmet from 'helmet'
import { rateLimit } from 'express-rate-limit'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { initDb, getProject, saveProject } from './db.js'
import { login, logout, requireAuth } from './auth.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Fail fast if required env vars are missing
const missing = ['APP_PASSWORD', 'SESSION_SECRET'].filter(k => !process.env[k])
if (missing.length) {
  console.error(`Missing required env vars: ${missing.join(', ')}`)
  process.exit(1)
}

initDb()

const app = express()

// Security headers — trust proxy so X-Forwarded-Proto works behind ingress
app.set('trust proxy', 1)
app.use(helmet())

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000
  }
}))

// 10 login attempts per 15 minutes per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false
})

// API routes — must be before static/catch-all
app.post('/api/login', loginLimiter, express.json(), login)
app.post('/api/logout', logout)
app.get('/api/project', requireAuth, (_req, res) => res.json(getProject()))
app.put('/api/project', requireAuth, express.json({ limit: '10mb' }), (req, res) => {
  saveProject(req.body)
  res.json({ ok: true })
})

// Static files + SPA catch-all (last)
const distDir = join(__dirname, '..', 'dist')
app.use(express.static(distDir))
app.get('/{*path}', (_req, res) => res.sendFile(join(distDir, 'index.html')))

const PORT = process.env.PORT || 3000
app.listen(PORT, () => console.log(`Robert the Framer running on http://localhost:${PORT}`))
