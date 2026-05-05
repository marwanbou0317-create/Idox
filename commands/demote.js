const { isSuperAdmin, isAdmin, removeAdmin } = require('../utils/admin');
const log = require('../utils/logger');
function handle(event, api, args) {
  const { senderID, threadID, mentions } = event;
  if (!isSuperAdmin(senderID)) return api.sendMessage('❌ فقط سوبر أدمن يمكنه إنزال الأشخاص.', threadID);
  let targetID = null, targetName = null;
  if (mentions && Object.keys(mentions).length > 0) { targetID = Object.keys(mentions)[0]; targetName = mentions[targetID]; }
  else if (args[0] && /^\d+$/.test(args[0])) { targetID = args[0]; targetName = 'ID: ' + args[0]; }
  if (!targetID) return api.sendMessage('❗ يجب تحديد شخص.\nمثال: /اخفاض @اسم\nأو: /اخفاض [ID]', threadID);
  if (isSuperAdmin(targetID)) return api.sendMessage('🚫 لا يمكن إنزال سوبر أدمن. هذه الرتبة محمية.', threadID);
  if (!isAdmin(targetID)) return api.sendMessage('⚠️ ' + (targetName || targetID) + ' ليس مشرفاً.', threadID);
  removeAdmin(targetID);
  log.bot(targetID + ' demoted by ' + senderID);
  return api.sendMessage('✅ تم إنزال ' + (targetName || targetID) + ' من رتبة مشرف البوت.', threadID);
}
module.exports = { handle };
