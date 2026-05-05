const { login } = require('ws3-fca');
const fs = require('fs');
const path = require('path');
const config = require('./config.json');
const log = require('./utils/logger');
const { isAdmin } = require('./utils/admin');
const { isLocked, markActivity } = require('./utils/state');
const { setStartTime } = require('./commands/server');
const { replyDelay } = require('./utils/delay');
const autoMessages = require('./utils/autoMessages');

const engineCmd    = require('./commands/engine');
const lockCmd      = require('./commands/lock');
const promoteCmd   = require('./commands/promote');
const demoteCmd    = require('./commands/demote');
const helpCmd      = require('./commands/help');
const serverCmd    = require('./commands/server');
const nicknameCmd  = require('./commands/nickname');
const nicknamesCmd = require('./commands/nicknames');
const pingCmd      = require('./commands/ping');
const automsgCmd   = require('./commands/automsg');

const APPSTATE_PATH = path.join(__dirname, 'appstate.json');

let reconnectAttempts = 0;
let globalApi = null;

// ─── تأخيرات عشوائية لإخفاء نشاط البوت ───
function randomMs(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

// تأخير عشوائي قبل تسجيل الدخول (3-8 ثواني) — يبدو طبيعياً
function startupDelay() { return wait(randomMs(3000, 8000)); }

// تأخير بعد تسجيل الدخول قبل بدء الاستماع (2-5 ثواني)
function postLoginDelay() { return wait(randomMs(2000, 5000)); }

// تأخير بين محاولات إعادة الاتصال — يتزايد مع كل محاولة
function reconnectWait(attempt) {
  const base = (config.reconnectDelay || 5000) * Math.min(attempt, 5);
  const jitter = randomMs(0, base * 0.3);
  return wait(base + jitter);
}

function loadAppstate() {
  try {
    const raw = fs.readFileSync(APPSTATE_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      log.error('ملف appstate.json فارغ أو غير صحيح.');
      return null;
    }
    return parsed;
  } catch (e) {
    log.error('فشل تحميل appstate.json: ' + e.message);
    return null;
  }
}

function saveAppstate(state) {
  try {
    fs.writeFileSync(APPSTATE_PATH, JSON.stringify(state, null, 2));
    log.success('تم حفظ appstate الجديد.');
  } catch (e) {
    log.error('فشل حفظ appstate: ' + e.message);
  }
}

async function handleCommand(event, api) {
  const body = event.body || '';
  const prefix = config.prefix;
  if (!body.startsWith(prefix)) return false;

  const threadID = event.threadID;
  const senderID = event.senderID;

  if (isLocked(threadID) && !isAdmin(senderID)) return true;

  const withoutPrefix = body.slice(prefix.length).trim();
  const parts = withoutPrefix.split(/\s+/);
  const cmd = parts[0].toLowerCase();
  const args = parts.slice(1);

  log.bot('Command [' + cmd + '] from ' + senderID + ' in ' + threadID);

  // تأخير عشوائي قبل الرد (0.5-2 ثانية) — يبدو إنسانياً
  await replyDelay();

  switch (cmd) {
    case 'ping': case 'بينج':
      pingCmd.handle(event, api); break;

    case 'اوامر': case 'أوامر': case 'help':
      helpCmd.handle(event, api, args, prefix); break;

    case 'محرك': case 'engine':
      if (!isAdmin(senderID)) return api.sendMessage('❌ ليس لديك صلاحية استخدام هذا الأمر.', threadID);
      engineCmd.handle(event, api, args, prefix); break;

    case 'قفل': case 'lock':
      if (!isAdmin(senderID)) return api.sendMessage('❌ ليس لديك صلاحية استخدام هذا الأمر.', threadID);
      lockCmd.handle(event, api, args, prefix); break;

    case 'كنية': case 'nickname':
      if (!isAdmin(senderID)) return api.sendMessage('❌ ليس لديك صلاحية استخدام هذا الأمر.', threadID);
      nicknameCmd.handle(event, api, args); break;

    case 'كنيات': case 'nicknames':
      if (!isAdmin(senderID)) return api.sendMessage('❌ ليس لديك صلاحية استخدام هذا الأمر.', threadID);
      nicknamesCmd.handle(event, api, args); break;

    case 'رسائل': case 'automsg':
      if (!isAdmin(senderID)) return api.sendMessage('❌ ليس لديك صلاحية استخدام هذا الأمر.', threadID);
      automsgCmd.handle(event, api, args, prefix); break;

    case 'رفع': case 'promote':
      promoteCmd.handle(event, api, args); break;

    case 'اخفاض': case 'خفض': case 'demote':
      demoteCmd.handle(event, api, args); break;

    case 'سيرفر': case 'server':
      serverCmd.handleServer(event, api); break;

    case 'ابتيم': case 'uptime':
      serverCmd.handleUptime(event, api); break;

    default:
      log.bot('Unknown command [' + cmd + '] from ' + senderID);
      return false;
  }
  return true;
}

function handleEvent(event) {
  const activityTypes = [
    'change_thread_name','change_group_image','change_nickname',
    'change_thread_color','change_thread_icon','add_participants',
    'remove_participants','log:subscribe','log:unsubscribe',
  ];
  if (activityTypes.includes(event.type)) markActivity(event.threadID);
}

async function startBot() {
  const appstate = loadAppstate();
  if (!appstate) {
    log.error('لا يمكن بدء البوت بدون appstate صحيح.');
    return;
  }

  // ── تأخير عشوائي قبل تسجيل الدخول ──
  const sDelay = randomMs(3000, 8000);
  log.info('انتظار ' + (sDelay/1000).toFixed(1) + 'ث قبل تسجيل الدخول...');
  await startupDelay();
  log.info('جاري تسجيل الدخول...');

  // الكوكيز من موبايل → نستخدم user agent موبايل مطابق
  const mobileUserAgent = 'Mozilla/5.0 (Linux; Android 11; SM-A325F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.6261.119 Mobile Safari/537.36 [FBAN/FB4A;FBAV/461.0.0.44.109;FBBV/601398754]';

  login({
    appState: appstate,
    logLevel: config.logLevel || 'error',
    online: config.online !== false,
    selfListen: config.selfListen === true,
    listenEvents: config.listenEvents !== false,
    autoMarkRead: config.autoMarkRead === true,
    autoMarkDelivery: config.autoMarkDelivery === true,
    forceLogin: config.forceLogin === true,
    userAgent: mobileUserAgent,
  }, async (err, api) => {
    if (err) {
      const errMsg = err.error || err.message || JSON.stringify(err);
      log.error('فشل تسجيل الدخول: ' + errMsg);
      if (String(errMsg).includes('checkpoint') || errMsg === 'login-approval')
        return log.error('⚠️  الحساب محتاج موافقة. جدّد الكوكيز يدوياً.');
      if (String(errMsg).includes('Not logged in') || String(errMsg).includes('appstate'))
        return log.error('⚠️  انتهت صلاحية الجلسة. جدّد الكوكيز.');
      return scheduleReconnect();
    }

    reconnectAttempts = 0;
    globalApi = api;
    engineCmd.setApi(api);
    autoMessages.setApi(api);
    setStartTime(Date.now());

    // Wrap sendMessage
    const _origSend = api.sendMessage.bind(api);
    api.sendMessage = (msg, threadID, callback) => {
      const result = _origSend(msg, threadID, callback);
      if (result && typeof result.catch === 'function')
        result.catch((e) => log.error('sendMessage خطأ: ' + (e && e.error ? e.error : JSON.stringify(e))));
      return result;
    };

    // Wrap getThreadInfo
    if (api.getThreadInfo) {
      const _origInfo = api.getThreadInfo.bind(api);
      api.getThreadInfo = (tid, cb) => {
        const result = _origInfo(tid, cb);
        if (result && typeof result.catch === 'function')
          result.catch((e) => log.error('getThreadInfo خطأ: ' + JSON.stringify(e)));
        return result;
      };
    }

    saveAppstate(api.getAppState());
    log.success('تم تسجيل الدخول بنجاح!');

    // ── تأخير بعد الدخول قبل بدء الاستماع ──
    const pDelay = randomMs(2000, 5000);
    log.info('انتظار ' + (pDelay/1000).toFixed(1) + 'ث قبل بدء الاستماع...');
    await postLoginDelay();

    log.info('البوت يعمل. البادئة: ' + config.prefix + ' | اكتب ' + config.prefix + 'ping للاختبار');

    api.setOptions({
      listenEvents: config.listenEvents !== false,
      selfListen: config.selfListen === true,
      logLevel: config.logLevel || 'error',
    });

    const stopListening = api.listenMqtt((err, event) => {
      if (err) {
        log.error('خطأ في الاستماع: ' + JSON.stringify(err));
        if (
          err.error === 'Not logged in' ||
          err.error === 'Connection closed' ||
          err.type === 'stop_listen'
        ) {
          log.warn('تم قطع الاتصال. إعادة الاتصال...');
          try { stopListening(); } catch (_) {}
          scheduleReconnect();
        }
        return;
      }
      if (!event) return;
      if (event.type === 'message' || event.type === 'message_reply') {
        markActivity(event.threadID);
        if (isLocked(event.threadID) && !isAdmin(event.senderID)) return;
        handleCommand(event, api);
      } else if (event.type === 'event') {
        handleEvent(event);
      }
    });

    // حفظ appstate كل 10 دقائق
    setInterval(() => saveAppstate(api.getAppState()), 10 * 60 * 1000);
  });
}

async function scheduleReconnect() {
  const maxAttempts = config.maxReconnectAttempts;
  if (maxAttempts > 0 && reconnectAttempts >= maxAttempts) {
    log.error('وصل إلى الحد الأقصى من محاولات إعادة الاتصال (' + maxAttempts + ').');
    return process.exit(1);
  }
  reconnectAttempts++;
  log.warn('إعادة الاتصال... (محاولة ' + reconnectAttempts + ')');
  await reconnectWait(reconnectAttempts);
  startBot();
}

process.on('uncaughtException', (err) => {
  log.error('استثناء غير مُعالج: ' + err.message);
  log.error(err.stack || '');
});
process.on('unhandledRejection', (reason) => {
  const msg = reason instanceof Error ? reason.message : (typeof reason === 'object' ? JSON.stringify(reason) : String(reason));
  log.error('رفض وعد غير مُعالج: ' + msg);
});
process.on('SIGINT', () => {
  log.warn('تم إيقاف البوت يدوياً.');
  autoMessages.stopAll();
  if (globalApi) { try { globalApi.logout(() => process.exit(0)); } catch (_) { process.exit(0); } }
  else process.exit(0);
});

log.info('='.repeat(40));
log.info('  ' + config.botName + ' - Facebook Messenger Bot');
log.info('='.repeat(40));
startBot();
