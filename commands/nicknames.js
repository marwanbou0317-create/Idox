const { getThread } = require('../_nick_helper');
const protect       = require('../utils/nickProtect');
const log           = require('../utils/logger');

async function handle(event, api, args) {
  const { threadID } = event;
  const sub = (args[0] || '').trim().toLowerCase();

  // ── حالة: كم كنية مقفولة ──────────────────────────────────────────
  if (sub === '\u062d\u0627\u0644\u0629' || sub === 'status') {
    const info = await getThread(api, threadID);
    if (!info) return api.sendMessage('\u274c \u062a\u0639\u0630\u0651\u0631 \u062c\u0644\u0628 \u0645\u0639\u0644\u0648\u0645\u0627\u062a \u0627\u0644\u0645\u062c\u0645\u0648\u0639\u0629.', threadID);
    const total  = (info.participantIDs || []).length;
    const locked = (info.participantIDs || []).filter(uid => protect.isProtected(threadID, uid)).length;
    return api.sendMessage(
      '\ud83d\udd12 \u062d\u0627\u0644\u0629 \u0642\u0641\u0644 \u0627\u0644\u0643\u0646\u064a\u0627\u062a:\n' +
      '\u2022 \u0645\u0642\u0641\u0648\u0644: ' + locked + ' / ' + total + ' \u0639\u0636\u0648\n\n' +
      '/\u0643\u0646\u064a\u0627\u062a \u2014 \u0642\u0641\u0644 \u0627\u0644\u0643\u0644\n' +
      '/\u0643\u0646\u064a\u0627\u062a \u0641\u0643 \u2014 \u0641\u0643 \u0627\u0644\u0642\u0641\u0644',
      threadID);
  }

  // ── فك: إلغاء قفل جميع الكنيات ──────────────────────────────────
  if (sub === '\u0641\u0643' || sub === '\u0625\u0644\u063a\u0627\u0621' || sub === '\u0627\u0644\u063a\u0627\u0621' || sub === 'off') {
    const info = await getThread(api, threadID);
    if (!info) return api.sendMessage('\u274c \u062a\u0639\u0630\u0651\u0631 \u062c\u0644\u0628 \u0627\u0644\u0623\u0639\u0636\u0627\u0621.', threadID);
    let count = 0;
    for (const uid of (info.participantIDs || [])) {
      if (protect.isProtected(threadID, uid)) {
        protect.unprotect(threadID, uid);
        count++;
      }
    }
    return api.sendMessage(
      '\ud83d\udd13 \u062a\u0645 \u0641\u0643 \u0642\u0641\u0644 ' + count + ' \u0643\u0646\u064a\u0629.\n' +
      '\u0627\u0644\u0643\u0646\u064a\u0627\u062a \u0644\u0645 \u062a\u0639\u062f \u0645\u062d\u0645\u064a\u0629.',
      threadID);
  }

  // ── قفل (الافتراضي): تثبيت جميع الكنيات الحالية ──────────────────
  api.sendMessage('\u23f3 \u062c\u0627\u0631\u064a \u062c\u0644\u0628 \u0628\u064a\u0627\u0646\u0627\u062a \u0627\u0644\u0645\u062c\u0645\u0648\u0639\u0629...', threadID);

  const info = await getThread(api, threadID);
  if (!info) return api.sendMessage('\u274c \u062a\u0639\u0630\u0651\u0631 \u062c\u0644\u0628 \u0627\u0644\u0623\u0639\u0636\u0627\u0621.', threadID);

  const members   = info.participantIDs || [];
  const nicknames = info.nicknames || {};
  let locked = 0;

  for (const uid of members) {
    const nick = nicknames[uid] || '';
    protect.protect(threadID, uid, nick);
    locked++;
  }

  log.info('nicknames lock: ' + locked + ' members in ' + threadID);

  return api.sendMessage(
    '\ud83d\udd12 \u062a\u0645 \u0642\u0641\u0644 ' + locked + ' \u0643\u0646\u064a\u0629!\n' +
    '\u0623\u064a \u062a\u063a\u064a\u064a\u0631 \u0633\u064a\u064f\u0639\u0627\u062f \u062a\u0644\u0642\u0627\u0626\u064a\u0627\u064b \u062e\u0644\u0627\u0644 5 \u062b\u0648\u0627\u0646\u064a.\n\n' +
    '/\u0643\u0646\u064a\u0627\u062a \u0641\u0643 \u2014 \u0644\u0625\u0644\u063a\u0627\u0621 \u0627\u0644\u0642\u0641\u0644\n' +
    '/\u0643\u0646\u064a\u0627\u062a \u062d\u0627\u0644\u0629 \u2014 \u0639\u0631\u0636 \u0639\u062f\u062f \u0627\u0644\u0645\u0642\u0641\u0648\u0644\u064a\u0646',
    threadID
  );
}

module.exports = { handle };
