const log = require('../utils/logger');
const { jitter } = require('../utils/actionQueue');

function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

async function acceptPending(api) {
  try {
    await wait(jitter(5000, 9000));

    const threads = await api.getThreadList(30, null, ['PENDING']);
    if (!threads || !threads.length) return;

    log.info('طلبات مراسلة معلقة: ' + threads.length);

    for (const t of threads) {
      try {
        await api.sendMessage('✅', t.threadID);
        log.bot('تم قبول: ' + t.threadID + (t.threadName ? ' (' + t.threadName + ')' : ''));
        await wait(jitter(2500, 4500));
      } catch (e) {
        log.error('فشل قبول ' + t.threadID + ': ' + (e?.message || e));
        await wait(2000);
      }
    }
  } catch (e) {
    log.error('autoAccept pending: ' + (e?.message || e));
  }
}

async function getPendingList(api) {
  try {
    const threads = await api.getThreadList(50, null, ['PENDING']);
    if (!threads || !threads.length) return [];

    return threads.map(t => ({
      threadID:   t.threadID,
      name:       t.threadName || t.name || null,
      isGroup:    t.isGroup || false,
      snippet:    t.snippet  || '',
      timestamp:  t.timestamp || null,
      participants: (t.participants || []).slice(0, 5).map(p => ({
        id:   String(p.userFbId || p.id || p),
        name: p.name || p.fullName || null,
      })),
    }));
  } catch (e) {
    log.error('getPendingList: ' + (e?.message || e));
    return [];
  }
}

async function acceptOne(api, threadID) {
  try {
    await api.sendMessage('✅', threadID);
    log.bot('قبول يدوي: ' + threadID);
    return { ok: true };
  } catch (e) {
    log.error('acceptOne ' + threadID + ': ' + (e?.message || e));
    return { ok: false, error: e?.message || String(e) };
  }
}

async function rejectOne(api, threadID) {
  try {
    if (typeof api.deleteThread === 'function') {
      await api.deleteThread(threadID);
    } else {
      await api.sendMessage('🚫', threadID);
      await wait(500);
      if (typeof api.deleteThread === 'function') await api.deleteThread(threadID);
    }
    log.bot('رفض يدوي: ' + threadID);
    return { ok: true };
  } catch (e) {
    log.error('rejectOne ' + threadID + ': ' + (e?.message || e));
    return { ok: false, error: e?.message || String(e) };
  }
}

async function onSubscribeEvent(event, api) {
  try {
    const botID = String(api.getCurrentUserID());
    const added = event.logMessageData?.addedParticipants || [];

    const botAdded = added.some(p =>
      String(p.userFbId || p.id || p) === botID
    );

    if (!botAdded) return;

    const { threadID } = event;
    log.bot('تمت الإضافة للمجموعة: ' + threadID + ' — قبول تلقائي');

    await wait(jitter(2500, 4000));
    await api.sendMessage('✅ تم الانضمام!', threadID);
    log.bot('تم قبول المجموعة: ' + threadID);
  } catch (e) {
    log.error('autoAccept subscribe: ' + (e?.message || e));
  }
}

module.exports = { acceptPending, getPendingList, acceptOne, rejectOne, onSubscribeEvent };
