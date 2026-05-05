const os = require('os');
let startTime = Date.now();
const setStartTime = t => { startTime = t; };

function uptime() {
  const s = Math.floor((Date.now() - startTime) / 1000);
  return Math.floor(s/3600) + 'س ' + Math.floor((s%3600)/60) + 'د ' + (s%60) + 'ث';
}

function handle(event, api, type) {
  if (type === 'uptime')
    return api.sendMessage('⏱ وقت التشغيل: ' + uptime(), event.threadID);

  const mem = process.memoryUsage();
  api.sendMessage(
    '🖥 السيرفر:\n' +
    '▪ نظام: ' + os.platform() + '\n' +
    '▪ Node.js: ' + process.version + '\n' +
    '▪ ذاكرة البوت: ' + (mem.rss/1024/1024).toFixed(1) + ' MB\n' +
    '▪ ذاكرة الجهاز: ' + (os.freemem()/1024/1024).toFixed(0) + ' / ' + (os.totalmem()/1024/1024).toFixed(0) + ' MB\n' +
    '▪ التشغيل: ' + uptime(),
    event.threadID);
}

module.exports = { handle, setStartTime };
