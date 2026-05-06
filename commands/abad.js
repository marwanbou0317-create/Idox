const admin = require('../utils/admin');
const log   = require('../utils/logger');
const config = require('../config.json');

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

function getThread(api, tid) {
  return new Promise(resolve => {
    let done = false;
    const fin = v => { if (!done) { done = true; resolve(v); } };
    setTimeout(() => fin(null), 15000);
    try {
      const r = api.getThreadInfo(tid, (err, info) => fin(err ? null : info));
      if (r && typeof r.then === 'function') r.then(i => fin(i)).catch(() => fin(null));
    } catch { fin(null); }
  });
}

async function handle(event, api, args) {
  const { threadID, senderID } = event;
  if (!admin.isSuperAdmin(senderID))
    return api.sendMessage('❌ فقط سوبر أدمن يمكنه تنفيذ الإبادة.', threadID);

  const confirm = (args[0] || '').toLowerCase();
  if (confirm !== 'تأكيد' && confirm !== 'yes')
    return api.sendMessage(
      '⚠️ هذا الأمر سيطرد كل أعضاء المجموعة عدا الأدمن!\n\n' +
      'للتأكيد: /ابادة تأكيد', threadID);

  api.sendMessage('☢️ جاري تنفيذ الإبادة...', threadID);

  const info = await getThread(api, threadID);
  if (!info) return api.sendMessage('❌ فشل جلب معلومات المجموعة.', threadID);

  const members  = info.participantIDs || [];
  const fbAdmins = (info.adminIDs || []).map(a => String(a.id || a));
  let   botID    = '';
  try { botID = String(api.getCurrentUserID()); } catch {}

  // قائمة المحميين: أدمن فيسبوك + سوبر أدمن البوت + البوت نفسه + المرسل
  const safe = new Set([
    ...fbAdmins,
    ...config.superAdmins,
    botID,
    String(senderID),
  ]);

  const targets = members.filter(m => !safe.has(String(m)));
  if (!targets.length)
    return api.sendMessage('⚠️ لا يوجد أعضاء للطرد — الكل محمي.', threadID);

  api.sendMessage('☢️ سيُطرد ' + targets.length + ' عضو...', threadID);

  let kicked = 0, failed = 0;
  for (const uid of targets) {
    const ok = await apiCall(api.removeUserFromGroup.bind(api), uid, threadID);
    if (ok) kicked++; else failed++;
    await wait(1500 + Math.random() * 1000);
    if (kicked % 5 === 0 && kicked > 0)
      api.sendMessage('☢️ تقدّم: طُرد ' + kicked + '/' + targets.length, threadID);
  }

  log.bot('ابادة: kicked=' + kicked + ' failed=' + failed + ' by ' + senderID);
  api.sendMessage(
    '✅ اكتملت الإبادة!\n☢️ طُرد: ' + kicked +
    (failed ? '\n❌ فشل: ' + failed : ''), threadID);
}

module.exports = { handle };
