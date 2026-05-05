const { getRole } = require('../utils/admin');
function handle(event, api) {
  const role = getRole(event.senderID);
  const roleText = role === 'superadmin' ? '👑 سوبر أدمن' : role === 'admin' ? '🔧 مشرف' : '👤 عضو';
  const now = new Date().toLocaleTimeString('ar-SA', { hour12: false });
  api.sendMessage('🏓 البوت يعمل!\n⏰ الوقت: ' + now + '\n🪪 رتبتك: ' + roleText, event.threadID);
}
module.exports = { handle };
