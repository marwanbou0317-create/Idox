const log = require('../utils/logger');
const { isAdmin } = require('../utils/admin');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function getThread(api, threadID) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), 15000);
    try {
      api.getThreadInfo(threadID, (err, info) => {
        clearTimeout(timer);
        resolve(err ? null : info);
      });
    } catch (e) { clearTimeout(timer); resolve(null); }
  });
}

async function setNick(api, nickname, threadID, uid) {
  const fn = api.setNickname || api.changeNickname;
  if (!fn) { log.error('setNickname غير متاح'); return false; }
  return new Promise((resolve) => {
    try {
      fn.call(api, nickname, threadID, uid, (err) => {
        if (err) { log.error('nicknames خطأ لـ ' + uid + ': ' + JSON.stringify(err)); resolve(false); }
        else resolve(true);
      });
    } catch (e) { log.error('nicknames استثناء: ' + e.message); resolve(false); }
  });
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
  if (!input) {
    return api.sendMessage(
      '📌 طريقة الاستخدام:\n' +
      '/كنيات [نص] — نفس الكنية لكل الأعضاء\n' +
      '/كنيات reset — مسح كنيات الجميع\n\n' +
      'مثال: /كنيات VIP ⭐',
      threadID
    );
  }

  const isReset = input === 'reset' || input === 'مسح';
  const nickname = isReset ? '' : input;

  api.sendMessage('⏳ جاري جلب أعضاء المجموعة...', threadID);
  const info = await getThread(api, threadID);
  if (!info) return api.sendMessage('❌ تعذّر جلب معلومات المجموعة. حاول مجدداً.', threadID);

  const members = info.participantIDs || [];
  if (!members.length) return api.sendMessage('⚠️ لا يوجد أعضاء في هذه المجموعة.', threadID);

  api.sendMessage(
    '⏳ جاري ' + (isReset ? 'مسح كنيات' : 'تعيين "' + nickname + '" لـ') + ' ' + members.length + ' عضو...',
    threadID
  );

  let done = 0, fail = 0;
  for (let i = 0; i < members.length; i++) {
    if (i > 0 && i % 5 === 0) await sleep(12000);
    else if (i > 0) await sleep(3000 + Math.random() * 2000);

    if (await setNickRetry(api, nickname, threadID, members[i])) {
      done++;
      if (done % 10 === 0)
        api.sendMessage('⏳ تقدّم: ' + done + ' من ' + members.length + '...', threadID);
    } else {
      fail++;
    }
  }

  return api.sendMessage(
    '✅ اكتمل!\n' +
    (isReset ? '🗑 مُسح: ' + done : '✏️ تم تعيين "' + nickname + '" لـ ' + done) +
    (fail ? '\n❌ فشل: ' + fail : ''),
    threadID
  );
}

module.exports = { handle };
