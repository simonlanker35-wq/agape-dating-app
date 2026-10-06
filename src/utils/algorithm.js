// Compatibility scoring for Agape.
//
// Every profile gets a score from 0 to 100 against the current user, built from what both
// people actually said: faith, what they want from a relationship, lifestyle, interests,
// whether each fits the other's filters, trust signals and distance. The same breakdown
// produces a short, truthful explanation ("You're both Catholic · Both want children").
//
// Seek sorts by this score with a small daily shuffle so the order is stable while browsing
// but not identical every day. Chosen takes the single best score of the week, no shuffle.

const WEIGHTS = {
  faith: 35,       // denomination, church attendance, prayer
  goals: 25,       // children, what they are looking for, relocating
  lifestyle: 10,   // smoking, drinking, exercise
  interests: 10,   // shared interests
  mutualFit: 10,   // you fit their age and distance filters
  trust: 10,       // verified, showed up to dates, recently active
  distance: 5,     // closer is a little better
};

// Denominations that share theological roots
const DENOM_FAMILY = {
  Catholic: "catholic", Orthodox: "catholic",
  Protestant: "protestant", Evangelical: "protestant", Reformed: "protestant",
  Baptist: "protestant", Pentecostal: "protestant", Methodist: "protestant", Lutheran: "protestant",
  "Non-denominational": "independent",
};

// Ordered scales: distance on the scale = how different two answers are
const SCALES = {
  churchAttendance: ["Every week", "A few times a month", "On special occasions", "Rarely"],
  prayer: ["Daily", "A few times a week", "Sometimes", "Rarely"],
  drinking: ["Not for me", "Sober curious", "On special occasions", "Socially", "Most nights"],
  smoking: ["Non-smoker", "Social smoker", "Smoker when drinking", "Smoker"],
  exercise: ["Daily", "Almost daily", "Sometimes", "Never"],
};

const LOWER = {
  churchAttendance: { "Every week": "go to church every week", "A few times a month": "go to church a few times a month" },
  prayer: { Daily: "pray daily", "A few times a week": "pray several times a week" },
  lookingFor: { Marriage: "are looking for marriage", "A serious relationship": "want a serious relationship" },
};

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

// 1 when identical, down to 0 at the far ends of the scale
function closeness(key, a, b) {
  const scale = SCALES[key];
  if (!scale || !a || !b) return null;
  const ia = scale.indexOf(a), ib = scale.indexOf(b);
  if (ia < 0 || ib < 0) return null;
  return 1 - Math.abs(ia - ib) / (scale.length - 1);
}

export function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Deterministic 0..1 from a string (same input, same output, no library)
function hash01(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 10000) / 10000;
}

// ── Components. Each returns { points, reasons[] } ──

function faith(me, them) {
  const reasons = [];
  let pts = 0;
  const md = me.denomination, td = them.denomination;
  if (md && td) {
    if (md === td) { pts += 22; reasons.push({ w: 22, text: `You're both ${td}` }); }
    else if (DENOM_FAMILY[md] && DENOM_FAMILY[md] === DENOM_FAMILY[td]) { pts += 10; reasons.push({ w: 10, text: `${td} and ${md}: close traditions` }); }
  }
  for (const key of ["churchAttendance", "prayer"]) {
    const a = me.details?.[key], b = them.details?.[key];
    const c = closeness(key, a, b);
    if (c === null) continue;
    pts += 6.5 * c;
    if (c === 1 && LOWER[key]?.[b]) reasons.push({ w: 7, text: `Both ${LOWER[key][b]}` });
  }
  return { points: clamp(pts, 0, WEIGHTS.faith), reasons };
}

