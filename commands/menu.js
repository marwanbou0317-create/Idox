// القائمة التفاعلية الرقمية — 14 خياراً مع نظام جلسات
const engine       = require('./engine');
const groupProtect = require('../utils/groupNameProtect');
const nickProtect  = require('../utils/nickProtect');
const parseMentions = require('../_mentions');
const { getThread } = require('../_nick_helper');
const log = require('../utils/logger');

// ── معرّف البوت (يُضبط بعد تسجيل الدخول) ─────────────────────
let _botID = null;
function setBotID(id) { _botID = id ? String(id) : null; }

// ── نظام الجلسات ─────────────────────────────────────────────
const sessions = new Map();
const TTL = 5 * 60 * 1000; // 5 دقائق

function sKey(tid, sid) { return tid + ':' + sid; }

function clearExpired() {
  const now = Date.now();
  const expired = [];
  for (const [k, s] of sessions) { if (now - s.ts > TTL) expired.push(k); }
  expired.forEach(k => sessions.delete(k));
}

function hasSession(threadID, senderID) {
  clearExpired();
  return sessions.has(sKey(threadID, senderID));
}

// ── تنسيق الوقت ──────────────────────────────────────────────
function fmtSec(s) {
  if (!s && s !== 0) return '—';
  if (s < 60)   return s + 'ث';
  if (s < 3600) return Math.floor(s / 60) + 'د';
  return Math.floor(s / 3600) + 'س';
}
function fmtAgo(ts) {
  if (!ts) return '—';
  const s = Math.floor((Date.now() - ts) / 1000);
  return s < 0 ? '—' : 'منذ ' + s + 'ث';
}
function fmtIn(ts) {
  if (!ts) return '—';
  const s = Math.floor((ts - Date.now()) / 1000);
  return s <= 0 ? 'الآن' : 'خلال ' + s + 'ث';
}
function fmtTime(st) {
  if (st.isRandom) return '🎲 ' + st.minSec + 's-' + st.maxSec + 's';
  return fmtSec(st.seconds);
}

// ── بناء نص القائمة (يجلب اسم الغروب من API) ─────────────────
async function buildMenu(threadID, api) {
  const ns  = engine.normal.getState();
  const ss  = engine.smart.getState();
  const sep = '━━━━━━━━━━━━━━━';

  // جلب معلومات الغروب
  let groupName = null;
  if (api) {
    try {
      const info = await getThread(api, threadID);
      if (info) groupName = info.threadName || info.name || null;
    } catch {}
  }

  const gnLocked      = groupProtect.isProtected(threadID);
  const gnName        = gnLocked ? groupProtect.getProtected(threadID) : null;
  const botNickLocked = _botID ? nickProtect.isProtected(threadID, _botID) : false;
  const botNick       = (botNickLocked && _botID) ? nickProtect.getProtected(threadID, _botID) : null;

  // ── رأس الرسالة: قفل كنية البوت ──────────────────────────────
  let header = '';
  if (botNickLocked) {
    header = '🔒 تم قفل كنية البوت على:\n"' + (botNick || '(فارغة)') + '"\n\n' +
             '⚡ أي تغيير سيُعاد تلقائياً\n(لإيقاف القفل: اختار 12 ثم اكتب ايقاف)\n\n';
  }

  // ── معلومات الغروب ────────────────────────────────────────────
  let groupSection = '';
  if (groupName)     groupSection += '👥 ' + groupName + '\n';
  groupSection += '🆔 ' + threadID + '\n';
  if (gnLocked)      groupSection += '🔒 اسم مقفول: "' + gnName + '"\n';
  if (botNickLocked) groupSection += '🔒 كنية مقفولة (بوت): "' + (botNick || '') + '"';

  // ── حالة المحركين ─────────────────────────────────────────────
  const nSt   = ns.on ? '🟢 شغّال' : '🔴 متوقف';
  const sSt   = ss.on ? '🟢 شغّال' : '⚫ متوقف';
  const nTime = fmtTime(ns);
  const sTime = fmtTime(ss);

  let nDetail = '   📝 "' + (ns.message || 'لم تُضبط') + '" · ⏱ ' + nTime;
  if (ns.on) nDetail += '\n   آخر إرسال: ' + fmtAgo(ns.lastSent) + '  |  التالي: ' + fmtIn(ns.nextAt);
  let sDetail = '   📝 "' + (ss.message || 'لم تُضبط') + '" · ⏱ ' + sTime;

  return (
    header +
    groupSection + '\n' +
    sep + '\n' +
    '📍 المحرك العادي: ' + nSt + '\n' + nDetail + '\n\n' +
    '📍 المحرك الذكي: ' + sSt + '\n' + sDetail + '\n' +
    sep + '\n' +
    '1 - تفعيل المحرك العادي\n' +
    '2 - إيقاف المحرك العادي\n' +
    '3 - ضبط رسالة المحرك العادي\n' +
    '4 - ضبط وقت المحرك العادي (s/m أو r للعشوائي)\n' +
    '5 - تفعيل المحرك الذكي\n' +
    '6 - إيقاف المحرك الذكي\n' +
    '7 - ضبط رسالة المحرك الذكي\n' +
    '8 - ضبط وقت المحرك الذكي (s/m أو r للعشوائي)\n' +
    '9 - إرسال رسالة للغروب\n' +
    '10 - إخراج البوت من الغروب\n' +
    '11 - تغيير/إيقاف قفل اسم الغروب 🔒\n' +
    '12 - تغيير/إيقاف قفل كنية البوت 🔒\n' +
    '13 - تغيير لقب عضو (بالرد/منشن) — مرة واحدة\n' +
    '14 - قفل كنية الجميع 🔒\n' +
    sep + '\n' +
    '↩️ رد بالرقم (أو اكتب اغلاق للخروج)'
  );
}

