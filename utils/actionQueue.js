// Ø·Ø§Ø¨ÙØ± Ø¹ÙÙÙØ§Øª API â ÙÙÙØ¹ Ø¥Ø±Ø³Ø§Ù Ø·ÙØ¨Ø§Øª ÙØ«ÙØ±Ø© Ø¨Ø´ÙÙ ÙØªØ²Ø§ÙÙ
// ÙØ¶ÙÙ ØªØ³ÙØ³Ù Ø§ÙØ¹ÙÙÙØ§Øª ÙØ¹ ØªØ£Ø®ÙØ± Ø¥ÙØ³Ø§ÙÙ Ø¨ÙÙ ÙÙ Ø·ÙØ¨ ÙØ¢Ø®Ø±

const MIN_GAP = 800;   // Ø£ÙÙ ÙØ¬ÙØ© Ø¨ÙÙ Ø£Ù Ø·ÙØ¨ÙÙ (ms)
const MAX_GAP = 2200;  // Ø£ÙØµÙ ÙØ¬ÙØ© Ø¹Ø´ÙØ§Ø¦ÙØ© (ms)

let lastCall = 0;

function jitter(min, max) {
  return Math.floor(min + Math.random() * (max - min));
}

/**
 * ÙÙÙØ° Ø¯Ø§ÙØ© Ø¨Ø¹Ø¯ ØªØ£Ø®ÙØ± Ø¥ÙØ³Ø§ÙÙ Ø¹Ø´ÙØ§Ø¦Ù.
 * @param {Function} fn - Ø§ÙØ¯Ø§ÙØ© Ø§ÙÙØ·ÙÙØ¨ ØªÙÙÙØ°ÙØ§ (ÙØ¬Ø¨ Ø£Ù ØªØ±Ø¬Ø¹ Promise)
 * @returns {Promise<any>}
 */
async function enqueue(fn) {
  const now  = Date.now();
  const gap  = jitter(MIN_GAP, MAX_GAP);
  const wait = Math.max(0, (lastCall + gap) - now);

  if (wait > 0) await new Promise(r => setTimeout(r, wait));

  lastCall = Date.now();
  return fn();
}

module.exports = { enqueue, jitter };
