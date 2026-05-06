// إدارة الأدمن — سوبر أدمن من config.json + رتب وقت التشغيل محفوظة في ملف
const fs     = require('fs');
const path   = require('path');
const config = require('../config.json');

const RUNTIME_FILE = path.join(__dirname, '..', 'data', 'runtime_admins.json');

// تحميل الأدمن المحفوظين من الملف عند بدء التشغيل
function _loadRuntime() {
  try {
    if (!fs.existsSync(RUNTIME_FILE)) return new Set();
    const arr = JSON.parse(fs.readFileSync(RUNTIME_FILE, 'utf8'));
    return new Set(Array.isArray(arr) ? arr : []);
  } catch { return new Set(); }
}

function _saveRuntime() {
  try {
    const dir = path.dirname(RUNTIME_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(RUNTIME_FILE, JSON.stringify([...runtime]));
  } catch {}
}

const runtime = _loadRuntime();

const isSuperAdmin = uid => config.superAdmins.includes(String(uid));
const isAdmin      = uid => isSuperAdmin(uid) || runtime.has(String(uid));

function promote(uid) {
  runtime.add(String(uid));
  _saveRuntime();
}

function demote(uid) {
  runtime.delete(String(uid));
  _saveRuntime();
}

const getRole   = uid => isSuperAdmin(uid) ? 'superadmin' : isAdmin(uid) ? 'admin' : 'user';
const getAdmins = ()  => [...runtime];

module.exports = { isSuperAdmin, isAdmin, promote, demote, getRole, getAdmins };
