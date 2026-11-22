// Placeholder picture with someone's initials, drawn in the app (no outside service sees the name).
// Returns an SVG data URL usable as an <img src>.
export function initialsAvatar(name) {
  const initials = String(name || "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => Array.from(w)[0] || "")
    .join("")
    .toUpperCase() || "?";
  const safe = initials.replace(/[&<>"']/g, "");
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">` +
    `<rect width="200" height="200" fill="#FBF5E6"/>` +
    `<text x="100" y="100" dy=".35em" text-anchor="middle" font-family="Outfit, system-ui, sans-serif" font-size="${safe.length > 1 ? 78 : 92}" font-weight="700" fill="#B8912A">${safe}</text>` +
    `</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
