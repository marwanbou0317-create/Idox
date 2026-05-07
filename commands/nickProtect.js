const protect       = require('../utils/nickProtect');
const parseMentions = require('../_mentions');
const { getThread } = require('../_nick_helper');
const log           = require('../utils/logger');

async function handle(event, api, args) {
  const { threadID } = event;
  const sub = (args[0] || '').trim().toLowerCase();

  if (sub === '\u0642\u0627\u0626\u0645\u0629' || sub === 'list') {
    const list = protect.listProtected(threadID);
    if (!list.length)
      return api.sendMessage('\ud83d\udccb \u0644\u0627 \u062a\u0648\u062c\u062f \u0643\u0646\u064a\u0627\u062a \u0645\u062d\u0645\u064a\u0629 \u0641\u064a \u0647\u0630\u0647 \u0627\u0644\u0645\u062c\u0645\u0648\u0639\u0629.', threadID);
    const lines = list.map(function(entry) { return '\u25aa ' + entry[0]; }).join('\n');
    return api.sendMessage('\ud83d\udd12 \u0627\u0644\u0623\u0639\u0636\u0627\u0621 \u0630\u0648\u0648 \u0627\u0644\u0643\u0646\u064a\u0627\u062a \u0627\u0644\u0645\u062d\u0645\u064a\u0629:\n' + lines, threadID);
  }

  const mentions = parseMentions(event.mentions);
  if (!mentions.length)
    return api.sendMessage(
      '\ud83d\udccc \u0627\u0644\u0627\u0633\u062a\u062e\u062f\u0627\u0645:\n' +
      '/\u062a\u062b\u0628\u064a\u062a @\u0634\u062e\u0635 [\u0643\u0646\u064a\u0629] \u2014 \u062a\u062b\u0628\u064a\u062a \u0643\u0646\u064a\u0629\n' +
      '/\u062a\u062b\u0628\u064a\u062a @\u0634\u062e\u0635 \u0625\u0644\u063a\u0627\u0621 \u2014 \u0625\u0644\u063a\u0627\u0621 \u0627\u0644\u062d\u0645\u0627\u064a\u0629\n' +
      '/\u062a\u062b\u0628\u064a\u062a \u0642\u0627\u0626\u0645\u0629 \u2014 \u0639\u0631\u0636 \u0627\u0644\u0645\u062d\u0645\u064a\u064a\u0646',
      threadID);

  const { id, name } = mentions[0];
  const nameWords = name.trim().split(/\s+/).filter(Boolean).length;
  const raw = args.slice(nameWords).join(' ').trim();

  if (raw === '\u0625\u0644\u063a\u0627\u0621' || raw === '\u0627\u0644\u063a\u0627\u0621' || raw === 'remove' || raw === 'unlock') {
    protect.unprotect(threadID, id);
    return api.sendMessage('\ud83d\udd13 \u062a\u0645 \u0625\u0644\u063a\u0627\u0621 \u062d\u0645\u0627\u064a\u0629 \u0643\u0646\u064a\u0629 ' + name + '.', threadID);
  }

  if (!raw) {
    const info = await getThread(api, threadID);
    const currentNick = info && info.nicknames && info.nicknames[id] ? info.nicknames[id] : '';
    protect.protect(threadID, id, currentNick);
    return api.sendMessage('\ud83d\udd12 \u062a\u0645 \u062a\u062b\u0628\u064a\u062a \u0643\u0646\u064a\u0629 ' + name + '.', threadID);
  }

  try { await api.nickname(raw, threadID, id); } catch (e) {
    log.error('nickProtect set: ' + e.message);
  }
  protect.protect(threadID, id, raw);
  return api.sendMessage('\ud83d\udd12 \u062a\u0645 \u062a\u062b\u0628\u064a\u062a \u0643\u0646\u064a\u0629 ' + name + '.', threadID);
}

module.exports = { handle };
