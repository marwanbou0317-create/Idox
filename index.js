4a1f5c98229a9a573ea9ed63da75919ca3dccd67
const { login }   = require('ws3-fca');
const fs          = require('fs');
const path        = require('path');
const config      = require('./config.json');
const log         = require('./utils/logger');
const admin       = require('./utils/admin');
const rl          = require('./utils/rateLimiter');
const antiban     = require('./utils/antiban');
const { jitter }  = require('./utils/actionQueue');
const nickProtectUtils     = require('./utils/nickProtect');
const groupNameProtectUtils = require('./utils/groupNameProtect');

const engine      = require('./commands/engine');
const lock        = require('./commands/lock');
const nickname    = require('./commands/nickname');
const nicknames   = require('./commands/nicknames');
const nickProtect = require('./commands/nickProtect');
const groupProtect = require('./commands/groupProtect');
const promote     = require('./commands/promote');
const demote      = require('./commands/demote');
const automsg     = require('./commands/automsg');
const ping        = require('./commands/ping');
const server      = require('./commands/server');
const help        = require('./commands/help');
const abad        = require('./commands/abad');
const torture     = require('./commands/torture');
const autoAccept  = require('./commands/autoAccept');
const AM          = require('./utils/autoMessages');
const web         = require('./webServer');

const APPSTATE = path.join(__dirname, 'appstate.json');
const P        = config.prefix || '/';
let reconnects = 0;
let currentApi = null;

const MQTT_TIMEOUT = 8 * 60 * 1000;
let lastMqttEvent  = Date.now();
let watchdogTimer  = null;

function resetWatchdog() { lastMqttEvent = Date.now(); }

function startWatchdog() {
  if (watchdogTimer) clearInterval(watchdogTimer);
  watchdogTimer = setInterval(() => {
    const silence = Date.now() - lastMqttEvent;
    if (silence > MQTT_TIMEOUT && currentApi) {
      log.warn('⚠️ MQTT صامت منذ ' + Math.round(silence / 60000) + ' دقيقة — إعادة اتصال...');
      web.pushLog('WARN', 'MQTT silent ' + Math.round(silence / 60000) + 'min — reconnecting');
      currentApi = null;
      scheduleReconnect();
    }
  }, 2 * 60 * 1000);
}

function stopWatchdog() {
  if (watchdogTimer) { clearInterval(watchdogTimer); watchdogTimer = null; }
}

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

web.init({
  get api()    { return currentApi; },
  get online() { return !!currentApi; },
  startTime:   Date.now(),
  adminMod:    admin,
  engineMod:   engine,
  autoMsgMod:  AM,
  antibanMod:  antiban,
});
web.start();

const COOLDOWNS = config.cooldowns || {};
function getCooldown(cmd) {
  return COOLDOWNS[cmd] ?? COOLDOWNS['default'] ?? 5;
}

