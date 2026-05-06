const log = require('./logger');

let botApi = null;
const msgs = new Map();
let nextId = 1;

function setApi(api) { botApi = api; }

function _loop(entry) {
  const myGen = entry.gen;
  const base  = entry.seconds * 1000;
  const delay = Math.round(base * 0.8 + Math.random() * base * 0.4);

  setTimeout(() => {
    if (!entry.enabled || entry.gen !== myGen || !botApi) return;

    // ← استدعاء sendMessage بدون انتظار callback لضمان استمرار الحلقة
    const result = botApi.sendMessage(entry.text, entry.threadID);
    if (result && typeof result.then === 'function')
      result.catch(e => log.error('AutoMsg #' + entry.id + ': ' + (e?.message || JSON.stringify(e))));

    // ← جدولة التكرار التالي فوراً بعد الإرسال (لا تنتظر callback)
    _loop(entry);
  }, delay);
}

function add(text, threadID, seconds) {
  const entry = { id: nextId++, text, threadID, seconds, enabled: true, gen: 1 };
  msgs.set(entry.id, entry);
  _loop(entry);
  return entry.id;
}

function remove(id) {
  const e = msgs.get(id);
  if (!e) return false;
  e.enabled = false; e.gen++;
  msgs.delete(id); return true;
}

function enable(id) {
  const e = msgs.get(id);
  if (!e) return false;
  if (e.enabled) return true;
  e.enabled = true; e.gen++;
  _loop(e); return true;
}

function disable(id) {
  const e = msgs.get(id);
  if (!e) return false;
  e.enabled = false; e.gen++; return true;
}

function edit(id, { text, seconds } = {}) {
  const e = msgs.get(id);
  if (!e) return false;
  if (text)    e.text    = text;
  if (seconds) e.seconds = seconds;
  if (e.enabled) { e.gen++; _loop(e); }
  return true;
}

function list()    { return [...msgs.values()]; }
function get(id)   { return msgs.get(id) || null; }
function stopAll() { msgs.forEach(e => { e.enabled = false; e.gen++; }); }

module.exports = { setApi, add, remove, enable, disable, edit, list, get, stopAll };
