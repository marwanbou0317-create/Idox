function randomDelay(minMs, maxMs) {
  const ms = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return new Promise(resolve => setTimeout(resolve, ms));
}
function shortDelay()  { return randomDelay(1000, 3000); }
function mediumDelay() { return randomDelay(2000, 5000); }
function longDelay()   { return randomDelay(3000, 7000); }
function replyDelay()  { return randomDelay(500, 1500); }
function engineDelay(baseSeconds) {
  const base = baseSeconds * 1000;
  const jitter = base * 0.2;
  return randomDelay(base - jitter, base + jitter);
}
module.exports = { randomDelay, shortDelay, mediumDelay, longDelay, replyDelay, engineDelay };
