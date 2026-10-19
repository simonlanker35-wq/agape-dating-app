import { useState } from "react";
import { createPortal } from "react-dom";
import { Heart, Users, Sparkles } from "lucide-react";
import { useApp } from "../context/AppContext";
import Pip from "./Pip";
import { track } from "../services/posthog";

const FONT = "'Outfit', system-ui, sans-serif";
const C = { primary: "#B8912A", primarySoft: "#FBF5E6", text: "#1A1612", sub: "#8C857C", border: "#E8E4DF", surface: "#F4F2EE" };

// The friends side arrived on 16 October 2026. Accounts from before that never answered
// "What brings you here?", so they are asked once; the answer is stored on the profile.
const FRIENDS_LAUNCH = Date.parse("2026-10-16T12:00:00Z");

const OPTIONS = [
  { value: "date", label: "I want to date", hint: "Find a partner who shares your faith", Icon: Heart },
  { value: "friends", label: "I want to meet friends", hint: "Christian friends near you, men and women", Icon: Users },
  { value: "both", label: "Both", hint: "A switch at the top lets you change sides", Icon: Sparkles },
];

export default function IntentPrompt() {
  const { state, actions, dispatch } = useApp();
  const [picked, setPicked] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const user = state.currentUser;
  if (!user || !state.onboardingComplete) return null;
  if (user.details?.intentChosen) return null;
  const created = user.createdAt ? Date.parse(user.createdAt) : NaN;
  if (!(created < FRIENDS_LAUNCH)) return null; // new accounts answer this during sign-up

  const choose = async (value) => {
    if (saving) return;
    setPicked(value);
    setSaving(true);
    setError("");
    track("intent_prompt_answered", { intent: value });
    try {
      const updated = await actions.updateProfile({ intent: value, details: { ...(user.details || {}), intentChosen: true } });
      dispatch({ type: "SET_USER", payload: updated });
    } catch (e) {
      setError(e?.message || "Could not save. Please try again.");
      setSaving(false);
      setPicked(null);
    }
  };

  return createPortal(
    <div role="dialog" aria-label="What brings you here?" style={{ position: "fixed", inset: 0, zIndex: 9600, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "flex-end", justifyContent: "center", fontFamily: FONT }}>
      <div style={{ position: "relative", width: "100%", maxWidth: 430, background: "#fff", borderRadius: "24px 24px 0 0", padding: "18px 20px max(28px, env(safe-area-inset-bottom, 28px))", boxShadow: "0 -12px 40px rgba(0,0,0,0.25)" }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: C.border, margin: "0 auto 16px" }} />
        <Pip pose="fly" size={110} style={{ position: "absolute", right: 14, top: -48 }} />
        <p style={{ fontSize: 12, fontWeight: 700, color: C.primary, textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 6px" }}>New on Agape</p>
        <h2 style={{ fontSize: 24, fontWeight: 800, color: C.text, margin: "0 0 6px", letterSpacing: "-0.3px" }}>What brings you here?</h2>
        <p style={{ fontSize: 14, color: C.sub, margin: "0 0 16px", lineHeight: 1.5 }}>Agape now also helps you meet Christian friends. Choose what you are here for — you can change it any time under Settings → Here for.</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {OPTIONS.map(({ value, label, hint, Icon }) => {
            const on = picked === value;
            return (
              <button
                key={value}
                onClick={() => choose(value)}
                disabled={saving}
                style={{
                  display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "14px 16px", borderRadius: 16, textAlign: "left", cursor: saving ? "default" : "pointer",
                  background: on ? C.primarySoft : C.surface, border: `1.5px solid ${on ? C.primary : C.border}`, opacity: saving && !on ? 0.6 : 1,
                }}
              >
                <span style={{ width: 40, height: 40, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: on ? C.primary : "#fff" }}>
                  <Icon size={19} strokeWidth={1.8} color={on ? "#fff" : C.primary} />
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 16, fontWeight: 700, color: C.text }}>{label}</span>
                  <span style={{ display: "block", fontSize: 12.5, color: C.sub, marginTop: 2 }}>{hint}</span>
                </span>
              </button>
            );
          })}
        </div>
        {error && <p style={{ fontSize: 12.5, color: "#EF4444", margin: "10px 0 0" }}>{error}</p>}
        {saving && !error && <p style={{ fontSize: 12.5, color: C.sub, margin: "10px 0 0", textAlign: "center" }}>Saving…</p>}
      </div>
    </div>,
    document.body
  );
}
