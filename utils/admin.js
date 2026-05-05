const config = require('../config.json');
const runtime = new Set();               // مشرفون يُضافون أثناء التشغيل

const isSuperAdmin = uid => config.superAdmins.includes(String(uid));
const isAdmin      = uid => isSuperAdmin(uid) || runtime.has(String(uid));
const promote      = uid => runtime.add(String(uid));
const demote       = uid => runtime.delete(String(uid));
const getRole      = uid => isSuperAdmin(uid) ? 'superadmin' : isAdmin(uid) ? 'admin' : 'user';
const getAdmins    = ()  => [...runtime];

module.exports = { isSuperAdmin, isAdmin, promote, demote, getRole, getAdmins };
