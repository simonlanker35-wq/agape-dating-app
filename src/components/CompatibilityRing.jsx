import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useApp } from "../context/AppContext";
import { scoreProfile } from "../utils/algorithm";
import { track } from "../services/posthog";

const FONT = "'Outfit', system-ui, sans-serif";
const SERIF = "'Lora', Georgia, serif";
const GOLD = "#B8912A";

const PARTS = [
  { key: "faith", label: "Faith", max: 35, hint: "Denomination, church attendance and prayer" },
  { key: "goals", label: "Relationship goals", max: 25, hint: "Children, what you're looking for, relocating" },
  { key: "lifestyle", label: "Lifestyle", max: 10, hint: "Smoking, drinking and exercise" },
  { key: "interests", label: "Shared interests", max: 10, hint: "Interests you both picked" },
  { key: "mutualFit", label: "You fit their filters", max: 10, hint: "Your age, distance and denomination match what they're looking for" },
  { key: "trust", label: "Trust", max: 10, hint: "Verified selfie, showed up to dates, recently active. No-shows count against." },
  { key: "distance", label: "Distance", max: 5, hint: "Closer is a little better" },
];

const NEGATIVE = /disagree|no-show|Different views/;

// Ring showing how well a profile matches the current user. Tap for the explanation and breakdown.
export default function CompatibilityRing({ profile, size = 44, light = false, style }) {
  const { state } = useApp();
  const [open, setOpen] = useState(false);
  const me = state.currentUser;

  const result = useMemo(() => (me && profile ? scoreProfile(profile, me, state.filters || {}) : null), [me, profile, state.filters]);
  if (!result) return null;

  const pct = result.score;
  const stroke = Math.max(3, Math.round(size * 0.085));
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const dash = circ * (pct / 100);
  const trackColor = light ? "rgba(255,255,255,0.3)" : "#E8E4DF";
  const textColor = light ? "#FFFFFF" : "#1A1612";
  const name = profile.name || "this person";

  const show = (e) => { e.stopPropagation(); e.preventDefault(); track("compatibility_ring_tapped", { score: pct }); setOpen(true); };
  const close = (e) => { e?.stopPropagation(); setOpen(false); };

  return (
    <>
      <span
        role="button"
        tabIndex={0}
        aria-label={`${pct}% compatible. Tap to see why.`}
        title={`${pct}% compatible`}
        onClick={show}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") show(e); }}
        style={{ position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center", width: size, height: size, flexShrink: 0, cursor: "pointer", filter: light ? "drop-shadow(0 1px 3px rgba(0,0,0,0.35))" : "none", ...style }}
      >
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)", display: "block" }} aria-hidden="true">
          <circle cx={size / 2} cy={size / 2} r={r} fill={light ? "rgba(0,0,0,0.25)" : "#FFFFFF"} stroke={trackColor} strokeWidth={stroke} />
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={GOLD} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${dash} ${circ - dash}`} />
        </svg>
        <span style={{ position: "absolute", fontFamily: FONT, fontWeight: 700, fontSize: Math.round(size * 0.3), color: textColor, lineHeight: 1, letterSpacing: "-0.02em" }}>
          {pct}<span style={{ fontSize: Math.round(size * 0.18), fontWeight: 600 }}>%</span>
        </span>
      </span>

      {open && createPortal(
        <div
          onClick={close}
          onPointerDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          style={{ position: "fixed", inset: 0, zIndex: 10050, background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)", display: "flex", alignItems: "flex-end", justifyContent: "center", animation: "overlayFadeIn 0.2s ease" }}
        >
          <div
            role="dialog"
            aria-label="What the compatibility percentage means"
            onClick={(e) => e.stopPropagation()}
            style={{ width: "100%", maxWidth: 430, maxHeight: "88vh", overflowY: "auto", background: "#FFFFFF", borderRadius: "24px 24px 0 0", padding: "18px 20px calc(env(safe-area-inset-bottom, 0px) + 20px)", boxShadow: "0 -12px 40px rgba(0,0,0,0.25)", animation: "sheetSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)", fontFamily: FONT }}
          >
            <div style={{ width: 36, height: 4, borderRadius: 2, background: "#E8E4DF", margin: "0 auto 16px" }} />
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
              <CompatibilityRingStatic pct={pct} size={64} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontFamily: SERIF, fontSize: 21, fontWeight: 600, color: "#1A1612", margin: 0, lineHeight: 1.2 }}>{pct}% compatible</p>
                <p style={{ fontSize: 13, color: "#8C857C", margin: "4px 0 0", lineHeight: 1.4 }}>
                  {pct >= 80 ? "You line up on almost everything that matters." : pct >= 60 ? "A lot in common on the things that matter." : pct >= 40 ? "Some common ground, and some real differences." : "Your answers point in different directions."}
                </p>
              </div>
              <button onClick={close} aria-label="Close" style={{ width: 32, height: 32, borderRadius: 16, border: "none", background: "#F4F2EE", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
                <X size={16} color="#8C857C" />
              </button>
            </div>

            <p style={{ fontSize: 14, color: "#5F5A53", lineHeight: 1.55, margin: "0 0 16px" }}>
              This number compares what you and {name} told Agape about yourselves: your faith, what you want from a relationship, how you live and your interests. It also counts whether you fit what they're looking for, how reliable they've been on dates, and how close you live. It does not look at photos or chats, and it is a starting point, not a verdict.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
              {PARTS.map((p) => {
                const pts = Math.max(0, result.breakdown[p.key] || 0);
                const neg = (result.breakdown[p.key] || 0) < 0;
                const ratio = Math.min(1, pts / p.max);
                return (
                  <div key={p.key}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
                      <span style={{ fontSize: 13.5, fontWeight: 600, color: "#1A1612" }}>{p.label}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: neg ? "#DC2626" : "#8C857C", fontVariantNumeric: "tabular-nums" }}>{neg ? "−" : ""}{Math.round(Math.abs(result.breakdown[p.key] || 0))} / {p.max}</span>
                    </div>
                    <div style={{ height: 6, borderRadius: 3, background: "#F0ECE6", overflow: "hidden" }}>
                      <div style={{ width: `${Math.round(ratio * 100)}%`, height: "100%", borderRadius: 3, background: neg ? "#DC2626" : GOLD, transition: "width 0.3s" }} />
                    </div>
                    <p style={{ fontSize: 11.5, color: "#8C857C", margin: "3px 0 0" }}>{p.hint}</p>
                  </div>
                );
              })}
            </div>

            {result.reasons.length > 0 && (
              <div style={{ borderRadius: 14, background: "#FAFAF8", border: "1px solid #E8E4DF", padding: "12px 14px" }}>
                <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#8C857C", margin: "0 0 8px" }}>What stands out</p>
                {result.reasons.slice(0, 6).map((r) => (
                  <p key={r} style={{ fontSize: 14, color: NEGATIVE.test(r) ? "#B3261E" : "#1A1612", margin: "0 0 6px", lineHeight: 1.4 }}>
                    {NEGATIVE.test(r) ? "– " : "+ "}{r}
                  </p>
                ))}
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

function CompatibilityRingStatic({ pct, size }) {
  const stroke = 6;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  return (
    <span style={{ position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)", display: "block" }} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#E8E4DF" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={GOLD} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${circ * (pct / 100)} ${circ}`} />
      </svg>
      <span style={{ position: "absolute", fontFamily: FONT, fontWeight: 700, fontSize: 18, color: "#1A1612" }}>{pct}</span>
    </span>
  );
}
