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

  await replyDelay();

  switch (cmd) {
    case 'ping':
    case 'بينج':
      pingCmd.handle(event, api);
      break;

    case 'اوامر':
    case 'أوامر':
    case 'help':
      helpCmd.handle(event, api, args, prefix);
      break;

    case 'محرك':
    case 'engine':
      if (!isAdmin(senderID)) return api.sendMessage('❌ ليس لديك صلاحية استخدام هذا الأمر.', threadID);
      engineCmd.handle(event, api, args, prefix);
      break;

    case 'قفل':
    case 'lock':
      if (!isAdmin(senderID)) return api.sendMessage('❌ ليس لديك صلاحية استخدام هذا الأمر.', threadID);
      lockCmd.handle(event, api, args, prefix);
      break;

    case 'كنية':
    case 'nickname':
      if (!isAdmin(senderID)) return api.sendMessage('❌ ليس لديك صلاحية استخدام هذا الأمر.', threadID);
      nicknameCmd.handle(event, api, args);
      break;

    case 'كنيات':
    case 'nicknames':
      if (!isAdmin(senderID)) return api.sendMessage('❌ ليس لديك صلاحية استخدام هذا الأمر.', threadID);
      nicknamesCmd.handle(event, api, args);
      break;

    case 'رسائل':
    case 'automsg':
      if (!isAdmin(senderID)) return api.sendMessage('❌ ليس لديك صلاحية استخدام هذا الأمر.', threadID);
      automsgCmd.handle(event, api, args, prefix);
      break;

    case 'رفع':
    case 'promote':
      promoteCmd.handle(event, api, args);
      break;

    case 'اخفاض':
    case 'خفض':
    case 'demote':
      demoteCmd.handle(event, api, args);
      break;

    case 'سيرفر':
    case 'server':
      serverCmd.handleServer(event, api);
      break;

    case 'ابتيم':
    case 'uptime':
      serverCmd.handleUptime(event, api);
      break;

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

function startBot() {
  const appstate = loadAppstate();
  if (!appstate) {
    log.error('لا يمكن بدء البوت بدون appstate صحيح.');
    log.info('شغّل: node reset-cookies.js لتجديد الجلسة.');
    return;
  }

  log.info('جاري تسجيل الدخول...');

  login({
    appState: appstate,
    logLevel: config.logLevel || 'error',
    online: config.online !== false,
    selfListen: config.selfListen === true,
    listenEvents: config.listenEvents !== false,
    autoMarkRead: config.autoMarkRead === true,
    autoMarkDelivery: config.autoMarkDelivery === true,
    forceLogin: config.forceLogin === true,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  }, (err, api) => {
    if (err) {
      const errMsg = err.error || err.message || JSON.stringify(err);
      log.error('فشل تسجيل الدخول: ' + errMsg);
      if (String(errMsg).includes('checkpoint') || errMsg === 'login-approval')
        return log.error('⚠️  الحساب محتاج موافقة. شغّل: node reset-cookies.js');
      if (String(errMsg).includes('Not logged in') || String(errMsg).includes('appstate'))
        return log.error('⚠️  انتهت صلاحية الجلسة. شغّل: node reset-cookies.js');
      return scheduleReconnect();
    }

    reconnectAttempts = 0;
    globalApi = api;
    engineCmd.setApi(api);
    autoMessages.setApi(api);
    setStartTime(Date.now());

    const _origSend = api.sendMessage.bind(api);
    api.sendMessage = (msg, threadID, callback) => {
      const result = _origSend(msg, threadID, callback);
      if (result && typeof result.catch === 'function')
        result.catch((e) => log.error('sendMessage خطأ: ' + (e && e.error ? e.error : JSON.stringify(e))));
      return result;
    };

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
    log.info('البوت يعمل. البادئة: ' + config.prefix + ' | اكتب ' + config.prefix + 'ping للاختبار');

    api.setOptions({
      listenEvents: config.listenEvents !== false,
      selfListen: config.selfListen === true,
      logLevel: config.logLevel || 'error',
    });

    const stopListening = api.listenMqtt((err, event) => {
      if (err) {
        log.error('خطأ في الاستماع: ' + JSON.stringify(err));
        if (err.error === 'Not logged in' || err.error === 'Connection closed' || err.type === 'stop_listen') {
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

    setInterval(() => saveAppstate(api.getAppState()), 10 * 60 * 1000);
  });
}

function scheduleReconnect() {
  const maxAttempts = config.maxReconnectAttempts;
  if (maxAttempts > 0 && reconnectAttempts >= maxAttempts) {
    log.error('وصل إلى الحد الأقصى من محاولات إعادة الاتصال (' + maxAttempts + ').');
    return process.exit(1);
  }
  reconnectAttempts++;
  const delay = config.reconnectDelay || 5000;
  log.warn('إعادة الاتصال بعد ' + (delay / 1000) + ' ثانية... (محاولة ' + reconnectAttempts + ')');
  setTimeout(() => startBot(), delay);
}

process.on('uncaughtException', (err) => { log.error('استثناء غير مُعالج: ' + err.message); log.error(err.stack || ''); });
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
