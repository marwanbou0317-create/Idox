const { isAdmin } = require('../utils/admin');
const { engineState, setEngineEnabled, setEngineMessage, setEngineInterval, setEngineSmart, setEngineTarget, markActivity, hasActivity, clearActivity } = require('../utils/state');
const { engineDelay } = require('../utils/delay');
const log = require('../utils/logger');

let currentApi = null;
// كل مرة نبدأ المحرك نرفع الجيل — السلاسل القديمة تتحقق من الجيل وتتوقف
let engineGeneration = 0;

function setApi(api) { currentApi = api; }

function startEngineTimer() {
  // رفع الجيل يُبطل أي سلسلة قديمة تعمل
  engineGeneration++;
  const myGen = engineGeneration;

  async function loop() {
    // توقف إذا تغير الجيل أو أُوقف المحرك
    if (myGen !== engineGeneration || !engineState.enabled || !engineState.targetThreadID) return;

    await engineDelay(engineState.intervalSeconds);

    if (myGen !== engineGeneration || !engineState.enabled || !currentApi || !engineState.targetThreadID) return;

    if (engineState.smart) {
      if (!hasActivity(engineState.targetThreadID)) {
        loop(); return;
      }
      clearActivity(engineState.targetThreadID);
    }

    currentApi.sendMessage(engineState.message, engineState.targetThreadID, (err) => {
      if (err) log.error('Engine send error: ' + err);
    });

    loop();
  }

  loop();
}

function stopEngineTimer() {
  // رفع الجيل يوقف السلسلة الحالية
  engineGeneration++;
}

function handle(event, botApi, args, prefix) {
  setApi(botApi);
  const { senderID, threadID } = event;
  const subCmd = (args[0] || '').toLowerCase();

  // ── تشغيل/إيقاف تبديل ──
  if (!subCmd) {
    if (engineState.enabled) {
      stopEngineTimer();
      setEngineEnabled(false);
      return botApi.sendMessage('🔴 تم إيقاف المحرك.', threadID);
    }
    setEngineTarget(threadID);
    setEngineEnabled(true);
    startEngineTimer();
    return botApi.sendMessage(
      '🟢 تم تشغيل المحرك.\n' +
      '📍 المجموعة: هذه المجموعة\n' +
      '⏱ كل: ~' + engineState.intervalSeconds + 'ث (±20%)\n' +
      '💬 الرسالة: ' + engineState.message + '\n' +
      '🧠 الذكي: ' + (engineState.smart ? 'مفعل ✅' : 'موقوف ❌'),
      threadID
    );
  }

  // ── تشغيل صريح ──
  if (subCmd === 'تشغيل' || subCmd === 'on') {
    if (engineState.enabled) return botApi.sendMessage('⚠️ المحرك يعمل بالفعل.', threadID);
    setEngineTarget(threadID);
    setEngineEnabled(true);
    startEngineTimer();
    return botApi.sendMessage('🟢 تم تشغيل المحرك.', threadID);
  }

  // ── إيقاف صريح ──
  if (subCmd === 'ايقاف' || subCmd === 'إيقاف' || subCmd === 'off') {
    if (!engineState.enabled) return botApi.sendMessage('⚠️ المحرك متوقف بالفعل.', threadID);
    stopEngineTimer();
    setEngineEnabled(false);
    return botApi.sendMessage('🔴 تم إيقاف المحرك.', threadID);
  }

  // ── تعيين الرسالة ──
  if (subCmd === 'رسالة' || subCmd === 'message') {
    const msg = args.slice(1).join(' ').trim();
    if (!msg) return botApi.sendMessage('❗ مثال: ' + prefix + 'محرك رسالة مرحباً', threadID);
    setEngineMessage(msg);
    return botApi.sendMessage('✅ تم تعيين رسالة المحرك:\n"' + msg + '"', threadID);
  }

  // ── تعيين الوقت ──
  if (subCmd === 'وقت' || subCmd === 'time') {
    const secs = parseInt(args[1]);
    if (isNaN(secs) || secs < 10)
      return botApi.sendMessage('❗ الحد الأدنى 10 ثواني لتجنب الحظر.\nمثال: ' + prefix + 'محرك وقت 30', threadID);
    setEngineInterval(secs);
    // إعادة تشغيل السلسلة بالوقت الجديد إذا كان المحرك يعمل
    if (engineState.enabled) startEngineTimer();
    return botApi.sendMessage('✅ تم تعيين وقت المحرك: ~' + secs + 'ث (±20% عشوائي).', threadID);
  }

  // ── الوضع الذكي ──
  if (subCmd === 'الذكي' || subCmd === 'smart') {
    const v = !engineState.smart;
    setEngineSmart(v);
    return botApi.sendMessage(
      v ? '🧠 تم تفعيل الوضع الذكي.\nالمحرك سيرسل فقط عند وجود نشاط في المجموعة.'
        : '🧠 تم إيقاف الوضع الذكي.',
      threadID
    );
  }

  // ── الحالة ──
  if (subCmd === 'حالة' || subCmd === 'status') {
    return botApi.sendMessage(
      '📊 حالة المحرك:\n' +
      '▪️ الحالة: ' + (engineState.enabled ? '🟢 يعمل' : '🔴 متوقف') + '\n' +
      '▪️ الرسالة: ' + engineState.message + '\n' +
      '▪️ الوقت: ~' + engineState.intervalSeconds + 'ث (±20%)\n' +
      '▪️ الذكي: ' + (engineState.smart ? '✅ مفعل' : '❌ موقوف') + '\n' +
      '▪️ المجموعة: ' + (engineState.targetThreadID || 'غير محدد'),
      threadID
    );
  }

  return botApi.sendMessage(
    '⚙️ أوامر المحرك:\n' +
    prefix + 'محرك — تشغيل/إيقاف\n' +
    prefix + 'محرك رسالة [نص]\n' +
    prefix + 'محرك وقت [ثواني] (الحد الأدنى 10)\n' +
    prefix + 'محرك الذكي — تشغيل/إيقاف الوضع الذكي\n' +
    prefix + 'محرك حالة',
    threadID
  );
}

module.exports = { handle, setApi, startEngineTimer, stopEngineTimer };
