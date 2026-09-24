import { Flower2 } from "lucide-react";
import { useApp } from "../context/AppContext";
import { track } from "../services/posthog";

const FONT = "'Outfit', system-ui, sans-serif";
const SERIF = "'Lora', Georgia, serif";
const C = { bg: "#FFFFFF", primary: "#B8912A", primarySoft: "#FBF5E6", text: "#1A1612", sub: "#8C857C", border: "#E8E4DF", sent: "#111111" };

// Pops up in front of everything when she sends a rose
export default function RoseAlert() {
  const { state, dispatch } = useApp();
  const alert = state.roseAlert;
  if (!alert) return null;

  const { match } = alert;
  const name = match.profile?.name || "She";
  const photo = match.profile?.photos?.[0];

  const dismiss = () => { track("rose_alert_dismissed"); dispatch({ type: "DISMISS_ROSE" }); };
  const open = () => { track("rose_alert_opened"); dispatch({ type: "DISMISS_ROSE" }); dispatch({ type: "OPEN_CHAT", payload: match.id }); };

  return (
    <div onClick={dismiss} style={{ position: "fixed", inset: 0, zIndex: 10000, background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 28, animation: "overlayFadeIn 0.2s ease" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 340, background: C.bg, borderRadius: 24, padding: "28px 24px 20px", textAlign: "center", boxShadow: "0 24px 60px rgba(0,0,0,0.3)", animation: "sheetSlideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1)" }}>
        <div style={{ position: "relative", width: 96, height: 96, margin: "0 auto 16px" }}>
          {photo ? (
            <img src={photo} alt={name} onError={(e) => { e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&size=96&background=FBF5E6&color=B8912A`; }} style={{ width: 96, height: 96, borderRadius: "50%", objectFit: "cover", objectPosition: "50% 20%", display: "block", border: `3px solid ${C.primarySoft}` }} />
          ) : (
            <div style={{ width: 96, height: 96, borderRadius: "50%", background: C.primarySoft }} />
          )}
          <div style={{ position: "absolute", right: -4, bottom: -4, width: 40, height: 40, borderRadius: "50%", background: C.primary, border: `3px solid ${C.bg}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Flower2 size={20} color="#fff" strokeWidth={2} />
          </div>
        </div>

        <p style={{ fontFamily: SERIF, fontSize: 22, fontWeight: 600, color: C.text, margin: "0 0 8px", lineHeight: 1.2 }}>{name} sent you a rose</p>
        <p style={{ fontFamily: FONT, fontSize: 14, color: C.sub, lineHeight: 1.5, margin: "0 0 22px" }}>
          She'd love to go on a date with you. You have an extra 36 hours to plan one.
        </p>

        <button onClick={open} style={{ width: "100%", padding: "14px", borderRadius: 14, background: C.sent, color: "#fff", border: "none", fontFamily: FONT, fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
          Plan a date
        </button>
        <button onClick={dismiss} style={{ width: "100%", padding: "12px", marginTop: 4, background: "none", border: "none", fontFamily: FONT, fontSize: 14, fontWeight: 600, color: C.sub, cursor: "pointer" }}>
          Later
        </button>
      </div>
    </div>
  );
}
