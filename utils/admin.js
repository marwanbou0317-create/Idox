const config = require('../config.json');
const admins = new Set();

function isSuperAdmin(userID) { return config.superAdmins.includes(String(userID)); }
function isAdmin(userID) { return admins.has(String(userID)) || isSuperAdmin(userID); }
function addAdmin(userID) { admins.add(String(userID)); }
function removeAdmin(userID) { admins.delete(String(userID)); }
function getAdmins() { return [...admins]; }
function getRole(userID) {
  if (isSuperAdmin(userID)) return 'superadmin';
  if (isAdmin(userID)) return 'admin';
  return 'user';
}
module.exports = { isSuperAdmin, isAdmin, addAdmin, removeAdmin, getAdmins, getRole };
