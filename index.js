const { login }   = require('ws3-fca');
const fs          = require('fs');
const path        = require('path');
const config      = require('./config.json');
const log         = require('./utils/logger');
const admin       = require('./utils/admin');

const engine   = require('./commands/engine');
const lock     = require('./commands/lock');
const nickname = require('./commands/nickname');
const nicknames= require('./commands/nicknames');
const promote  = require('./commands/promote');
const demote   = require('./commands/demote');
const automsg  = require('./commands/automsg');
const ping     = require('./commands/ping');
const server   = require('./commands/server');
const help     = require('./commands/help');

const APPSTATE = path.join(__dirname, 'appstate.json');
const P        = config.prefix;
let reconnects = 0;

function rand(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }
function wait(ms)   { return new Promise(r => setTimeout(r, ms)); }

function loadState() {
  try {
    const d = JSON.parse(fs.readFileSync(APPSTATE, 'utf8'));
    return Array.isArray(d) && d.length ? d : null;
  } catch { return null; }
}

function saveState(api) {
  try { fs.writeFileSync(APPSTATE, JSON.stringify(api.getAppState(), null, 2)); } catch {}
}

// ── موجّه الأوامر الرئيسي ───────────────────────────────────
async function onMessage(event, api) {
  const body = (event.body || '').trim();
  if (!body.startsWith(P)) return;

  const text  = body.slice(P.length).trim();
  const parts = text.split(/\s+/);
  const cmd   = (parts[0] || '').toLowerCase();
  const args  = parts.slice(1);
  const { threadID, senderID } = event;

  log.bot('[' + cmd + '] من ' + senderID);

  // تأخير طبيعي قبل الرد (يبدو بشرياً)
  await wait(rand(500, 1500));

  // ── أوامر متاحة للجميع ─────────────────────
  if (cmd === 'ping' || cmd === 'بينج')
    return ping.handle(event, api);

  if (cmd === 'اوامر' || cmd === 'أوامر' || cmd === 'help')
    return help.handle(event, api, admin.getRole(senderID));

  if (cmd === 'سيرفر' || cmd === 'server')
    return server.handle(event, api, 'info');

  if (cmd === 'ابتيم' || cmd === 'uptime')
    return server.handle(event, api, 'uptime');

  // ── أوامر المشرف ────────────────────────────
  const adminOnly = () => api.sendMessage('❌ ليس لديك صلاحية.', threadID);
  const superOnly = () => api.sendMessage('❌ فقط سوبر أدمن.', threadID);

  if (cmd === 'محرك' || cmd === 'engine') {
    if (!admin.isAdmin(senderID)) return adminOnly();
    return engine.handle(event, api, args);
  }

  if (cmd === 'قفل' || cmd === 'lock') {
    if (!admin.isAdmin(senderID)) return adminOnly();
    return lock.handle(event, api, args);
  }

  if (cmd === 'كنية' || cmd === 'nickname') {
    if (!admin.isAdmin(senderID)) return adminOnly();
    return nickname.handle(event, api, args);
  }

  if (cmd === 'كنيات' || cmd === 'nicknames') {
    if (!admin.isAdmin(senderID)) return adminOnly();
    return nicknames.handle(event, api, args);
  }

  if (cmd === 'رسائل' || cmd === 'automsg') {
    if (!admin.isAdmin(senderID)) return adminOnly();
    return automsg.handle(event, api, args);
  }

  // ── أوامر سوبر أدمن ─────────────────────────
  if (cmd === 'رفع' || cmd === 'promote') {
    if (!admin.isSuperAdmin(senderID)) return superOnly();
    return promote.handle(event, api, args);
  }

  if (cmd === 'اخفاض' || cmd === 'خفض' || cmd === 'demote') {
    if (!admin.isSuperAdmin(senderID)) return superOnly();
    return demote.handle(event, api, args);
  }
}

// ── تشغيل البوت ────────────────────────────────────────────
async function startBot() {
  const state = loadState();
  if (!state) {
    log.error('appstate.json غير صالح أو مفقود. جدّد الكوكيز.');
    return;
  }

  const delay = rand(3000, 7000);
  log.info('انتظار ' + (delay/1000).toFixed(1) + 'ث...');
  await wait(delay);
  log.info('جاري تسجيل الدخول...');

  login({
    appState: state,
    logLevel: 'error',
    online:          true,
    selfListen:      false,
    listenEvents:    true,
    autoMarkRead:    false,
    autoMarkDelivery:false,
    userAgent: 'Mozilla/5.0 (Linux; Android 11; SM-A325F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.6261.119 Mobile Safari/537.36',
  }, (err, api) => {
    if (err) {
      const msg = err.error || err.message || JSON.stringify(err);
      log.error('فشل تسجيل الدخول: ' + msg);
      if (String(msg).includes('checkpoint'))
        return log.error('⚠️ الحساب محتاج تحقق. جدّد الكوكيز يدوياً.');
      return scheduleReconnect();
    }

    reconnects = 0;
    engine.setApi(api);
    automsg.setApi(api);
    server.setStartTime(Date.now());
    saveState(api);

    log.success('البوت يعمل! البادئة: ' + P);

    // حفظ تلقائي كل 10 دقائق
    setInterval(() => saveState(api), 10 * 60 * 1000);

    api.listenMqtt((listenErr, event) => {
      if (listenErr) {
        log.error('خطأ في الاستماع: ' + JSON.stringify(listenErr));
        return scheduleReconnect();
      }
      if (!event) return;

      if (event.type === 'message' || event.type === 'message_reply') {
        // تحقق من القفل
        if (lock.isLocked(event.threadID) && !admin.isAdmin(event.senderID)) return;
        // تتبع النشاط للمحرك الذكي
        engine.markActivity(event.threadID);
        onMessage(event, api).catch(e => log.error('onMessage خطأ: ' + e.message));
      }
    });
  });
}

async function scheduleReconnect() {
  reconnects++;
  const delay = Math.min(reconnects * 5000, 30000) + rand(0, 3000);
  log.warn('إعادة اتصال بعد ' + (delay/1000).toFixed(1) + 'ث (محاولة ' + reconnects + ')');
  await wait(delay);
  startBot();
}

process.on('uncaughtException',  e => log.error('Uncaught: ' + e.message));
process.on('unhandledRejection', e => log.error('Unhandled: ' + (e?.message || JSON.stringify(e))));

log.info('='.repeat(45));
log.info('  ' + config.botName + ' — Messenger Bot');
log.info('='.repeat(45));
startBot();
