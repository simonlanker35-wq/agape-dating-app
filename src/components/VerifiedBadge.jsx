import { useState } from "react";
import { createPortal } from "react-dom";
import { BadgeCheck } from "lucide-react";
import { useApp } from "../context/AppContext";
import { track } from "../services/posthog";

const FONT = "'Outfit', system-ui, sans-serif";
const SERIF = "'Lora', Georgia, serif";

// The one verified mark used everywhere a profile is shown: a gold seal with a white tick.
// `label` adds the word "Verified" in a pill, for the larger profile views.
// Tapping it explains what verification means.
// `empty` is the outline version shown only to the owner of a profile that is not verified yet.
export default function VerifiedBadge({ size = 20, label = false, empty = false, style }) {
  const { state } = useApp();
  const [open, setOpen] = useState(false);

  const iAmVerified = !!state.currentUser?.isVerified;

  const show = (e) => {
    // The badge often sits inside a tappable row or card: keep the tap from opening that too
    e.stopPropagation();
    e.preventDefault();
    track("verified_badge_tapped", { empty });
    setOpen(true);
  };
  const onKey = (e) => { if (e.key === "Enter" || e.key === " ") show(e); };
  const close = (e) => { e?.stopPropagation(); setOpen(false); };

  const seal = empty ? (
    <BadgeCheck size={size} fill="none" color="#B8AFA3" strokeWidth={1.8} aria-hidden="true" style={{ flexShrink: 0, display: "block" }} />
  ) : (
    <BadgeCheck
      size={size}
      fill="#B8912A"
      color="#FFFFFF"
      strokeWidth={2}
      aria-hidden="true"
      style={{ flexShrink: 0, display: "block", filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.3))" }}
    />
  );

  const trigger = {
    role: "button",
    tabIndex: 0,
    "aria-label": empty ? "Not verified yet. Tap for details." : "Verified by Agape. Tap for details.",
    title: empty ? "Not verified yet" : "Verified by Agape",
    onClick: show,
    onKeyDown: onKey,
  };

  return (
    <>
      {label ? (
        <span
          {...trigger}
          style={{
            display: "inline-flex", alignItems: "center", alignSelf: "center", gap: 4, flexShrink: 0, cursor: "pointer",
            padding: "3px 10px 3px 4px", borderRadius: 999, background: "#FFFFFF", border: "1px solid #E9D9A8",
            boxShadow: "0 1px 4px rgba(0,0,0,0.18)", ...style,
          }}
        >
          {seal}
          <span style={{ fontSize: Math.max(11, Math.round(size * 0.6)), fontWeight: 700, color: "#8A6A12", fontFamily: FONT, letterSpacing: "0.01em", lineHeight: 1 }}>Verified</span>
        </span>
      ) : (
        // Padding with a negative margin gives a comfortable tap area without shifting the layout
        <span {...trigger} style={{ display: "inline-flex", alignItems: "center", alignSelf: "center", flexShrink: 0, cursor: "pointer", padding: 6, margin: -6, ...style }}>
          {seal}
        </span>
      )}

      {open && createPortal(
        // Events from a portal still bubble to the React parents, so every tap in here is stopped
        <div
          onClick={close}
          onPointerDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          style={{ position: "fixed", inset: 0, zIndex: 10050, background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 28, animation: "overlayFadeIn 0.2s ease" }}
        >
          <div
            role="dialog"
            aria-label="About the verified badge"
            onClick={(e) => e.stopPropagation()}
            style={{ width: "100%", maxWidth: 340, background: "#FFFFFF", borderRadius: 24, padding: "26px 24px 18px", textAlign: "center", boxShadow: "0 24px 60px rgba(0,0,0,0.3)", animation: "sheetSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)" }}
          >
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
              {empty
                ? <BadgeCheck size={52} fill="none" color="#B8AFA3" strokeWidth={1.6} aria-hidden="true" />
                : <BadgeCheck size={52} fill="#B8912A" color="#FFFFFF" strokeWidth={1.8} aria-hidden="true" />}
            </div>
            {empty ? (
              <>
                <p style={{ fontFamily: SERIF, fontSize: 21, fontWeight: 600, color: "#1A1612", margin: "0 0 10px" }}>Not verified yet</p>
                <p style={{ fontFamily: FONT, fontSize: 14, color: "#5F5A53", lineHeight: 1.55, margin: 0 }}>
                  Every profile on agape is checked by hand by our team. Once yours has been looked at, this badge turns gold and everyone sees it. There is nothing you need to do.
                </p>
                <p style={{ fontFamily: FONT, fontSize: 13, color: "#8C857C", lineHeight: 1.5, margin: "10px 0 0" }}>
                  Only you can see this empty badge. A gold badge tells others your photos are really you.
                </p>
                <button onClick={close} style={{ width: "100%", padding: 14, marginTop: 20, borderRadius: 14, background: "#111111", color: "#fff", border: "none", fontFamily: FONT, fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
                  Got it
                </button>
              </>
            ) : (
              <>
                <p style={{ fontFamily: SERIF, fontSize: 21, fontWeight: 600, color: "#1A1612", margin: "0 0 10px" }}>Verified by Agape</p>
                <p style={{ fontFamily: FONT, fontSize: 14, color: "#5F5A53", lineHeight: 1.55, margin: 0 }}>
                  Someone on the agape team looked at this profile by hand and confirmed it belongs to a real person who is who they say they are.
                </p>
                <p style={{ fontFamily: FONT, fontSize: 13, color: "#8C857C", lineHeight: 1.5, margin: "10px 0 0" }}>
                  It shows the photos are real. It is not a background check, so still meet in a public place.
                </p>

                <button
                  onClick={close}
                  style={{ width: "100%", padding: 14, marginTop: 20, borderRadius: 14, background: "#111111", color: "#fff", border: "none", fontFamily: FONT, fontSize: 15, fontWeight: 700, cursor: "pointer" }}
                >
                  {iAmVerified ? "Got it" : "Close"}
                </button>
              </>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
