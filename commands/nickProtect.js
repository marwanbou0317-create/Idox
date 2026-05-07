const protect       = require('../utils/nickProtect');
const parseMentions = require('../_mentions');
const { setNick, getThread } = require('../_nick_helper');
const log           = require('../utils/logger');

async function handle(event, api, args) {
  const { threadID } = event;
  const sub = (args[0] || '').trim().toLowerCase();

  if (sub === 'قائمة' || sub === 'list') {
    const list = protect.listProtected(threadID);
    if (!list.length)
      return api.sendMessage('📋 لا توجد كنيات محمية في هذه المجموعة.', threadID);
    const lines = list.map(([uid, nick]) => '▪ ' + uid + ': "' + (nick || '(فارغة)') + '"').join('
');
    return api.sendMessage('🔒 الكنيات المحمية:
' + lines, threadID);
  }

  const mentions = parseMentions(event.mentions);
  if (!mentions.length)
    return api.sendMessage(
      '📌 الاستخدام:
' +
      '/تثبيت @شخص [كنية] — تثبيت كنية
' +
      '/تثبيت @شخص إلغاء — إلغاء الحماية
' +
      '/تثبيت قائمة — عرض المحميين',
      threadID);

  const { id, name } = mentions[0];
  const nameWords = name.trim().split(/s+/).filter(Boolean).length;
  const raw = args.slice(nameWords).join(' ').trim();

  if (raw === 'إلغاء' || raw === 'الغاء' || raw === 'remove' || raw === 'unlock') {
    protect.unprotect(threadID, id);
    return api.sendMessage('🔓 تم إلغاء حماية كنية ' + name + '.', threadID);
  }

  if (!raw) {
    const info = await getThread(api, threadID);
    const currentNick = info?.nicknames?.[id] || '';
    protect.protect(threadID, id, currentNick);
    return api.sendMessage(
      '🔒 تم تثبيت كنية ' + name + ' على: "' + (currentNick || '(فارغة)') + '"',
      threadID);
  }

  try { await api.nickname(raw, threadID, id); } catch (e) {
    log.error('nickProtect set: ' + e.message);
  }
  protect.protect(threadID, id, raw);
  return api.sendMessage('🔒 تم تثبيت كنية ' + name + ': "' + raw + '"', threadID);
}

module.exports = { handle };
