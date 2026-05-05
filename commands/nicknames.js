const log = require('../utils/logger');

const DELAY_BETWEEN = 3500;
const BATCH_SIZE    = 5;
const BATCH_DELAY   = 12000;

function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

function getThread(api, threadID) {
  return new Promise(resolve => {
    const done = v => { clearTimeout(t); resolve(v); };
    const t = setTimeout(() => resolve(null), 15000);
    try {
      const result = api.getThreadInfo(threadID, (err, info) => {
        done(err ? null : info);
      });
      if (result && typeof result.then === 'function') {
        result.then(info => done(info)).catch(() => done(null));
      }
    } catch { done(null); }
  });
}

function setNick(api, nickname, threadID, uid) {
  return new Promise(resolve => {
    const fn = api.setNickname || api.changeNickname;
    if (!fn) { resolve(false); return; }
    try {
      const result = fn.call(api, nickname, threadID, uid, err => {
        resolve(!err);
      });
      if (result && typeof result.then === 'function') {
        result.then(() => resolve(true)).catch(e => {
          log.error('nicknames ' + uid + ': ' + JSON.stringify(e));
          resolve(false);
        });
      }
    } catch (e) { resolve(false); }
  });
}

async function setNickRetry(api, nickname, threadID, uid) {
  for (let i = 0; i < 3; i++) {
    if (await setNick(api, nickname, threadID, uid)) return true;
    if (i < 2) await wait(5000 * (i + 1));
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

  if (!info || !info.participantIDs || !info.participantIDs.length)
    return api.sendMessage('❌ تعذّر جلب الأعضاء. تأكد أن البوت أدمن في المجموعة.', threadID);

  const members = info.participantIDs;
  api.sendMessage(
    '⏳ جاري ' + (isReset ? 'مسح كنيات' : 'تعيين "' + nick + '" لـ') + ' ' + members.length + ' عضو...',
    threadID);

  let done = 0, fail = 0;
  for (let i = 0; i < members.length; i++) {
    if (i > 0 && i % BATCH_SIZE === 0) await wait(BATCH_DELAY);
    else if (i > 0) await wait(DELAY_BETWEEN);
    if (await setNickRetry(api, nick, threadID, members[i])) {
      done++;
      if (done % 10 === 0) api.sendMessage('⏳ ' + done + ' / ' + members.length, threadID);
    } else fail++;
  }

  return api.sendMessage(
    '✅ اكتمل!\n' + (isReset ? '🗑 مُسح: ' + done : '✏️ "' + nick + '" لـ ' + done) +
    (fail ? '\n❌ فشل: ' + fail : ''), threadID);
}

module.exports = { handle };
