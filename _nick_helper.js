const log = require('./utils/logger');
let workingOrder = null; // 'A'=(nick,tid,uid) | 'B'=(nick,uid,tid)

function getThread(api, threadID) {
  return new Promise(resolve => {
    let done = false;
    const fin = v => { if (!done) { done = true; resolve(v); } };
    setTimeout(() => fin(null), 15000);
    try {
      const r = api.getThreadInfo(threadID, (err, info) => fin(err ? null : info));
      if (r && typeof r.then === 'function') r.then(i => fin(i)).catch(() => fin(null));
    } catch { fin(null); }
  });
}

function tryNick(api, args3) {
  // args3 = [nickname, arg1, arg2] where arg1/arg2 order varies
  const fn = api.setNickname || api.changeNickname;
  return new Promise(resolve => {
    let done = false;
    const fin = v => { if (!done) { done = true; resolve(v); } };
    setTimeout(() => fin(null), 8000); // null = inconclusive (timeout/no answer)
    try {
      const r = fn.call(api, ...args3, err => {
        if (err) {
          const msg = JSON.stringify(err);
          log.error('setNick: ' + msg);
          fin(false);
        } else fin(true);
      });
      if (r && typeof r.then === 'function')
        r.then(() => fin(true)).catch(e => { log.error('setNick P: ' + (e?.message || e)); fin(false); });
    } catch (e) { log.error('setNick ex: ' + e.message); fin(null); }
  });
}

async function setNick(api, nickname, threadID, uid) {
  const fn = api.setNickname || api.changeNickname;
  if (!fn) { log.error('❌ setNickname/changeNickname غير موجود في API!'); return false; }

  const A = [nickname, threadID, uid];  // (nick, threadID, participantID)
  const B = [nickname, uid, threadID];  // (nick, participantID, threadID)

  // استخدم الترتيب المعروف
  if (workingOrder === 'A') { const r = await tryNick(api, A); return r === true; }
  if (workingOrder === 'B') { const r = await tryNick(api, B); return r === true; }

  // حاول A أولاً
  const rA = await tryNick(api, A);
  if (rA === true) { workingOrder = 'A'; log.bot('setNick: ترتيب A يعمل'); return true; }

  // ثم B
  const rB = await tryNick(api, B);
  if (rB === true) { workingOrder = 'B'; log.bot('setNick: ترتيب B يعمل'); return true; }

  return false;
}

module.exports = { setNick, getThread };
