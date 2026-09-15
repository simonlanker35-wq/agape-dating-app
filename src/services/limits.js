const DAILY_LIKES = 8;
const WEEKLY_DOVES = 1;
const WEEKLY_STANDOUT_LIKES = 1;
const WEEKLY_REVEALS = 1;

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function weekKey() {
  const d = new Date();
  const jan1 = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d - jan1) / 86400000 + jan1.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${week}`;
}

function getCount(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return 0;
    const { count, period } = JSON.parse(raw);
    const current = key.includes("daily") ? todayKey() : weekKey();
    return period === current ? count : 0;
  } catch { return 0; }
}

function increment(key) {
  const isDaily = key.includes("daily");
  const period = isDaily ? todayKey() : weekKey();
  const current = getCount(key);
  try {
    localStorage.setItem(key, JSON.stringify({ count: current + 1, period }));
  } catch {}
}

export function getLikesUsed() { return getCount("agape_daily_likes"); }
export function getLikesRemaining() { return Math.max(0, DAILY_LIKES - getLikesUsed()); }
export function recordLike() { increment("agape_daily_likes"); }

export function getDovesUsed() { return getCount("agape_weekly_doves"); }
export function getDovesRemaining() { return Math.max(0, WEEKLY_DOVES - getDovesUsed()); }
export function recordDove() { increment("agape_weekly_doves"); }

export function getStandoutLikesUsed() { return getCount("agape_weekly_standout"); }
export function getStandoutLikesRemaining() { return Math.max(0, WEEKLY_STANDOUT_LIKES - getStandoutLikesUsed()); }
export function recordStandoutLike() { increment("agape_weekly_standout"); }

export function getRevealsUsed() { return getCount("agape_weekly_reveals"); }
export function getRevealsRemaining() { return Math.max(0, WEEKLY_REVEALS - getRevealsUsed()); }
export function recordReveal() { increment("agape_weekly_reveals"); }

export const LIMITS = { DAILY_LIKES, WEEKLY_DOVES, WEEKLY_STANDOUT_LIKES, WEEKLY_REVEALS };
