const protect = require('../utils/groupNameProtect');
const log     = require('../utils/logger');

async function handle(event, api, args) {
  const { threadID } = event;
  const sub = (args[0] || '').trim().toLowerCase();

  if (sub === '\u0625\u0644\u063a\u0627\u0621' || sub === '\u0627\u0644\u063a\u0627\u0621' || sub === 'unlock') {
    if (!protect.isProtected(threadID))
      return api.sendMessage('\u2139\ufe0f \u0627\u0633\u0645 \u0627\u0644\u0645\u062c\u0645\u0648\u0639\u0629 \u063a\u064a\u0631 \u0645\u062d\u0645\u064a \u0623\u0635\u0644\u0627\u064b.', threadID);
    protect.unprotect(threadID);
    return api.sendMessage('\ud83d\udd13 \u062a\u0645 \u0625\u0644\u063a\u0627\u0621 \u062d\u0645\u0627\u064a\u0629 \u0627\u0633\u0645 \u0627\u0644\u0645\u062c\u0645\u0648\u0639\u0629.', threadID);
  }

  if (sub === '\u0639\u0631\u0636' || sub === '\u062d\u0627\u0644\u0629' || sub === 'status') {
    if (!protect.isProtected(threadID))
      return api.sendMessage('\u2139\ufe0f \u0627\u0633\u0645 \u0627\u0644\u0645\u062c\u0645\u0648\u0639\u0629 \u063a\u064a\u0631 \u0645\u062d\u0645\u064a \u062d\u0627\u0644\u064a\u0627\u064b.', threadID);
    return api.sendMessage('\ud83d\udd12 \u0627\u0633\u0645 \u0627\u0644\u0645\u062c\u0645\u0648\u0639\u0629 \u0645\u062d\u0645\u064a \u0648\u0645\u062b\u0628\u062a.', threadID);
  }

  const name = args.join(' ').trim();

  if (!name)
    return api.sendMessage(
      '\ud83d\udccc \u0627\u0644\u0627\u0633\u062a\u062e\u062f\u0627\u0645:\n' +
      '/\u0627\u0633\u0645 [\u0627\u0644\u0627\u0633\u0645] \u2014 \u062a\u062b\u0628\u064a\u062a \u0627\u0633\u0645 \u0627\u0644\u0645\u062c\u0645\u0648\u0639\u0629\n' +
      '/\u0627\u0633\u0645 \u0625\u0644\u063a\u0627\u0621 \u2014 \u0625\u0644\u063a\u0627\u0621 \u0627\u0644\u062d\u0645\u0627\u064a\u0629\n' +
      '/\u0627\u0633\u0645 \u0639\u0631\u0636 \u2014 \u0639\u0631\u0636 \u0627\u0644\u062d\u0627\u0644\u0629',
      threadID);

  try { await api.setTitle(name, threadID); } catch (e) {
    log.error('groupProtect set: ' + e.message);
  }
  protect.protect(threadID, name);
  return api.sendMessage('\ud83d\udd12 \u062a\u0645 \u062a\u062b\u0628\u064a\u062a \u0627\u0633\u0645 \u0627\u0644\u0645\u062c\u0645\u0648\u0639\u0629.', threadID);
}

module.exports = { handle };
