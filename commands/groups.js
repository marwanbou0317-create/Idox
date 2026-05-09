module.exports = {
  config: {
    name: "groups",
    aliases: ["gc", "group"],
    version: "3.0",
    author: "ChatGPT",
    role: 2,
    shortDescription: "إدارة الجروبات",
    longDescription: "تحكم كامل بالمجموعات",
    category: "admin",
    guide: {
      ar: "/groups"
    }
  },

  onStart: async function ({ api, event, args }) {

    try {

      const cmd = args[0]?.toLowerCase();

      const inbox = await api.getThreadList(100, null, ["INBOX"]);
      const groups = inbox.filter(thread => thread.isGroup);

      // قائمة الأوامر
      if (!cmd) {

        return api.sendMessage(
`📋 أوامر الجروبات:

/groups list
/groups info [id]
/groups rename [id] [name]
/groups emoji [id] [emoji]
/groups admin [id] [uid]
/groups unadmin [id] [uid]
/groups kick [id] [uid]
/groups add [id] [uid]
/groups nickname [id] [uid] [nickname]
/groups uid
/groups leave [id]
/groups broadcast [message]`,
          event.threadID
        );
      }

      // عرض الجروبات
      if (cmd === "list") {

        if (!groups.length) {
          return api.sendMessage(
            "❌ لا توجد جروبات",
            event.threadID
          );
        }

        let msg = "📋 قائمة الجروبات:\n\n";

        groups.forEach((group, index) => {

          msg += `${index + 1}. ${group.name || "بدون اسم"}\n`;
          msg += `🆔 ${group.threadID}\n`;
          msg += `👥 ${group.participantIDs?.length || 0} عضو\n\n`;

        });

        return api.sendMessage(msg, event.threadID);
      }

      // معلومات قروب
      if (cmd === "info") {

        const threadID = args[1];

        if (!threadID) {
          return api.sendMessage(
            "❌ اكتب ايدي القروب",
            event.threadID
          );
        }

        const info = await api.getThreadInfo(threadID);

        let admins = "لا يوجد";

        if (info.adminIDs && info.adminIDs.length > 0) {

          admins = info.adminIDs
            .map(admin => `• ${admin.id}`)
            .join("\n");
        }

        return api.sendMessage(
`📌 معلومات القروب

📛 الاسم: ${info.threadName}
🆔 الايدي: ${info.threadID}
👥 عدد الأعضاء: ${info.participantIDs.length}

👑 الأدمن:
${admins}

🔒 وضع الموافقة:
${info.approvalMode ? "مفعل" : "معطل"}`,
          event.threadID
        );
      }

      // تغيير الاسم
      if (cmd === "rename") {

        const threadID = args[1];
        const newName = args.slice(2).join(" ");

        if (!threadID || !newName) {

          return api.sendMessage(
            "❌ الاستخدام:\n/groups rename [id] [name]",
            event.threadID
          );
        }

        await api.setTitle(newName, threadID);

        return api.sendMessage(
          "✅ تم تغيير اسم القروب",
          event.threadID
        );
      }

      // تغيير ايموجي
      if (cmd === "emoji") {

        const threadID = args[1];
        const emoji = args[2];

        if (!threadID || !emoji) {

          return api.sendMessage(
            "❌ الاستخدام:\n/groups emoji [id] [emoji]",
            event.threadID
          );
        }

        await api.changeThreadEmoji(emoji, threadID);

        return api.sendMessage(
          "✅ تم تغيير ايموجي القروب",
          event.threadID
        );
      }

      // رفع ادمن
      if (cmd === "admin") {

        const threadID = args[1];
        const uid = args[2];

        if (!threadID || !uid) {

          return api.sendMessage(
            "❌ الاستخدام:\n/groups admin [id] [uid]",
            event.threadID
          );
        }

        await api.changeAdminStatus(threadID, uid, true);

        return api.sendMessage(
          "✅ تم رفع العضو أدمن",
          event.threadID
        );
      }

      // تنزيل ادمن
      if (cmd === "unadmin") {

        const threadID = args[1];
        const uid = args[2];

        if (!threadID || !uid) {

          return api.sendMessage(
            "❌ الاستخدام:\n/groups unadmin [id] [uid]",
            event.threadID
          );
        }

        await api.changeAdminStatus(threadID, uid, false);

        return api.sendMessage(
          "✅ تم تنزيل الأدمن",
          event.threadID
        );
      }

      // طرد عضو
      if (cmd === "kick") {

        const threadID = args[1];
        const uid = args[2];

        if (!threadID || !uid) {

          return api.sendMessage(
            "❌ الاستخدام:\n/groups kick [id] [uid]",
            event.threadID
          );
        }

        await api.removeUserFromGroup(uid, threadID);

        return api.sendMessage(
          "✅ تم طرد العضو",
          event.threadID
        );
      }

      // إضافة عضو
      if (cmd === "add") {

        const threadID = args[1];
        const uid = args[2];

        if (!threadID || !uid) {

          return api.sendMessage(
            "❌ الاستخدام:\n/groups add [id] [uid]",
            event.threadID
          );
        }

        await api.addUserToGroup(uid, threadID);

        return api.sendMessage(
          "✅ تم إضافة العضو",
          event.threadID
        );
      }

      // تغيير كنية
      if (cmd === "nickname") {

        const threadID = args[1];
        const uid = args[2];
        const nickname = args.slice(3).join(" ");

        if (!threadID || !uid || !nickname) {

          return api.sendMessage(
            "❌ الاستخدام:\n/groups nickname [id] [uid] [nickname]",
            event.threadID
          );
        }

        await api.changeNickname(
          nickname,
          threadID,
          uid
        );

        return api.sendMessage(
          "✅ تم تغيير الكنية",
          event.threadID
        );
      }

      // استخراج UID
      if (cmd === "uid") {

        if (event.messageReply) {

          return api.sendMessage(
            `🆔 UID:\n${event.messageReply.senderID}`,
            event.threadID
          );
        }

        return api.sendMessage(
          `🆔 UID الخاص بك:\n${event.senderID}`,
          event.threadID
        );
      }

      // خروج البوت
      if (cmd === "leave") {

        const threadID = args[1];

        if (!threadID) {

          return api.sendMessage(
            "❌ الاستخدام:\n/groups leave [id]",
            event.threadID
          );
        }

        await api.removeUserFromGroup(
          api.getCurrentUserID(),
          threadID
        );

        return api.sendMessage(
          "✅ خرج البوت من القروب",
          event.threadID
        );
      }

      // رسالة جماعية
      if (cmd === "broadcast") {

        const message = args.slice(1).join(" ");

        if (!message) {

          return api.sendMessage(
            "❌ اكتب الرسالة",
            event.threadID
          );
        }

        for (const group of groups) {

          await api.sendMessage(
            message,
            group.threadID
          );
        }

        return api.sendMessage(
          "✅ تم إرسال الرسالة لكل الجروبات",
          event.threadID
        );
      }

      // أمر غير معروف
      return api.sendMessage(
        "❌ أمر غير موجود",
        event.threadID
      );

    } catch (error) {

      console.log(error);

      return api.sendMessage(
        `❌ حدث خطأ:\n${error.message}`,
        event.threadID
      );
    }
  }
};
