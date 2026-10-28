// Smoke test: node test.js  (uses an in-memory database and Node's built-in fetch)
process.env.DB_FILE = ':memory:';
const assert = require('assert');
const app = require('./server');

const server = app.listen(0, async () => {
  const base = `http://localhost:${server.address().port}`;
  const call = (path, method = 'GET', body) =>
    fetch(base + path, { method, headers: { 'Content-Type': 'application/json' }, body: body && JSON.stringify(body) });
  try {
    let r = await call('/tasks', 'POST', { title: 'Write report', priority: 'high', due_date: '2026-11-01' });
    assert.equal(r.status, 201); const t = await r.json(); assert.equal(t.status, 'pending');

    r = await call('/tasks', 'POST', { title: '' });
    assert.equal(r.status, 400);

    r = await call(`/tasks/${t.id}`, 'PUT', { status: 'in_progress', title: 'Write final report' });
    assert.equal((await r.json()).status, 'in_progress');

    r = await call(`/tasks/${t.id}/complete`, 'PATCH');
    const done = await r.json(); assert.equal(done.status, 'completed'); assert.ok(done.completed_at);

    r = await call('/tasks?status=completed'); assert.equal((await r.json()).length, 1);
    r = await call('/stats'); assert.equal((await r.json()).completed, 1);

    r = await call(`/tasks/${t.id}`, 'DELETE'); assert.equal(r.status, 204);
    r = await call(`/tasks/${t.id}`); assert.equal(r.status, 404);
    console.log('All API tests passed');
  } catch (e) { console.error('TEST FAILED:', e.message); process.exitCode = 1; }
  server.close();
});
