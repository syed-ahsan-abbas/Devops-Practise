const express = require('express');
const os = require('os');
const path = require('path');
const fs = require('fs');
const client = require('prom-client');

function createApp() {
  const app = express();
  const startedAt = new Date();
  const version = process.env.APP_VERSION || '1.0.0';
  const env = process.env.NODE_ENV || 'development';
  const chaos = process.env.ENABLE_CHAOS === 'true';
  const dataFile = process.env.DATA_FILE || '';
  let ready = true;

  // ---- tiny storage: memory, optionally mirrored to a JSON file ----
  let tasks = [];
  let nextId = 1;
  if (dataFile && fs.existsSync(dataFile)) {
    try {
      tasks = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
      nextId = tasks.reduce((m, t) => Math.max(m, t.id), 0) + 1;
    } catch (e) { console.error('Could not read DATA_FILE:', e.message); }
  }
  const save = () => {
    if (!dataFile) return;
    fs.mkdirSync(path.dirname(dataFile), { recursive: true });
    fs.writeFileSync(dataFile, JSON.stringify(tasks, null, 2));
  };

  // ---- metrics (Prometheus) ----
  const register = new client.Registry();
  client.collectDefaultMetrics({ register });
  const httpDuration = new client.Histogram({
    name: 'http_request_duration_seconds',
    help: 'HTTP request duration in seconds',
    labelNames: ['method', 'route', 'status'],
    buckets: [0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5],
    registers: [register],
  });
  new client.Gauge({
    name: 'app_tasks_total', help: 'Number of tasks', registers: [register],
    collect() { this.set(tasks.length); },
  });

  app.use(express.json());
  app.use((req, res, next) => {
    const end = httpDuration.startTimer();
    res.on('finish', () => {
      const route = req.route ? req.baseUrl + req.route.path : 'static';
      end({ method: req.method, route, status: res.statusCode });
      if (req.path !== '/metrics' && req.path !== '/health')
        console.log(JSON.stringify({ t: new Date().toISOString(), method: req.method, path: req.originalUrl, status: res.statusCode }));
    });
    next();
  });

  // ---- health / ops endpoints ----
  app.get('/health', (req, res) => res.json({ status: 'ok' }));              // liveness
  app.get('/ready', (req, res) =>                                             // readiness
    ready ? res.json({ status: 'ready' }) : res.status(503).json({ status: 'not-ready' }));
  app.get('/metrics', async (req, res) => {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  });
  app.get('/api/info', (req, res) => res.json({
    app: 'devops-lab', version, env, hostname: os.hostname(), pid: process.pid,
    node: process.version, startedAt, uptimeSeconds: Math.round(process.uptime()),
    chaosEnabled: chaos, persistence: dataFile ? 'file' : 'memory',
  }));

  // ---- tasks API ----
  app.get('/api/tasks', (req, res) => res.json(tasks));
  app.post('/api/tasks', (req, res) => {
    const title = ((req.body && req.body.title) || '').trim();
    if (!title) return res.status(400).json({ error: 'title is required' });
    const task = { id: nextId++, title, done: false, createdAt: new Date().toISOString() };
    tasks.push(task); save();
    res.status(201).json(task);
  });
  app.patch('/api/tasks/:id', (req, res) => {
    const task = tasks.find(t => t.id === Number(req.params.id));
    if (!task) return res.status(404).json({ error: 'not found' });
    if (typeof req.body.done === 'boolean') task.done = req.body.done;
    save(); res.json(task);
  });
  app.delete('/api/tasks/:id', (req, res) => {
    const before = tasks.length;
    tasks = tasks.filter(t => t.id !== Number(req.params.id));
    if (tasks.length === before) return res.status(404).json({ error: 'not found' });
    save(); res.status(204).end();
  });

  // ---- chaos endpoints for practising restarts, probes, autoscaling ----
  if (chaos) {
    app.post('/api/chaos/crash', (req, res) => {
      res.json({ message: 'crashing in 500ms' });
      setTimeout(() => process.exit(1), 500);
    });
    app.post('/api/chaos/unready', (req, res) => { ready = !ready; res.json({ ready }); });
    app.get('/api/chaos/slow', (req, res) => {
      const ms = Math.min(Number(req.query.ms) || 2000, 15000);
      setTimeout(() => res.json({ waitedMs: ms }), ms);
    });
    app.get('/api/chaos/load', (req, res) => {
      const ms = Math.min(Number(req.query.ms) || 1000, 10000);
      const end = Date.now() + ms;
      while (Date.now() < end) Math.sqrt(Math.random());
      res.json({ burnedCpuMs: ms });
    });
  }

  app.use(express.static(path.join(__dirname, '..', 'public')));
  app.use((req, res) => res.status(404).json({ error: 'not found' }));
  return app;
}

module.exports = { createApp };
