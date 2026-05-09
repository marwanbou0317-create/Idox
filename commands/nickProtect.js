const protect = require('../utils/nickProtect');
const log     = require('../utils/logger');

async function handle(event, api, args) {
  const { threadID, mentions } = event;
  const sub = (args[0] || '').trim().toLowerCase();

  if (sub === 'عرض' || sub === 'قائمة' || sub === 'list') {
    const list = protect.listProtected(threadID);
    if (!list.length)
      return api.sendMessage('ℹ️ لا توجد كنيات محمية في هذه المجموعة.', threadID);
    const lines = list.map(([uid, nick]) => '• ' + uid + ': ' + (nick || '(فارغة)')).join('
');
    return api.sendMessage('🔒 الكنيات المحمية:
' + lines, threadID);
  }

  const mentionIDs = Object.keys(mentions || {});

  if (!mentionIDs.length)
    return api.sendMessage(
      '📌 الاستخدام:
' +
      '/تثبيت @شخص [كنية] — تثبيت كنية شخص
' +
      '/تثبيت @شخص إلغاء — إلغاء حماية كنيته
' +
      '/تثبيت عرض — عرض جميع الكنيات المحمية',
      threadID
    );

  const uid = mentionIDs[0];
  const mentionName = (mentions || {})[uid] || uid;
  const rest = args.slice(1).join(' ').trim().toLowerCase();

  if (rest === 'إلغاء' || rest === 'الغاء') {
    if (!protect.isProtected(threadID, uid))
      return api.sendMessage('ℹ️ كنية ' + mentionName + ' غيير محمية أصلاً.', threadID);
    protect.unprotect(threadID, uid);
    return api.sendMessage('🔓 تم إلغاء حمية كنية ' + mentionName + '.', threadID);
  }

  const nick = args.slice(1).join(' ').trim();

  try {
    if (nick) await api.changeNickname(nick, threadID, uid);
  } catch (e) {
    log.error('nickProtect changeNickname: ' + e.message);
  }

  protect.protect(threadID, uid, nick);
  return api.sendMessage(
    '🔒 تم تثبيت كنية ' + mentionName + '
' +
    '📌 الكنية: ' + (nick || '(فارغة)') + '

' +
    'أي محاولة لتغييرها ستُستعاد تلقائياً خلال 5 ثواني.',
    threadID
  );
}

module.exports = { handle };
