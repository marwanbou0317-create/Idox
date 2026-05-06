// نظام تحديد المعدل — يمنع إرسال أوامر كثيرة دفعة واحدة
const cooldowns = new Map(); // key: uid:cmd → timestamp

function _key(uid, cmd) { return uid + ':' + cmd; }

/**
 * هل يُسمح للمستخدم بتنفيذ الأمر؟
 * @param {string} uid - معرف المستخدم
 * @param {string} cmd - اسم الأمر
 * @param {number} secs - فترة الانتظار بالثواني
 * @returns {{ allowed: boolean, remaining: number }}
 */
function check(uid, cmd, secs) {
  const k   = _key(uid, cmd);
  const now = Date.now();
  const last = cooldowns.get(k) || 0;
  const elapsed = (now - last) / 1000;

  if (elapsed < secs) {
    return { allowed: false, remaining: Math.ceil(secs - elapsed) };
  }
  cooldowns.set(k, now);
  return { allowed: true, remaining: 0 };
}

// تنظيف الإدخالات القديمة كل 10 دقائق لمنع تسرب الذاكرة
setInterval(() => {
  const cutoff = Date.now() - 10 * 60 * 1000;
  for (const [k, t] of cooldowns) {
    if (t < cutoff) cooldowns.delete(k);
  }
}, 10 * 60 * 1000);

module.exports = { check };
