const express = require('express');
const fs      = require('fs');
const path    = require('path');

const CONFIG_PATH    = path.join(__dirname, 'config.json');
const APPSTATE_PATH  = path.join(__dirname, 'appstate.json');
const PUBLIC_DIR     = path.join(__dirname, 'public');

const MAX_LOGS = 300;
const recentLogs = [];

// ── أمان: الحصول على API Key من متغيرات البيئة ──────────────────
const DASHBOARD_TOKEN = process.env.DASHBOARD_TOKEN || null;
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:4000').split(',');

if (!DASHBOARD_TOKEN) {
  console.warn('⚠️ تحذير: DASHBOARD_TOKEN غير معرّف. قم بتعيينه في متغيرات البيئة.');
}

function pushLog(level, msg) {
  recentLogs.push({ t: Date.now(), level, msg });
  if (recentLogs.length > MAX_LOGS) recentLogs.shift();
}

let _state = {
  api:        null,
  online:     false,
  startTime:  Date.now(),
  adminMod:   null,
  engineMod:  null,
  autoMsgMod: null,
  antibanMod: null,
};

function init(state) { Object.assign(_state, state); }

function start() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));
  app.use(express.static(PUBLIC_DIR));

  // ── CORS: محدود لأصول معينة فقط ─────────────────────────────────
  app.use((req, res, next) => {
    const origin = req.headers.origin || req.headers.host;
    if (ALLOWED_ORIGINS.includes(origin) || ALLOWED_ORIGINS.includes('*')) {
      res.header('Access-Control-Allow-Origin', origin);
    }
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-token');
    if (req.method === 'OPTIONS') return res.status(200).end();
    next();
  });

  const cfg = () => JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));

  // ── المصادقة: تحقق من API Token ──────────────────────────────────
  const auth = (req, res, next) => {
    const token = req.headers['x-token'] || req.query.token || req.body.token;
    
    // إذا لم يكن هناك token معرّف، فالقفل مفعّل
    if (!DASHBOARD_TOKEN) {
      return res.status(503).json({ error: 'لم يتم تكوين نظام المصادقة بعد' });
    }

    // تحقق من التطابق
    if (!token || token !== DASHBOARD_TOKEN) {
      pushLog('SECURITY', 'محاولة وصول غير مصرح: ' + (req.ip || 'unknown'));
      return res.status(401).json({ error: 'غير مصرح — Token غير صحيح أو مفقود' });
    }

    next();
  };

  function requireApi(res) {
    if (!_state.api || !_state.online) {
      res.status(503).json({ error: 'البوت غير متصل' });
      return false;
    }
    return true;
  }

  // ── التحقق من صحة البيانات ───────────────────────────────────────
  function validateID(id) {
    return /^\d+$/.test(String(id));
  }

  function validateMessage(msg) {
    return typeof msg === 'string' && msg.length > 0 && msg.length <= 4096;
  }

  // ── Status ────────────────────────────────────────────────────────
  app.get('/dash/status', (req, res) => {
    const c = cfg();
    const ab = _state.antibanMod;
    res.json({
      online:   _state.online,
      uptime:   Math.floor((Date.now() - _state.startTime) / 1000),
      prefix:   c.prefix,
      botName:  c.botName,
      mem:      Math.round(process.memoryUsage().rss / 1024 / 1024),
      antiban:  ab ? ab.stats() : null,
    });
  });

  // ── Logs ──────────────────────────────────────────────────────────
  app.get('/dash/logs', auth, (req, res) => {
    const { level, n = 100 } = req.query;
    let logs = recentLogs.slice(-Number(n));
    if (level) logs = logs.filter(l => l.level === level.toUpperCase());
    res.json(logs);
  });

  // ── Config read / write ───────────────────────────────────────────
  app.get('/dash/config', auth, (req, res) => {
    try {
      const c = cfg();
      delete c.dashboardToken;
      res.json(c);
    } catch (e) { 
      pushLog('ERROR', 'config read: ' + e.message);
      res.status(500).json({ error: e.message }); 
    }
  });

  app.post('/dash/config', auth, (req, res) => {
    try {
      const cur = cfg();
      const safe = { ...cur, ...req.body };
      safe.dashboardToken = cur.dashboardToken;
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(safe, null, 2));
      pushLog('BOT', 'Dashboard: config updated');
      res.json({ ok: true });
    } catch (e) { 
      pushLog('ERROR', 'config write: ' + e.message);
      res.status(500).json({ error: e.message }); 
    }
  });

  // ── Cookies ───────────────────────────────────────────────────────
  app.post('/dash/cookies', auth, (req, res) => {
    try {
      const { cookies } = req.body;
      if (!Array.isArray(cookies) || !cookies.length)
        return res.status(400).json({ error: 'يجب أن تكون الكوكيز مصفوفة JSON غير فارغة' });
      fs.writeFileSync(APPSTATE_PATH, JSON.stringify(cookies, null, 2));
      pushLog('BOT', 'Dashboard: cookies updated');
      res.json({ ok: true, count: cookies.length });
    } catch (e) { 
      pushLog('ERROR', 'cookies write: ' + e.message);
      res.status(500).json({ error: e.message }); 
    }
  });

  // ── Admins ────────────────────────────────────────────────────────
  app.get('/dash/admins', auth, (req, res) => {
    const m = _state.adminMod;
    res.json({ superAdmins: cfg().superAdmins || [], runtimeAdmins: m ? m.getAdmins() : [] });
  });

  app.post('/dash/admins/add', auth, (req, res) => {
    const { id } = req.body;
    if (!id || !validateID(id)) return res.status(400).json({ error: 'Invalid ID format' });
    if (_state.adminMod) _state.adminMod.promote(String(id));
    pushLog('BOT', 'Dashboard: admin added ' + id);
    res.json({ ok: true });
  });

  app.post('/dash/admins/remove', auth, (req, res) => {
    const { id } = req.body;
    if (!id || !validateID(id)) return res.status(400).json({ error: 'Invalid ID format' });
    if (_state.adminMod) _state.adminMod.demote(String(id));
    pushLog('BOT', 'Dashboard: admin removed ' + id);
    res.json({ ok: true });
  });

  // ── Send message (remote control) ─────────────────────────────────
  app.post('/dash/send', auth, (req, res) => {
    const { threadID, message } = req.body;
    if (!threadID || !validateID(threadID)) return res.status(400).json({ error: 'Invalid threadID' });
    if (!message || !validateMessage(message)) return res.status(400).json({ error: 'Invalid message' });
    if (!requireApi(res)) return;
    try {
      const r = _state.api.sendMessage(message, threadID);
      if (r && typeof r.then === 'function') r.catch(() => {});
      pushLog('BOT', 'Dashboard: message sent to ' + threadID);
      res.json({ ok: true });
    } catch (e) { 
      pushLog('ERROR', 'send message: ' + e.message);
      res.status(500).json({ error: e.message }); 
    }
  });

  // ── Engine control ────────────────────────────────────────────────
  app.get('/dash/engine', auth, (req, res) => {
    const e = _state.engineMod;
    if (!e) return res.json({ available: false });
    res.json({ available: true, ...e.getState() });
  });

  app.post('/dash/engine', auth, (req, res) => {
    const e = _state.engineMod;
    if (!e) return res.status(503).json({ error: 'Engine not available' });
    const { action, message, seconds, threadID } = req.body;
    if (action === 'start') {
      if (!threadID || !validateID(threadID)) return res.status(400).json({ error: 'Invalid threadID' });
      e.remoteStart(threadID);
    }
    if (action === 'stop')     e.remoteStop();
    if (message !== undefined && validateMessage(message)) e.setMessage(message);
    if (seconds  !== undefined && /^\d+$/.test(seconds)) e.setSeconds(Number(seconds));
    pushLog('BOT', 'Dashboard: engine ' + action);
    res.json({ ok: true });
  });

  // ── Auto messages ─────────────────────────────────────────────────
  app.get('/dash/automsg', auth, (req, res) => {
    const a = _state.autoMsgMod;
    res.json(a ? a.list() : []);
  });

  app.delete('/dash/automsg/:id', auth, (req, res) => {
    const a = _state.autoMsgMod;
    if (!a) return res.status(503).json({ error: 'Not available' });
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid ID' });
    res.json({ ok: a.remove(id) });
  });

  // ── Anti-ban control ──────────────────────────────────────────────
  app.get('/dash/antiban', auth, (req, res) => {
    const ab = _state.antibanMod;
    if (!ab) return res.json({ available: false });
    res.json({ available: true, ...ab.stats(), pausedFor: ab.pausedFor() });
  });

  app.post('/dash/antiban', auth, (req, res) => {
    const ab = _state.antibanMod;
    if (!ab) return res.status(503).json({ error: 'Not available' });
    const { action, ms } = req.body;
    if (action === 'pause') {
      const pauseMs = ms && /^\d+$/.test(ms) ? Number(ms) : 3 * 60 * 1000;
      ab.pause(pauseMs);
    }
    if (action === 'resume') ab.resume();
    pushLog('BOT', 'Dashboard: antiban ' + action);
    res.json({ ok: true });
  });

  // ── Pending message requests ──────────────────────────────────────
  app.get('/dash/pending', auth, async (req, res) => {
    if (!requireApi(res)) return;
    try {
      const autoAccept = require('./commands/autoAccept');
      const list = await autoAccept.getPendingList(_state.api);
      res.json(list);
    } catch (e) { 
      pushLog('ERROR', 'pending list: ' + e.message);
      res.status(500).json({ error: e.message }); 
    }
  });

  app.post('/dash/pending/accept', auth, async (req, res) => {
    const { threadID } = req.body;
    if (!threadID || !validateID(threadID)) return res.status(400).json({ error: 'Invalid threadID' });
    if (!requireApi(res)) return;
    try {
      const autoAccept = require('./commands/autoAccept');
      const r = await autoAccept.acceptOne(_state.api, threadID);
      pushLog('BOT', 'Dashboard: accepted ' + threadID);
      res.json(r);
    } catch (e) { 
      pushLog('ERROR', 'accept pending: ' + e.message);
      res.status(500).json({ error: e.message }); 
    }
  });

  app.post('/dash/pending/reject', auth, async (req, res) => {
    const { threadID } = req.body;
    if (!threadID || !validateID(threadID)) return res.status(400).json({ error: 'Invalid threadID' });
    if (!requireApi(res)) return;
    try {
      const autoAccept = require('./commands/autoAccept');
      const r = await autoAccept.rejectOne(_state.api, threadID);
      pushLog('BOT', 'Dashboard: rejected ' + threadID);
      res.json(r);
    } catch (e) { 
      pushLog('ERROR', 'reject pending: ' + e.message);
      res.status(500).json({ error: e.message }); 
    }
  });

  app.post('/dash/pending/accept-all', auth, async (req, res) => {
    if (!requireApi(res)) return;
    try {
      const autoAccept = require('./commands/autoAccept');
      const list = await autoAccept.getPendingList(_state.api);
      let accepted = 0, failed = 0;
      for (const t of list) {
        const r = await autoAccept.acceptOne(_state.api, t.threadID);
        if (r.ok) accepted++; else failed++;
        await new Promise(x => setTimeout(x, 2000));
      }
      pushLog('BOT', 'Dashboard: accept-all completed - ' + accepted + '/' + list.length);
      res.json({ ok: true, accepted, failed, total: list.length });
    } catch (e) { 
      pushLog('ERROR', 'accept-all: ' + e.message);
      res.status(500).json({ error: e.message }); 
    }
  });

  // ── Nickname management ───────────────────────────────────────────
  app.post('/dash/nickname/set', auth, async (req, res) => {
    const { threadID, userID, nick } = req.body;
    if (!threadID || !validateID(threadID)) return res.status(400).json({ error: 'Invalid threadID' });
    if (!userID || !validateID(userID)) return res.status(400).json({ error: 'Invalid userID' });
    if (!requireApi(res)) return;
    try {
      const nickProtect = require('./utils/nickProtect');
      if (nickProtect.isProtected(threadID, String(userID)))
        return res.status(403).json({ error: 'الكنية محمية — أزل الحماية أولاً' });
      await _state.api.nickname(nick || '', threadID, String(userID));
      pushLog('BOT', 'Dashboard: set nick for ' + userID);
      res.json({ ok: true });
    } catch (e) { 
      pushLog('ERROR', 'set nick: ' + e.message);
      res.status(500).json({ error: e.message }); 
    }
  });

  const _nickJobStatus = { running: false, done: 0, total: 0, fail: 0, skipped: 0, log: [] };

  app.get('/dash/nickname/job', auth, (req, res) => {
    res.json({ ..._nickJobStatus });
  });

  app.post('/dash/nickname/set-all', auth, async (req, res) => {
    if (_nickJobStatus.running)
      return res.status(409).json({ error: 'يوجد عملية جارية بالفعل' });
    const { threadID, nick, delay, batchSize, batchDelay } = req.body;
    if (!threadID || !validateID(threadID)) return res.status(400).json({ error: 'Invalid threadID' });
    if (!requireApi(res)) return;

    const nickMs      = Math.max(500, Number(delay)      || 3000);
    const batch       = Math.max(1,   Number(batchSize)  || 5);
    const batchMs     = Math.max(5000,Number(batchDelay) || 12000);

    res.json({ ok: true, msg: 'بدأت العملية — تابع التقدم عبر /dash/nickname/job' });

    (async () => {
      _nickJobStatus.running = true;
      _nickJobStatus.done = _nickJobStatus.fail = _nickJobStatus.skipped = 0;
      _nickJobStatus.log = [];
      try {
        const { getThread } = require('./_nick_helper');
        const { setNick }   = require('./_nick_helper');
        const nickProtect   = require('./utils/nickProtect');
        const info = await getThread(_state.api, threadID);
        const members = info && info.participantIDs ? info.participantIDs : [];
        _nickJobStatus.total = members.length;

        for (let i = 0; i < members.length; i++) {
          const uid = String(members[i]);
          if (nickProtect.isProtected(threadID, uid)) {
            _nickJobStatus.skipped++;
            _nickJobStatus.log.push('⏭ تجاهل (محمي): ' + uid);
            continue;
          }
          if (i > 0 && i % batch === 0) {
            await new Promise(r => setTimeout(r, batchMs));
          } else if (i > 0) {
            await new Promise(r => setTimeout(r, nickMs));
          }
          let ok = false;
          for (let attempt = 0; attempt < 3; attempt++) {
            ok = await setNick(_state.api, nick || '', threadID, uid);
            if (ok) break;
            if (attempt < 2) await new Promise(r => setTimeout(r, 4000 * (attempt + 1)));
          }
          if (ok) {
            _nickJobStatus.done++;
            _nickJobStatus.log.push('✅ ' + uid);
          } else {
            _nickJobStatus.fail++;
            _nickJobStatus.log.push('❌ فشل: ' + uid);
          }
          pushLog('BOT', 'set-all nick ' + _nickJobStatus.done + '/' + members.length);
        }
      } catch (e) {
        _nickJobStatus.log.push('خطأ: ' + e.message);
        pushLog('ERROR', 'set-all nick: ' + e.message);
      } finally {
        _nickJobStatus.running = false;
      }
    })();
  });

  // ── Group name management ─────────────────────────────────────────
  app.post('/dash/groupname/set', auth, async (req, res) => {
    const { threadID, name, protect } = req.body;
    if (!threadID || !validateID(threadID)) return res.status(400).json({ error: 'Invalid threadID' });
    if (!name || typeof name !== 'string') return res.status(400).json({ error: 'Invalid name' });
    if (!requireApi(res)) return;
    try {
      await _state.api.setTitle(name, threadID);
      const groupProtect = require('./utils/groupNameProtect');
      if (protect) {
        groupProtect.protect(threadID, name);
        pushLog('BOT', 'Dashboard: set+protect group name');
      } else {
        if (groupProtect.isProtected(threadID)) groupProtect.unprotect(threadID);
        pushLog('BOT', 'Dashboard: set group name');
      }
      res.json({ ok: true, protected: !!protect });
    } catch (e) { 
      pushLog('ERROR', 'set group name: ' + e.message);
      res.status(500).json({ error: e.message }); 
    }
  });

  // ── Nick protection management ────────────────────────────────────
  app.get('/dash/nickprotect', auth, (req, res) => {
    try {
      const nickProtect = require('./utils/nickProtect');
      const { threadID } = req.query;
      if (threadID) {
        if (!validateID(threadID)) return res.status(400).json({ error: 'Invalid threadID' });
        const list = nickProtect.listProtected(threadID);
        return res.json(list.map(([uid, nick]) => ({ uid, nick })));
      }
      const FILE = path.join(__dirname, 'data', 'nickProtect.json');
      const db = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, 'utf8')) : {};
      const result = [];
      for (const [tid, members] of Object.entries(db)) {
        for (const [uid, nick] of Object.entries(members)) {
          result.push({ threadID: tid, uid, nick });
        }
      }
      res.json(result);
    } catch (e) { 
      pushLog('ERROR', 'nickprotect list: ' + e.message);
      res.status(500).json({ error: e.message }); 
    }
  });

  app.post('/dash/nickprotect/add', auth, async (req, res) => {
    const { threadID, userID, nick } = req.body;
    if (!threadID || !validateID(threadID)) return res.status(400).json({ error: 'Invalid threadID' });
    if (!userID || !validateID(userID)) return res.status(400).json({ error: 'Invalid userID' });
    try {
      const nickProtect = require('./utils/nickProtect');
      let resolvedNick = nick || '';
      if (!resolvedNick && _state.api && _state.online) {
        try {
          const { getThread } = require('./_nick_helper');
          const info = await getThread(_state.api, threadID);
          resolvedNick = (info && info.nicknames && info.nicknames[userID]) || '';
        } catch (_) {}
      }
      nickProtect.protect(threadID, String(userID), resolvedNick);
      pushLog('BOT', 'Dashboard: protect nick');
      res.json({ ok: true, nick: resolvedNick });
    } catch (e) { 
      pushLog('ERROR', 'protect nick: ' + e.message);
      res.status(500).json({ error: e.message }); 
    }
  });

  app.post('/dash/nickprotect/remove', auth, (req, res) => {
    const { threadID, userID } = req.body;
    if (!threadID || !validateID(threadID)) return res.status(400).json({ error: 'Invalid threadID' });
    if (!userID || !validateID(userID)) return res.status(400).json({ error: 'Invalid userID' });
    try {
      const nickProtect = require('./utils/nickProtect');
      nickProtect.unprotect(threadID, String(userID));
      pushLog('BOT', 'Dashboard: unprotect nick');
      res.json({ ok: true });
    } catch (e) { 
      pushLog('ERROR', 'unprotect nick: ' + e.message);
      res.status(500).json({ error: e.message }); 
    }
  });

  // ── Group name protection management ─────────────────────────────
  app.get('/dash/groupprotect', auth, (req, res) => {
    try {
      const FILE = path.join(__dirname, 'data', 'groupNameProtect.json');
      const db = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, 'utf8')) : {};
      const result = Object.entries(db).map(([tid, name]) => ({ threadID: tid, name }));
      res.json(result);
    } catch (e) { 
      pushLog('ERROR', 'groupprotect list: ' + e.message);
      res.status(500).json({ error: e.message }); 
    }
  });

  app.post('/dash/groupprotect/set', auth, (req, res) => {
    const { threadID, name } = req.body;
    if (!threadID || !validateID(threadID)) return res.status(400).json({ error: 'Invalid threadID' });
    if (!name || typeof name !== 'string') return res.status(400).json({ error: 'Invalid name' });
    try {
      const groupProtect = require('./utils/groupNameProtect');
      groupProtect.protect(threadID, name);
      pushLog('BOT', 'Dashboard: protect group name');
      res.json({ ok: true });
    } catch (e) { 
      pushLog('ERROR', 'protect group: ' + e.message);
      res.status(500).json({ error: e.message }); 
    }
  });

  app.post('/dash/groupprotect/remove', auth, (req, res) => {
    const { threadID } = req.body;
    if (!threadID || !validateID(threadID)) return res.status(400).json({ error: 'Invalid threadID' });
    try {
      const groupProtect = require('./utils/groupNameProtect');
      groupProtect.unprotect(threadID);
      pushLog('BOT', 'Dashboard: unprotect group name');
      res.json({ ok: true });
    } catch (e) { 
      pushLog('ERROR', 'unprotect group: ' + e.message);
      res.status(500).json({ error: e.message }); 
    }
  });

  // ── Nick speed settings ───────────────────────────────────────────
  app.get('/dash/nickspeed', auth, (req, res) => {
    try {
      const c = cfg();
      res.json({
        nickDelay:      (c.antiban && c.antiban.nickDelay)      || 3000,
        nickBatchSize:  (c.antiban && c.antiban.nickBatchSize)  || 5,
        nickBatchDelay: (c.antiban && c.antiban.nickBatchDelay) || 12000,
        tortureDelay:   (c.antiban && c.antiban.tortureDelay)   || 3500,
      });
    } catch (e) { 
      pushLog('ERROR', 'nickspeed get: ' + e.message);
      res.status(500).json({ error: e.message }); 
    }
  });

  app.post('/dash/nickspeed', auth, (req, res) => {
    try {
      const cur = cfg();
      if (!cur.antiban) cur.antiban = {};
      if (req.body.nickDelay      != null) cur.antiban.nickDelay      = Math.max(500,  Number(req.body.nickDelay));
      if (req.body.nickBatchSize  != null) cur.antiban.nickBatchSize  = Math.max(1,    Number(req.body.nickBatchSize));
      if (req.body.nickBatchDelay != null) cur.antiban.nickBatchDelay = Math.max(5000, Number(req.body.nickBatchDelay));
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(cur, null, 2));
      pushLog('BOT', 'Dashboard: nickspeed updated');
      res.json({ ok: true, antiban: cur.antiban });
    } catch (e) { 
      pushLog('ERROR', 'nickspeed set: ' + e.message);
      res.status(500).json({ error: e.message }); 
    }
  });

  // ── Bot restart hint ──────────────────────────────────────────────
  app.post('/dash/restart', auth, (req, res) => {
    res.json({ ok: true, msg: 'يتطلب إعادة تشغيل البوت يدوياً على المنصة.' });
  });

  // ── Serve dashboard ───────────────────────────────────────────────
  app.get('/', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'index.html')));
  app.get('/dash', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'index.html')));

  const PORT = process.env.DASH_PORT || 4000;
  app.listen(PORT, () => console.log('[Dashboard] http://localhost:' + PORT));
}

module.exports = { start, init, pushLog };