async function onMessage(event, api) {
  resetWatchdog();
  const body = (event.body || '').trim();
  if (!body.startsWith(P)) return;

  if (antiban.isPaused()) {
    const rem = antiban.pausedFor();
    return api.sendMessage('⏸ البوت في وضع الحماية. ارجع بعد ' + rem + 'ث.', event.threadID);
  }

  const text  = body.slice(P.length).trim();
  const parts = text.split(/s+/);
  const cmd   = (parts[0] || '').toLowerCase();
  const args  = parts.slice(1);
  const { threadID, senderID } = event;

  log.bot('[' + cmd + '] من ' + senderID);
  web.pushLog('BOT', cmd + ' from ' + senderID);

  const secs  = getCooldown(parts[0]) || getCooldown(cmd);
  const { allowed, remaining } = rl.check(senderID, cmd, secs);
  if (!allowed) {
    return api.sendMessage('⏳ انتظر ' + remaining + 'ث قبل استخدام هذا الأمر مجدداً.', threadID);
  }

  await wait(jitter(400, 1200));

  const adminOnly = () => api.sendMessage('❌ ليس لديك صلاحية.', threadID);
  const superOnly = () => api.sendMessage('❌ فقط سوبر أدمن.', threadID);

  if (cmd === 'ping' || cmd === 'بينج')
    return ping.handle(event, api);

  if (cmd === 'اوامر' || cmd === 'أوامر' || cmd === 'help')
    return help.handle(event, api, admin.getRole(senderID));

  if (cmd === 'سيرفر' || cmd === 'server')
    return server.handle(event, api, 'info');

  if (cmd === 'ابتيم' || cmd === 'uptime')
    return server.handle(event, api, 'uptime');

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
  if (cmd === 'تثبيت' || cmd === 'nickprotect') {
    if (!admin.isAdmin(senderID)) return adminOnly();
    return nickProtect.handle(event, api, args);
  }
  if (cmd === 'اسم' || cmd === 'groupname') {
    if (!admin.isAdmin(senderID)) return adminOnly();
    return groupProtect.handle(event, api, args);
  }
  if (cmd === 'رسائل' || cmd === 'automsg') {
    if (!admin.isAdmin(senderID)) return adminOnly();
    return automsg.handle(event, api, args);
  }
  if (cmd === 'تعذيب' || cmd === 'torture') {
    if (!admin.isAdmin(senderID)) return adminOnly();
    return torture.handle(event, api, args);
  }

  if (cmd === 'رفع' || cmd === 'promote') {
    if (!admin.isSuperAdmin(senderID)) return superOnly();
    return promote.handle(event, api, args);
  }
  if (cmd === 'اخفاض' || cmd === 'خفض' || cmd === 'demote') {
    if (!admin.isSuperAdmin(senderID)) return superOnly();
    return demote.handle(event, api, args);
  }
  if (cmd === 'ابادة') {
    if (!admin.isSuperAdmin(senderID)) return superOnly();
    return abad.handle(event, api, args);
  }

  if (cmd === 'حماية' || cmd === 'antiban') {
    if (!admin.isSuperAdmin(senderID)) return superOnly();
    const sub = (args[0] || '').toLowerCase();
    const s   = antiban.stats();
    if (sub === 'ايقاف' || sub === 'وقف') {
      antiban.pause(3 * 60 * 1000);
      return api.sendMessage('⏸ تم إيقاف البوت مؤقتاً لمدة 3 دقائق.', threadID);
    }
    if (sub === 'رفع' || sub === 'استمر') {
      antiban.resume();
      return api.sendMessage('▶️ رُفع الإيقاف.', threadID);
    }
    return api.sendMessage(
      '🛡 حالة الحماية:\n' +
      '▪ الوضع: ' + (s.paused ? '⏸ موقوف مؤقتاً' : '▶️ يعمل') +
      (s.paused ? '\n▪ ينتهي بعد: ' + antiban.pausedFor() + 'ث' : '') +
      '\n▪ أخطاء مرصودة: ' + s.errCount +
      '\n\n/حماية ايقاف — وقف احترازي\n/حماية رفع — رفع الإيقاف',
      threadID);
  }
}

