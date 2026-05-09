const protect = require('../utils/groupNameProtect');
const log     = require('../utils/logger');

async function handle(event, api, args) {
  const { threadID } = event;
  const sub = (args[0] || '').trim().toLowerCase();

  if (sub === 'إلغاء' || sub === 'الغاء' || sub === 'off') {
    if (!protect.isProtected(threadID))
      return api.sendMessage('ℹ️ اسم المجموعة غيير محمي
ℹ️ المجموعة غيير محم أصلاً.', threadID);
    protect.unprotect(threadID);
    return api.sendMessage('🔓 تم إلغاء حماية اسم المجموعة.', threadID);
  }

  if (sub === 'حالة' || sub === 'عرض' || sub === 'status') {
    if (!protect.isProtected(threadID))
      return api.sendMessage('ℹ️ اسم المجموعة غير محمي حالياً.', threadID);
    const name = protect.getProtected(threadID);
    return api.sendMessage('🔒 اسم المجموعة محمي
📌 الاسم المثبت: ' + name, threadID);
  }

  const name = args.join(' ').trim();

  if (!name)
    return api.sendMessage(
      '📌 الاستخدام:
' +
      '/اسم [الاسم] — تغيير وتثبيت اسم المجموعة
' +
      '/اسم إلغاء — إلغاء الحماية
' +
      '/اسم حالة — عرض الحالة',
      threadID
    );

  try {
    await api.setTitle(name, threadID);
  } catch (e) {
    log.error('groupProtect setTitle: ' + e.message);
    return api.sendMessage('❌ فشل تغيير اسم المجموعة.', threadID);
  }

  protect.protect(threadID, name);
  return api.sendMessage(
    '🔒 تم تغيير اسم المجموعة وتثبيته
' +
    '📌 الاسم: ' + name + '

' +
    'أي محاولة لتغييره ستُستعاد تلقائياً خلال 5 ثواني.',
    threadID
  );
}

module.exports = { handle };