function goals(me, them) {
  const reasons = [];
  let pts = 0;
  const mw = me.details?.wantsChildren, tw = them.details?.wantsChildren;
  if (mw && tw) {
    const yes = (v) => v === "Yes", no = (v) => v === "No", open = (v) => v === "Open to it";
    if ((yes(mw) && no(tw)) || (no(mw) && yes(tw))) { pts -= 20; reasons.push({ w: -20, text: "You disagree about having children" }); }
    else if (mw === tw && yes(mw)) { pts += 12; reasons.push({ w: 12, text: "Both want children" }); }
    else if (mw === tw && no(mw)) { pts += 12; reasons.push({ w: 12, text: "Neither of you wants children" }); }
    else if (open(mw) || open(tw)) { pts += 8; }
    else if (mw === tw) { pts += 6; }
    else { pts += 3; }
  }
  const ml = me.details?.lookingFor, tl = them.details?.lookingFor;
  if (ml && tl) {
    if (ml === tl && ml !== "Not sure yet") { pts += 9; reasons.push({ w: 9, text: `Both ${LOWER.lookingFor[tl]}` }); }
    else if (ml === "Not sure yet" || tl === "Not sure yet") { pts += 3; }
    else { pts += 6; } // marriage vs serious relationship: close enough
  }
  const mr = me.details?.relocate, tr = them.details?.relocate;
  if (mr && tr) {
    if (mr !== "No" && tr !== "No") { pts += 3; reasons.push({ w: 3, text: "Both open to relocating" }); }
    else if (mr === "No" && tr === "No") { pts += 2; }
  }
  if (me.details?.hasChildren && them.details?.hasChildren && me.details.hasChildren === them.details.hasChildren && me.details.hasChildren === "Yes") {
    pts += 1; reasons.push({ w: 1, text: "Both have children" });
  }
  return { points: clamp(pts, -20, WEIGHTS.goals), reasons };
}

function lifestyle(me, them) {
  const reasons = [];
  let pts = 0;
  const s = closeness("smoking", me.details?.smoking, them.details?.smoking);
  if (s !== null) {
    pts += 5 * s;
    if (s < 0.4) { pts -= 4; reasons.push({ w: -4, text: "Different views on smoking" }); }
    else if (s === 1 && them.details.smoking === "Non-smoker") reasons.push({ w: 3, text: "Both non-smokers" });
  }
  const d = closeness("drinking", me.details?.drinking, them.details?.drinking);
  if (d !== null) {
    pts += 3 * d;
    if (d === 1 && them.details.drinking === "Not for me") reasons.push({ w: 2, text: "Neither of you drinks" });
  }
  const e = closeness("exercise", me.details?.exercise, them.details?.exercise);
  if (e !== null) pts += 2 * e;
  return { points: clamp(pts, -4, WEIGHTS.lifestyle), reasons };
}

function interests(me, them) {
  const mine = me.interests || [], theirs = them.interests || [];
  if (!mine.length || !theirs.length) return { points: 0, reasons: [] };
  const shared = mine.filter((i) => theirs.includes(i));
  if (!shared.length) return { points: 0, reasons: [] };
  const pts = clamp(shared.length * 3, 0, WEIGHTS.interests);
  const text = shared.length === 1 ? `You both love ${shared[0]}` : shared.length === 2 ? `You both love ${shared[0]} and ${shared[1]}` : `${shared.length} shared interests, including ${shared[0]}`;
  return { points: pts, reasons: [{ w: pts, text }] };
}

// Would I pass their filters? Being liked back is what makes a match.
function mutualFit(me, them, distanceKm) {
  const f = them.filters;
  if (!f) return { points: WEIGHTS.mutualFit * 0.5, reasons: [] };
  let ok = true;
  if (me.age && f.minAge && me.age < f.minAge) ok = false;
  if (me.age && f.maxAge && me.age > f.maxAge) ok = false;
  if (distanceKm != null && f.maxDistance && distanceKm > f.maxDistance * 1.1) ok = false;
  if (Array.isArray(f.denominations) && f.denominations.length && me.denomination && !f.denominations.includes(me.denomination)) ok = false;
  return ok ? { points: WEIGHTS.mutualFit, reasons: [{ w: 4, text: "You fit what they're looking for" }] } : { points: 0, reasons: [] };
}

function trust(them) {
  const reasons = [];
  let pts = 0;
  if (them.isVerified) { pts += 4; reasons.push({ w: 4, text: "Verified profile" }); }
  const r = them.reliability;
  if (r?.dates) {
    const rate = (r.dates - (r.noShows || 0)) / r.dates;
    if (r.noShows > 0 && rate < 0.75) { pts -= 10; reasons.push({ w: -10, text: `${r.noShows} no-show${r.noShows === 1 ? "" : "s"} on past dates` }); }
    else if (r.noShows === 0 && r.dates >= 1) { pts += 3; reasons.push({ w: 3, text: `Showed up to ${r.dates === 1 ? "their date" : `all ${r.dates} dates`}` }); }
  }
  const t = them.lastActive ? new Date(them.lastActive).getTime() : NaN;
  if (Number.isFinite(t)) {
    const age = Date.now() - t;
    if (age < 24 * 3600e3) pts += 3;
    else if (age < 7 * 24 * 3600e3) pts += 1.5;
  }
  return { points: clamp(pts, -10, WEIGHTS.trust), reasons };
}

