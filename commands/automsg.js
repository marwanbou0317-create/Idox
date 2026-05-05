const { isAdmin } = require('../utils/admin');
const autoMsg = require('../utils/autoMessages');
const log = require('../utils/logger');

function formatTime(seconds) {
  if (seconds < 60) return seconds + ' ثانية';
  if (seconds < 3600) return Math.floor(seconds / 60) + ' دقيقة';
  return Math.floor(seconds / 3600) + ' ساعة ' + (Math.floor((seconds % 3600) / 60) || '');
}

function parseSeconds(str) {
  if (!str) return null;
  const n = parseInt(str);
  if (isNaN(n) || n < 10) return null;
  // Support: 30s, 5m, 2h
  if (str.endsWith('د') || str.endsWith('m')) return n * 60;
  if (str.endsWith('س') || str.endsWith('h')) return n * 3600;
  return n; // default: seconds
}

function handle(event, api, args, prefix) {
  const { senderID, threadID } = event;

  if (!isAdmin(senderID)) {
    return api.sendMessage('❌ ليس لديك صلاحية استخدام هذا الأمر.', threadID);
  }

  const subCmd = (args[0] || '').toLowerCase();

  // ── /رسائل إضافة [وقت] [نص] ──
  if (subCmd === 'إضافة' || subCmd === 'اضافة' || subCmd === 'add') {
    const rawTime = args[1];
    const text = args.slice(2).join(' ').trim();

    if (!rawTime || !text) {
      return api.sendMessage(
        '❗ الاستخدام:\n' +
        prefix + 'رسائل إضافة [وقت] [نص]\n\n' +
        '📌 أمثلة:\n' +
        prefix + 'رسائل إضافة 30 مرحباً بالجميع\n' +
        prefix + 'رسائل إضافة 5م صباح الخير!\n' +
        prefix + 'رسائل إضافة 1س تذكير مهم\n\n' +
        '⏱ الوحدات: ثانية (افتراضي) | م/m = دقيقة | س/h = ساعة\n' +
        '⚠️ الحد الأدنى: 10 ثواني',
        threadID
      );
    }

    const seconds = parseSeconds(rawTime);
    if (!seconds) {
      return api.sendMessage('❌ وقت غير صحيح. الحد الأدنى 10 ثواني.\nمثال: 30 أو 5م أو 1س', threadID);
    }

    const id = autoMsg.addMessage(text, threadID, seconds);
    log.bot('AutoMsg #' + id + ' added by ' + senderID + ' every ' + seconds + 's');

    return api.sendMessage(
      '✅ تمت الإضافة!\n' +
      '🆔 الرقم: #' + id + '\n' +
      '⏱ كل: ~' + formatTime(seconds) + ' (±20% عشوائي)\n' +
      '💬 الرسالة: ' + text + '\n' +
      '📍 المجموعة: هذه المجموعة\n\n' +
      'لإيقافها: ' + prefix + 'رسائل إيقاف ' + id,
      threadID
    );
  }

  // ── /رسائل قائمة ──
  if (subCmd === 'قائمة' || subCmd === 'list' || subCmd === 'كل') {
    const list = autoMsg.listMessages();
    if (list.length === 0) {
      return api.sendMessage(
        '📭 لا توجد رسائل تلقائية.\n' +
        'لإضافة رسالة: ' + prefix + 'رسائل إضافة [وقت] [نص]',
        threadID
      );
    }
    const lines = list.map(m =>
      (m.enabled ? '🟢' : '🔴') + ' #' + m.id +
      ' | ' + formatTime(m.intervalSeconds) +
      '\n   💬 ' + m.text.slice(0, 40) + (m.text.length > 40 ? '...' : '') +
      '\n   📍 ' + m.threadID
    );
    return api.sendMessage(
      '📋 الرسائل التلقائية (' + list.length + '):\n\n' + lines.join('\n\n'),
      threadID
    );
  }

  // ── /رسائل حذف [id] ──
  if (subCmd === 'حذف' || subCmd === 'delete' || subCmd === 'مسح') {
    const id = parseInt(args[1]);
    if (isNaN(id)) return api.sendMessage('❗ أرسل رقم الرسالة.\nمثال: ' + prefix + 'رسائل حذف 1', threadID);
    if (!autoMsg.removeMessage(id)) return api.sendMessage('⚠️ لا توجد رسالة برقم #' + id, threadID);
    log.bot('AutoMsg #' + id + ' removed by ' + senderID);
    return api.sendMessage('🗑 تم حذف الرسالة #' + id + ' بنجاح.', threadID);
  }

  // ── /رسائل إيقاف [id] ──
  if (subCmd === 'إيقاف' || subCmd === 'ايقاف' || subCmd === 'off') {
    const id = parseInt(args[1]);
    if (isNaN(id)) {
      // Stop all
      const list = autoMsg.listMessages().filter(m => m.enabled);
      list.forEach(m => autoMsg.disableMessage(m.id));
      return api.sendMessage('🔴 تم إيقاف جميع الرسائل التلقائية (' + list.length + ').', threadID);
    }
    if (!autoMsg.disableMessage(id)) return api.sendMessage('⚠️ لا توجد رسالة برقم #' + id, threadID);
    return api.sendMessage('🔴 تم إيقاف الرسالة #' + id, threadID);
  }

  // ── /رسائل تشغيل [id] ──
  if (subCmd === 'تشغيل' || subCmd === 'on') {
    const id = parseInt(args[1]);
    if (isNaN(id)) {
      // Enable all
      const list = autoMsg.listMessages().filter(m => !m.enabled);
      list.forEach(m => autoMsg.enableMessage(m.id));
      return api.sendMessage('🟢 تم تشغيل جميع الرسائل المتوقفة (' + list.length + ').', threadID);
    }
    if (!autoMsg.enableMessage(id)) return api.sendMessage('⚠️ لا توجد رسالة برقم #' + id, threadID);
    return api.sendMessage('🟢 تم تشغيل الرسالة #' + id, threadID);
  }

  // ── /رسائل حالة [id] ──
  if (subCmd === 'حالة' || subCmd === 'status') {
    const id = parseInt(args[1]);
    if (!isNaN(id)) {
      const m = autoMsg.getMessage(id);
      if (!m) return api.sendMessage('⚠️ لا توجد رسالة برقم #' + id, threadID);
      return api.sendMessage(
        '📊 الرسالة #' + m.id + ':\n' +
        '▪️ الحالة: ' + (m.enabled ? '🟢 تعمل' : '🔴 متوقفة') + '\n' +
        '▪️ الوقت: ~' + formatTime(m.intervalSeconds) + ' (±20%)\n' +
        '▪️ الرسالة: ' + m.text + '\n' +
        '▪️ المجموعة: ' + m.threadID,
        threadID
      );
    }
    const list = autoMsg.listMessages();
    const active = list.filter(m => m.enabled).length;
    return api.sendMessage(
      '📊 الرسائل التلقائية:\n' +
      '▪️ المجموع: ' + list.length + '\n' +
      '▪️ تعمل: 🟢 ' + active + '\n' +
      '▪️ متوقفة: 🔴 ' + (list.length - active),
      threadID
    );
  }

  // ── /رسائل تعديل [id] [وقت] [نص] ──
  if (subCmd === 'تعديل' || subCmd === 'edit') {
    const id = parseInt(args[1]);
    if (isNaN(id)) return api.sendMessage('❗ أرسل رقم الرسالة.\nمثال: ' + prefix + 'رسائل تعديل 1 60 نص جديد', threadID);
    const m = autoMsg.getMessage(id);
    if (!m) return api.sendMessage('⚠️ لا توجد رسالة برقم #' + id, threadID);

    const rawTime = args[2];
    const text = args.slice(3).join(' ').trim();

    if (rawTime) {
      const seconds = parseSeconds(rawTime);
      if (!seconds) return api.sendMessage('❌ وقت غير صحيح. الحد الأدنى 10 ثواني.', threadID);
      m.intervalSeconds = seconds;
    }
    if (text) m.text = text;

    // Restart timer if enabled
    if (m.enabled) {
      autoMsg.disableMessage(id);
      m.enabled = true;
      autoMsg.enableMessage(id);
    }

    return api.sendMessage(
      '✅ تم تعديل الرسالة #' + id + ':\n' +
      '▪️ الوقت: ~' + formatTime(m.intervalSeconds) + '\n' +
      '▪️ الرسالة: ' + m.text,
      threadID
    );
  }

  // ── Help ──
  return api.sendMessage(
    '📨 أوامر الرسائل التلقائية:\n\n' +
    prefix + 'رسائل إضافة [وقت] [نص] — إضافة رسالة\n' +
    prefix + 'رسائل قائمة — عرض كل الرسائل\n' +
    prefix + 'رسائل حالة — إحصائيات\n' +
    prefix + 'رسائل تعديل [id] [وقت] [نص]\n' +
    prefix + 'رسائل إيقاف [id] — إيقاف رسالة\n' +
    prefix + 'رسائل إيقاف — إيقاف الكل\n' +
    prefix + 'رسائل تشغيل [id] — تشغيل رسالة\n' +
    prefix + 'رسائل حذف [id] — حذف نهائي\n\n' +
    '📌 مثال:\n' +
    prefix + 'رسائل إضافة 5م صباح الخير! 🌅\n' +
    prefix + 'رسائل إضافة 1س تذكير: لا تنسوا القواعد',
    threadID
  );
}

module.exports = { handle };
