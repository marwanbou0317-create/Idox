module.exports.config = {
  name: "uptime",
  version: "1.0.0",
  permission: 0,
  credits: "copilot",
  description: "يعرض مدة تشغيل البوت",
  prefix: true,
  premium: false,
  category: "info",
  usages: "uptime",
  cooldowns: 3,
};

module.exports.run = async function({ api, event }) {
  function toTime(duration) {
    duration = Math.floor(duration);
    const days = Math.floor(duration / (3600 * 24));
    duration %= 3600 * 24;
    const hours = Math.floor(duration / 3600);
    duration %= 3600;
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    return `${days > 0 ? days + " يوم و " : ""}${hours > 0 ? hours + " ساعة و " : ""}${minutes > 0 ? minutes + " دقيقة و " : ""}${seconds} ثانية`;
  }
  const uptimeSec = process.uptime();
  api.sendMessage(`⏱️ مدة تشغيل البوت: ${toTime(uptimeSec)}`, event.threadID, event.messageID);
};
