// In-memory sliding window rate limiter — no external dependencies

interface RateWindow {
  hourCount: number;
  hourStart: number;
  dayCount: number;
  dayStart: number;
}

const limits = new Map<string, RateWindow>();

const HOUR_LIMIT = 30;
const DAY_LIMIT = 100;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

// Clean up stale entries every 10 minutes
let lastCleanup = Date.now();
function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < 10 * 60 * 1000) return;
  lastCleanup = now;
  for (const [key, w] of limits) {
    if (now - w.dayStart > DAY_MS) limits.delete(key);
  }
}

export function checkRateLimit(userId: string): { allowed: boolean; retryAfterMs?: number } {
  cleanup();
  const now = Date.now();
  let w = limits.get(userId);

  if (!w) {
    w = { hourCount: 0, hourStart: now, dayCount: 0, dayStart: now };
    limits.set(userId, w);
  }

  // Reset windows if expired
  if (now - w.hourStart > HOUR_MS) {
    w.hourCount = 0;
    w.hourStart = now;
  }
  if (now - w.dayStart > DAY_MS) {
    w.dayCount = 0;
    w.dayStart = now;
  }

  if (w.dayCount >= DAY_LIMIT) {
    return { allowed: false, retryAfterMs: w.dayStart + DAY_MS - now };
  }
  if (w.hourCount >= HOUR_LIMIT) {
    return { allowed: false, retryAfterMs: w.hourStart + HOUR_MS - now };
  }

  w.hourCount++;
  w.dayCount++;
  return { allowed: true };
}
