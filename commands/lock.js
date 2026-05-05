const locked = new Set();
let smartLock = false;

const isLocked = threadID => smartLock || locked.has(String(threadID));

function handle(event, api, args) {
  const { threadID } = event;
  const sub = (args[0] || '').toLowerCase();

  if (!sub) {
    if (locked.has(String(threadID))) {
      locked.delete(String(threadID));
      return api.sendMessage('🔓 تم فتح هذه المجموعة. البوت يستجيب للجميع.', threadID);
    }
    locked.add(String(threadID));
    return api.sendMessage('🔒 تم قفل هذه المجموعة. البوت يستجيب للمشرفين فقط.', threadID);
  }

  if (sub === 'الذكي' || sub === 'smart') {
    smartLock = !smartLock;
    return api.sendMessage(smartLock
      ? '🔒 القفل الذكي مفعّل — كل المجموعات مقفلة.'
      : '🔓 القفل الذكي موقوف.', threadID);
  }

  if (sub === 'حالة' || sub === 'status') {
    return api.sendMessage(
      '🔒 حالة القفل:\n' +
      '▪ القفل الذكي: ' + (smartLock ? '🔴 مفعّل' : '⚪ موقوف') + '\n' +
      '▪ هذه المجموعة: ' + (locked.has(String(threadID)) ? '🔒 مقفلة' : '🔓 مفتوحة'), threadID);
  }

  return api.sendMessage('/قفل — قفل/فتح\n/قفل الذكي\n/قفل حالة', threadID);
}

module.exports = { handle, isLocked };
