const admin = require('../utils/admin');

function handle(event, api) {
  const role = admin.getRole(event.senderID);
  const roleText = role === 'superadmin' ? '👑 سوبر أدمن' : role === 'admin' ? '🔧 مشرف' : '👤 عضو';
  const t = new Date().toLocaleTimeString('ar-SA', { hour12: false });
  api.sendMessage('🏓 البوت يعمل!\n⏰ ' + t + '\n🪪 رتبتك: ' + roleText, event.threadID);
}

module.exports = { handle };
