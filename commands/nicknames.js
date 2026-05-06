const { setNick, getThread } = require('../_nick_helper');
const log = require('../utils/logger');

const DELAY = 3500;
const BATCH = 5;
const BATCH_DELAY = 12000;

function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

async function setNickRetry(api, nick, tid, uid) {
  for (let i = 0; i < 3; i++) {
    if (await setNick(api, nick, tid, uid)) return true;
    if (i < 2) await wait(4000 * (i + 1));
  }
  return false;
}

async function handle(event, api, args) {
  const { threadID } = event;
  const raw     = args.join(' ').trim();
  const isReset = !raw || raw === 'reset' || raw === 'مسح';
  const nick    = isReset ? '' : raw;

  if (!raw)
    return api.sendMessage(
      '📌 الاستخدام:\n/كنيات [نص] — نفس الكنية للجميع\n/كنيات reset — مسح الكنيات\n\nمثال: /كنيات VIP ⭐',
      threadID);

  api.sendMessage('⏳ جاري جلب الأعضاء...', threadID);
  const info = await getThread(api, threadID);

  if (!info || !info.participantIDs?.length)
    return api.sendMessage('❌ تعذّر جلب الأعضاء.', threadID);

  const members = info.participantIDs;
  api.sendMessage('⏳ ' + members.length + ' عضو — جاري المعالجة...', threadID);

  let done = 0, fail = 0;
  for (let i = 0; i < members.length; i++) {
    if (i > 0 && i % BATCH === 0) await wait(BATCH_DELAY);
    else if (i > 0) await wait(DELAY);

    if (await setNickRetry(api, nick, threadID, members[i])) {
      done++;
      if (done % 10 === 0) api.sendMessage('⏳ ' + done + '/' + members.length, threadID);
    } else fail++;
  }

  api.sendMessage(
    '✅ اكتمل!\n' +
    (isReset ? '🗑 مُسح: ' + done : '✏️ "' + nick + '" لـ ' + done) +
    (fail ? '\n❌ فشل: ' + fail : ''),
    threadID);
}

module.exports = { handle };
