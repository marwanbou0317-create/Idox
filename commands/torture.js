const admin = require('../utils/admin');
const parseMentions = require('../_mentions');
const log = require('../utils/logger');

function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

function apiCall(fn, ...args) {
  return new Promise(resolve => {
    let done = false;
    const fin = ok => { if (!done) { done = true; resolve(ok); } };
    setTimeout(() => fin(false), 10000);
    try {
      const r = fn(...args, err => fin(!err));
      if (r && typeof r.then === 'function') r.then(() => fin(true)).catch(() => fin(false));
    } catch { fin(false); }
  });
}

const sessions = new Set(); // threadID → active torture

async function handle(event, api, args) {
  const { threadID, senderID, messageReply } = event;

  if (!admin.isAdmin(senderID))
    return api.sendMessage('❌ ليس لديك صلاحية.', threadID);

  if (sessions.has(threadID))
    return api.sendMessage('⚠️ جلسة تعذيب نشطة بالفعل في هذه المجموعة.', threadID);

  // تحديد الهدف: رد على رسالة أو منشن
  let targetID = null, targetName = 'المستهدف';

  if (messageReply?.senderID) {
    targetID   = String(messageReply.senderID);
    targetName = String(messageReply.senderName || targetID);
  } else {
    const mentions = parseMentions(event.mentions);
    if (mentions.length) { targetID = mentions[0].id; targetName = mentions[0].name; }
  }

  if (!targetID)
    return api.sendMessage(
      '❗ رد على رسالة شخص أو: /تعذيب @شخص\n\n' +
      'البوت سيطرده ويضيفه 10 مرات متتالية.', threadID);

  if (admin.isAdmin(targetID))
    return api.sendMessage('🚫 لا يمكن تعذيب مشرف.', threadID);

  sessions.add(threadID);

  const ROUNDS = 10;
  api.sendMessage('😈 بدأت جلسة التعذيب!\n🎯 الهدف: ' + targetName + '\n🔄 ' + ROUNDS + ' جولات', threadID);
  await wait(1000);

  let done = 0;
  for (let i = 1; i <= ROUNDS; i++) {
    // طرد
    const kicked = await apiCall(api.removeUserFromGroup.bind(api), targetID, threadID);
    if (!kicked) {
      api.sendMessage('❌ فشل الطرد في الجولة ' + i + '. توقف.', threadID);
      break;
    }

    api.sendMessage('☠️ [' + i + '/' + ROUNDS + '] تم طرد ' + targetName + ' — تعذيب!', threadID);
    done++;
    await wait(2500);

    // إعادة (ما عدا الجولة الأخيرة)
    if (i < ROUNDS) {
      const added = await apiCall(api.addUserToGroup.bind(api), targetID, threadID);
      if (!added) {
        api.sendMessage('⚠️ [' + i + '] لم يتم الإضافة — ربما رفض الدعوة. استمر بالطرد فقط.', threadID);
      }
      await wait(2000);
    }
  }

  sessions.delete(threadID);
  api.sendMessage(
    '✅ انتهت جلسة التعذيب!\n😈 ' + targetName + ' تعرّض للتعذيب ' + done + ' مرات.',
    threadID);

  log.bot('torture: ' + targetID + ' x' + done + ' by ' + senderID);
}

module.exports = { handle };
