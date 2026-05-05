const engineState = {
  enabled: false,
  message: 'مرحباً! 👋',
  intervalSeconds: 60,
  smart: false,
  timers: new Map(),
  activityGroups: new Set(),
  targetThreadID: null,
};
const lockState = { smartLock: false, lockedGroups: new Set() };

function setEngineTarget(t)   { engineState.targetThreadID = t; }
function setEngineMessage(m)  { engineState.message = m; }
function setEngineInterval(s) { engineState.intervalSeconds = s; }
function setEngineSmart(v)    { engineState.smart = v; }
function setEngineEnabled(v)  { engineState.enabled = v; }
function isLocked(threadID)   { return lockState.smartLock || lockState.lockedGroups.has(String(threadID)); }
function lockGroup(threadID)  { lockState.lockedGroups.add(String(threadID)); }
function unlockGroup(threadID){ lockState.lockedGroups.delete(String(threadID)); }
function setSmartLock(v)      { lockState.smartLock = v; }
function markActivity(threadID)  { engineState.activityGroups.add(String(threadID)); }
function hasActivity(threadID)   { return engineState.activityGroups.has(String(threadID)); }
function clearActivity(threadID) { engineState.activityGroups.delete(String(threadID)); }

module.exports = {
  engineState, lockState,
  setEngineTarget, setEngineMessage, setEngineInterval, setEngineSmart, setEngineEnabled,
  isLocked, lockGroup, unlockGroup, setSmartLock,
  markActivity, hasActivity, clearActivity,
};
