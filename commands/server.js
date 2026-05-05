const os = require('os');
let startTime = Date.now();
function setStartTime(t) { startTime = t; }
function getUptime() {
  const diff = Math.floor((Date.now() - startTime) / 1000);
  return Math.floor(diff/3600) + 'س ' + Math.floor((diff%3600)/60) + 'د ' + (diff%60) + 'ث';
}
function handleServer(event, api) {
  const mem = process.memoryUsage();
  api.sendMessage(
    '🖥 معلومات السيرفر:\n' +
    '▪️ المنصة: ' + os.platform() + '\n' +
    '▪️ Node.js: ' + process.version + '\n' +
    '▪️ ذاكرة البوت: ' + (mem.rss/1024/1024).toFixed(1) + ' MB\n' +
    '▪️ ذاكرة السيرفر: ' + (os.freemem()/1024/1024).toFixed(1) + '/' + (os.totalmem()/1024/1024).toFixed(1) + ' MB\n' +
    '▪️ وقت التشغيل: ' + getUptime(),
    event.threadID
  );
}
function handleUptime(event, api) {
  api.sendMessage('⏱ وقت تشغيل البوت: ' + getUptime(), event.threadID);
}
module.exports = { handleServer, handleUptime, setStartTime };
