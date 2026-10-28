const express = require('express');
const Database = require('better-sqlite3');

const PORT = process.env.PORT || 3000;
const DB_FILE = process.env.DB_FILE || 'todo.db';
const STATUSES = ['pending', 'in_progress', 'completed'];
const PRIORITIES = ['low', 'medium', 'high'];

// ---------- database ----------
const db = new Database(DB_FILE);
db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    title       TEXT    NOT NULL,
    description TEXT    NOT NULL DEFAULT '',
    status      TEXT    NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','completed')),
    priority    TEXT    NOT NULL DEFAULT 'medium'  CHECK (priority IN ('low','medium','high')),
    due_date    TEXT,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    completed_at TEXT
  )
`);

// ---------- validation ----------
function validate(body, { partial = false } = {}) {
  const errors = [];
  const out = {};
  const has = k => Object.prototype.hasOwnProperty.call(body, k);

  if (!partial || has('title')) {
    if (typeof body.title !== 'string' || !body.title.trim()) errors.push('title is required (non-empty string)');
    else if (body.title.trim().length > 120) errors.push('title must be at most 120 characters');
    else out.title = body.title.trim();
  }
  if (has('description')) {
    if (typeof body.description !== 'string' || body.description.length > 1000) errors.push('description must be a string up to 1000 characters');
    else out.description = body.description.trim();
  }
  if (has('status')) {
    if (!STATUSES.includes(body.status)) errors.push(`status must be one of: ${STATUSES.join(', ')}`);
    else out.status = body.status;
  }
  if (has('priority')) {
    if (!PRIORITIES.includes(body.priority)) errors.push(`priority must be one of: ${PRIORITIES.join(', ')}`);
    else out.priority = body.priority;
  }
  if (has('due_date')) {
    if (body.due_date !== null && (typeof body.due_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(body.due_date) || isNaN(Date.parse(body.due_date))))
      errors.push('due_date must be null or a valid YYYY-MM-DD date');
    else out.due_date = body.due_date;
  }
  return { errors, data: out };
}

// ---------- app ----------
const app = express();
app.use(express.json());

app.get('/', (_req, res) => res.json({
  name: 'To-Do List API',
  endpoints: ['GET /tasks', 'GET /tasks/:id', 'POST /tasks', 'PUT /tasks/:id', 'PATCH /tasks/:id/complete', 'DELETE /tasks/:id', 'GET /stats']
}));

// List tasks with optional ?status=&priority=&search=
app.get('/tasks', (req, res) => {
  const where = [], params = [];
  if (req.query.status)   { where.push('status = ?');   params.push(req.query.status); }
  if (req.query.priority) { where.push('priority = ?'); params.push(req.query.priority); }
  if (req.query.search)   { where.push('(title LIKE ? OR description LIKE ?)'); params.push(`%${req.query.search}%`, `%${req.query.search}%`); }
  const sql = `SELECT * FROM tasks ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY id DESC`;
  res.json(db.prepare(sql).all(...params));
});

app.get('/tasks/:id', (req, res) => {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  res.json(task);
});

app.post('/tasks', (req, res) => {
  const { errors, data } = validate(req.body || {});
  if (errors.length) return res.status(400).json({ errors });
  const info = db.prepare(
    `INSERT INTO tasks (title, description, status, priority, due_date, completed_at)
     VALUES (@title, @description, @status, @priority, @due_date, CASE WHEN @status = 'completed' THEN datetime('now') END)`
  ).run({ description: '', status: 'pending', priority: 'medium', due_date: null, ...data });
  res.status(201).json(db.prepare('SELECT * FROM tasks WHERE id = ?').get(info.lastInsertRowid));
});

app.put('/tasks/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Task not found' });
  const { errors, data } = validate(req.body || {}, { partial: true });
  if (errors.length) return res.status(400).json({ errors });
  const merged = { ...existing, ...data };
  const completedAt = merged.status === 'completed' ? (existing.completed_at || new Date().toISOString().replace('T', ' ').slice(0, 19)) : null;
  db.prepare(
    `UPDATE tasks SET title=@title, description=@description, status=@status, priority=@priority,
       due_date=@due_date, completed_at=@completed_at, updated_at=datetime('now') WHERE id=@id`
  ).run({ ...merged, completed_at: completedAt, id: existing.id });
  res.json(db.prepare('SELECT * FROM tasks WHERE id = ?').get(existing.id));
});

app.patch('/tasks/:id/complete', (req, res) => {
  const info = db.prepare(
    `UPDATE tasks SET status='completed', completed_at=COALESCE(completed_at, datetime('now')), updated_at=datetime('now') WHERE id=?`
  ).run(req.params.id);
  if (!info.changes) return res.status(404).json({ error: 'Task not found' });
  res.json(db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id));
});

app.delete('/tasks/:id', (req, res) => {
  const info = db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
  if (!info.changes) return res.status(404).json({ error: 'Task not found' });
  res.status(204).end();
});

app.get('/stats', (_req, res) => {
  const rows = db.prepare('SELECT status, COUNT(*) AS count FROM tasks GROUP BY status').all();
  const stats = { total: 0, pending: 0, in_progress: 0, completed: 0 };
  rows.forEach(r => { stats[r.status] = r.count; stats.total += r.count; });
  res.json(stats);
});

app.use((_req, res) => res.status(404).json({ error: 'Route not found' }));
app.use((err, _req, res, _next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON body' });
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

if (require.main === module) {
  app.listen(PORT, () => console.log(`To-Do API running on http://localhost:${PORT}`));
}
module.exports = app;
