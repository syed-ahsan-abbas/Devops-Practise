const test = require('node:test');
const assert = require('node:assert');
const { createApp } = require('../src/app');

let server, base;
const json = { 'Content-Type': 'application/json' };

test.before(async () => {
  server = createApp().listen(0);
  await new Promise(r => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
test.after(() => server.close());

test('GET /health returns ok', async () => {
  const r = await fetch(`${base}/health`);
  assert.strictEqual(r.status, 200);
  assert.deepStrictEqual(await r.json(), { status: 'ok' });
});

test('GET /ready returns ready', async () => {
  assert.strictEqual((await fetch(`${base}/ready`)).status, 200);
});

test('tasks: create, toggle, delete', async () => {
  const created = await fetch(`${base}/api/tasks`, { method: 'POST', headers: json, body: JSON.stringify({ title: 'Write Dockerfile' }) });
  assert.strictEqual(created.status, 201);
  const task = await created.json();
  const patched = await fetch(`${base}/api/tasks/${task.id}`, { method: 'PATCH', headers: json, body: JSON.stringify({ done: true }) });
  assert.strictEqual((await patched.json()).done, true);
  assert.strictEqual((await fetch(`${base}/api/tasks/${task.id}`, { method: 'DELETE' })).status, 204);
});

test('POST /api/tasks rejects empty title', async () => {
  const r = await fetch(`${base}/api/tasks`, { method: 'POST', headers: json, body: '{}' });
  assert.strictEqual(r.status, 400);
});

test('GET /metrics exposes prometheus data', async () => {
  const text = await (await fetch(`${base}/metrics`)).text();
  assert.match(text, /http_request_duration_seconds/);
});
