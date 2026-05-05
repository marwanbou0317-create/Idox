/**
 * نظام الرسائل التلقائية
 * يدير رسائل متعددة بأوقات وأهداف مختلفة
 */

const { engineDelay } = require('./delay');
const log = require('./logger');

let nextId = 1;
let currentApi = null;

// Map of id -> { id, text, threadID, intervalSeconds, enabled, timer }
const messages = new Map();

function setApi(api) {
  currentApi = api;
}

function scheduleMessage(entry) {
  if (!entry.enabled || !entry.threadID) return;

  function run() {
    if (!entry.enabled || !currentApi) return;

    // Random jitter ±20%
    const base = entry.intervalSeconds * 1000;
    const jitter = base * 0.2;
    const delay = Math.floor(Math.random() * jitter * 2 + (base - jitter));

    entry.timer = setTimeout(() => {
      if (!entry.enabled || !currentApi) return;
      currentApi.sendMessage(entry.text, entry.threadID, (err) => {
        if (err) log.error('AutoMsg [' + entry.id + '] خطأ: ' + err);
      });
      run();
    }, delay);
  }

  run();
}

function stopMessage(entry) {
  if (entry.timer) {
    clearTimeout(entry.timer);
    entry.timer = null;
  }
}

function addMessage(text, threadID, intervalSeconds) {
  const id = nextId++;
  const entry = { id, text, threadID, intervalSeconds, enabled: true, timer: null };
  messages.set(id, entry);
  scheduleMessage(entry);
  return id;
}

function removeMessage(id) {
  const entry = messages.get(id);
  if (!entry) return false;
  stopMessage(entry);
  messages.delete(id);
  return true;
}

function enableMessage(id) {
  const entry = messages.get(id);
  if (!entry) return false;
  if (entry.enabled) return true;
  entry.enabled = true;
  scheduleMessage(entry);
  return true;
}

function disableMessage(id) {
  const entry = messages.get(id);
  if (!entry) return false;
  entry.enabled = false;
  stopMessage(entry);
  return true;
}

function listMessages() {
  return [...messages.values()];
}

function getMessage(id) {
  return messages.get(id) || null;
}

function stopAll() {
  for (const entry of messages.values()) {
    entry.enabled = false;
    stopMessage(entry);
  }
}

module.exports = { setApi, addMessage, removeMessage, enableMessage, disableMessage, listMessages, getMessage, stopAll };
