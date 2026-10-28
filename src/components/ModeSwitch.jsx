import { useState } from "react";
import { createPortal } from "react-dom";
import { Heart, Users } from "lucide-react";
import { useApp } from "../context/AppContext";
import { track } from "../services/posthog";

const FONT = "'Outfit', system-ui, sans-serif";
const C = { primary: "#B8912A", text: "#1A1612", sub: "#8C857C", border: "#E8E4DF", surface: "#F4F2EE" };

// The switch between the two front ends: dating and friends. The side a person has not activated is
// greyed out; tapping it offers to activate both.
export default function ModeSwitch() {
  const { state, actions, dispatch } = useApp();
  const [ask, setAsk] = useState(null); // "date" | "friends": the side being offered
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const user = state.currentUser;
  if (!user || state.activeTab === "profile") return null;
  const intent = user.intent || "date";
  const mode = state.mode;
  const enabled = (id) => intent === "both" || (id === "friends" ? intent === "friends" : intent === "date");

  const tap = (id) => {
    if (id === mode) return;
    if (enabled(id)) { track("mode_switched", { mode: id }); actions.setMode(id); return; }
    track("mode_locked_tapped", { mode: id });
    setError("");
    setAsk(id);
  };

  const activateBoth = async () => {
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      const updated = await actions.updateProfile({ intent: "both", details: { ...(user.details || {}), intentChosen: true } });
      track("intent_changed", { intent: "both", via: "mode_switch" });
      dispatch({ type: "SET_USER", payload: updated });
      actions.setMode(ask);
      setAsk(null);
    } catch (e) {
      setError(e?.message || "Could not save. Please try again.");
    }
    setSaving(false);
  };

  const seg = (id, label, Icon) => {
    const on = mode === id;
    const locked = !enabled(id);
    const color = on ? "#fff" : locked ? "rgba(255,255,255,0.38)" : "rgba(255,255,255,0.78)";
    return (
      <button
        key={id}
        onClick={() => tap(id)}
        aria-pressed={on}
        aria-label={locked ? `${label} (not activated)` : label}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 9999, border: "none", cursor: "pointer",
          fontFamily: FONT, fontSize: 13, fontWeight: 700, letterSpacing: "0.01em",
          background: on ? C.primary : "transparent", color, transition: "background 160ms, color 160ms",
        }}
      >
        <Icon size={14} strokeWidth={2.2} color={color} fill={on && id === "date" ? "#fff" : "none"} />
        {label}
      </button>
    );
  };

  const offer = ask === "friends"
    ? { title: "Also meet friends?", text: "You are here for dating. Activate both and a friends side opens next to it: Seek for friends of either gender, waves instead of likes, a community and separate chats. Dating stays exactly as it is." }
    : { title: "Also date?", text: "You are here for friends. Activate both and the dating side opens next to it, with its own Seek, likes and chats. Your friendships stay exactly as they are." };

  return (
    <>
      <div style={{ position: "fixed", top: "max(10px, env(safe-area-inset-top, 10px))", left: "50%", transform: "translateX(-50%)", zIndex: 150, display: "inline-flex", padding: 3, borderRadius: 9999, background: "rgba(17,17,17,0.9)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", boxShadow: "0 6px 20px rgba(0,0,0,0.25)" }}>
        {seg("date", "Dating", Heart)}
        {seg("friends", "Friends", Users)}
      </div>
      {ask && createPortal(
        <div data-dismiss onClick={() => !saving && setAsk(null)} role="dialog" aria-label={offer.title} style={{ position: "fixed", inset: 0, zIndex: 9500, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: FONT }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 20, padding: 22, width: "100%", maxWidth: 360 }}>
            <div style={{ width: 44, height: 44, borderRadius: 22, background: "#FBF5E6", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
              {ask === "friends" ? <Users size={22} color={C.primary} /> : <Heart size={22} color={C.primary} />}
            </div>
            <p style={{ fontSize: 19, fontWeight: 800, color: C.text, margin: "0 0 6px" }}>{offer.title}</p>
            <p style={{ fontSize: 14, color: C.sub, margin: "0 0 16px", lineHeight: 1.5 }}>{offer.text}</p>
            {error && <p style={{ fontSize: 12.5, color: "#EF4444", margin: "0 0 10px" }}>{error}</p>}
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setAsk(null)} disabled={saving} style={{ flex: 1, padding: "12px 0", borderRadius: 12, border: `1px solid ${C.border}`, background: "#fff", color: C.text, fontWeight: 600, fontFamily: FONT, cursor: "pointer" }}>Not now</button>
              <button onClick={activateBoth} disabled={saving} style={{ flex: 1.4, padding: "12px 0", borderRadius: 12, border: "none", background: C.primary, color: "#fff", fontWeight: 700, fontFamily: FONT, cursor: "pointer" }}>{saving ? "Saving…" : "Activate both"}</button>
            </div>
            <p style={{ fontSize: 12, color: C.sub, margin: "12px 0 0", textAlign: "center" }}>You can change this any time under Settings → Here for.</p>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
