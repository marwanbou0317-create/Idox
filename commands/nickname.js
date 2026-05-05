const log = require('../utils/logger');
const parseMentions = require('../_mentions');

const DELAY_BETWEEN = 3500;   // ms بين كل عضو
const BATCH_SIZE    = 5;      // عدد الأعضاء قبل راحة طويلة
const BATCH_DELAY   = 12000;  // ms راحة طويلة

function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

// جلب معلومات المجموعة — callback → promise
function getThread(api, threadID) {
  return new Promise(resolve => {
    const t = setTimeout(() => resolve(null), 15000);
    try {
      api.getThreadInfo(threadID, (err, info) => {
        clearTimeout(t);
        resolve(err ? null : info);
      });
    } catch { clearTimeout(t); resolve(null); }
  });
}

// تعيين كنية — callback → promise
function setNick(api, nickname, threadID, uid) {
  return new Promise(resolve => {
    const fn = api.setNickname || api.changeNickname;
    if (!fn) { resolve(false); return; }
    try {
      fn.call(api, nickname, threadID, uid, err => {
        if (err) log.error('setNick ' + uid + ': ' + JSON.stringify(err));
        resolve(!err);
      });
    } catch (e) { log.error('setNick ex: ' + e.message); resolve(false); }
  });
}

async function setNickRetry(api, nickname, threadID, uid, tries = 3) {
  for (let i = 0; i < tries; i++) {
    if (await setNick(api, nickname, threadID, uid)) return true;
    if (i < tries - 1) await wait(5000 * (i + 1));
  }
  return false;
}

async function handle(event, api, args) {
  const { threadID } = event;
  const sub = (args[0] || '').trim().toLowerCase();

  // ── /كنية الكل [نص | reset] ──────────────────
  if (sub === 'الكل' || sub === 'all') {
    const raw     = args.slice(1).join(' ').trim();
    const isReset = !raw || raw === 'reset' || raw === 'مسح';
    const nick    = isReset ? '' : raw;

    api.sendMessage('⏳ جاري جلب الأعضاء...', threadID);
    const info = await getThread(api, threadID);
    if (!info || !info.participantIDs?.length)
      return api.sendMessage('❌ تعذّر جلب الأعضاء.', threadID);

    const members = info.participantIDs;
    api.sendMessage('⏳ ' + members.length + ' عضو — جاري المعالجة...', threadID);

    let done = 0, fail = 0;
    for (let i = 0; i < members.length; i++) {
      if (i > 0 && i % BATCH_SIZE === 0) await wait(BATCH_DELAY);
      else if (i > 0) await wait(DELAY_BETWEEN);

      if (await setNickRetry(api, nick, threadID, members[i])) done++;
      else fail++;

      if (done > 0 && done % 10 === 0)
        api.sendMessage('⏳ ' + done + ' / ' + members.length, threadID);
    }
    return api.sendMessage(
      '✅ اكتمل!\n' + (isReset ? '🗑 مُسح: ' : '✏️ كنية "' + nick + '" لـ ') + done +
      (fail ? '\n❌ فشل: ' + fail : ''), threadID);
  }

  // ── /كنية @شخص [نص | reset] ──────────────────
  const mentions = parseMentions(event.mentions);
  if (!mentions.length)
    return api.sendMessage(
      '📌 الاستخدام:\n/كنية @شخص [كنية]\n/كنية @شخص reset — مسح الكنية\n/كنية الكل [كنية]\n/كنية الكل reset',
      threadID);

  const { id, name } = mentions[0];
  // الكنية هي كل شيء بعد اسم المنشن في args
  const nameWords  = name.trim().split(/\s+/).filter(Boolean).length;
  const raw        = args.slice(nameWords).join(' ').trim();
  const isReset    = !raw || raw === 'reset' || raw === 'مسح';
  const nick       = isReset ? '' : raw;

  const ok = await setNickRetry(api, nick, threadID, id);
  return api.sendMessage(
    ok ? (isReset ? '✅ تم مسح كنية ' + name : '✅ كنية ' + name + ':\n"' + nick + '"')
       : '❌ فشل تغيير الكنية. تأكد أن البوت أدمن في المجموعة.',
    threadID);
}

module.exports = { handle };
