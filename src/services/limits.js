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

// Once usage_limits.sql has run, the database counts likes, Doves and reveals and refuses the one
// too many. The counts it reports replace the per-device numbers below, which stay as a fallback.
let server = null;
export function setServerUsage(u) {
  server = u && typeof u === "object" ? { ...u } : null;
}
export function getServerUsage() { return server; }
export function hasServerUsage() { return !!server; }

export function getLikesUsed() { return server ? server.likesUsed : getCount("agape_daily_likes"); }
export function getLikesRemaining(isPremium) {
  if (server) return Math.max(0, server.likesLimit - server.likesUsed);
  return Math.max(0, tier(isPremium).dailyLikes - getLikesUsed());
}
export function recordLike() { if (server) server.likesUsed += 1; increment("agape_daily_likes"); }

export function getDovesUsed() { return server ? server.dovesUsed : getCount("agape_weekly_doves"); }
export function getDovesRemaining(isPremium) {
  if (server) return Math.max(0, server.dovesLimit - server.dovesUsed);
  return Math.max(0, tier(isPremium).weeklyDoves - getDovesUsed());
}
export function recordDove() { if (server) server.dovesUsed += 1; increment("agape_weekly_doves"); }

export function getStandoutLikesUsed() { return getCount("agape_weekly_standout"); }
export function getStandoutLikesRemaining(isPremium) { return Math.max(0, tier(isPremium).weeklyStandouts - getStandoutLikesUsed()); }
export function recordStandoutLike() { increment("agape_weekly_standout"); }

export function getRevealsUsed() { return server ? server.revealsUsed : getCount("agape_weekly_reveals"); }
export function getRevealsRemaining(isPremium) {
  if (server) return server.revealsLimit >= 1000000 ? Infinity : Math.max(0, server.revealsLimit - server.revealsUsed);
  return isPremium ? Infinity : Math.max(0, FREE.weeklyReveals - getRevealsUsed());
}
export function recordReveal() { if (server) server.revealsUsed += 1; increment("agape_weekly_reveals"); }

export const LIMITS = { FREE, PREMIUM };
