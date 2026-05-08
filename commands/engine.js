// محركان مستقلان: عادي (يرسل دائماً) وذكي (يرسل عند نشاط فقط)
const log = require('../utils/logger');

let botApi = null;
const activity = new Set();

function setApi(api)       { botApi = api; }
function markActivity(tid) { activity.add(String(tid)); }

// ── مصنع المحركات ────────────────────────────────────────────
function makeEngine(name, smartMode) {
  let gen = 0;
  const st = {
    on:       false,
    message:  null,
    seconds:  30,
    isRandom: false,
    minSec:   25,
    maxSec:   45,
    thread:   null,
    lastSent: null,
    nextAt:   null,
  };

  function getDelay() {
    if (st.isRandom)
      return (st.minSec + Math.random() * (st.maxSec - st.minSec)) * 1000;
    const base = st.seconds * 1000;
    return Math.round(base * 0.8 + Math.random() * base * 0.4);
  }

  function loop(myGen) {
    if (!st.on || gen !== myGen || !botApi || !st.thread) return;
    const delay = getDelay();
    st.nextAt = Date.now() + delay;
    setTimeout(() => {
      if (!st.on || gen !== myGen || !botApi || !st.thread) return;
      if (smartMode && !activity.has(st.thread)) { loop(myGen); return; }
      activity.delete(st.thread);
      st.lastSent = Date.now();
      st.nextAt   = null;
      botApi.sendMessage(st.message || '👋', st.thread, err => {
        if (err) log.error(name + ': ' + JSON.stringify(err));
        loop(myGen);
      });
    }, delay);
  }

  const eng = {
    start(thread) {
      gen++;
      st.on = true;
      if (thread) st.thread = String(thread);
      loop(gen);
    },
    stop()              { gen++; st.on = false; st.nextAt = null; },
    setMessage(msg)     { st.message = msg; },
    setTime(sec)        { st.seconds = sec; st.isRandom = false; if (st.on) eng.restart(); },
    setRandom(min, max) { st.minSec = min; st.maxSec = max; st.isRandom = true; if (st.on) eng.restart(); },
    restart()           { if (st.on) { gen++; loop(gen); } },
    isOn()              { return st.on; },
    getState()          { return { ...st }; },
  };
  return eng;
}

// ── المحركان ──────────────────────────────────────────────────
const normal = makeEngine('NormalEngine', false);
const smart  = makeEngine('SmartEngine',  true);

// ── تنسيق الوقت ──────────────────────────────────────────────
function fmtSec(s) {
  if (!s) return '—';
  if (s < 60)   return s + 'ث';
  if (s < 3600) return Math.floor(s / 60) + 'د';
  return Math.floor(s / 3600) + 'س';
}

// ── أمر /محرك (يعمل على المحرك العادي — للتوافق) ─────────────
function handle(event, api, args) {
  const { threadID } = event;
  const sub = (args[0] || '').toLowerCase();

  if (!sub) {
    if (normal.isOn()) { normal.stop(); return api.sendMessage('🔴 المحرك العادي متوقف.', threadID); }
    normal.start(threadID);
    const ns = normal.getState();
    return api.sendMessage(
      '🟢 المحرك العادي يعمل!\n⏱ كل ~' + fmtSec(ns.seconds) + ' (±20%)\n💬 ' + (ns.message || '(لم تُضبط رسالة)'),
      threadID);
  }

  if (sub === 'رسالة' || sub === 'msg') {
    const txt = args.slice(1).join(' ').trim();
    if (!txt) return api.sendMessage('❗ مثال: /محرك رسالة نص الرسالة', threadID);
    normal.setMessage(txt);
    if (normal.isOn()) normal.restart();
    return api.sendMessage('✅ الرسالة: "' + txt + '"', threadID);
  }

  if (sub === 'وقت' || sub === 'time') {
    const s = parseInt(args[1]);
    if (isNaN(s) || s < 10) return api.sendMessage('❗ الحد الأدنى 10ث. مثال: /محرك وقت 30', threadID);
    normal.setTime(s);
    return api.sendMessage('✅ الوقت: ~' + fmtSec(s) + ' (±20%)', threadID);
  }

  if (sub === 'الذكي' || sub === 'smart') {
    if (smart.isOn()) { smart.stop(); return api.sendMessage('⚫ المحرك الذكي متوقف.', threadID); }
    smart.start(threadID);
    return api.sendMessage('🧠 المحرك الذكي مفعّل — يرسل عند وجود نشاط.', threadID);
  }

  if (sub === 'تشغيل' || sub === 'on') {
    if (normal.isOn()) return api.sendMessage('⚠️ المحرك العادي يعمل بالفعل.', threadID);
    normal.start(threadID); return api.sendMessage('🟢 المحرك العادي يعمل!', threadID);
  }

  if (sub === 'إيقاف' || sub === 'ايقاف' || sub === 'off') {
    if (!normal.isOn()) return api.sendMessage('⚠️ المحرك العادي متوقف بالفعل.', threadID);
    normal.stop(); return api.sendMessage('🔴 المحرك العادي متوقف.', threadID);
  }

  if (sub === 'حالة' || sub === 'status') {
    const ns = normal.getState(), ss = smart.getState();
    return api.sendMessage(
      '📊 المحركات:\n' +
      '📍 العادي: ' + (ns.on ? '🟢 يعمل' : '🔴 متوقف') +
      '\n   💬 ' + (ns.message || '—') + ' · ⏱ ' + fmtSec(ns.seconds) +
      '\n📍 الذكي: ' + (ss.on ? '🟢 يعمل' : '⚫ متوقف') +
      '\n   💬 ' + (ss.message || '—') + ' · ⏱ ' + fmtSec(ss.seconds), threadID);
  }

  return api.sendMessage(
    '/محرك — تشغيل/إيقاف العادي\n/محرك رسالة [نص]\n/محرك وقت [ثواني]\n' +
    '/محرك الذكي — تشغيل/إيقاف الذكي\n/محرك حالة\n\n💡 للتحكم الكامل استخدم /قائمة', threadID);
}

// ── صادرات التوافق مع الداشبورد ──────────────────────────────
function getState() {
  const ns = normal.getState();
  return { on: ns.on, message: ns.message, seconds: ns.seconds, smart: smart.isOn(), thread: ns.thread };
}
function remoteStart(threadID) { normal.start(threadID || normal.getState().thread); }
function remoteStop()          { normal.stop(); }
function setMessage(msg)       { normal.setMessage(msg); if (normal.isOn()) normal.restart(); }
function setSeconds(s)         { normal.setTime(s); }

module.exports = { handle, setApi, markActivity, getState, remoteStart, remoteStop, setMessage, setSeconds, normal, smart };
