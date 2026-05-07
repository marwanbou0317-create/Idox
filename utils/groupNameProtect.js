const fs   = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'data', 'groupNameProtect.json');
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

function protect(threadID, name) {
  db[threadID] = name;
  save();
}

function unprotect(threadID) {
  delete db[threadID];
  save();
}

function isProtected(threadID) {
  return threadID in db;
}

function getProtected(threadID) {
  return db[threadID] ?? null;
}

module.exports = { protect, unprotect, isProtected, getProtected };
