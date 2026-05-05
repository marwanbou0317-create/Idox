// نظام الرسائل التلقائية — كل رسالة تملك "جيلها" الخاص لمنع السلاسل المتعددة
const log = require('./logger');

let botApi = null;
const msgs = new Map();   // id → entry
let nextId = 1;

function setApi(api) { botApi = api; }

function _scheduleLoop(entry) {
  const myGen = entry.gen;
  const delay = entry.seconds * 1000;
  const jitter = delay * 0.2;
  const actual = Math.round(delay - jitter + Math.random() * jitter * 2);

  setTimeout(() => {
    if (!entry.enabled || entry.gen !== myGen || !botApi) return;
    botApi.sendMessage(entry.text, entry.threadID, err => {
      if (err) log.error('AutoMsg #' + entry.id + ': ' + JSON.stringify(err));
    });
    _scheduleLoop(entry);
  }, actual);
}

function add(text, threadID, seconds) {
  const entry = { id: nextId++, text, threadID, seconds, enabled: true, gen: 1 };
  msgs.set(entry.id, entry);
  _scheduleLoop(entry);
  return entry.id;
}

function remove(id) {
  const e = msgs.get(id); if (!e) return false;
  e.enabled = false; e.gen++;
  msgs.delete(id); return true;
}

function enable(id) {
  const e = msgs.get(id); if (!e) return false;
  if (e.enabled) return true;
  e.enabled = true; e.gen++;
  _scheduleLoop(e); return true;
}

function disable(id) {
  const e = msgs.get(id); if (!e) return false;
  e.enabled = false; e.gen++; return true;
}

function list()       { return [...msgs.values()]; }
function get(id)      { return msgs.get(id) || null; }
function stopAll()    { msgs.forEach(e => { e.enabled = false; e.gen++; }); }

module.exports = { setApi, add, remove, enable, disable, list, get, stopAll };
