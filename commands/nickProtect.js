const log = require('../utils/logger');

// تخزين داخلي داخل نفس الملف
const data = new Map();

module.exports = async function (event, api) {
  const { threadID, logMessageType, logMessageData } = event;

  // حدث تغيير الكنية فقط
  if (logMessageType !== "log:thread-nickname") return;

  const userID = logMessageData?.participant_id;
  if (!userID) return;

  const savedNick = data.get(threadID)?.[userID];

  // إذا غير محمي → لا شيء
  if (!savedNick) return;

  try {
    await api.changeNickname(savedNick, threadID, userID);
  } catch (e) {
    log.error("nick guard error: " + e.message);
  }
};


// ===== دوال تستخدمها من أوامر البوت =====

module.exports.protect = function (threadID, userID, nickname) {
  if (!data.has(threadID)) data.set(threadID, {});
  data.get(threadID)[userID] = nickname;
};

module.exports.unprotect = function (threadID, userID) {
  if (!data.has(threadID)) return;
  delete data.get(threadID)[userID];
};

module.exports.get = function (threadID, userID) {
  return data.get(threadID)?.[userID];
};

module.exports.list = function (threadID) {
  return Object.entries(data.get(threadID) || {});
};
