const admin  = require('../utils/admin');
const parseMentions = require('../_mentions');
const log    = require('../utils/logger');
const { jitter } = require('../utils/actionQueue');
const cfg    = require('../config.json');

function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

async function gcRemove(api, uid, threadID) {
  try {
    const r = await api.gcmember('remove', uid, threadID);
    return r && r.type !== 'error_gc';
  } catch (e) {
    log.error('gcRemove: ' + (e?.message || e));
    return false;
  }
}

async function gcAdd(api, uid, threadID) {
  try {
    const r = await api.gcmember('add', uid, threadID);
    return r && r.type !== 'error_gc';
  } catch (e) {
    log.error('gcAdd: ' + (e?.message || e));
    return false;
  }
}

const sessions = new Set();

async function handle(event, api, args) {
  const { threadID, senderID, messageReply } = event;

  if (!admin.isAdmin(senderID))
    return api.sendMessage('❌ ليس لديك صلاحية.', threadID);

  if (sessions.has(threadID))
    return api.sendMessage('⚠️ جلسة تعذيب نشطة بالفعل في هذه المجموعة.', threadID);

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
      '❗ رد على رسالة شخص أو: /تعذيب @شخص\n\nالبوت سيطرده ويضيفه 10 مرات متتالية.',
      threadID);

  if (admin.isAdmin(targetID))
    return api.sendMessage('🚫 لا يمكن تعذيب مشرف.', threadID);

  sessions.add(threadID);

  const ROUNDS     = 10;
  const BASE_DELAY = cfg.antiban?.tortureDelay || 3500;

  api.sendMessage('😈 بدأت جلسة التعذيب!\n🎯 الهدف: ' + targetName + '\n🔄 ' + ROUNDS + ' جولات', threadID);
  await wait(jitter(1500, 2500));

  let done = 0;
  for (let i = 1; i <= ROUNDS; i++) {
    const kicked = await gcRemove(api, targetID, threadID);
    if (!kicked) {
      api.sendMessage('❌ فشل الطرد في الجولة ' + i + '. توقف.', threadID);
      break;
    }

    api.sendMessage('☠️ [' + i + '/' + ROUNDS + '] تم طرد ' + targetName + ' — تعذيب!', threadID);
    done++;

    // تأخير إنساني بين الطرد والإضافة
    await wait(jitter(BASE_DELAY, BASE_DELAY + 1500));

    if (i < ROUNDS) {
      const added = await gcAdd(api, targetID, threadID);
      if (!added)
        api.sendMessage('⚠️ [' + i + '] لم يتم الإضافة — ربما رفض الدعوة. استمر بالطرد فقط.', threadID);

      // تأخير قبل الجولة التالية — متغير لتبدو طبيعية
      await wait(jitter(BASE_DELAY - 500, BASE_DELAY + 2000));
    }
  }

  sessions.delete(threadID);
  api.sendMessage(
    '✅ انتهت جلسة التعذيب!\n😈 ' + targetName + ' تعرّض للتعذيب ' + done + ' مرات.',
    threadID);

  log.bot('torture: ' + targetID + ' x' + done + ' by ' + senderID);
}

module.exports = { handle };
