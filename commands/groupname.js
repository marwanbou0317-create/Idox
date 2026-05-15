// أمر تغيير اسم المجموعة مع دعم القفل
// استخدم: /اسم تعيين [اسم جديد]
// استخدم: /اسم قفل

const groupProtect = require('../utils/groupNameProtect');

module.exports = {
  async handle(event, api, args, config) {
    const { threadID, senderID } = event;
    const command = args[0];
    // تحقق أن المستخدم SuperAdmin فقط
    const isSuper = config.superAdmins && config.superAdmins.includes(String(senderID));
    if (!isSuper) {
      return api.sendMessage('❌ هذا الأمر متاح فقط للسوبر أدمن.', threadID);
    }

    if (command === 'تعيين') {
      // /اسم تعيين [الاسم]
      const newName = args.slice(1).join(' ');
      if (!newName) {
        return api.sendMessage('يرجى كتابة الاسم الجديد بعد: /اسم تعيين', threadID);
      }
      try {
        await api.setTitle(newName, threadID);
        api.sendMessage('✅ تم تغيير اسم المجموعة إلى: ' + newName, threadID);
        // إذا الاسم محمي، حدث الحماية
        if (groupProtect.isProtected(threadID)) {
          groupProtect.protect(threadID, newName);
        }
      } catch (e) {
        api.sendMessage('❌ تعذر تغيير اسم المجموعة. (صلاحيات أو خطأ API)', threadID);
      }
    } else if (command === 'قفل') {
      // /اسم قفل
      try {
        const current = await api.getThreadInfo(threadID);
        if (!current || !current.name) {
          return api.sendMessage('❌ لم أستطع معرفة اسم المجموعة الحالي.', threadID);
        }
        groupProtect.protect(threadID, current.name);
        api.sendMessage('🔒 تم تفعيل قفل اسم المجموعة. لا أحد يستطيع تغييره إلا السوبر أدمن.', threadID);
      } catch (e) {
        api.sendMessage('❌ حدث خطأ أثناء تفعيل القفل: ' + e.message, threadID);
      }
    } else {
      api.sendMessage('❓ الأمر غير معروف. استخدم:\n/اسم تعيين [اسم جديد]
/اسم قفل', threadID);
    }
  }
};
