// نظام مكافحة الحظر — يرصد أخطاء فيسبوك ويحمي الجلسة
const log = require('./logger');

let paused     = false;
let pauseUntil = 0;
let errCount   = 0;
let lastErrAt  = 0;

const WINDOW_MS   = 5 * 60 * 1000;  // نافذة رصد 5 دقائق
const ERR_LIMIT   = 8;               // أقصى أخطاء قبل الإيقاف المؤقت
const PAUSE_MS    = 3 * 60 * 1000;  // وقت الإيقاف المؤقت 3 دقائق

// كلمات مفتاحية تدل على حظر/تقييد من فيسبوك
const BAN_SIGNALS = [
  'checkpoint', 'temporarily blocked', 'action blocked',
  'rate limit', 'too many', 'spam', 'restricted',
  'account disabled', 'account suspended',
];

const TEMP_SIGNALS = [
  'error_gc', 'not in group', 'permission', 'not allowed',
  'unable to', 'failed to', 'cannot',
];

/**
 * صنّف الخطأ وقرر ماذا تفعل.
 * @param {string|Error} err
 * @returns {'ban'|'temp'|'network'|'unknown'}
 */
function classify(err) {
  const msg = String(err?.message || err || '').toLowerCase();

  for (const s of BAN_SIGNALS)  if (msg.includes(s)) return 'ban';
  for (const s of TEMP_SIGNALS) if (msg.includes(s)) return 'temp';
  if (msg.includes('econnreset') || msg.includes('enotfound') || msg.includes('timeout'))
    return 'network';
  return 'unknown';
}

/**
 * سجّل خطأ وقرر هل يجب الإيقاف المؤقت.
 * @param {string|Error} err
 * @param {string} context - مصدر الخطأ
 */
function report(err, context) {
  const type = classify(err);
  const now  = Date.now();

  // إعادة ضبط العداد إذا مرت نافذة الرصد
  if (now - lastErrAt > WINDOW_MS) errCount = 0;
  lastErrAt = now;
  errCount++;

  if (type === 'ban') {
    log.error('[AntiBAn] 🚨 إشارة حظر مكتشفة! [' + context + '] — ' + String(err?.message || err));
    _pauseBot('حظر مشتبه به من فيسبوك');
  } else if (errCount >= ERR_LIMIT) {
    log.warn('[AntiBAn] ⚠️ ' + ERR_LIMIT + ' أخطاء في 5 دقائق — إيقاف مؤقت.');
    _pauseBot('أخطاء متكررة — حماية احترازية');
  }

  return type;
}

function _pauseBot(reason) {
  if (paused) return;
  paused     = true;
  pauseUntil = Date.now() + PAUSE_MS;
  log.warn('[AntiBAn] ⏸ البوت موقوف مؤقتاً لـ ' + (PAUSE_MS / 60000).toFixed(0) + ' دقائق. السبب: ' + reason);
  setTimeout(() => {
    paused = false;
    errCount = 0;
    log.info('[AntiBAn] ▶️ استؤنف عمل البوت.');
  }, PAUSE_MS);
}

/** هل البوت موقوف مؤقتاً؟ */
function isPaused() { return paused; }

/** كم ثانية متبقية على رفع الإيقاف؟ */
function pausedFor() {
  if (!paused) return 0;
  return Math.max(0, Math.ceil((pauseUntil - Date.now()) / 1000));
}

/** إيقاف يدوي مؤقت */
function pause(ms) { _pauseBot('إيقاف يدوي'); if (ms) { pauseUntil = Date.now() + ms; } }

/** رفع الإيقاف يدوياً */
function resume() { paused = false; errCount = 0; log.info('[AntiBAn] ▶️ رُفع الإيقاف يدوياً.'); }

/** إحصائيات */
function stats() { return { paused, pauseUntil, errCount, lastErrAt }; }

module.exports = { classify, report, isPaused, pausedFor, pause, resume, stats };
