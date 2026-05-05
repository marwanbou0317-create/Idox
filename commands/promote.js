const { isSuperAdmin, isAdmin, addAdmin } = require('../utils/admin');
const log = require('../utils/logger');
function handle(event, api, args) {
  const { senderID, threadID, mentions } = event;
  if (!isSuperAdmin(senderID)) return api.sendMessage('❌ فقط سوبر أدمن يمكنه رفع الأشخاص.', threadID);
  let targetID = null, targetName = null;
  if (mentions && Object.keys(mentions).length > 0) { targetID = Object.keys(mentions)[0]; targetName = mentions[targetID]; }
  else if (args[0] && /^\d+$/.test(args[0])) { targetID = args[0]; targetName = 'ID: ' + args[0]; }
  if (!targetID) return api.sendMessage('❗ يجب تحديد شخص.\nمثال: /رفع @اسم\nأو: /رفع [ID]', threadID);
  if (isSuperAdmin(targetID)) return api.sendMessage('⚠️ هذا الشخص سوبر أدمن ولا يمكن تغيير رتبته.', threadID);
  if (isAdmin(targetID)) return api.sendMessage('⚠️ ' + (targetName || targetID) + ' هو مشرف بالفعل.', threadID);
  addAdmin(targetID);
  log.bot(targetID + ' promoted by ' + senderID);
  return api.sendMessage('✅ تم رفع ' + (targetName || targetID) + ' إلى مشرف البوت.', threadID);
}
module.exports = { handle };
