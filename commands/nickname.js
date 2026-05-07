const { setNick, getThread } = require('../_nick_helper');
const parseMentions = require('../_mentions');
const protect       = require('../utils/nickProtect');
const log           = require('../utils/logger');

const DELAY = 3500; const BATCH = 5; const BATCH_DELAY = 12000;
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
  const sub = (args[0] || '').trim().toLowerCase();

  if (sub === 'الكل' || sub === 'all') {
    const raw = args.slice(1).join(' ').trim();
    const isReset = !raw || raw === 'reset' || raw === 'مسح';
    const nick = isReset ? '' : raw;

    api.sendMessage('⏳ جاري جلب الأعضاء...', threadID);
    const info = await getThread(api, threadID);
    if (!info || !info.participantIDs?.length)
      return api.sendMessage('❌ تعذّر جلب الأعضاء.', threadID);

    const members = info.participantIDs;
    api.sendMessage('⏳ ' + members.length + ' عضو...', threadID);
    let done = 0, fail = 0, skipped = 0;
    for (let i = 0; i < members.length; i++) {
      if (protect.isProtected(threadID, members[i])) { skipped++; continue; }
      if (i > 0 && i % BATCH === 0) await wait(BATCH_DELAY);
      else if (i > 0) await wait(DELAY);
      if (await setNickRetry(api, nick, threadID, members[i])) {
        done++;
        if (done % 10 === 0) api.sendMessage('⏳ ' + done + '/' + members.length, threadID);
      } else fail++;
    }
    return api.sendMessage(
      '✅ اكتمل!
' + (isReset ? '🗑 مُسحت الكنيات: ' : '✏️ تم التعيين لـ ') + done +
      (skipped ? '
🔒 محمي (تجاهل): ' + skipped : '') +
      (fail ? '
❌ فشل: ' + fail : ''), threadID);
  }

  const mentions = parseMentions(event.mentions);
  if (!mentions.length)
    return api.sendMessage('📌 الاستخدام:
/كنية @شخص [كنية]
/كنية @شخص reset
/كنية الكل [كنية|reset]', threadID);

  const { id, name } = mentions[0];
  const nameWords = name.trim().split(/s+/).filter(Boolean).length;
  const raw       = args.slice(nameWords).join(' ').trim();
  const isReset   = !raw || raw === 'reset' || raw === 'مسح';
  const nick      = isReset ? '' : raw;

  if (protect.isProtected(threadID, id))
    return api.sendMessage('🔒 كنية ' + name + ' محمية ولا يمكن تغييرها.
استخدم /تثبيت @شخص إلغاء لرفع الحماية.', threadID);

  const ok = await setNickRetry(api, nick, threadID, id);
  api.sendMessage(
    ok ? (isReset ? '✅ مُسحت كنية ' + name : '✅ تم تعيين كنية ' + name)
       : '❌ فشل تغيير الكنية. راجع لوق البوت للسبب.',
    threadID);
}

module.exports = { handle };
