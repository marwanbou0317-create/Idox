// طابور عمليات API — يمنع إرسال طلبات كثيرة بشكل متزامن
// يضمن تسلسل العمليات مع تأخير إنساني بين كل طلب وآخر

const MIN_GAP = 800;   // أقل فجوة بين أي طلبين (ms)
const MAX_GAP = 2200;  // أقصى فجوة عشوائية (ms)

let lastCall = 0;

function jitter(min, max) {
  return Math.floor(min + Math.random() * (max - min));
}

/**
 * نفّذ دالة بعد تأخير إنساني عشوائي.
 * @param {Function} fn - الدالة المطلوب تنفيذها (يجب أن ترجع Promise)
 * @returns {Promise<any>}
 */
async function enqueue(fn) {
  const now  = Date.now();
  const gap  = jitter(MIN_GAP, MAX_GAP);
  const wait = Math.max(0, (lastCall + gap) - now);

  if (wait > 0) await new Promise(r => setTimeout(r, wait));

  lastCall = Date.now();
  return fn();
}

module.exports = { enqueue, jitter };
