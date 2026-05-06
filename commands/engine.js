// محرك الرسائل — generation counter يضمن سلسلة واحدة فقط
const log = require('../utils/logger');

let botApi = null;
let gen    = 0;

const state = {
  on:       false,
  message:  'مرحباً! 👋',
  seconds:  60,
  smart:    false,
  thread:   null,
  activity: new Set(),   // المجموعات التي شهدت نشاطاً
};

function setApi(api) { botApi = api; }
function markActivity(threadID) { state.activity.add(String(threadID)); }

function _loop(myGen) {
  if (!state.on || gen !== myGen || !botApi || !state.thread) return;
  const base  = state.seconds * 1000;
  const delay = Math.round(base * 0.8 + Math.random() * base * 0.4); // ±20%
  setTimeout(() => {
    if (!state.on || gen !== myGen || !botApi || !state.thread) return;
    if (state.smart && !state.activity.has(state.thread)) {
      _loop(myGen); return;
    }
    state.activity.delete(state.thread);
    botApi.sendMessage(state.message, state.thread, err => {
      if (err) log.error('Engine: ' + JSON.stringify(err));
      _loop(myGen);
    });
  }, delay);
}

function start(thread) {
  gen++;                           // يُبطل أي سلسلة قديمة تلقائياً
  state.on     = true;
  state.thread = thread || state.thread;
  _loop(gen);
}

function stop() {
  gen++;
  state.on = false;
}

function fmt(s) {
  if (s < 60)   return s + 'ث';
  if (s < 3600) return Math.floor(s/60) + 'د';
  return Math.floor(s/3600) + 'س';
}

function handle(event, api, args) {
  const { threadID } = event;
  const sub = (args[0] || '').toLowerCase();

  if (!sub) {
    if (state.on) { stop(); return api.sendMessage('🔴 المحرك متوقف.', threadID); }
    start(threadID);
    return api.sendMessage(
      '🟢 المحرك يعمل!\n⏱ كل ~' + fmt(state.seconds) + ' (±20%)\n💬 ' + state.message +
      '\n🧠 الذكي: ' + (state.smart ? 'مفعّل' : 'موقوف'), threadID);
  }

  if (sub === 'رسالة' || sub === 'msg') {
    const txt = args.slice(1).join(' ').trim();
    if (!txt) return api.sendMessage('❗ مثال: /محرك رسالة نص الرسالة', threadID);
    state.message = txt;
    if (state.on) start(); // إعادة تشغيل بالرسالة الجديدة
    return api.sendMessage('✅ الرسالة: "' + txt + '"', threadID);
  }

  if (sub === 'وقت' || sub === 'time') {
    const s = parseInt(args[1]);
    if (isNaN(s) || s < 10) return api.sendMessage('❗ الحد الأدنى 10ث\nمثال: /محرك وقت 30', threadID);
    state.seconds = s;
    if (state.on) start(); // إعادة تشغيل بالوقت الجديد
    return api.sendMessage('✅ الوقت: ~' + fmt(s) + ' (±20%)', threadID);
  }

  if (sub === 'الذكي' || sub === 'smart') {
    state.smart = !state.smart;
    return api.sendMessage(state.smart
      ? '🧠 الوضع الذكي مفعّل — يرسل فقط عند وجود نشاط.'
      : '🧠 الوضع الذكي موقوف.', threadID);
  }

  if (sub === 'تشغيل' || sub === 'on') {
    if (state.on) return api.sendMessage('⚠️ المحرك يعمل بالفعل.', threadID);
    start(threadID);
    return api.sendMessage('🟢 المحرك يعمل!', threadID);
  }

  if (sub === 'إيقاف' || sub === 'ايقاف' || sub === 'off') {
    if (!state.on) return api.sendMessage('⚠️ المحرك متوقف بالفعل.', threadID);
    stop();
    return api.sendMessage('🔴 المحرك متوقف.', threadID);
  }

  if (sub === 'حالة' || sub === 'status') {
    return api.sendMessage(
      '📊 المحرك:\n▪ ' + (state.on ? '🟢 يعمل' : '🔴 متوقف') +
      '\n▪ الرسالة: ' + state.message +
      '\n▪ الوقت: ~' + fmt(state.seconds) + ' (±20%)' +
      '\n▪ الذكي: ' + (state.smart ? '✅' : '❌') +
      '\n▪ المجموعة: ' + (state.thread || 'غير محدد'), threadID);
  }

  return api.sendMessage(
    '/محرك — تشغيل/إيقاف\n' +
    '/محرك رسالة [نص]\n' +
    '/محرك وقت [ثواني]\n' +
    '/محرك الذكي\n' +
    '/محرك حالة', threadID);
}

function getState() {
  return {
    on:      state.on,
    message: state.message,
    seconds: state.seconds,
    smart:   state.smart,
    thread:  state.thread,
  };
}

function remoteStart(threadID) { start(threadID || state.thread); }
function remoteStop()          { stop(); }
function setMessage(msg)       { state.message = msg; if (state.on) start(); }
function setSeconds(s)         { state.seconds = s;   if (state.on) start(); }

module.exports = { handle, setApi, markActivity, getState, remoteStart, remoteStop, setMessage, setSeconds };
