const AM = require('../utils/autoMessages');

function setApi(api) { AM.setApi(api); }

function fmtSecs(s) {
  if (s < 60)   return s + 'ث';
  if (s < 3600) return Math.floor(s/60) + 'د';
  return Math.floor(s/3600) + 'س ' + (Math.floor((s%3600)/60) || '');
}

// تحويل "5م" أو "2س" أو "30" → ثواني
function parseTime(str) {
  if (!str) return null;
  const n = parseFloat(str);
  if (isNaN(n) || n <= 0) return null;
  if (str.endsWith('د') || str.endsWith('م') || str.endsWith('m')) return Math.round(n * 60);
  if (str.endsWith('س') || str.endsWith('h'))                        return Math.round(n * 3600);
  const s = Math.round(n);
  return s >= 10 ? s : null;
}

function handle(event, api, args) {
  const { threadID } = event;
  const sub = (args[0] || '').toLowerCase();

  // ── إضافة ──────────────────────────────────
  if (sub === 'إضافة' || sub === 'اضافة' || sub === 'add') {
    const secs = parseTime(args[1]);
    const text = args.slice(2).join(' ').trim();

    if (!secs || !text)
      return api.sendMessage(
        '❗ الاستخدام:\n/رسائل إضافة [وقت] [نص]\n\n' +
        'أمثلة:\n/رسائل إضافة 30 مرحبا\n/رسائل إضافة 5م صباح الخير\n/رسائل إضافة 1س تذكير\n\n' +
        'الوحدات: ث | م/د | س\nحد أدنى: 10ث', threadID);

    const id = AM.add(text, threadID, secs);
    return api.sendMessage(
      '✅ تمت الإضافة!\n🆔 #' + id + '\n⏱ كل ~' + fmtSecs(secs) + ' (±20%)\n💬 ' + text, threadID);
  }

  // ── قائمة ──────────────────────────────────
  if (sub === 'قائمة' || sub === 'list') {
    const all = AM.list();
    if (!all.length) return api.sendMessage('📭 لا توجد رسائل تلقائية.\n/رسائل إضافة [وقت] [نص]', threadID);
    const lines = all.map(m =>
      (m.enabled ? '🟢' : '🔴') + ' #' + m.id +
      ' — كل ~' + fmtSecs(m.seconds) +
      '\n   💬 ' + m.text.slice(0, 50) + (m.text.length > 50 ? '...' : ''));
    return api.sendMessage('📋 الرسائل التلقائية (' + all.length + '):\n\n' + lines.join('\n\n'), threadID);
  }

  // ── حذف ──────────────────────────────────
  if (sub === 'حذف' || sub === 'delete') {
    const id = parseInt(args[1]);
    if (isNaN(id)) return api.sendMessage('❗ /رسائل حذف [رقم]', threadID);
    return api.sendMessage(AM.remove(id) ? '🗑 تم حذف #' + id : '⚠️ لا توجد رسالة #' + id, threadID);
  }

  // ── إيقاف ──────────────────────────────────
  if (sub === 'إيقاف' || sub === 'ايقاف' || sub === 'off') {
    const id = parseInt(args[1]);
    if (isNaN(id)) {
      const all = AM.list().filter(m => m.enabled);
      all.forEach(m => AM.disable(m.id));
      return api.sendMessage('🔴 تم إيقاف ' + all.length + ' رسالة.', threadID);
    }
    return api.sendMessage(AM.disable(id) ? '🔴 تم إيقاف #' + id : '⚠️ لا توجد رسالة #' + id, threadID);
  }

  // ── تشغيل ──────────────────────────────────
  if (sub === 'تشغيل' || sub === 'on') {
    const id = parseInt(args[1]);
    if (isNaN(id)) {
      const all = AM.list().filter(m => !m.enabled);
      all.forEach(m => AM.enable(m.id));
      return api.sendMessage('🟢 تم تشغيل ' + all.length + ' رسالة.', threadID);
    }
    return api.sendMessage(AM.enable(id) ? '🟢 تم تشغيل #' + id : '⚠️ لا توجد رسالة #' + id, threadID);
  }

  // ── حالة ──────────────────────────────────
  if (sub === 'حالة' || sub === 'status') {
    const all    = AM.list();
    const active = all.filter(m => m.enabled).length;
    return api.sendMessage(
      '📊 الرسائل التلقائية:\n▪ المجموع: ' + all.length +
      '\n▪ تعمل: 🟢 ' + active +
      '\n▪ متوقفة: 🔴 ' + (all.length - active), threadID);
  }

  // ── مساعدة ──────────────────────────────────
  return api.sendMessage(
    '📨 أوامر الرسائل التلقائية:\n' +
    '/رسائل إضافة [وقت] [نص]\n' +
    '/رسائل قائمة\n' +
    '/رسائل إيقاف [id]\n' +
    '/رسائل تشغيل [id]\n' +
    '/رسائل حذف [id]\n' +
    '/رسائل حالة\n\n' +
    'مثال:\n/رسائل إضافة 5م صباح الخير 🌅', threadID);
}

module.exports = { handle, setApi };
