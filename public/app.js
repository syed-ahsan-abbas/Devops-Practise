const $ = s => document.querySelector(s);
const api = (url, opts = {}) => fetch(url, { headers: { 'Content-Type': 'application/json' }, ...opts });

async function loadTasks() {
  const tasks = await (await api('/api/tasks')).json();
  const ul = $('#tasks'); ul.innerHTML = '';
  $('#empty').hidden = tasks.length > 0;
  for (const t of tasks) {
    const li = document.createElement('li');
    if (t.done) li.className = 'done';
    const cb = Object.assign(document.createElement('input'), { type: 'checkbox', checked: t.done });
    cb.setAttribute('aria-label', `Mark "${t.title}" done`);
    cb.onchange = async () => { await api(`/api/tasks/${t.id}`, { method: 'PATCH', body: JSON.stringify({ done: cb.checked }) }); loadTasks(); };
    const span = document.createElement('span'); span.textContent = t.title;
    const del = document.createElement('button'); del.className = 'del'; del.textContent = 'Delete';
    del.onclick = async () => { await api(`/api/tasks/${t.id}`, { method: 'DELETE' }); loadTasks(); };
    li.append(cb, span, del); ul.append(li);
  }
}

async function loadRuntime() {
  const dot = $('#health-dot'), txt = $('#health-text');
  try {
    const [h, r, info] = await Promise.all([fetch('/health'), fetch('/ready'), api('/api/info').then(x => x.json())]);
    const up = h.ok && r.ok;
    dot.className = 'dot ' + (up ? 'up' : 'down');
    txt.textContent = up ? 'Healthy and ready' : (h.ok ? 'Alive but not ready' : 'Unhealthy');
    const rows = { Version: info.version, Environment: info.env, Hostname: info.hostname, PID: info.pid,
      Node: info.node, 'Uptime (s)': info.uptimeSeconds, Storage: info.persistence };
    $('#info').innerHTML = '';
    for (const [k, v] of Object.entries(rows)) {
      const dt = document.createElement('dt'), dd = document.createElement('dd');
      dt.textContent = k; dd.textContent = v; $('#info').append(dt, dd);
    }
    $('#chaos').hidden = !info.chaosEnabled;
  } catch {
    dot.className = 'dot down'; txt.textContent = 'Backend unreachable'; $('#info').innerHTML = '';
  }
}

$('#task-form').onsubmit = async e => {
  e.preventDefault();
  const title = $('#task-input').value.trim();
  if (!title) return;
  await api('/api/tasks', { method: 'POST', body: JSON.stringify({ title }) });
  $('#task-input').value = ''; loadTasks();
};
$('#refresh').onclick = loadRuntime;

document.querySelectorAll('[data-chaos]').forEach(btn => {
  btn.onclick = async () => {
    const a = btn.dataset.chaos, out = $('#chaos-out');
    out.textContent = 'Sending…';
    const url = { crash: '/api/chaos/crash', unready: '/api/chaos/unready', slow: '/api/chaos/slow?ms=3000', load: '/api/chaos/load?ms=2000' }[a];
    try {
      const res = await fetch(url, { method: ['crash', 'unready'].includes(a) ? 'POST' : 'GET' });
      out.textContent = JSON.stringify(await res.json());
    } catch { out.textContent = 'Request failed. The process may have crashed.'; }
    setTimeout(loadRuntime, 1500);
  };
});

loadTasks(); loadRuntime(); setInterval(loadRuntime, 10000);
