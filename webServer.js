const express = require('express');
const fs      = require('fs');
const path    = require('path');

const CONFIG_PATH    = path.join(__dirname, 'config.json');
const APPSTATE_PATH  = path.join(__dirname, 'appstate.json');
const PUBLIC_DIR     = path.join(__dirname, 'public');

const MAX_LOGS = 300;
const recentLogs = [];

function pushLog(level, msg) {
  recentLogs.push({ t: Date.now(), level, msg });
  if (recentLogs.length > MAX_LOGS) recentLogs.shift();
}

let _state = {
  api:       null,
  online:    false,
  startTime: Date.now(),
  adminMod:  null,
  engineMod: null,
  autoMsgMod:null,
};

function init(state) { Object.assign(_state, state); }

function start() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));
  app.use(express.static(PUBLIC_DIR));

  const cfg = () => JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));

  // ── Auth middleware ──────────────────────────────────────────
  const auth = (req, res, next) => {
    const tok = req.headers['x-token'] || req.query.token;
    const expected = cfg().dashboardToken || 'bot123';
    if (tok !== expected) return res.status(401).json({ error: 'Unauthorized' });
    next();
  };

  // ── Status ───────────────────────────────────────────────────
  app.get('/dash/status', (req, res) => {
    const c = cfg();
    res.json({
      online:   _state.online,
      uptime:   Math.floor((Date.now() - _state.startTime) / 1000),
      prefix:   c.prefix,
      botName:  c.botName,
      mem:      Math.round(process.memoryUsage().rss / 1024 / 1024),
    });
  });

  // ── Logs ─────────────────────────────────────────────────────
  app.get('/dash/logs', auth, (req, res) => {
    const { level, n = 100 } = req.query;
    let logs = recentLogs.slice(-Number(n));
    if (level) logs = logs.filter(l => l.level === level.toUpperCase());
    res.json(logs);
  });

  // ── Config read / write ──────────────────────────────────────
  app.get('/dash/config', auth, (req, res) => {
    try {
      const c = cfg(); delete c.dashboardToken;
      res.json(c);
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.post('/dash/config', auth, (req, res) => {
    try {
      const cur = cfg();
      const safe = { ...cur, ...req.body };
      safe.dashboardToken = cur.dashboardToken;      // protect token
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(safe, null, 2));
      res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ── Cookies ──────────────────────────────────────────────────
  app.post('/dash/cookies', auth, (req, res) => {
    try {
      const { cookies } = req.body;
      if (!Array.isArray(cookies) || !cookies.length)
        return res.status(400).json({ error: 'يجب أن تكون الكوكيز مصفوفة JSON غير فارغة' });
      fs.writeFileSync(APPSTATE_PATH, JSON.stringify(cookies, null, 2));
      res.json({ ok: true, count: cookies.length });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ── Admins ───────────────────────────────────────────────────
  app.get('/dash/admins', auth, (req, res) => {
    const m = _state.adminMod;
    res.json({ superAdmins: cfg().superAdmins || [], runtimeAdmins: m ? m.getAdmins() : [] });
  });

  app.post('/dash/admins/add', auth, (req, res) => {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'Missing id' });
    if (_state.adminMod) _state.adminMod.promote(String(id));
    res.json({ ok: true });
  });

  app.post('/dash/admins/remove', auth, (req, res) => {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'Missing id' });
    if (_state.adminMod) _state.adminMod.demote(String(id));
    res.json({ ok: true });
  });

  // ── Send message (remote control) ────────────────────────────
  app.post('/dash/send', auth, (req, res) => {
    const { threadID, message } = req.body;
    if (!threadID || !message) return res.status(400).json({ error: 'Missing threadID or message' });
    if (!_state.api || !_state.online) return res.status(503).json({ error: 'Bot offline' });
    try {
      const r = _state.api.sendMessage(message, threadID);
      if (r && typeof r.then === 'function') r.catch(() => {});
      res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ── Engine control ───────────────────────────────────────────
  app.get('/dash/engine', auth, (req, res) => {
    const e = _state.engineMod;
    if (!e) return res.json({ available: false });
    res.json({ available: true, ...e.getState() });
  });

  app.post('/dash/engine', auth, (req, res) => {
    const e = _state.engineMod;
    if (!e) return res.status(503).json({ error: 'Engine not available' });
    const { action, message, seconds } = req.body;
    if (action === 'start')   e.remoteStart(req.body.threadID);
    if (action === 'stop')    e.remoteStop();
    if (message !== undefined) e.setMessage(message);
    if (seconds  !== undefined) e.setSeconds(Number(seconds));
    res.json({ ok: true });
  });

  // ── Auto messages ────────────────────────────────────────────
  app.get('/dash/automsg', auth, (req, res) => {
    const a = _state.autoMsgMod;
    res.json(a ? a.list() : []);
  });

  app.delete('/dash/automsg/:id', auth, (req, res) => {
    const a = _state.autoMsgMod;
    if (!a) return res.status(503).json({ error: 'Not available' });
    res.json({ ok: a.remove(Number(req.params.id)) });
  });

  // ── Bot restart hint ─────────────────────────────────────────
  app.post('/dash/restart', auth, (req, res) => {
    res.json({ ok: true, msg: 'يتطلب إعادة تشغيل البوت يدوياً على المنصة.' });
  });

  // ── Serve dashboard ──────────────────────────────────────────
  app.get('/', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'index.html')));
  app.get('/dash', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'index.html')));

  const PORT = process.env.DASH_PORT || 4000;
  app.listen(PORT, () => console.log('[Dashboard] http://localhost:' + PORT));
}

module.exports = { start, init, pushLog };
