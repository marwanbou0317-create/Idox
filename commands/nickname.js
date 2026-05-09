const { setNick } = require('../_nick_helper');
const parseMentions = require('../_mentions');
const protect       = require('../utils/nickProtect');
const log           = require('../utils/logger');

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

  const mentions = parseMentions(event.mentions);
  if (!mentions.length)
    return api.sendMessage(
      '\ud83d\udccc \u0627\u0644\u0627\u0633\u062a\u062e\u062f\u0627\u0645:\n' +
      '/\u0643\u0646\u064a\u0629 @\u0634\u062e\u0635 [\u0643\u0646\u064a\u0629] \u2014 \u062a\u0639\u064a\u064a\u0646 \u0643\u0646\u064a\u0629\n' +
      '/\u0643\u0646\u064a\u0629 @\u0634\u062e\u0635 reset \u2014 \u0645\u0633\u062d \u0627\u0644\u0643\u0646\u064a\u0629',
      threadID);

  const { id, name } = mentions[0];
  const nameWords = name.trim().split(/\s+/).filter(Boolean).length;
  const raw       = args.slice(nameWords).join(' ').trim();
  const isReset   = !raw || raw === 'reset' || raw === '\u0645\u0633\u062d';
  const nick      = isReset ? '' : raw;

  if (protect.isProtected(threadID, id))
    return api.sendMessage(
      '\ud83d\udd12 \u0643\u0646\u064a\u0629 ' + name + ' \u0645\u062d\u0645\u064a\u0629.\n' +
      '\u0627\u0633\u062a\u062e\u062f\u0645 /\u062a\u062b\u0628\u064a\u062a @\u0634\u062e\u0635 \u0625\u0644\u063a\u0627\u0621 \u0644\u0631\u0641\u0639 \u0627\u0644\u062d\u0645\u0627\u064a\u0629.',
      threadID);

  const ok = await setNickRetry(api, nick, threadID, id);
  api.sendMessage(
    ok
      ? (isReset ? '\u2705 \u0645\u064f\u0633\u062d\u062a \u0643\u0646\u064a\u0629 ' + name : '\u2705 \u062a\u0645 \u062a\u0639\u064a\u064a\u0646 \u0643\u0646\u064a\u0629 ' + name)
      : '\u274c \u0641\u0634\u0644 \u062a\u063a\u064a\u064a\u0631 \u0627\u0644\u0643\u0646\u064a\u0629.',
    threadID);
}

module.exports = { handle };
