const { isAdmin } = require('../utils/admin');
const { engineState, setEngineEnabled, setEngineMessage, setEngineInterval, setEngineSmart, setEngineTarget, markActivity, hasActivity, clearActivity } = require('../utils/state');
const { engineDelay } = require('../utils/delay');
const log = require('../utils/logger');

let currentApi = null;
function setApi(api) { currentApi = api; }

function startEngineTimer() {
  if (engineState.timers.has('main')) {
    const ref = engineState.timers.get('main');
    if (ref && typeof ref === 'object') ref.active = false;
    else clearInterval(ref);
    engineState.timers.delete('main');
  }
  if (!engineState.enabled || !engineState.targetThreadID) return;

  function scheduleNext() {
    if (!engineState.enabled || !engineState.targetThreadID) return;
    engineDelay(engineState.intervalSeconds).then(() => {
      if (!engineState.enabled || !currentApi || !engineState.targetThreadID) return;
      if (engineState.smart) {
        if (!hasActivity(engineState.targetThreadID)) { scheduleNext(); return; }
        clearActivity(engineState.targetThreadID);
      }
      currentApi.sendMessage(engineState.message, engineState.targetThreadID, (err) => {
        if (err) log.error('Engine send error: ' + err);
      });
      scheduleNext();
    });
  }
  const timerRef = { active: true };
  engineState.timers.set('main', timerRef);
  scheduleNext();
}

function stopEngineTimer() {
  if (engineState.timers.has('main')) {
    const ref = engineState.timers.get('main');
    if (ref && typeof ref === 'object') ref.active = false;
    else clearInterval(ref);
    engineState.timers.delete('main');
  }
}

function handle(event, botApi, args, prefix) {
  setApi(botApi);
  const { senderID, threadID } = event;
  if (!isAdmin(senderID)) return botApi.sendMessage('❌ ليس لديك صلاحية استخدام هذا الأمر.', threadID);
  const subCmd = args[0] ? args[0].toLowerCase() : '';

  if (!subCmd) {
    if (engineState.enabled) {
      stopEngineTimer(); setEngineEnabled(false);
      return botApi.sendMessage('🔴 تم إيقاف المحرك.', threadID);
    } else {
      if (!engineState.targetThreadID) setEngineTarget(threadID);
      setEngineEnabled(true); startEngineTimer();
      return botApi.sendMessage(
        '🟢 تم تشغيل المحرك.\n📍 المجموعة: ' + engineState.targetThreadID +
        '\n⏱ كل: ~' + engineState.intervalSeconds + ' ثانية (±20% عشوائي)' +
        '\n💬 الرسالة: ' + engineState.message +
        '\n🧠 الذكي: ' + (engineState.smart ? 'مفعل' : 'موقوف'), threadID);
    }
  }
  if (subCmd === 'رسالة' || subCmd === 'message') {
    const msg = args.slice(1).join(' ');
    if (!msg) return botApi.sendMessage('❗ مثال: /محرك رسالة مرحباً', threadID);
    setEngineMessage(msg);
    return botApi.sendMessage('✅ تم تعيين رسالة المحرك:\n"' + msg + '"', threadID);
  }
  if (subCmd === 'وقت' || subCmd === 'time') {
    const secs = parseInt(args[1]);
    if (isNaN(secs) || secs < 10) return botApi.sendMessage('❗ الحد الأدنى 10 ثواني لتجنب الحظر.\nمثال: /محرك وقت 30', threadID);
    setEngineInterval(secs);
    if (engineState.enabled) startEngineTimer();
    return botApi.sendMessage('✅ تم تعيين وقت المحرك: ~' + secs + ' ثانية (±20% عشوائي).', threadID);
  }
  if (subCmd === 'الذكي' || subCmd === 'smart') {
    const v = !engineState.smart; setEngineSmart(v);
    return botApi.sendMessage(v ? '🧠 تم تفعيل وضع الذكي.' : '🧠 تم إيقاف وضع الذكي.', threadID);
  }
  if (subCmd === 'تشغيل' || subCmd === 'on') {
    if (engineState.enabled) return botApi.sendMessage('⚠️ المحرك يعمل بالفعل.', threadID);
    if (!engineState.targetThreadID) setEngineTarget(threadID);
    setEngineEnabled(true); startEngineTimer();
    return botApi.sendMessage('🟢 تم تشغيل المحرك.', threadID);
  }
  if (subCmd === 'ايقاف' || subCmd === 'إيقاف' || subCmd === 'off') {
    if (!engineState.enabled) return botApi.sendMessage('⚠️ المحرك متوقف بالفعل.', threadID);
    stopEngineTimer(); setEngineEnabled(false);
    return botApi.sendMessage('🔴 تم إيقاف المحرك.', threadID);
  }
  if (subCmd === 'حالة' || subCmd === 'status') {
    return botApi.sendMessage(
      '📊 حالة المحرك:\n' +
      '▪️ الحالة: ' + (engineState.enabled ? '🟢 يعمل' : '🔴 متوقف') + '\n' +
      '▪️ الرسالة: ' + engineState.message + '\n' +
      '▪️ الوقت: ~' + engineState.intervalSeconds + 'ث (±20%)\n' +
      '▪️ الذكي: ' + (engineState.smart ? '✅ مفعل' : '❌ موقوف') + '\n' +
      '▪️ المجموعة: ' + (engineState.targetThreadID || 'غير محدد'), threadID);
  }
  return botApi.sendMessage(
    '⚙️ أوامر المحرك:\n' +
    prefix + 'محرك — تشغيل/إيقاف\n' +
    prefix + 'محرك رسالة [نص]\n' +
    prefix + 'محرك وقت [ثواني] (min: 10)\n' +
    prefix + 'محرك الذكي\n' +
    prefix + 'محرك حالة', threadID);
}

module.exports = { handle, setApi, startEngineTimer, stopEngineTimer };
module.exports.markActivityForEngine = markActivity;
