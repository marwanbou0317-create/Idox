const protect = require('../utils/groupNameProtect');
const log     = require('../utils/logger');

async function handle(event, api, args) {
  const { threadID } = event;
  const sub = (args[0] || '').trim().toLowerCase();

  if (sub === 'إلغاء' || sub === 'الغاء' || sub === 'unlock') {
    if (!protect.isProtected(threadID))
      return api.sendMessage('ℹ️ اسم المجموعة غير محمي أصلاً.', threadID);
    protect.unprotect(threadID);
    return api.sendMessage('🔓 تم إلغاء حماية اسم المجموعة.', threadID);
  }

  if (sub === 'عرض' || sub === 'حالة' || sub === 'status') {
    if (!protect.isProtected(threadID))
      return api.sendMessage('ℹ️ اسم المجموعة غير محمي حالياً.', threadID);
    return api.sendMessage('🔒 اسم المجموعة محمي ومثبت.', threadID);
  }

  const name = args.join(' ').trim();

  if (!name)
    return api.sendMessage(
      '📌 الاستخدام:
' +
      '/اسم [الاسم] — تثبيت اسم المجموعة
' +
      '/اسم إلغاء — إلغاء الحماية
' +
      '/اسم عرض — عرض الحالة',
      threadID);

  try { await api.setTitle(name, threadID); } catch (e) {
    log.error('groupProtect set: ' + e.message);
  }
  protect.protect(threadID, name);
  return api.sendMessage('🔒 تم تثبيت اسم المجموعة.', threadID);
}

module.exports = { handle };
