import { DETAIL_FIELDS } from "../data/profiles";

// Before a dating like is sent, and before a Spark can be accepted, you pick 3 to 5 things you like
// about the other person: their values, goals, lifestyle and interests. Both sides see the picks.
export const HIGHLIGHTS_MIN = 3;
export const HIGHLIGHTS_MAX = 5;
export const COMMENT_MIN_WORDS = 3;

const GOAL_KEYS = ["lookingFor", "wantsChildren", "relocate"];
const SKIP_KEYS = ["hasChildren"];

const detailLabel = (f, value) => `${f.label} · ${value}`;

// The chips one profile offers, grouped for display. Each chip's label is what gets stored.
export function highlightGroups(profile) {
  const details = profile?.details || {};
  const fields = DETAIL_FIELDS.filter((f) => details[f.key] && !SKIP_KEYS.includes(f.key));
  return [
    { title: "Values", items: profile?.traits || [] },
    { title: "Goals", items: fields.filter((f) => GOAL_KEYS.includes(f.key)).map((f) => detailLabel(f, details[f.key])) },
    { title: "Lifestyle", items: fields.filter((f) => !GOAL_KEYS.includes(f.key)).map((f) => detailLabel(f, details[f.key])) },
    { title: "Interests", items: profile?.interests || [] },
  ].filter((g) => g.items.length > 0);
}

// A profile with fewer than 3 things filled in only asks for as many as it has
export function highlightsNeeded(profile) {
  const total = highlightGroups(profile).reduce((n, g) => n + g.items.length, 0);
  return Math.min(HIGHLIGHTS_MIN, total);
}

export function wordCount(text) {
  return (text || "").trim().split(/\s+/).filter(Boolean).length;
}