function distance(distanceKm, maxDistance) {
  if (distanceKm == null) return { points: WEIGHTS.distance * 0.5, reasons: [] };
  const ratio = clamp(1 - distanceKm / Math.max(maxDistance || 80, 1), 0, 1);
  const pts = WEIGHTS.distance * ratio;
  const reasons = distanceKm <= 15 ? [{ w: 2, text: `Lives ${Math.max(1, Math.round(distanceKm))} km away` }] : [];
  return { points: pts, reasons };
}

// ── Public API ──

/**
 * Score one profile against the current user.
 * Returns { score (0..100), reasons: string[] (best first), distanceKm, breakdown }.
 */
export function scoreProfile(them, me, filters = {}) {
  const myLat = me?.location?.lat ?? me?.lat, myLng = me?.location?.lng ?? me?.lng;
  const distanceKm = myLat && myLng && them.lat && them.lng ? haversineKm(myLat, myLng, them.lat, them.lng) : null;

  const parts = {
    faith: faith(me, them),
    goals: goals(me, them),
    lifestyle: lifestyle(me, them),
    interests: interests(me, them),
    mutualFit: mutualFit(me, them, distanceKm),
    trust: trust(them),
    distance: distance(distanceKm, filters.maxDistance),
  };
  const raw = Object.values(parts).reduce((s, p) => s + p.points, 0);
  const score = Math.round(clamp(raw, 0, 100));
  const reasons = Object.values(parts).flatMap((p) => p.reasons).sort((a, b) => Math.abs(b.w) - Math.abs(a.w)).map((r) => r.text);
  const breakdown = Object.fromEntries(Object.entries(parts).map(([k, p]) => [k, Math.round(p.points * 10) / 10]));
  return { score, reasons, distanceKm, breakdown };
}

// One short sentence for the card, built only from real overlap. Null when there is nothing to say.
export function compatibilityReason(result) {
  const good = result.reasons.filter((r) => !/disagree|no-show|Different views/.test(r));
  if (!good.length) return null;
  return good.slice(0, 3).join(" · ");
}

/**
 * Seek: best first, with a small daily shuffle (±4 points) so the order is stable while browsing
 * today but not identical tomorrow, and brand-new profiles get a short boost so they are seen.
 */
export function rankProfiles(profiles, me, filters = {}) {
  if (!me) return profiles;
  const day = new Date().toISOString().slice(0, 10);
  return profiles
    .map((p) => {
      const r = scoreProfile(p, me, filters);
      const created = p.createdAt ? new Date(p.createdAt).getTime() : NaN;
      const fresh = Number.isFinite(created) && Date.now() - created < 7 * 24 * 3600e3 ? 3 : 0;
      const jitter = (hash01(day + p.id + (me.id || "")) - 0.5) * 8;
      return { ...p, compatibilityScore: r.score, compatibilityReason: compatibilityReason(r), compatibilityReasons: r.reasons, distanceKm: r.distanceKm, _rank: r.score + fresh + jitter };
    })
    .sort((a, b) => b._rank - a._rank);
}

/**
 * Chosen: the single most compatible profile, no shuffle, so it stays the same all week.
 * Ties go to the profile that has been active most recently.
 */
export function mostCompatible(profiles, me, filters = {}) {
  if (!me || !profiles.length) return null;
  let best = null;
  for (const p of profiles) {
    const r = scoreProfile(p, me, filters);
    const cand = { ...p, compatibilityScore: r.score, compatibilityReason: compatibilityReason(r), compatibilityReasons: r.reasons, distanceKm: r.distanceKm };
    if (!best || cand.compatibilityScore > best.compatibilityScore ||
        (cand.compatibilityScore === best.compatibilityScore && new Date(cand.lastActive || 0) > new Date(best.lastActive || 0))) best = cand;
  }
  return best;
}
