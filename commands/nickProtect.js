const protect = require('../utils/nickProtect');
const log     = require('../utils/logger');

async function handle(event, api, args) {
  const { threadID, mentions } = event;
  const sub = (args[0] || '').trim().toLowerCase();

  if (sub === '\u0639\u0631\u0636' || sub === '\u0642\u0627\u0626\u0645\u0629' || sub === 'list') {
    const list = protect.listProtected(threadID);
    if (!list.length)
      return api.sendMessage('\u2139\uFE0F \u0644\u0627 \u062A\u0648\u062C\u062F \u0643\u0646\u064A\u0627\u062A \u0645\u062D\u0645\u064A\u0629 \u0641\u064A \u0647\u0630\u0647 \u0627\u0644\u0645\u062C\u0645\u0648\u0639\u0629.', threadID);
    const lines = list.map(function(entry) { return '- ' + entry[0] + ': ' + (entry[1] || '(---)'); }).join('\n');
    return api.sendMessage('\uD83D\uDD12 \u0627\u0644\u0643\u0646\u064A\u0627\u062A \u0627\u0644\u0645\u062D\u0645\u064A\u0629:\n' + lines, threadID);
  }

  const mentionIDs = Object.keys(mentions || {});

  if (!mentionIDs.length)
    return api.sendMessage(
      '\uD83D\uDCCC \u0627\u0644\u0627\u0633\u062A\u062E\u062F\u0627\u0645:\n' +
      '/\u062A\u062B\u0628\u064A\u062A @\u0634\u062E\u0635 [\u0643\u0646\u064A\u0629] \u2014 \u062A\u062B\u0628\u064A\u062A \u0643\u0646\u064A\u0629 \u0634\u062E\u0635\n' +
      '/\u062A\u062B\u0628\u064A\u062A @\u0634\u062E\u0635 \u0625\u0644\u063A\u0627\u0621 \u2014 \u0625\u0644\u063A\u0627\u0621 \u062D\u0645\u0627\u064A\u0629 \u0643\u0646\u064A\u062A\u0647\n' +
      '/\u062A\u062B\u0628\u064A\u062A \u0639\u0631\u0636 \u2014 \u0639\u0631\u0636 \u062C\u0645\u064A\u0639 \u0627\u0644\u0643\u0646\u064A\u0627\u062A \u0627\u0644\u0645\u062D\u0645\u064A\u0629',
      threadID
    );

  const uid = mentionIDs[0];
  const mentionName = (mentions || {})[uid] || uid;
  const rest = args.slice(1).join(' ').trim().toLowerCase();

  if (rest === '\u0625\u0644\u063A\u0627\u0621' || rest === '\u0627\u0644\u063A\u0627\u0621') {
    if (!protect.isProtected(threadID, uid))
      return api.sendMessage('\u2139\uFE0F \u0643\u0646\u064A\u0629 ' + mentionName + ' \u063A\u064A\u0631 \u0645\u062D\u0645\u064A\u0629 \u0623\u0635\u0644\u0627\u064B.', threadID);
    protect.unprotect(threadID, uid);
    return api.sendMessage('\uD83D\uDD13 \u062A\u0645 \u0625\u0644\u063A\u0627\u0621 \u062D\u0645\u0627\u064A\u0629 \u0643\u0646\u064A\u0629 ' + mentionName + '.', threadID);
  }

  const nick = args.slice(1).join(' ').trim();

  try {
    if (nick) await api.changeNickname(nick, threadID, uid);
  } catch (e) {
    log.error('nickProtect changeNickname: ' + e.message);
  }

  protect.protect(threadID, uid, nick);
  return api.sendMessage(
    '\uD83D\uDD12 \u062A\u0645 \u062A\u062B\u0628\u064A\u062A \u0643\u0646\u064A\u0629 ' + mentionName + '\n' +
    '\uD83D\uDCCC \u0627\u0644\u0643\u0646\u064A\u0629: ' + (nick || '(---)') + '\n\n' +
    '\u0623\u064A \u0645\u062D\u0627\u0648\u0644\u0629 \u0644\u062A\u063A\u064A\u064A\u0631\u0647\u0627 \u0633\u062A\u064F\u0633\u062A\u0639\u0627\u062F \u062A\u0644\u0642\u0627\u0626\u064A\u0627\u064B \u062E\u0644\u0627\u0644 5 \u062B\u0648\u0627\u0646\u064A.',
    threadID
  );
}

module.exports = { handle };
