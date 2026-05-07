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

  if (sub === '\u0627\u0644\u0643\u0644' || sub === 'all') {
    const raw = args.slice(1).join(' ').trim();
    const isReset = !raw || raw === 'reset' || raw === '\u0645\u0633\u062d';
    const nick = isReset ? '' : raw;

    api.sendMessage('\u23f3 \u062c\u0627\u0631\u064a \u062c\u0644\u0628 \u0627\u0644\u0623\u0639\u0636\u0627\u0621...', threadID);
    const info = await getThread(api, threadID);
    if (!info || !info.participantIDs || !info.participantIDs.length)
      return api.sendMessage('\u274c \u062a\u0639\u0630\u0651\u0631 \u062c\u0644\u0628 \u0627\u0644\u0623\u0639\u0636\u0627\u0621.', threadID);

    const members = info.participantIDs;
    api.sendMessage('\u23f3 ' + members.length + ' \u0639\u0636\u0648...', threadID);
    let done = 0, fail = 0, skipped = 0;
    for (let i = 0; i < members.length; i++) {
      if (protect.isProtected(threadID, members[i])) { skipped++; continue; }
      if (i > 0 && i % BATCH === 0) await wait(BATCH_DELAY);
      else if (i > 0) await wait(DELAY);
      if (await setNickRetry(api, nick, threadID, members[i])) {
        done++;
        if (done % 10 === 0) api.sendMessage('\u23f3 ' + done + '/' + members.length, threadID);
      } else fail++;
    }
    return api.sendMessage(
      '\u2705 \u0627\u0643\u062a\u0645\u0644!\n' +
      (isReset ? '\ud83d\uddd1 \u0645\u064f\u0633\u062d\u062a \u0627\u0644\u0643\u0646\u064a\u0627\u062a: ' : '\u270f\ufe0f \u062a\u0645 \u0627\u0644\u062a\u0639\u064a\u064a\u0646 \u0644\u0640 ') + done +
      (skipped ? '\n\ud83d\udd12 \u0645\u062d\u0645\u064a (\u062a\u062c\u0627\u0647\u0644): ' + skipped : '') +
      (fail ? '\n\u274c \u0641\u0634\u0644: ' + fail : ''),
      threadID);
  }

  const mentions = parseMentions(event.mentions);
  if (!mentions.length)
    return api.sendMessage(
      '\ud83d\udccc \u0627\u0644\u0627\u0633\u062a\u062e\u062f\u0627\u0645:\n/\u0643\u0646\u064a\u0629 @\u0634\u062e\u0635 [\u0643\u0646\u064a\u0629]\n/\u0643\u0646\u064a\u0629 @\u0634\u062e\u0635 reset\n/\u0643\u0646\u064a\u0629 \u0627\u0644\u0643\u0644 [\u0643\u0646\u064a\u0629|reset]',
      threadID);

  const { id, name } = mentions[0];
  const nameWords = name.trim().split(/\s+/).filter(Boolean).length;
  const raw       = args.slice(nameWords).join(' ').trim();
  const isReset   = !raw || raw === 'reset' || raw === '\u0645\u0633\u062d';
  const nick      = isReset ? '' : raw;

  if (protect.isProtected(threadID, id))
    return api.sendMessage(
      '\ud83d\udd12 \u0643\u0646\u064a\u0629 ' + name + ' \u0645\u062d\u0645\u064a\u0629 \u0648\u0644\u0627 \u064a\u0645\u0643\u0646 \u062a\u063a\u064a\u064a\u0631\u0647\u0627.\n\u0627\u0633\u062a\u062e\u062f\u0645 /\u062a\u062b\u0628\u064a\u062a @\u0634\u062e\u0635 \u0625\u0644\u063a\u0627\u0621 \u0644\u0631\u0641\u0639 \u0627\u0644\u062d\u0645\u0627\u064a\u0629.',
      threadID);

  const ok = await setNickRetry(api, nick, threadID, id);
  api.sendMessage(
    ok
      ? (isReset ? '\u2705 \u0645\u064f\u0633\u062d\u062a \u0643\u0646\u064a\u0629 ' + name : '\u2705 \u062a\u0645 \u062a\u0639\u064a\u064a\u0646 \u0643\u0646\u064a\u0629 ' + name)
      : '\u274c \u0641\u0634\u0644 \u062a\u063a\u064a\u064a\u0631 \u0627\u0644\u0643\u0646\u064a\u0629. \u0631\u0627\u062c\u0639 \u0644\u0648\u0642 \u0627\u0644\u0628\u0648\u062a \u0644\u0644\u0633\u0628\u0628.',
    threadID);
}

module.exports = { handle };
