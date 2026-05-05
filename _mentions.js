// يُستخدم داخلياً فقط
function parseMentions(mentions) {
  if (!mentions) return [];
  if (Array.isArray(mentions))
    return mentions.map(m => ({ id: String(m.id || m.userID || ''), name: String(m.name || m.tag || '').replace(/^@/, '') }));
  return Object.entries(mentions).map(([id, name]) => ({ id: String(id), name: String(name || id).replace(/^@/, '') }));
}
module.exports = parseMentions;
