const admin = require('../utils/admin');
const parseMentions = require('../_mentions');

function handle(event, api, args) {
  const { senderID, threadID } = event;
  if (!admin.isSuperAdmin(senderID))
    return api.sendMessage('❌ فقط سوبر أدمن يمكنه إنزال الأشخاص.', threadID);

  const mentions = parseMentions(event.mentions);
  let id, name;

  if (mentions.length) {
    id   = mentions[0].id;
    name = mentions[0].name;
  } else if (args[0] && /^\d{5,}$/.test(args[0])) {
    id   = args[0];
    name = id;
  } else {
    return api.sendMessage('❗ حدد شخصاً.\nمثال: /اخفاض @اسم\nأو: /اخفاض [ID]', threadID);
  }

  if (admin.isSuperAdmin(id)) return api.sendMessage('🚫 لا يمكن إنزال سوبر أدمن.', threadID);
  if (!admin.isAdmin(id))     return api.sendMessage('⚠️ ' + name + ' ليس مشرفاً.', threadID);

  admin.demote(id);
  return api.sendMessage('✅ تم إنزال ' + name + ' من رتبة مشرف البوت.', threadID);
}

module.exports = { handle };
