const { setNick, getThread } = require('../_nick_helper');
const protect       = require('../utils/nickProtect');
const log           = require('../utils/logger');
const cfg           = require('../config.json');

function wait(ms) { return new Promise(r => setTimeout(r, ms)); }
function jitter(a, b) { return Math.floor(a + Math.random() * (b - a)); }

const DELAY       = cfg.antiban && cfg.antiban.nickDelay      ? cfg.antiban.nickDelay      : 3000;
const BATCH       = cfg.antiban && cfg.antiban.nickBatchSize  ? cfg.antiban.nickBatchSize  : 5;
const BATCH_DELAY = cfg.antiban && cfg.antiban.nickBatchDelay ? cfg.antiban.nickBatchDelay : 12000;

async function setNickRetry(api, nick, tid, uid) {
  for (let i = 0; i < 3; i++) {
    if (await setNick(api, nick, tid, uid)) return true;
    if (i < 2) await wait(jitter(4000, 7000));
  }
  return false;
}

async function handle(event, api, args) {
  const { threadID } = event;
  const raw     = args.join(' ').trim();
  const isReset = !raw || raw === 'reset' || raw === '\u0645\u0633\u062d';
  const nick    = isReset ? '' : raw;

  if (!raw)
    return api.sendMessage(
      '\ud83d\udccc \u0627\u0644\u0627\u0633\u062a\u062e\u062f\u0627\u0645:\n/\u0643\u0646\u064a\u0627\u062a [\u0646\u0635] \u2014 \u0646\u0641\u0633 \u0627\u0644\u0643\u0646\u064a\u0629 \u0644\u0644\u062c\u0645\u064a\u0639\n/\u0643\u0646\u064a\u0627\u062a reset \u2014 \u0645\u0633\u062d \u0627\u0644\u0643\u0646\u064a\u0627\u062a\n\n\u0645\u062b\u0627\u0644: /\u0643\u0646\u064a\u0627\u062a VIP \u2b50',
      threadID);

  api.sendMessage('\u23f3 \u062c\u0627\u0631\u064a \u062c\u0644\u0628 \u0627\u0644\u0623\u0639\u0636\u0627\u0621...', threadID);
  const info = await getThread(api, threadID);

  if (!info || !info.participantIDs || !info.participantIDs.length)
    return api.sendMessage('\u274c \u062a\u0639\u0630\u0651\u0631 \u062c\u0644\u0628 \u0627\u0644\u0623\u0639\u0636\u0627\u0621.', threadID);

  const members = info.participantIDs;
  api.sendMessage('\u23f3 ' + members.length + ' \u0639\u0636\u0648 \u2014 \u062c\u0627\u0631\u064a \u0627\u0644\u0645\u0639\u0627\u0644\u062c\u0629...', threadID);

  let done = 0, fail = 0, skipped = 0;
  for (let i = 0; i < members.length; i++) {
    if (protect.isProtected(threadID, members[i])) { skipped++; continue; }

    if (i > 0 && i % BATCH === 0) {
      await wait(jitter(BATCH_DELAY, BATCH_DELAY + 3000));
    } else if (i > 0) {
      await wait(jitter(DELAY - 500, DELAY + 1000));
    }

    if (await setNickRetry(api, nick, threadID, members[i])) {
      done++;
      if (done % 10 === 0) api.sendMessage('\u23f3 ' + done + '/' + members.length, threadID);
    } else {
      fail++;
    }
  }

  api.sendMessage(
    '\u2705 \u0627\u0643\u062a\u0645\u0644!\n' +
    (isReset ? '\ud83d\uddd1 \u0645\u064f\u0633\u062d\u062a \u0627\u0644\u0643\u0646\u064a\u0627\u062a: ' + done : '\u270f\ufe0f \u062a\u0645 \u0627\u0644\u062a\u0639\u064a\u064a\u0646 \u0644\u0640 ' + done) +
    (skipped ? '\n\ud83d\udd12 \u0645\u062d\u0645\u064a (\u062a\u062c\u0627\u0647\u0644): ' + skipped : '') +
    (fail ? '\n\u274c \u0641\u0634\u0644: ' + fail : ''),
    threadID);
}

module.exports = { handle };
