const admin = require('../utils/admin');

async function handle(event, api) {

  const role = admin.getRole(event.senderID);

  if (role !== 'admin' && role !== 'superadmin') {
    return api.sendMessage(
      '❌ ليس لديك صلاحية',
      event.threadID
    );
  }

  const args = event.body.trim().split(/\s+/);
  const cmd = args[1]?.toLowerCase();

  try {

    const inbox = await api.getThreadList(
      100,
      null,
      ['INBOX']
    );

    const groups = inbox.filter(
      t => t.isGroup
    );

    // القائمة
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
    if (cmd === 'list') {

      let msg = '📋 قائمة الجروبات:\n\n';

      groups.forEach((g, i) => {

        msg += `${i + 1}. ${g.name || 'بدون اسم'}\n`;
        msg += `🆔 ${g.threadID}\n`;
        msg += `👥 ${g.participantIDs.length} عضو\n\n`;

      });

      return api.sendMessage(
        msg,
        event.threadID
      );
    }

    // معلومات قروب
    if (cmd === 'info') {

      const id = args[2];

      if (!id) {
        return api.sendMessage(
          '❌ ضع ايدي القروب',
          event.threadID
        );
      }

      const info = await api.getThreadInfo(id);

      return api.sendMessage(
`📌 معلومات القروب

📛 الاسم: ${info.threadName}
🆔 الايدي: ${info.threadID}
👥 الأعضاء: ${info.participantIDs.length}
👑 الأدمن: ${info.adminIDs.length}`,
        event.threadID
      );
    }

    // تغيير اسم
    if (cmd === 'rename') {

      const id = args[2];
      const name = args.slice(3).join(' ');

      await api.setTitle(name, id);

      return api.sendMessage(
        '✅ تم تغيير الاسم',
        event.threadID
      );
    }

    // تغيير ايموجي
    if (cmd === 'emoji') {

      const id = args[2];
      const emoji = args[3];

      await api.changeThreadEmoji(
        emoji,
        id
      );

      return api.sendMessage(
        '✅ تم تغيير الايموجي',
        event.threadID
      );
    }

    // رفع أدمن
    if (cmd === 'admin') {

      const id = args[2];
      const uid = args[3];

      await api.changeAdminStatus(
        id,
        uid,
        true
      );

      return api.sendMessage(
        '✅ تم رفع العضو أدمن',
        event.threadID
      );
    }

    // تنزيل أدمن
    if (cmd === 'unadmin') {

      const id = args[2];
      const uid = args[3];

      await api.changeAdminStatus(
        id,
        uid,
        false
      );

      return api.sendMessage(
        '✅ تم تنزيل الأدمن',
        event.threadID
      );
    }

    // طرد عضو
    if (cmd === 'kick') {

      const id = args[2];
      const uid = args[3];

      await api.removeUserFromGroup(
        uid,
        id
      );

      return api.sendMessage(
        '✅ تم طرد العضو',
        event.threadID
      );
    }

    // إضافة عضو
    if (cmd === 'add') {

      const id = args[2];
      const uid = args[3];

      await api.addUserToGroup(
        uid,
        id
      );

      return api.sendMessage(
        '✅ تم إضافة العضو',
        event.threadID
      );
    }

    // تغيير كنية
    if (cmd === 'nickname') {

      const id = args[2];
      const uid = args[3];
      const nick = args.slice(4).join(' ');

      await api.changeNickname(
        nick,
        id,
        uid
      );

      return api.sendMessage(
        '✅ تم تغيير الكنية',
        event.threadID
      );
    }

    // UID
    if (cmd === 'uid') {

      if (event.messageReply) {

        return api.sendMessage(
          '🆔 UID: ' +
          event.messageReply.senderID,
          event.threadID
        );
      }

      return api.sendMessage(
        '🆔 UID: ' + event.senderID,
        event.threadID
      );
    }

    // خروج البوت
    if (cmd === 'leave') {

      const id = args[2];

      await api.removeUserFromGroup(
        api.getCurrentUserID(),
        id
      );

      return api.sendMessage(
        '✅ خرج البوت من القروب',
        event.threadID
      );
    }

    // بث رسالة
    if (cmd === 'broadcast') {

      const message = args.slice(2).join(' ');

      for (const g of groups) {

        await api.sendMessage(
          message,
          g.threadID
        );
      }

      return api.sendMessage(
        '✅ تم الإرسال لكل الجروبات',
        event.threadID
      );
    }

  } catch (e) {

    console.log(e);

    return api.sendMessage(
      '❌ خطأ:\n' + e.message,
      event.threadID
    );
  }
}

module.exports = { handle };
