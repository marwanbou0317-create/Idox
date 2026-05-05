const { isSuperAdmin, isAdmin, addAdmin } = require('../utils/admin');
const log = require('../utils/logger');

function parseMentions(mentions) {
  if (!mentions) return null;
  if (Array.isArray(mentions) && mentions.length > 0) {
    const m = mentions[0];
    return { id: String(m.id || m.userID || ''), name: String(m.name || m.tag || '') };
  }
  const keys = Object.keys(mentions);
  if (keys.length > 0) return { id: String(keys[0]), name: String(mentions[keys[0]] || keys[0]) };
  return null;
}

function handle(event, api, args) {
  const { senderID, threadID } = event;
  if (!isSuperAdmin(senderID))
    return api.sendMessage('❌ فقط سوبر أدمن يمكنه رفع الأشخاص.', threadID);

  let targetID = null, targetName = null;
  const mention = parseMentions(event.mentions);

  if (mention && mention.id) {
    targetID = mention.id;
    targetName = mention.name;
  } else if (args[0] && /^\d{5,}$/.test(args[0])) {
    targetID = args[0];
    targetName = args[0];
  }

  if (!targetID)
    return api.sendMessage('❗ يجب تحديد شخص.\nمثال: /رفع @اسم\nأو: /رفع [ID]', threadID);
  if (isSuperAdmin(targetID))
    return api.sendMessage('⚠️ هذا الشخص سوبر أدمن. لا يمكن تغيير رتبته.', threadID);
  if (isAdmin(targetID))
    return api.sendMessage('⚠️ ' + targetName + ' هو مشرف بالفعل.', threadID);

  addAdmin(targetID);
  log.bot(targetID + ' promoted to admin by ' + senderID);
  return api.sendMessage('✅ تم رفع ' + targetName + ' إلى مشرف البوت.', threadID);
}

module.exports = { handle };