// ── عرض القائمة (/قائمة) ─────────────────────────────────────
async function show(event, api) {
  clearExpired();
  const { threadID, senderID } = event;
  try {
    const menuText = await buildMenu(threadID, api);
    await new Promise((res, rej) =>
      api.sendMessage(menuText, threadID, err => err ? rej(err) : res())
    );
    sessions.set(sKey(threadID, senderID), { step: 'menu', ts: Date.now() });
  } catch (e) {
    log.error('menu.show: ' + e.message);
    api.sendMessage('❌ خطأ في بناء القائمة: ' + e.message, threadID);
  }
}

// ── تحليل الوقت ─────────────────────────────────────────────
function parseTime(raw) {
  const s = (raw || '').trim().toLowerCase();
  if (!s) return null;

  const rCustom = s.match(/^r(\d+)-(\d+)$/);
  if (rCustom) {
    const min = parseInt(rCustom[1]), max = parseInt(rCustom[2]);
    return min >= 5 && max > min ? { random: true, min, max } : null;
  }

  if (s === 'r' || s === 'عشوائي') return { random: true, min: 25, max: 45 };

  if (/^[\d.]+[mمد]$/.test(s)) {
    const v = parseFloat(s);
    return !isNaN(v) && v >= 1 ? { sec: Math.round(v * 60) } : null;
  }

  const v = parseFloat(s.replace(/s$/, ''));
  if (!isNaN(v) && v >= 10) return { sec: Math.round(v) };
  return null;
}

