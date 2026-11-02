import { Check } from "lucide-react";
import { highlightGroups, HIGHLIGHTS_MAX } from "../utils/highlights";

const C = { surface: "#F4F2EE", primary: "#B8912A", primarySoft: "#FBF5E6", text: "#1A1612", sub: "#8C857C", border: "#E8E4DF" };
const FONT = "'Outfit', system-ui, sans-serif";

// Chips from someone's profile; tap to pick up to 5 things you like about them.
export default function HighlightPicker({ profile, selected, onChange, max = HIGHLIGHTS_MAX }) {
  const groups = highlightGroups(profile);
  const full = selected.length >= max;
  const toggle = (label) => {
    if (selected.includes(label)) onChange(selected.filter((s) => s !== label));
    else if (!full) onChange([...selected, label]);
  };

  if (!groups.length) return <p style={{ fontSize: 13, color: C.sub, fontFamily: FONT, margin: 0 }}>{profile?.name || "They"} hasn't filled in values or interests yet.</p>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {groups.map((g) => (
        <div key={g.title}>
          <p style={{ fontSize: 11, fontWeight: 700, color: C.sub, textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 8px", fontFamily: FONT }}>{g.title}</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {g.items.map((label) => {
              const on = selected.includes(label);
              const off = !on && full;
              return (
                <button key={label} type="button" onClick={() => toggle(label)} aria-pressed={on} disabled={off}
                  style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "8px 13px", borderRadius: 9999, fontSize: 13, fontWeight: 600, fontFamily: FONT, cursor: off ? "default" : "pointer", border: `1.5px solid ${on ? C.primary : C.border}`, background: on ? C.primary : "#fff", color: on ? "#fff" : C.text, opacity: off ? 0.45 : 1, transition: "background 0.15s, border-color 0.15s" }}>
                  {on && <Check size={13} strokeWidth={3} />}{label}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// Someone's picks, read-only: "What Anna likes about you"
export function HighlightList({ title, items, dark = false }) {
  if (!items?.length) return null;
  return (
    <div>
      {title && <p style={{ fontSize: 11, fontWeight: 700, color: dark ? "rgba(255,255,255,0.75)" : C.primary, textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 8px", fontFamily: FONT }}>{title}</p>}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {items.map((label) => (
          <span key={label} style={{ padding: "6px 11px", borderRadius: 9999, fontSize: 12.5, fontWeight: 600, fontFamily: FONT, background: dark ? "rgba(255,255,255,0.16)" : C.primarySoft, color: dark ? "#fff" : C.text, border: `1px solid ${dark ? "rgba(255,255,255,0.25)" : "#EFE3C4"}` }}>{label}</span>
        ))}
      </div>
    </div>
  );
}
