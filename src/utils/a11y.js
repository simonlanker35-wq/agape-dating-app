// Keyboard access for things that are tapped but aren't <button>s.

// Spread onto a clickable div/span/img: it becomes reachable with Tab and presses with Enter or Space.
export function pressable(onClick, label) {
  return {
    role: "button",
    tabIndex: 0,
    "aria-label": label,
    onClick,
    onKeyDown: (e) => {
      if (e.target !== e.currentTarget) return;
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(e); }
    },
  };
}

// Escape closes the topmost sheet or popup, the same as tapping outside it. Backdrops opt in with
// a data-dismiss attribute; the one with the highest z-index (latest on a tie) is "clicked".
export function closeTopLayer() {
  let top = null, topZ = -Infinity;
  for (const el of document.querySelectorAll("[data-dismiss]")) {
    const z = parseInt(getComputedStyle(el).zIndex, 10) || 0;
    if (z >= topZ) { top = el; topZ = z; }
  }
  if (top) top.click();
  return !!top;
}

export function closeTopLayerOnEscape(e) {
  if (e.key !== "Escape") return;
  if (closeTopLayer()) e.preventDefault();
}

// Android back button: close the open sheet, else press the screen's own Back arrow.
// Returns false when there is nothing to go back to (the app then goes to the background).
export function goBackInApp() {
  if (closeTopLayer()) return true;
  const back = [...document.querySelectorAll('[aria-label="Back"]')].reverse().find((el) => el.offsetParent !== null && !el.disabled);
  if (back) { back.click(); return true; }
  return false;
}
