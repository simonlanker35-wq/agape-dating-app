import { Check, X } from "lucide-react";
import { useApp } from "../context/AppContext";
import { track } from "../services/posthog";

const FONT = "'Outfit', system-ui, sans-serif";
const SERIF = "'Lora', Georgia, serif";
const C = { bg: "#FFFFFF", primary: "#B8912A", text: "#1A1612", sub: "#8C857C", surface: "#F4F2EE", sent: "#111111" };

// Pops up once when the Agape team has approved or rejected one of the user's verification selfies
export default function ReviewAlert() {
  const { state, dispatch } = useApp();
  const alert = state.reviewAlert;
  // Match and rose celebrations take the screen first
  if (!alert || state.matchAlert || state.roseAlert) return null;

  const approved = alert.status === "approved";
  const what = alert.kind === "church" ? "selfie with a church" : "selfie with a Bible";

  const close = () => { track("review_alert_closed", { status: alert.status }); dispatch({ type: "DISMISS_REVIEW" }); };
  const goToProfile = () => {
    track("review_alert_opened", { status: alert.status });
    dispatch({ type: "DISMISS_REVIEW" });
    dispatch({ type: "SET_TAB", payload: "profile" });
  };

  return (
    <div onClick={close} style={{ position: "fixed", inset: 0, zIndex: 10000, background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 28, animation: "overlayFadeIn 0.2s ease" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 340, background: C.bg, borderRadius: 24, padding: "26px 24px 18px", textAlign: "center", boxShadow: "0 24px 60px rgba(0,0,0,0.3)", animation: "sheetSlideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1)" }}>
        <div style={{ position: "relative", width: 88, margin: "0 auto 16px" }}>
          {alert.url ? (
            <img src={alert.url} alt="" style={{ width: 88, aspectRatio: "3/4", objectFit: "cover", borderRadius: 14, display: "block", filter: approved ? "none" : "brightness(0.7)" }} />
          ) : (
            <div style={{ width: 88, aspectRatio: "3/4", borderRadius: 14, background: C.surface }} />
          )}
          <div style={{ position: "absolute", right: -10, bottom: -10, width: 36, height: 36, borderRadius: "50%", background: approved ? "#22C55E" : "#DC2626", border: `3px solid ${C.bg}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {approved ? <Check size={18} color="#fff" strokeWidth={3} /> : <X size={18} color="#fff" strokeWidth={3} />}
          </div>
        </div>

        <p style={{ fontFamily: SERIF, fontSize: 21, fontWeight: 600, color: C.text, margin: "0 0 8px", lineHeight: 1.2 }}>Your photo has been reviewed</p>
        <p style={{ fontFamily: FONT, fontSize: 14, color: C.sub, lineHeight: 1.5, margin: 0 }}>
          {approved
            ? `Your ${what} is verified. It now shows on your profile, together with the verified tick next to your name.`
            : `Your ${what} was not approved.`}
        </p>
        {!approved && alert.note && (
          <p style={{ fontFamily: FONT, fontSize: 14, color: C.text, lineHeight: 1.5, margin: "10px 0 0", padding: "10px 12px", borderRadius: 12, background: C.surface }}>
            <span style={{ fontWeight: 700 }}>Reason:</span> {alert.note}
          </p>
        )}

        <button onClick={goToProfile} style={{ width: "100%", padding: 14, marginTop: 20, borderRadius: 14, background: C.sent, color: "#fff", border: "none", fontFamily: FONT, fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
          {approved ? "View my profile" : "Upload a new photo"}
        </button>
        <button onClick={close} style={{ width: "100%", padding: 12, marginTop: 4, background: "none", border: "none", fontFamily: FONT, fontSize: 14, fontWeight: 600, color: C.sub, cursor: "pointer" }}>
          {approved ? "Close" : "Later"}
        </button>
      </div>
    </div>
  );
}
