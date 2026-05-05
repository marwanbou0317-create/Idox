const { getRole } = require('../utils/admin');

function handle(event, api, args, prefix) {
  const role = getRole(event.senderID);
  const threadID = event.threadID;

  const baseCommands =
    '📋 قائمة الأوامر:\n\n' +
    prefix + 'ping — اختبار البوت\n' +
    prefix + 'اوامر — عرض هذه القائمة\n' +
    prefix + 'سيرفر — معلومات البوت والسيرفر\n' +
    prefix + 'ابتيم — وقت تشغيل البوت';

  const adminCommands =
    '\n\n🔧 أوامر الإدارة:\n' +
    prefix + 'محرك — تشغيل/إيقاف المحرك\n' +
    prefix + 'محرك رسالة [نص]\n' +
    prefix + 'محرك وقت [ثواني] (min: 10ث)\n' +
    prefix + 'محرك الذكي\n' +
    prefix + 'محرك حالة\n\n' +
    prefix + 'قفل — قفل/فتح هذه المجموعة\n' +
    prefix + 'قفل الذكي — قفل كل المجموعات\n' +
    prefix + 'قفل حالة\n\n' +
    prefix + 'كنية @شخص [كنية] — تعيين كنية\n' +
    prefix + 'كنية @شخص reset — مسح الكنية\n' +
    prefix + 'كنية الكل [كنية] — كنية للجميع\n' +
    prefix + 'كنيات [نص] — نفس الكنية لكل الأعضاء\n\n' +
    prefix + 'رسائل إضافة [وقت] [نص] — رسالة تلقائية\n' +
    prefix + 'رسائل قائمة — عرض الرسائل التلقائية\n' +
    prefix + 'رسائل إيقاف [id] — إيقاف رسالة\n' +
    prefix + 'رسائل تشغيل [id] — تشغيل رسالة\n' +
    prefix + 'رسائل حذف [id] — حذف رسالة\n' +
    prefix + 'رسائل حالة — إحصائيات الرسائل';

  const superAdminCommands =
    '\n\n👑 أوامر سوبر أدمن:\n' +
    prefix + 'رفع [@شخص أو ID] — رفع لمشرف\n' +
    prefix + 'اخفاض [@شخص أو ID] — إنزال من مشرف';

  let msg = baseCommands;
  if (role === 'admin' || role === 'superadmin') msg += adminCommands;
  if (role === 'superadmin') msg += superAdminCommands;

  const roleText = role === 'superadmin' ? '👑 سوبر أدمن' : role === 'admin' ? '🔧 مشرف' : '👤 عضو';
  msg += '\n\n🪪 رتبتك: ' + roleText;

  return api.sendMessage(msg, threadID);
}

module.exports = { handle };
