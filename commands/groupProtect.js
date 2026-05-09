const protect = require('../utils/groupNameProtect');
const log     = require('../utils/logger');

async function handle(event, api, args) {
  const { threadID } = event;
  const sub = (args[0] || '').trim().toLowerCase();

  if (sub === '\u0625\u0644\u063A\u0627\u0621' || sub === '\u0627\u0644\u063A\u0627\u0621' || sub === 'off') {
    if (!protect.isProtected(threadID))
      return api.sendMessage('\u2139\uFE0F \u0627\u0633\u0645 \u0627\u0644\u0645\u062C\u0645\u0648\u0639\u0629 \u063A\u064A\u0631 \u0645\u062D\u0645\u064A \u0623\u0635\u0644\u0627\u064B.', threadID);
    protect.unprotect(threadID);
    return api.sendMessage('\uD83D\uDD13 \u062A\u0645 \u0625\u0644\u063A\u0627\u0621 \u062D\u0645\u0627\u064A\u0629 \u0627\u0633\u0645 \u0627\u0644\u0645\u062C\u0645\u0648\u0639\u0629.', threadID);
  }

  if (sub === '\u062D\u0627\u0644\u0629' || sub === '\u0639\u0631\u0636' || sub === 'status') {
    if (!protect.isProtected(threadID))
      return api.sendMessage('\u2139\uFE0F \u0627\u0633\u0645 \u0627\u0644\u0645\u062C\u0645\u0648\u0639\u0629 \u063A\u064A\u0631 \u0645\u062D\u0645\u064A \u062D\u0627\u0644\u064A\u0627\u064B.', threadID);
    const name = protect.getProtected(threadID);
    return api.sendMessage('\uD83D\uDD12 \u0627\u0633\u0645 \u0627\u0644\u0645\u062C\u0645\u0648\u0639\u0629 \u0645\u062D\u0645\u064A\n\uD83D\uDCCC \u0627\u0644\u0627\u0633\u0645 \u0627\u0644\u0645\u062B\u0628\u062A: ' + name, threadID);
  }

  const name = args.join(' ').trim();

  if (!name)
    return api.sendMessage(
      '\uD83D\uDCCC \u0627\u0644\u0627\u0633\u062A\u062E\u062F\u0627\u0645:\n' +
      '/\u0627\u0633\u0645 [\u0627\u0644\u0627\u0633\u0645] \u2014 \u062A\u063A\u064A\u064A\u0631 \u0648\u062A\u062B\u0628\u064A\u062A \u0627\u0633\u0645 \u0627\u0644\u0645\u062C\u0645\u0648\u0639\u0629\n' +
      '/\u0627\u0633\u0645 \u0625\u0644\u063A\u0627\u0621 \u2014 \u0625\u0644\u063A\u0627\u0621 \u0627\u0644\u062D\u0645\u0627\u064A\u0629\n' +
      '/\u0627\u0633\u0645 \u062D\u0627\u0644\u0629 \u2014 \u0639\u0631\u0636 \u0627\u0644\u062D\u0627\u0644\u0629',
      threadID
    );

  try {
    await api.setTitle(name, threadID);
  } catch (e) {
    log.error('groupProtect setTitle: ' + e.message);
    return api.sendMessage('\u274C \u0641\u0634\u0644 \u062A\u063A\u064A\u064A\u0631 \u0627\u0633\u0645 \u0627\u0644\u0645\u062C\u0645\u0648\u0639\u0629.', threadID);
  }

  protect.protect(threadID, name);
  return api.sendMessage(
    '\uD83D\uDD12 \u062A\u0645 \u062A\u063A\u064A\u064A\u0631 \u0627\u0633\u0645 \u0627\u0644\u0645\u062C\u0645\u0648\u0639\u0629 \u0648\u062A\u062B\u0628\u064A\u062A\u0647\n' +
    '\uD83D\uDCCC \u0627\u0644\u0627\u0633\u0645: ' + name + '\n\n' +
    '\u0623\u064A \u0645\u062D\u0627\u0648\u0644\u0629 \u0644\u062A\u063A\u064A\u064A\u0631\u0647 \u0633\u062A\u064F\u0633\u062A\u0639\u0627\u062F \u062A\u0644\u0642\u0627\u0626\u064A\u0627\u064B \u062E\u0644\u0627\u0644 5 \u062B\u0648\u0627\u0646\u064A.',
    threadID
  );
}

module.exports = { handle };