async function startBot() {
  const state = loadState();
  if (!state) {
    log.error('appstate.json غير صالح. جدّد الكوكيز من الداشبورد.');
    web.pushLog('ERROR', 'appstate.json invalid');
    return;
  }

  await wait(rand(3000, 7000));
  log.info('جاري تسجيل الدخول...');

  login({
    appState:          state,
    logLevel:          'error',
    online:            config.online !== false,
    selfListen:        false,
    listenEvents:      true,
    autoMarkRead:      config.autoMarkRead      || false,
    autoMarkDelivery:  config.autoMarkDelivery  || false,
    userAgent: 'Mozilla/5.0 (Linux; Android 13; SM-A546B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.6261.119 Mobile Safari/537.36',
  }, (err, api) => {
    if (err) {
      const msg = err.error || err.message || JSON.stringify(err);
      log.error('فشل تسجيل الدخول: ' + msg);
      web.pushLog('ERROR', 'Login failed: ' + msg);
      const type = antiban.classify(msg);
      if (type === 'ban') {
        log.error('🚨 إشارة حظر — توقف. جدّد الكوكيز.');
        return;
      }
      if (String(msg).includes('checkpoint')) {
        log.error('⚠️ الحساب محتاج تحقق. جدّد الكوكيز.');
        return;
      }
      return scheduleReconnect();
    }

    reconnects = 0;
    currentApi = api;
    engine.setApi(api);
    automsg.setApi(api);
    server.setStartTime(Date.now());
    saveState(api);
    resetWatchdog();
    startWatchdog();

    log.success('البوت يعمل! البادئة: ' + P);
    web.pushLog('OK', 'Bot online. Prefix: ' + P);

    setInterval(() => saveState(api), 10 * 60 * 1000);
    autoAccept.acceptPending(api);

    api.listenMqtt((listenErr, event) => {
      if (listenErr) {
        const msg = JSON.stringify(listenErr);
        log.error('خطأ استماع: ' + msg);
        web.pushLog('ERROR', 'Listen error: ' + msg);
        antiban.report(msg, 'listenMqtt');
        currentApi = null;
        stopWatchdog();
        return scheduleReconnect();
      }
      if (!event) return;

      resetWatchdog();

      if (event.type === 'event' && event.logMessageType === 'log:subscribe') {
        autoAccept.onSubscribeEvent(event, api).catch(e =>
          log.error('autoAccept: ' + e.message)
        );
      }

      // ── حماية الكنيات — استعادة الكنية عند تغييرها ──────────────
      if (event.type === 'event' && event.logMessageData) {
        const d   = event.logMessageData;
        const uid = d.participant_id || d.PARTICIPANT_ID;
        if (uid && 'nickname' in d) {
          const tid = event.threadID;
          if (nickProtectUtils.isProtected(tid, uid)) {
            const savedNick = nickProtectUtils.getProtected(tid, uid);
            if ((d.nickname || '') !== (savedNick || '')) {
              setTimeout(async () => {
                try {
                  await api.nickname(savedNick || '', tid, uid);
                  log.info('nickProtect: استُعيدت كنية ' + uid);
                } catch (e) {
                  log.error('nickProtect restore: ' + e.message);
                }
              }, 1500);
            }
          }
        }
      }

      // ── حماية اسم المجموعة — استعادة الاسم عند تغييره ──────────
      if (event.type === 'event' &&
          (event.logMessageType === 'log:thread-name' ||
           (event.logMessageData && 'name' in event.logMessageData))) {
        const tid = event.threadID;
        if (groupNameProtectUtils.isProtected(tid)) {
          const savedName = groupNameProtectUtils.getProtected(tid);
          const newName   = event.logMessageData?.name || '';
          if (newName !== savedName) {
            setTimeout(async () => {
              try {
                await api.setTitle(savedName, tid);
                log.info('groupProtect: استُعيد اسم المجموعة في ' + tid);
              } catch (e) {
                log.error('groupProtect restore: ' + e.message);
              }
            }, 1500);
          }
        }
      }

      if (event.type === 'message' || event.type === 'message_reply') {
        if (lock.isLocked(event.threadID) && !admin.isAdmin(event.senderID)) return;
        engine.markActivity(event.threadID);
        onMessage(event, api).catch(e => {
          log.error('onMessage: ' + e.message);
          web.pushLog('ERROR', 'onMessage: ' + e.message);
          antiban.report(e, 'onMessage');
        });
      }
    });
  });
}

async function scheduleReconnect() {
  currentApi = null;
  stopWatchdog();
  reconnects++;
  const delay = Math.min(reconnects * 5000, 45000) + rand(0, 5000);
  log.warn('إعادة اتصال بعد ' + (delay/1000).toFixed(1) + 'ث (محاولة ' + reconnects + ')');
  web.pushLog('WARN', 'Reconnecting in ' + Math.round(delay/1000) + 's');
  await wait(delay);
  startBot();
}

process.on('uncaughtException',  e => {
  log.error('Uncaught: ' + e.message);
  web.pushLog('ERROR', e.message);
  antiban.report(e, 'uncaughtException');
});
process.on('unhandledRejection', e => {
  const m = e?.message || JSON.stringify(e);
  log.error('Unhandled: ' + m);
  web.pushLog('ERROR', m);
  antiban.report(e, 'unhandledRejection');
});

log.info('='.repeat(45));
log.info('  ' + config.botName + ' — Messenger Bot');
log.info('='.repeat(45));

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

startBot();
