const admin  = require('../utils/admin');
const log    = require('../utils/logger');
const config = require('../config.json');
const { jitter } = require('../utils/actionQueue');

function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

async function getThread(api, tid) {
  try {
    return await api.getThreadInfo(tid);
  } catch (e) {
    log.error('getThreadInfo: ' + (e?.message || e));
    return null;
  }
}

async function gcRemove(api, uid, threadID) {
  try {
    const r = await api.gcmember('remove', uid, threadID);
    return r && r.type !== 'error_gc';
  } catch (e) {
    log.error('gcRemove: ' + (e?.message || e));
    return false;
  }
}

async function handle(event, api, args) {
  const { threadID, senderID } = event;
  if (!admin.isSuperAdmin(senderID))
    return api.sendMessage('❌ فقط سوبر أدمن يمكنه تنفيذ الإبادة.', threadID);

  const confirm = (args[0] || '').toLowerCase();
  if (confirm !== 'تأكيد' && confirm !== 'yes')
    return api.sendMessage(
      '⚠️ هذا الأمر سيطرد كل أعضاء المجموعة عدا الأدمن!\n\nللتأكيد: /ابادة تأكيد',
      threadID);

  api.sendMessage('☢️ جاري تنفيذ الإبادة...', threadID);

  const info = await getThread(api, threadID);
  if (!info) return api.sendMessage('❌ فشل جلب معلومات المجموعة.', threadID);

  const members   = info.participantIDs || [];
  const rawAdmins = info.adminIDs || [];
  const fbAdmins  = rawAdmins.map(a => String(a.id || a));

  let botID = '';
  try { botID = String(api.getCurrentUserID()); } catch {}

  const safe = new Set([
    ...fbAdmins,
    ...(config.superAdmins || []).map(String),
    botID,
    String(senderID),
  ]);

  const targets = members.filter(m => !safe.has(String(m)));
  if (!targets.length)
    return api.sendMessage('⚠️ لا يوجد أعضاء للطرد — الكل محمي.', threadID);

  api.sendMessage('☢️ سيُطرد ' + targets.length + ' عضو...', threadID);

  const BASE = config.antiban?.abadDelay || 3000;
  let kicked = 0, failed = 0;

  for (const uid of targets) {
    const ok = await gcRemove(api, uid, threadID);
    if (ok) kicked++; else failed++;

    // تأخير إنساني متغير بين كل طرد
    await wait(jitter(BASE, BASE + 1500));

    if (kicked > 0 && kicked % 5 === 0)
      api.sendMessage('☢️ تقدّم: طُرد ' + kicked + '/' + targets.length, threadID);
  }

  log.bot('ابادة: kicked=' + kicked + ' failed=' + failed + ' by ' + senderID);
  api.sendMessage(
    '✅ اكتملت الإبادة!\n☢️ طُرد: ' + kicked +
    (failed ? '\n❌ فشل: ' + failed : ''),
    threadID);
}

module.exports = { handle };
