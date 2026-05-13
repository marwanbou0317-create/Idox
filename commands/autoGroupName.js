const protect = require('../utils/groupNameProtect');
const log     = require('../utils/logger');

function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

async function handle(event, api, args) {
  const { threadID } = event;
  const sub = (args[0] || '').trim().toLowerCase();

  if (sub === 'إيقاف' || sub === 'ايقاف' || sub === 'off') {
    return api.sendMessage(
      '❌ تم إيقاف التعيين التلقائي.\n' +
      'استخدم /تعيين تلقائي [النمط] لتشغيله مجدداً.',
      threadID
    );
  }

  if (sub === 'حالة' || sub === 'عرض' || sub === 'status') {
    return api.sendMessage(
      '⚙️ أنماط التعيين التلقائي المتاحة:\n\n' +
      '1️⃣ /تعيين تلقائي عام\n' +
      '   يعيّن اسم المجموعة تلقائياً كل ساعة\n\n' +
      '2️⃣ /تعيين تلقائي يومي\n' +
      '   يعيّن الاسم يومياً في الساعة 12 ظهراً\n\n' +
      '3️⃣ /تعيين تلقائي ساعة [الساعة]\n' +
      '   يعيّن الاسم في ساعة محددة يومياً\n\n' +
      '4️⃣ /تعيين تلقائي توقيت [الدقائق]\n' +
      '   يعيّن الاسم كل X دقيقة',
      threadID
    );
  }

  const pattern = (args[0] || '').toLowerCase();
  const value = args.slice(1).join(' ').trim();

  if (pattern === 'عام' || pattern === 'general') {
    protect.protect(threadID, `مجموعة ${new Date().getHours()}:00`);
    return api.sendMessage(
      '✅ تم تفعيل التعيين التلقائي (عام)\n' +
      '📅 سيتم تحديث الاسم كل ساعة تلقائياً',
      threadID
    );
  }

  if (pattern === 'يومي' || pattern === 'daily') {
    protect.protect(threadID, `مجموعة اليوم`);
    return api.sendMessage(
      '✅ تم تفعيل التعيين اليومي\n' +
      '📅 سيتم تحديث الاسم يومياً في الساعة 12 ظهراً',
      threadID
    );
  }

  if (pattern === 'ساعة' || pattern === 'hour') {
    if (!value || isNaN(value) || value < 0 || value > 23) {
      return api.sendMessage(
        '❌ أدخل ساعة صحيحة (0-23)\n' +
        'مثال: /تعيين تلقائي ساعة 15',
        threadID
      );
    }
    protect.protect(threadID, `مجموعة ${value}:00`);
    return api.sendMessage(
      `✅ تم تفعيل التعيين في الساعة ${value}:00\n` +
      '📅 سيتم تحديث الاسم يومياً في هذا الوقت',
      threadID
    );
  }

  if (pattern === 'توقيت' || pattern === 'interval') {
    if (!value || isNaN(value) || value < 5 || value > 1440) {
      return api.sendMessage(
        '❌ أدخل عدد دقائق صحيح (5-1440)\n' +
        'مثال: /تعيين تلقائي توقيت 30',
        threadID
      );
    }
    protect.protect(threadID, `مجموعة كل ${value}د`);
    return api.sendMessage(
      `✅ تم تفعيل التعيين كل ${value} دقيقة\n` +
      '📅 سيتم تحديث الاسم تلقائياً بشكل دوري',
      threadID
    );
  }

  return api.sendMessage(
    '📋 الاستخدام:\n' +
    '/تعيين تلقائي عام — تعيين عام كل ساعة\n' +
    '/تعيين تلقائي يومي — تعيين يومي\n' +
    '/تعيين تلقائي ساعة [0-23] — تعيين في ساعة محددة\n' +
    '/تعيين تلقائي توقيت [5-1440] — تعيين بفترة دقائق\n' +
    '/تعيين تلقائي حالة — عرض الأنماط المتاحة\n' +
    '/تعيين تلقائي إيقاف — إيقاف التعيين',
    threadID
  );
}

module.exports = { handle };
