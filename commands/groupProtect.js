const protect = require('../utils/groupNameProtect');
const log     = require('../utils/logger');

function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

async function handle(event, api, args) {
  const { threadID } = event;
  const sub = (args[0] || '').trim().toLowerCase();

  if (sub === '\u0625\u0644\u063a\u0627\u0621' || sub === '\u0627\u0644\u063a\u0627\u0621' || sub === 'off') {
    if (!protect.isProtected(threadID))
      return api.sendMessage('\u2139\ufe0f \u0627\u0633\u0645 \u0627\u0644\u0645\u062c\u0645\u0648\u0639\u0629 \u063a\u064a\u0631 \u0645\u062d\u0645\u064a \u0623\u0635\u0644\u0627\u064b.', threadID);
    protect.unprotect(threadID);
    return api.sendMessage('\ud83d\udd13 \u062a\u0645 \u0625\u0644\u063a\u0627\u0621 \u062d\u0645\u0627\u064a\u0629 \u0627\u0633\u0645 \u0627\u0644\u0645\u062c\u0645\u0648\u0639\u0629.', threadID);
  }

  if (sub === '\u062d\u0627\u0644\u0629' || sub === '\u0639\u0631\u0636' || sub === 'status') {
    if (!protect.isProtected(threadID))
      return api.sendMessage('\u2139\ufe0f \u0627\u0633\u0645 \u0627\u0644\u0645\u062c\u0645\u0648\u0639\u0629 \u063a\u064a\u0631 \u0645\u062d\u0645\u064a \u062d\u0627\u0644\u064a\u0627\u064b.', threadID);
    const name = protect.getProtected(threadID);
    return api.sendMessage('\ud83d\udd12 \u0627\u0633\u0645 \u0627\u0644\u0645\u062c\u0645\u0648\u0639\u0629 \u0645\u062d\u0645\u064a\n\ud83d\udccc \u0627\u0644\u0627\u0633\u0645 \u0627\u0644\u0645\u062b\u0628\u062a: ' + name, threadID);
  }

  const name = args.join(' ').trim();

  if (!name)
    return api.sendMessage(
      '\ud83d\udccc \u0627\u0644\u0627\u0633\u062a\u062e\u062f\u0627\u0645:\n' +
      '/\u0627\u0633\u0645 [\u0627\u0644\u0627\u0633\u0645] \u2014 \u062a\u063a\u064a\u064a\u0631 \u0648\u062a\u062b\u0628\u064a\u062a \u0627\u0633\u0645 \u0627\u0644\u0645\u062c\u0645\u0648\u0639\u0629\n' +
      '/\u0627\u0633\u0645 \u0625\u0644\u063a\u0627\u0621 \u2014 \u0625\u0644\u063a\u0627\u0621 \u0627\u0644\u062d\u0645\u0627\u064a\u0629\n' +
      '/\u0627\u0633\u0645 \u062d\u0627\u0644\u0629 \u2014 \u0639\u0631\u0636 \u0627\u0644\u062d\u0627\u0644\u0629',
      threadID
    );

  let ok = false;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await api.setTitle(name, threadID);
      ok = true;
      break;
    } catch (e) {
      log.error('groupProtect setTitle #' + (attempt + 1) + ': ' + e.message);
      if (attempt < 2) await wait(3000);
    }
  }

  if (!ok)
    return api.sendMessage('\u274c \u0641\u0634\u0644 \u062a\u063a\u064a\u064a\u0631 \u0627\u0633\u0645 \u0627\u0644\u0645\u062c\u0645\u0648\u0639\u0629 \u0628\u0639\u062f 3 \u0645\u062d\u0627\u0648\u0644\u0627\u062a.', threadID);

  protect.protect(threadID, name);
  return api.sendMessage(
    '\ud83d\udd12 \u062a\u0645 \u062a\u063a\u064a\u064a\u0631 \u0627\u0633\u0645 \u0627\u0644\u0645\u062c\u0645\u0648\u0639\u0629 \u0648\u062a\u062b\u0628\u064a\u062a\u0647\n' +
    '\ud83d\udccc \u0627\u0644\u0627\u0633\u0645: ' + name + '\n\n' +
    '\u0623\u064a \u0645\u062d\u0627\u0648\u0644\u0629 \u0644\u062a\u063a\u064a\u064a\u0631\u0647 \u0633\u062a\u064f\u0633\u062a\u0639\u0627\u062f \u062a\u0644\u0642\u0627\u0626\u064a\u0627\u064b \u062e\u0644\u0627\u0644 5 \u062b\u0648\u0627\u0646\u064a.',
    threadID
  );
}

module.exports = { handle };
