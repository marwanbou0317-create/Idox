/**
 * reset-cookies.js
 * يفتح متصفح ويطلب منك تسجيل الدخول يدوياً ثم يحفظ الكوكيز
 * الاستخدام: node reset-cookies.js
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

console.log('⚠️  لتجديد جلسة البوت:');
console.log('1. افتح Facebook في المتصفح وسجّل الدخول بحساب البوت');
console.log('2. استخدم إضافة EditThisCookie أو Cookie-Editor');
console.log('3. صدّر الكوكيز بصيغة JSON');
console.log('4. استبدل محتوى appstate.json بالكوكيز المصدّرة');
console.log('5. أعد تشغيل البوت: node index.js');
