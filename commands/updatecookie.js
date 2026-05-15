module.exports.config = {
  name: "updatecookie",
  version: "1.0.0",
  permission: 2, // Super Admin Only
  description: "تحديث ملف الكوكيز appstate.json بسهولة من الشات",
  prefix: true,
  credits: "Copilot System",
  category: "admin",
  usages: "updatecookie",
  cooldowns: 3
};

const fs = require('fs');
const path = require('path');

module.exports.run = async function({ api, event }) {
  const { threadID, senderID, messageID } = event;

  api.sendMessage(
    "أرسل الآن الكوكيز الجديدة (appstate.json) في رسالة نصية واحدة.\n\n",
    threadID,
    (err, data) => {
      global.client.handleReply.push({
        type: "updatecookie",
        name: this.config.name,
        author: senderID,
        messageID: data.messageID
      });
    }
  );
}

module.exports.handleReply = async function({ api, event, handleReply }) {
  if (parseInt(event.senderID) !== parseInt(handleReply.author)) return;
  const { threadID, body, messageID } = event;
  try {
    // يتحقق أن النص JSON
    let cookieObj = JSON.parse(body);
    if (!Array.isArray(cookieObj)) throw "صيغة الكوكيز يجب أن تكون مصفوفة []";

    // يحفظ الملف (يمكنك تعديل المسار حسب مشروعك)
    fs.writeFileSync(path.join(__dirname, "..", "appstate.json"), JSON.stringify(cookieObj, null, 2), "utf8");

    api.sendMessage(
      "✅ تم تحديث الكوكيز (appstate.json) بنجاح.\nيرجى إعادة تشغيل البوت أو تنفيذ /reboot لو متوفر.",
      threadID,
      messageID
    );
  } catch(e) {
    api.sendMessage(`❌ فشل التحديث — صيغة الكوكيز غير صحيحة أو خطأ: ${e}`, threadID, messageID);
  }
}
