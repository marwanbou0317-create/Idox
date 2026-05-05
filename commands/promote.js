const admin = require('../utils/admin');
const parseMentions = require('../_mentions');

function handle(event, api, args) {
  const { senderID, threadID } = event;
  if (!admin.isSuperAdmin(senderID))
    return api.sendMessage('❌ فقط سوبر أدمن يمكنه رفع الأشخاص.', threadID);

  const mentions = parseMentions(event.mentions);
  let id, name;

  if (mentions.length) {
    id   = mentions[0].id;
    name = mentions[0].name;
  } else if (args[0] && /^\d{5,}$/.test(args[0])) {
    id   = args[0];
    name = id;
  } else {
    return api.sendMessage('❗ حدد شخصاً.\nمثال: /رفع @اسم\nأو: /رفع [ID]', threadID);
  }

  if (admin.isSuperAdmin(id)) return api.sendMessage('⚠️ هذا الشخص سوبر أدمن — لا يمكن تغيير رتبته.', threadID);
  if (admin.isAdmin(id))      return api.sendMessage('⚠️ ' + name + ' مشرف بالفعل.', threadID);

  admin.promote(id);
  return api.sendMessage('✅ تم رفع ' + name + ' إلى مشرف البوت.', threadID);
}

module.exports = { handle };
