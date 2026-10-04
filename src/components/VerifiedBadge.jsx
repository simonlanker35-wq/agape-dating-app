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
export default function VerifiedBadge({ size = 20, label = false, style }) {
  const { state, dispatch } = useApp();
  const [open, setOpen] = useState(false);

  const mine = state.myVerifications || {};
  const iAmVerified = mine.church?.status === "approved" || mine.bible?.status === "approved";

  const show = (e) => {
    // The badge often sits inside a tappable row or card: keep the tap from opening that too
    e.stopPropagation();
    e.preventDefault();
    track("verified_badge_tapped");
    setOpen(true);
  };
  const onKey = (e) => { if (e.key === "Enter" || e.key === " ") show(e); };
  const close = (e) => { e?.stopPropagation(); setOpen(false); };
  const getVerified = (e) => {
    e.stopPropagation();
    track("verified_badge_get_verified");
    setOpen(false);
    dispatch({ type: "DISMISS_MATCH" });
    dispatch({ type: "OPEN_PHOTO_EDITOR" });
  };

  const seal = (
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
    "aria-label": "Verified by Agape. Tap for details.",
    title: "Verified by Agape",
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
              <BadgeCheck size={52} fill="#B8912A" color="#FFFFFF" strokeWidth={1.8} aria-hidden="true" />
            </div>
            <p style={{ fontFamily: SERIF, fontSize: 21, fontWeight: 600, color: "#1A1612", margin: "0 0 10px" }}>Verified by Agape</p>
            <p style={{ fontFamily: FONT, fontSize: 14, color: "#5F5A53", lineHeight: 1.55, margin: 0 }}>
              This person sent us a selfie with a church or a Bible. Someone on the Agape team looked at it and confirmed it is the same person as in the profile photos.
            </p>
            <p style={{ fontFamily: FONT, fontSize: 13, color: "#8C857C", lineHeight: 1.5, margin: "10px 0 0" }}>
              It shows the photos are real. It is not a background check, so still meet in a public place.
            </p>

            {!iAmVerified && (
              <button onClick={getVerified} style={{ width: "100%", padding: 14, marginTop: 20, borderRadius: 14, background: "#111111", color: "#fff", border: "none", fontFamily: FONT, fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
                Verify my profile too
              </button>
            )}
            <button
              onClick={close}
              style={iAmVerified
                ? { width: "100%", padding: 14, marginTop: 20, borderRadius: 14, background: "#111111", color: "#fff", border: "none", fontFamily: FONT, fontSize: 15, fontWeight: 700, cursor: "pointer" }
                : { width: "100%", padding: 12, marginTop: 4, background: "none", border: "none", fontFamily: FONT, fontSize: 14, fontWeight: 600, color: "#8C857C", cursor: "pointer" }}
            >
              {iAmVerified ? "Got it" : "Close"}
            </button>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
