import Database from 'better-sqlite3'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DB_PATH = process.env.DB_PATH || '/data/project.db'
const TEMPLATE_PATH = join(__dirname, '..', 'public', 'starter-template.json')

let db

export function initDb() {
  db = new Database(DB_PATH)
  db.exec(`
    CREATE TABLE IF NOT EXISTS project (
      id         INTEGER PRIMARY KEY CHECK (id = 1),
      data       TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `)
  const row = db.prepare('SELECT id FROM project WHERE id = 1').get()
  if (!row) {
    let template
    try {
      template = readFileSync(TEMPLATE_PATH, 'utf8')
    } catch (err) {
      console.error('Failed to read starter template:', err.message)
      process.exit(1)
    }
    db.prepare('INSERT INTO project (id, data, updated_at) VALUES (1, ?, ?)').run(template, Date.now())
  }
}

export function getProject() {
  const row = db.prepare('SELECT data FROM project WHERE id = 1').get()
  return JSON.parse(row.data)
}

export function saveProject(data) {
  db.prepare('UPDATE project SET data = ?, updated_at = ? WHERE id = 1')
    .run(JSON.stringify(data), Date.now())
}
