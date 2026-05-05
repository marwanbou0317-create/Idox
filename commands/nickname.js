const log = require('../utils/logger');
const { isAdmin } = require('../utils/admin');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// استخراج ID واسم من mentions بغض النظر عن الصيغة (object أو array)
function parseMentions(mentions) {
  if (!mentions) return null;
  if (Array.isArray(mentions) && mentions.length > 0) {
    const m = mentions[0];
    return { id: String(m.id || m.userID || ''), name: String(m.name || m.tag || '') };
  }
  const keys = Object.keys(mentions);
  if (keys.length > 0) {
    return { id: String(keys[0]), name: String(mentions[keys[0]] || '') };
  }
  return null;
}

async function getThread(api, threadID) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), 15000);
    try {
      api.getThreadInfo(threadID, (err, info) => {
        clearTimeout(timer);
        resolve(err ? null : info);
      });
    } catch (e) {
      clearTimeout(timer);
      resolve(null);
    }
  });
}

async function setNick(api, nickname, threadID, uid) {
  const fn = api.setNickname || api.changeNickname;
  if (!fn) { log.error('setNickname غير متاح في هذه النسخة'); return false; }
  return new Promise((resolve) => {
    try {
      fn.call(api, nickname, threadID, uid, (err) => {
        if (err) { log.error('setNick خطأ لـ ' + uid + ': ' + JSON.stringify(err)); resolve(false); }
        else resolve(true);
      });
    } catch (e) {
      log.error('setNick استثناء لـ ' + uid + ': ' + e.message);
      resolve(false);
    }
  });
}

async function setNickRetry(api, nickname, threadID, uid) {
  for (let i = 1; i <= 3; i++) {
    if (await setNick(api, nickname, threadID, uid)) return true;
    if (i < 3) await sleep(5000 * i);
  }
  return false;
}

async function handle(event, api, args) {
  const { threadID, senderID } = event;
  if (!isAdmin(senderID)) return api.sendMessage('❌ ليس لديك صلاحية استخدام هذا الأمر.', threadID);

  const subCmd = (args[0] || '').trim();

  // ── /كنية الكل [نص|reset] ──
  if (subCmd === 'الكل' || subCmd === 'all') {
    const nicknameText = args.slice(1).join(' ').trim();
    const isReset = !nicknameText || nicknameText === 'reset' || nicknameText === 'مسح';
    const nickname = isReset ? '' : nicknameText;

    api.sendMessage('⏳ جاري جلب أعضاء المجموعة...', threadID);
    const info = await getThread(api, threadID);
    if (!info) return api.sendMessage('❌ تعذّر جلب معلومات المجموعة. حاول مجدداً.', threadID);

    const members = info.participantIDs || [];
    if (!members.length) return api.sendMessage('⚠️ لا يوجد أعضاء في هذه المجموعة.', threadID);

    api.sendMessage(
      (isReset ? '⏳ جاري مسح كنيات ' : '⏳ جاري تعيين الكنية لـ ') + members.length + ' عضو...',
      threadID
    );

    let done = 0, fail = 0;
    for (let i = 0; i < members.length; i++) {
      // تأخير بين كل عضو لتجنب الحظر
      if (i > 0 && i % 5 === 0) await sleep(12000);
      else if (i > 0) await sleep(3000 + Math.random() * 2000);

      if (await setNickRetry(api, nickname, threadID, members[i])) {
        done++;
        if (done % 10 === 0)
          api.sendMessage('⏳ تقدّم: ' + done + ' من ' + members.length + '...', threadID);
      } else {
        fail++;
      }
    }

    return api.sendMessage(
      '✅ اكتمل!\n' +
      (isReset ? '🗑 مُسح: ' : '✏️ تم تعيين "' + nickname + '" لـ ') + done +
      (fail ? '\n❌ فشل: ' + fail : ''),
      threadID
    );
  }

  // ── /كنية @شخص [نص|reset] ──
  const mention = parseMentions(event.mentions);
  if (!mention || !mention.id) {
    return api.sendMessage(
      '📌 طريقة الاستخدام:\n' +
      '/كنية @شخص [كنية] — تعيين كنية\n' +
      '/كنية @شخص reset — مسح الكنية\n' +
      '/كنية الكل [كنية] — كنية للجميع\n' +
      '/كنية الكل reset — مسح كنيات الجميع',
      threadID
    );
  }

  // استخراج الكنية: كل شيء بعد اسم المنشن في args
  const mentionWords = mention.name.trim().split(/\s+/).filter(Boolean).length;
  const nicknameText = args.slice(Math.max(1, mentionWords)).join(' ').trim();
  const isReset = !nicknameText || nicknameText === 'reset' || nicknameText === 'مسح';
  const nickname = isReset ? '' : nicknameText;

  const ok = await setNickRetry(api, nickname, threadID, mention.id);
  return api.sendMessage(
    ok
      ? (isReset
          ? '✅ تم مسح كنية ' + mention.name + '.'
          : '✅ تم تعيين كنية ' + mention.name + ':\n"' + nickname + '"')
      : '❌ فشل تغيير الكنية بعد 3 محاولات. تأكد أن البوت أدمن في المجموعة.',
    threadID
  );
}

module.exports = { handle };
