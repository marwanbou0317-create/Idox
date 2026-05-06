const log = require('./utils/logger');

async function getThread(api, threadID) {
  try {
    return await api.getThreadInfo(threadID);
  } catch (e) {
    log.error('getThread: ' + (e?.message || e));
    return null;
  }
}

async function setNick(api, nickname, threadID, uid) {
  try {
    await api.nickname(nickname, threadID, uid);
    return true;
  } catch (e) {
    log.error('setNick [' + uid + ']: ' + (e?.message || e));
    return false;
  }
}

module.exports = { setNick, getThread };
