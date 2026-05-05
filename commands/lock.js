const { isAdmin } = require('../utils/admin');
const { lockState, setSmartLock, lockGroup, unlockGroup, isLocked } = require('../utils/state');
const log = require('../utils/logger');

function handle(event, api, args, prefix) {
  const { senderID, threadID } = event;
  if (!isAdmin(senderID)) return api.sendMessage('❌ ليس لديك صلاحية استخدام هذا الأمر.', threadID);
  const subCmd = args[0] || '';

  if (!subCmd) {
    if (lockState.lockedGroups.has(String(threadID))) {
      unlockGroup(threadID); log.bot('Group ' + threadID + ' unlocked by ' + senderID);
      return api.sendMessage('🔓 تم فتح هذه المجموعة.\nالبوت سيستجيب للجميع الآن.', threadID);
    } else {
      lockGroup(threadID); log.bot('Group ' + threadID + ' locked by ' + senderID);
      return api.sendMessage('🔒 تم قفل هذه المجموعة.\nالبوت لن يستجيب إلا للمشرفين.', threadID);
    }
  }
  if (subCmd === 'الذكي' || subCmd === 'smart') {
    const v = !lockState.smartLock; setSmartLock(v);
    return api.sendMessage(v ? '🔒 تم تفعيل القفل الذكي.\nالبوت مقفل في جميع المجموعات.' : '🔓 تم إيقاف القفل الذكي.', threadID);
  }
  if (subCmd === 'تشغيل' || subCmd === 'on') {
    lockGroup(threadID);
    return api.sendMessage('🔒 تم تشغيل القفل في هذه المجموعة.', threadID);
  }
  if (subCmd === 'ايقاف' || subCmd === 'إيقاف' || subCmd === 'off') {
    unlockGroup(threadID); if (lockState.smartLock) setSmartLock(false);
    return api.sendMessage('🔓 تم إيقاف القفل.', threadID);
  }
  if (subCmd === 'حالة' || subCmd === 'status') {
    const locked = isLocked(threadID);
    return api.sendMessage(
      '🔒 حالة القفل:\n' +
      '▪️ الذكي: ' + (lockState.smartLock ? '🔴 مفعل' : '⚪ موقوف') + '\n' +
      '▪️ هذه المجموعة: ' + (lockState.lockedGroups.has(String(threadID)) ? '🔴 مقفل' : '🟢 مفتوح') + '\n' +
      '▪️ الحالة الفعلية: ' + (locked ? '🔒 مقفل' : '🔓 مفتوح'),
      threadID
    );
  }
  return api.sendMessage(
    '🔒 أوامر القفل:\n' +
    prefix + 'قفل — قفل/فتح هذه المجموعة\n' +
    prefix + 'قفل الذكي — قفل/فتح كل المجموعات\n' +
    prefix + 'قفل حالة — عرض الحالة',
    threadID
  );
}
module.exports = { handle };
