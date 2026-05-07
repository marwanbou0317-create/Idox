const { setNick, getThread } = require('../_nick_helper');
const protect       = require('../utils/nickProtect');
const log           = require('../utils/logger');
const cfg           = require('../config.json');

function wait(ms) { return new Promise(r => setTimeout(r, ms)); }
function jitter(a, b) { return Math.floor(a + Math.random() * (b - a)); }

const DELAY       = cfg.antiban?.nickDelay       || 3000;
const BATCH       = cfg.antiban?.nickBatchSize   || 5;
const BATCH_DELAY = cfg.antiban?.nickBatchDelay  || 12000;

async function setNickRetry(api, nick, tid, uid) {
  for (let i = 0; i < 3; i++) {
    if (await setNick(api, nick, tid, uid)) return true;
    if (i < 2) await wait(jitter(4000, 7000));
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
      '📌 الاستخدام:
/كنيات [نص] — نفس الكنية للجميع
/كنيات reset — مسح الكنيات

مثال: /كنيات VIP ⭐',
      threadID);

  api.sendMessage('⏳ جاري جلب الأعضاء...', threadID);
  const info = await getThread(api, threadID);

  if (!info || !info.participantIDs?.length)
    return api.sendMessage('❌ تعذّر جلب الأعضاء.', threadID);

  const members = info.participantIDs;
  api.sendMessage('⏳ ' + members.length + ' عضو — جاري المعالجة...', threadID);

  let done = 0, fail = 0, skipped = 0;
  for (let i = 0; i < members.length; i++) {
    if (protect.isProtected(threadID, members[i])) { skipped++; continue; }

    if (i > 0 && i % BATCH === 0) {
      await wait(jitter(BATCH_DELAY, BATCH_DELAY + 3000));
    } else if (i > 0) {
      await wait(jitter(DELAY - 500, DELAY + 1000));
    }

    if (await setNickRetry(api, nick, threadID, members[i])) {
      done++;
      if (done % 10 === 0) api.sendMessage('⏳ ' + done + '/' + members.length, threadID);
    } else {
      fail++;
    }
  }

  api.sendMessage(
    '✅ اكتمل!
' +
    (isReset ? '🗑 مُسحت الكنيات: ' + done : '✏️ تم التعيين لـ ' + done) +
    (skipped ? '
🔒 محمي (تجاهل): ' + skipped : '') +
    (fail ? '
❌ فشل: ' + fail : ''),
    threadID);
}

module.exports = { handle };
