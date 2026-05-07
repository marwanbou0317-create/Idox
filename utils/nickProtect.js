const fs   = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'data', 'nickProtect.json');
let db = {};

function load() {
  try {
    if (fs.existsSync(FILE)) db = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch { db = {}; }
}

function save() {
  try { fs.writeFileSync(FILE, JSON.stringify(db, null, 2)); } catch {}
}

load();

function protect(threadID, uid, nickname) {
  if (!db[threadID]) db[threadID] = {};
  db[threadID][uid] = nickname;
  save();
}

function unprotect(threadID, uid) {
  if (db[threadID]) {
    delete db[threadID][uid];
    if (!Object.keys(db[threadID]).length) delete db[threadID];
    save();
  }
}

function isProtected(threadID, uid) {
  return !!(db[threadID] && uid in db[threadID]);
}

function getProtected(threadID, uid) {
  return db[threadID]?.[uid] ?? null;
}

function listProtected(threadID) {
  return db[threadID] ? Object.entries(db[threadID]) : [];
}

module.exports = { protect, unprotect, isProtected, getProtected, listProtected };
