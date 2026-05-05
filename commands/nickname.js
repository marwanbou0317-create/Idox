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
  } catch (e) { log.error('setNick فشل لـ ' + uid + ': ' + e.message); return false; }
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
  const subCmd = (args[0] || '').trim();

  if (subCmd === 'الكل' || subCmd === 'all') {
    const nicknameText = args.slice(1).join(' ').trim();
    const isReset = !nicknameText || nicknameText.toLowerCase() === 'reset' || nicknameText === 'مسح';
    const nickname = isReset ? '' : nicknameText;
    api.sendMessage('⏳ جاري جلب أعضاء المجموعة...', threadID);
    const info = await getThread(api, threadID);
    if (!info) return api.sendMessage('❌ تعذّر جلب معلومات المجموعة.', threadID);
    const members = info.participantIDs || [];
    if (!members.length) return api.sendMessage('⚠️ لا يوجد أعضاء.', threadID);
    api.sendMessage('⏳ جاري المعالجة لـ ' + members.length + ' عضو...', threadID);
    let done = 0, fail = 0;
    for (let i = 0; i < members.length; i++) {
      if (i > 0 && i % 5 === 0) await sleep(12000);
      else if (i > 0) await sleep(4000 + Math.random() * 3000);
      if (await setNickRetry(api, nickname, threadID, members[i])) done++; else fail++;
    }
    return api.sendMessage('✅ اكتمل!\nنجح: ' + done + (fail ? '\nفشل: ' + fail : ''), threadID);
  }

  const mentions = event.mentions || {};
  const ids = Object.keys(mentions);
  if (!ids.length) {
    return api.sendMessage(
      '/كنية @شخص [كنية] — تعيين\n/كنية @شخص reset — مسح\n/كنية الكل [كنية] — للجميع\n/كنية الكل reset — مسح الجميع',
      threadID
    );
  }
  const targetID = ids[0];
  const targetName = mentions[targetID] || '';
  const words = Math.max(1, targetName.trim().split(/\s+/).length);
  const nicknameText = args.slice(words).join(' ').trim();
  const isReset = !nicknameText || nicknameText.toLowerCase() === 'reset' || nicknameText === 'مسح';
  const ok = await setNickRetry(api, isReset ? '' : nicknameText, threadID, targetID);
  api.sendMessage(
    ok ? (isReset ? '✅ تم مسح كنية ' + targetName + '.' : '✅ تم تعيين كنية ' + targetName + ': "' + nicknameText + '"')
       : '❌ فشل تغيير الكنية بعد 3 محاولات.',
    threadID
  );
}

module.exports = { handle };
