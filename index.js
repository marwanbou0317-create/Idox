const { login }   = require('ws3-fca');
const fs          = require('fs');
const path        = require('path');
const config      = require('./config.json');
const log         = require('./utils/logger');
const admin       = require('./utils/admin');
const rl          = require('./utils/rateLimiter');
const antiban     = require('./utils/antiban');
const { jitter }  = require('./utils/actionQueue');
const nickProtectUtils      = require('./utils/nickProtect');
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

// ── MQTT Watchdog ──────────────────────────────────────────────────────
const MQTT_TIMEOUT = 8 * 60 * 1000;
let lastMqttEvent  = Date.now();
let watchdogTimer  = null;

function resetWatchdog() { lastMqttEvent = Date.now(); }

function startWatchdog() {
  if (watchdogTimer) clearInterval(watchdogTimer);
  watchdogTimer = setInterval(() => {
    const silence = Date.now() - lastMqttEvent;
    if (silence > MQTT_TIMEOUT && currentApi) {
      log.warn('\u26a0\ufe0f MQTT \u0635\u0627\u0645\u062a \u0645\u0646\u0630 ' + Math.round(silence / 60000) + ' \u062f\u0642\u064a\u0642\u0629 \u2014 \u0625\u0639\u0627\u062f\u0629 \u0627\u062a\u0635\u0627\u0644...');
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

// ── Web dashboard ──────────────────────────────────────────────────────
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

// ── Command router ─────────────────────────────────────────────────────
async function onMessage(event, api) {
  resetWatchdog();
  const body = (event.body || '').trim();
  if (!body.startsWith(P)) return;

  if (antiban.isPaused()) {
    const rem = antiban.pausedFor();
    return api.sendMessage('\u23f8 \u0627\u0644\u0628\u0648\u062a \u0641\u064a \u0648\u0636\u0639 \u0627\u0644\u062d\u0645\u0627\u064a\u0629. \u0627\u0631\u062c\u0639 \u0628\u0639\u062f ' + rem + '\u062b.', event.threadID);
  }

  const text  = body.slice(P.length).trim();
  const parts = text.split(/\s+/);
  const cmd   = (parts[0] || '').toLowerCase();
  const args  = parts.slice(1);
  const { threadID, senderID } = event;

  log.bot('[' + cmd + '] \u0645\u0646 ' + senderID);
  web.pushLog('BOT', cmd + ' from ' + senderID);

  const secs  = getCooldown(parts[0]) || getCooldown(cmd);
  const { allowed, remaining } = rl.check(senderID, cmd, secs);
  if (!allowed) {
    return api.sendMessage('\u23f3 \u0627\u0646\u062a\u0638\u0631 ' + remaining + '\u062b \u0642\u0628\u0644 \u0627\u0633\u062a\u062e\u062f\u0627\u0645 \u0647\u0630\u0627 \u0627\u0644\u0623\u0645\u0631 \u0645\u062c\u062f\u062f\u0627\u064b.', threadID);
  }

  await wait(jitter(400, 1200));

  const adminOnly = () => api.sendMessage('\u274c \u0644\u064a\u0633 \u0644\u062f\u064a\u0643 \u0635\u0644\u0627\u062d\u064a\u0629.', threadID);
  const superOnly = () => api.sendMessage('\u274c \u0641\u0642\u0637 \u0633\u0648\u0628\u0631 \u0623\u062f\u0645\u0646.', threadID);

  if (cmd === 'ping' || cmd === '\u0628\u064a\u0646\u062c')
    return ping.handle(event, api);

  if (cmd === '\u0627\u0648\u0627\u0645\u0631' || cmd === '\u0623\u0648\u0627\u0645\u0631' || cmd === 'help')
    return help.handle(event, api, admin.getRole(senderID));

  if (cmd === '\u0633\u064a\u0631\u0641\u0631' || cmd === 'server')
    return server.handle(event, api, 'info');

  if (cmd === '\u0627\u0628\u062a\u064a\u0645' || cmd === 'uptime')
    return server.handle(event, api, 'uptime');

  if (cmd === '\u0645\u062d\u0631\u0643' || cmd === 'engine') {
    if (!admin.isAdmin(senderID)) return adminOnly();
    return engine.handle(event, api, args);
  }
  if (cmd === '\u0642\u0641\u0644' || cmd === 'lock') {
    if (!admin.isAdmin(senderID)) return adminOnly();
    return lock.handle(event, api, args);
  }
  if (cmd === '\u0643\u0646\u064a\u0629' || cmd === 'nickname') {
    if (!admin.isAdmin(senderID)) return adminOnly();
    return nickname.handle(event, api, args);
  }
  if (cmd === '\u0643\u0646\u064a\u0627\u062a' || cmd === 'nicknames') {
    if (!admin.isAdmin(senderID)) return adminOnly();
    return nicknames.handle(event, api, args);
  }
  if (cmd === '\u062a\u062b\u0628\u064a\u062a' || cmd === 'nickprotect') {
    if (!admin.isAdmin(senderID)) return adminOnly();
    return nickProtect.handle(event, api, args);
  }
  if (cmd === '\u0627\u0633\u0645' || cmd === 'groupname') {
    if (!admin.isAdmin(senderID)) return adminOnly();
    return groupProtect.handle(event, api, args);
  }
  if (cmd === '\u0631\u0633\u0627\u0626\u0644' || cmd === 'automsg') {
    if (!admin.isAdmin(senderID)) return adminOnly();
    return automsg.handle(event, api, args);
  }
  if (cmd === '\u062a\u0639\u0630\u064a\u0628' || cmd === 'torture') {
    if (!admin.isAdmin(senderID)) return adminOnly();
    return torture.handle(event, api, args);
  }

  if (cmd === '\u0631\u0641\u0639' || cmd === 'promote') {
    if (!admin.isSuperAdmin(senderID)) return superOnly();
    return promote.handle(event, api, args);
  }
  if (cmd === '\u0627\u062e\u0641\u0627\u0636' || cmd === '\u062e\u0641\u0636' || cmd === 'demote') {
    if (!admin.isSuperAdmin(senderID)) return superOnly();
    return demote.handle(event, api, args);
  }
  if (cmd === '\u0627\u0628\u0627\u062f\u0629') {
    if (!admin.isSuperAdmin(senderID)) return superOnly();
    return abad.handle(event, api, args);
  }

  if (cmd === '\u062d\u0645\u0627\u064a\u0629' || cmd === 'antiban') {
    if (!admin.isSuperAdmin(senderID)) return superOnly();
    const sub = (args[0] || '').toLowerCase();
    const s   = antiban.stats();
    if (sub === '\u0627\u064a\u0642\u0627\u0641' || sub === '\u0648\u0642\u0641') {
      antiban.pause(3 * 60 * 1000);
      return api.sendMessage('\u23f8 \u062a\u0645 \u0625\u064a\u0642\u0627\u0641 \u0627\u0644\u0628\u0648\u062a \u0645\u0624\u0642\u062a\u0627\u064b \u0644\u0645\u062f\u0629 3 \u062f\u0642\u0627\u0626\u0642.', threadID);
    }
    if (sub === '\u0631\u0641\u0639' || sub === '\u0627\u0633\u062a\u0645\u0631') {
      antiban.resume();
      return api.sendMessage('\u25b6\ufe0f \u0631\u064f\u0641\u0639 \u0627\u0644\u0625\u064a\u0642\u0627\u0641.', threadID);
    }
    return api.sendMessage(
      '\ud83d\udee1 \u062d\u0627\u0644\u0629 \u0627\u0644\u062d\u0645\u0627\u064a\u0629:\n' +
      '\u25aa \u0627\u0644\u0648\u0636\u0639: ' + (s.paused ? '\u23f8 \u0645\u0648\u0642\u0648\u0641 \u0645\u0624\u0642\u062a\u0627\u064b' : '\u25b6\ufe0f \u064a\u0639\u0645\u0644') +
      (s.paused ? '\n\u25aa \u064a\u0646\u062a\u0647\u064a \u0628\u0639\u062f: ' + antiban.pausedFor() + '\u062b' : '') +
      '\n\u25aa \u0623\u062e\u0637\u0627\u0621 \u0645\u0631\u0635\u0648\u062f\u0629: ' + s.errCount +
      '\n\n/\u062d\u0645\u0627\u064a\u0629 \u0627\u064a\u0642\u0627\u0641 \u2014 \u0648\u0642\u0641 \u0627\u062d\u062a\u0631\u0627\u0632\u064a\n/\u062d\u0645\u0627\u064a\u0629 \u0631\u0641\u0639 \u2014 \u0631\u0641\u0639 \u0627\u0644\u0625\u064a\u0642\u0627\u0641',
      threadID);
  }
}

// ── Bot startup ────────────────────────────────────────────────────────
async function startBot() {
  const state = loadState();
  if (!state) {
    log.error('appstate.json \u063a\u064a\u0631 \u0635\u0627\u0644\u062d. \u062c\u062f\u0651\u062f \u0627\u0644\u0643\u0648\u0643\u064a\u0632 \u0645\u0646 \u0627\u0644\u062f\u0627\u0634\u0628\u0648\u0631\u062f.');
    web.pushLog('ERROR', 'appstate.json invalid');
    return;
  }

  await wait(rand(3000, 7000));
  log.info('\u062c\u0627\u0631\u064a \u062a\u0633\u062c\u064a\u0644 \u0627\u0644\u062f\u062e\u0648\u0644...');

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
      log.error('\u0641\u0634\u0644 \u062a\u0633\u062c\u064a\u0644 \u0627\u0644\u062f\u062e\u0648\u0644: ' + msg);
      web.pushLog('ERROR', 'Login failed: ' + msg);

      const type = antiban.classify(msg);
      if (type === 'ban') {
        log.error('\ud83d\udea8 \u0625\u0634\u0627\u0631\u0629 \u062d\u0638\u0631 \u2014 \u062a\u0648\u0642\u0641. \u062c\u062f\u0651\u062f \u0627\u0644\u0643\u0648\u0643\u064a\u0632.');
        return;
      }
      if (String(msg).includes('checkpoint')) {
        log.error('\u26a0\ufe0f \u0627\u0644\u062d\u0633\u0627\u0628 \u0645\u062d\u062a\u0627\u062c \u062a\u062d\u0642\u0642. \u062c\u062f\u0651\u062f \u0627\u0644\u0643\u0648\u0643\u064a\u0632.');
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

    log.success('\u0627\u0644\u0628\u0648\u062a \u064a\u0639\u0645\u0644! \u0627\u0644\u0628\u0627\u062f\u0626\u0629: ' + P);
    web.pushLog('OK', 'Bot online. Prefix: ' + P);

    setInterval(() => saveState(api), 10 * 60 * 1000);
    autoAccept.acceptPending(api);

    api.listenMqtt((listenErr, event) => {
      if (listenErr) {
        const msg = JSON.stringify(listenErr);
        log.error('\u062e\u0637\u0623 \u0627\u0633\u062a\u0645\u0627\u0639: ' + msg);
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

      // ── Nick protection: restore on change ──────────────────────────
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
                  log.info('nickProtect: restored nick for ' + uid);
                } catch (e) {
                  log.error('nickProtect restore: ' + e.message);
                }
              }, 1500);
            }
          }
        }
      }

      // ── Group name protection: restore on change ─────────────────────
      if (event.type === 'event' &&
          (event.logMessageType === 'log:thread-name' ||
           (event.logMessageData && 'name' in event.logMessageData))) {
        const tid = event.threadID;
        if (groupNameProtectUtils.isProtected(tid)) {
          const savedName = groupNameProtectUtils.getProtected(tid);
          const newName   = event.logMessageData && event.logMessageData.name ? event.logMessageData.name : '';
          if (newName !== savedName) {
            setTimeout(async () => {
              try {
                await api.setTitle(savedName, tid);
                log.info('groupProtect: restored group name in ' + tid);
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
  log.warn('\u0625\u0639\u0627\u062f\u0629 \u0627\u062a\u0635\u0627\u0644 \u0628\u0639\u062f ' + (delay/1000).toFixed(1) + '\u062b (\u0645\u062d\u0627\u0648\u0644\u0629 ' + reconnects + ')');
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
  const m = e && e.message ? e.message : JSON.stringify(e);
  log.error('Unhandled: ' + m);
  web.pushLog('ERROR', m);
  antiban.report(e, 'unhandledRejection');
});

log.info('='.repeat(45));
log.info('  ' + config.botName + ' \u2014 Messenger Bot');
log.info('='.repeat(45));

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

startBot();
