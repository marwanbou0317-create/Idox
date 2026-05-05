const log = require('../utils/logger');
const { isAdmin } = require('../utils/admin');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function getThread(api, threadID) {
  try {
    const r = api.getThreadInfo(threadID);
    if (r && typeof r.then === 'function') return await r;
  } catch (_) {}
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), 15000);
    try {
      api.getThreadInfo(threadID, (err, info) => { clearTimeout(timer); resolve(err ? null : info); });
    } catch (e) { clearTimeout(timer); resolve(null); }
  });
}

async function setNick(api, nickname, threadID, uid) {
  try {
    const fn = api.setNickname || api.changeNickname;
    await fn.call(api, nickname, threadID, uid);
    return true;
  } catch (e) { log.error('nicknames فشل لـ ' + uid + ': ' + e.message); return false; }
}

async function setNickRetry(api, nickname, threadID, uid) {
  for (let i = 1; i <= 3; i++) {
    if (await setNick(api, nickname, threadID, uid)) return true;
    if (i < 3) await sleep(5000 * i);
  }
  return false;
}

async function handle(event, api, args) {
  const { threadID, senderID } = event;
  if (!isAdmin(senderID)) return api.sendMessage('❌ ليس لديك صلاحية استخدام هذا الأمر.', threadID);
  const input = args.join(' ').trim();
  if (!input) return api.sendMessage('/كنيات [نص] — نفس الكنية للجميع\n/كنيات reset — مسح كنيات الجميع\n\nمثال: /كنيات VIP', threadID);
  const isReset = input.toLowerCase() === 'reset' || input === 'مسح';
  const nickname = isReset ? '' : input;
  api.sendMessage('⏳ جاري جلب أعضاء المجموعة...', threadID);
  const info = await getThread(api, threadID);
  if (!info) return api.sendMessage('❌ تعذّر جلب معلومات المجموعة.', threadID);
  const members = info.participantIDs || [];
  if (!members.length) return api.sendMessage('⚠️ لا يوجد أعضاء.', threadID);
  api.sendMessage('⏳ جاري ' + (isReset ? 'مسح' : 'تعيين "' + nickname + '"') + ' لـ ' + members.length + ' عضو...', threadID);
  let done = 0, fail = 0;
  for (let i = 0; i < members.length; i++) {
    if (i > 0 && i % 5 === 0) await sleep(12000);
    else if (i > 0) await sleep(4000 + Math.random() * 3000);
    if (await setNickRetry(api, nickname, threadID, members[i])) {
      done++;
      if (done % 10 === 0) api.sendMessage('⏳ تم ' + done + ' من ' + members.length + '...', threadID);
    } else { fail++; }
  }
  api.sendMessage(
    '✅ اكتمل!\n' + (isReset ? 'مُسح: ' + done : 'تم تعيين "' + nickname + '": ' + done) + (fail ? '\nفشل: ' + fail : ''),
    threadID
  );
}

module.exports = { handle };
