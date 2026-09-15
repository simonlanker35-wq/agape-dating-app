const FREE = { dailyLikes: 8, weeklyDoves: 1, weeklyStandouts: 1, weeklyReveals: 1 };
const PREMIUM = { dailyLikes: 15, weeklyDoves: 3, weeklyStandouts: 2, weeklyReveals: Infinity };

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

function tier(isPremium) { return isPremium ? PREMIUM : FREE; }

export function getLikesUsed() { return getCount("agape_daily_likes"); }
export function getLikesRemaining(isPremium) { return Math.max(0, tier(isPremium).dailyLikes - getLikesUsed()); }
export function recordLike() { increment("agape_daily_likes"); }

export function getDovesUsed() { return getCount("agape_weekly_doves"); }
export function getDovesRemaining(isPremium) { return Math.max(0, tier(isPremium).weeklyDoves - getDovesUsed()); }
export function recordDove() { increment("agape_weekly_doves"); }

export function getStandoutLikesUsed() { return getCount("agape_weekly_standout"); }
export function getStandoutLikesRemaining(isPremium) { return Math.max(0, tier(isPremium).weeklyStandouts - getStandoutLikesUsed()); }
export function recordStandoutLike() { increment("agape_weekly_standout"); }

export function getRevealsUsed() { return getCount("agape_weekly_reveals"); }
export function getRevealsRemaining(isPremium) { return isPremium ? Infinity : Math.max(0, FREE.weeklyReveals - getRevealsUsed()); }
export function recordReveal() { increment("agape_weekly_reveals"); }

export const LIMITS = { FREE, PREMIUM };