// ── معالجة الجلسة ─────────────────────────────────────────────
async function handleSession(event, api) {
  clearExpired();
  const { threadID, senderID, body, mentions, messageReply } = event;
  const k = sKey(threadID, senderID);
  const session = sessions.get(k);
  if (!session) return false;

  const text = (body || '').trim();

  // إغلاق القائمة
  if (text === 'اغلاق' || text === 'إغلاق') {
    sessions.delete(k);
    api.sendMessage('❌ تم إغلاق القائمة.', threadID);
    return true;
  }

  session.ts = Date.now();

  // ══ الخطوة الرئيسية: انتظار رقم 1-14 ════════════════════════
  if (session.step === 'menu') {
    const num = parseInt(text);
    if (isNaN(num) || num < 1 || num > 14) return false;

    switch (num) {
      case 1:
        engine.normal.start(threadID);
        sessions.delete(k);
        api.sendMessage('🟢 تم تفعيل المحرك العادي!', threadID);
        return true;

      case 2:
        engine.normal.stop();
        sessions.delete(k);
        api.sendMessage('🔴 تم إيقاف المحرك العادي.', threadID);
        return true;

      case 3:
        session.step = 'set-msg-normal';
        api.sendMessage('📝 أرسل الرسالة الجديدة للمحرك العادي:', threadID);
        return true;

      case 4:
        session.step = 'set-time-normal';
        api.sendMessage(
          '⏱ أرسل الوقت:\n• رقم = ثواني (مثل: 30)\n• 30s أو 5m\n• r = عشوائي (25-45ث)\n• r20-60 = نطاق مخصص',
          threadID);
        return true;

      case 5:
        engine.smart.start(threadID);
        sessions.delete(k);
        api.sendMessage('🧠 تم تفعيل المحرك الذكي!\nيرسل فقط عند وجود نشاط في الغروب.', threadID);
        return true;

      case 6:
        engine.smart.stop();
        sessions.delete(k);
        api.sendMessage('⚫ تم إيقاف المحرك الذكي.', threadID);
        return true;

      case 7:
        session.step = 'set-msg-smart';
        api.sendMessage('📝 أرسل الرسالة الجديدة للمحرك الذكي:', threadID);
        return true;

      case 8:
        session.step = 'set-time-smart';
        api.sendMessage(
          '⏱ أرسل الوقت:\n• رقم = ثواني (مثل: 30)\n• 30s أو 5m\n• r = عشوائي\n• r20-60 = نطاق مخصص',
          threadID);
        return true;

      case 9:
        session.step = 'send-msg';
        api.sendMessage('💬 أرسل الرسالة التي تريد إرسالها للغروب:', threadID);
        return true;

      case 10:
        session.step = 'leave-confirm';
        api.sendMessage('⚠️ هل أنت متأكد من إخراج البوت من الغروب؟\nاكتب تأكيد للمتابعة أو اغلاق للإلغاء.', threadID);
        return true;

      case 11: {
        const gnLocked = groupProtect.isProtected(threadID);
        session.step = 'group-name';
        api.sendMessage(
          gnLocked
            ? '🏷 القفل الحالي: "' + groupProtect.getProtected(threadID) + '"\nأرسل الاسم الجديد، أو اكتب ايقاف لإزالة القفل:'
            : '🏷 أرسل الاسم الذي تريد تثبيته للغروب:',
          threadID);
        return true;
      }

      case 12: {
        const nickLocked = _botID && nickProtect.isProtected(threadID, _botID);
        const curNick    = nickLocked ? nickProtect.getProtected(threadID, _botID) : null;
        session.step = 'bot-nick';
        api.sendMessage(
          nickLocked
            ? '🔒 الكنية الحالية مقفولة: "' + (curNick || '(فارغة)') + '"\nأرسل الكنية الجديدة، أو اكتب ايقاف لإزالة القفل:'
            : '✏️ أرسل الكنية التي تريد تثبيتها للبوت في هذا الغروب:',
          threadID);
        return true;
      }

      case 13:
        session.step = 'nick-member';
        api.sendMessage(
          '👤 أرسل رسالة فيها منشن (@عضو) أو رد على رسالة العضو:\n' +
          'اكتب الكنية بعد المنشن أو في أول السطر عند الرد.\n' +
          'مثال: @اسم الكنية الجديدة',
          threadID);
        return true;

      case 14:
        session.step = 'lock-all-confirm';
        api.sendMessage(
          '🔒 سيتم تثبيت كنية كل عضو على كنيته الحالية.\n' +
          'الأعضاء المحميون مسبقاً لن يُمسّوا.\n\n' +
          'اكتب تأكيد للمتابعة أو اغلاق للإلغاء.',
          threadID);
        return true;

      default:
        return false;
    }
  }

  // ══ الخطوات الثانوية ══════════════════════════════════════════

  if (session.step === 'set-msg-normal') {
    engine.normal.setMessage(text);
    if (engine.normal.isOn()) engine.normal.restart();
    sessions.delete(k);
    api.sendMessage('✅ رسالة المحرك العادي:\n"' + text + '"', threadID);
    return true;
  }

  if (session.step === 'set-msg-smart') {
    engine.smart.setMessage(text);
    if (engine.smart.isOn()) engine.smart.restart();
    sessions.delete(k);
    api.sendMessage('✅ رسالة المحرك الذكي:\n"' + text + '"', threadID);
    return true;
  }

  if (session.step === 'set-time-normal' || session.step === 'set-time-smart') {
    const t = parseTime(text);
    if (!t) {
      api.sendMessage('❌ صيغة خاطئة. أمثلة: 30 أو 30s أو 5m أو r أو r20-60', threadID);
      return true;
    }
    const eng = session.step === 'set-time-normal' ? engine.normal : engine.smart;
    if (t.random) {
      eng.setRandom(t.min, t.max);
      api.sendMessage('✅ الوقت العشوائي: ' + t.min + 's-' + t.max + 's 🎲', threadID);
    } else {
      eng.setTime(t.sec);
      const display = t.sec < 60 ? t.sec + 'ث' : Math.floor(t.sec / 60) + 'د';
      api.sendMessage('✅ الوقت: ~' + display + ' (±20%)', threadID);
    }
    sessions.delete(k);
    return true;
  }

  if (session.step === 'send-msg') {
    sessions.delete(k);
    api.sendMessage(text, threadID);
    return true;
  }

  if (session.step === 'leave-confirm') {
    sessions.delete(k);
    if (text === 'تأكيد') {
      api.sendMessage('👋 مع السلامة!', threadID, () => {
        if (_botID) {
          try {
            const r = api.removeUserFromGroup(_botID, threadID);
            if (r && typeof r.catch === 'function') r.catch(() => {});
          } catch {}
        }
      });
    } else {
      api.sendMessage('❌ تم إلغاء الإخراج.', threadID);
    }
    return true;
  }

  if (session.step === 'group-name') {
    sessions.delete(k);
    if (text === 'ايقاف' || text === 'إيقاف') {
      groupProtect.unprotect(threadID);
      api.sendMessage('🔓 تم إيقاف قفل اسم الغروب.', threadID);
    } else {
      try { await api.setTitle(text, threadID); } catch (e) { log.error('menu setTitle: ' + e.message); }
      groupProtect.protect(threadID, text);
      api.sendMessage('🔒 تم تثبيت اسم الغروب:\n"' + text + '"\n\n⚡ أي تغيير سيُعاد تلقائياً', threadID);
    }
    return true;
  }

  if (session.step === 'bot-nick') {
    sessions.delete(k);
    if (text === 'ايقاف' || text === 'إيقاف') {
      if (_botID) nickProtect.unprotect(threadID, _botID);
      api.sendMessage('🔓 تم إيقاف قفل كنية البوت.', threadID);
    } else {
      if (_botID) {
        try { await api.nickname(text, threadID, _botID); } catch (e) { log.error('menu bot-nick: ' + e.message); }
        nickProtect.protect(threadID, _botID, text);
      }
      api.sendMessage('🔒 تم تثبيت كنية البوت:\n"' + text + '"\n\n⚡ أي تغيير سيُعاد تلقائياً\n(لإيقاف: اختار 12 ثم اكتب ايقاف)', threadID);
    }
    return true;
  }

  if (session.step === 'nick-member') {
    const mentioned = parseMentions(mentions);
    if (mentioned.length) {
      const { id, name } = mentioned[0];
      const nameWords = name.trim().split(/\s+/).filter(Boolean).length;
      const nickText  = text.trim().split(/\s+/).slice(nameWords).join(' ').trim();
      if (nickProtect.isProtected(threadID, id)) {
        sessions.delete(k);
        api.sendMessage('🔒 كنية ' + name + ' محمية. استخدم /تثبيت @شخص إلغاء أولاً.', threadID);
        return true;
      }
      sessions.delete(k);
      try {
        await api.nickname(nickText || '', threadID, id);
        api.sendMessage(nickText
          ? '✅ تم تعيين كنية ' + name + ':\n"' + nickText + '"'
          : '✅ تم مسح كنية ' + name, threadID);
      } catch (e) {
        api.sendMessage('❌ فشل تغيير الكنية: ' + e.message, threadID);
      }
      return true;
    }

    if (messageReply && messageReply.senderID) {
      const uid = String(messageReply.senderID);
      if (nickProtect.isProtected(threadID, uid)) {
        sessions.delete(k);
        api.sendMessage('🔒 كنية هذا العضو محمية.', threadID);
        return true;
      }
      sessions.delete(k);
      try {
        await api.nickname(text || '', threadID, uid);
        api.sendMessage(text
          ? '✅ تم تعيين الكنية:\n"' + text + '"'
          : '✅ تم مسح الكنية.', threadID);
      } catch (e) {
        api.sendMessage('❌ فشل تغيير الكنية: ' + e.message, threadID);
      }
      return true;
    }

    api.sendMessage('⚠️ منشن عضو (@شخص) أو رد على رسالته، ثم أرسل الكنية.\nأو اكتب اغلاق للخروج.', threadID);
    return true;
  }

  if (session.step === 'lock-all-confirm') {
    sessions.delete(k);
    if (text !== 'تأكيد') {
      api.sendMessage('❌ تم إلغاء العملية.', threadID);
      return true;
    }
    api.sendMessage('⏳ جاري قفل كنيات الجميع...', threadID);
    lockAllNicks(api, threadID).then(r => {
      api.sendMessage(
        '✅ اكتمل!\n🔒 قُفل: ' + r.locked +
        '\n⏭ محمي مسبقاً: ' + r.skipped +
        '\n❌ فشل: ' + r.failed, threadID);
    }).catch(e => api.sendMessage('❌ خطأ: ' + e.message, threadID));
    return true;
  }

  return false;
}

// ── قفل كنيات جميع الأعضاء ──────────────────────────────────
async function lockAllNicks(api, threadID) {
  const info = await getThread(api, threadID);
  if (!info || !info.participantIDs) throw new Error('تعذّر جلب الأعضاء');
  const members = info.participantIDs;
  let locked = 0, skipped = 0, failed = 0;
  for (let i = 0; i < members.length; i++) {
    const uid = String(members[i]);
    if (nickProtect.isProtected(threadID, uid)) { skipped++; continue; }
    if (i > 0) await new Promise(r => setTimeout(r, 2000));
    const currentNick = (info.nicknames && info.nicknames[uid]) || '';
    try { nickProtect.protect(threadID, uid, currentNick); locked++; }
    catch { failed++; }
  }
  return { locked, skipped, failed };
}

module.exports = { show, handleSession, hasSession, setBotID };
