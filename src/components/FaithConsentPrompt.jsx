import { useState } from "react";
import { createPortal } from "react-dom";
import { Church, Check } from "lucide-react";
import { useApp } from "../context/AppContext";
import { recordFaithConsent, deleteAccount } from "../services/api";
import { track } from "../services/posthog";
import { FAITH_CONSENT_INTRO, FAITH_CONSENT_USE, FAITH_CONSENT_WITHDRAW, FAITH_CONSENT_CHECKBOX } from "../data/consent";

const FONT = "'Outfit', system-ui, sans-serif";
const C = { primary: "#B8912A", text: "#1A1612", sub: "#6F685F", border: "#E8E4DF", surface: "#F4F2EE", red: "#B3261E" };

// Members who signed up before consent was recorded ticked the box, but no record was kept.
// They are asked once more; the answer is stored with the database's time (supabase/faith_consent.sql).
// faithConsentAt is undefined while the database has no consent columns, so nobody is asked before that.
export default function FaithConsentPrompt() {
  const { state, dispatch, actions } = useApp();
  const [ticked, setTicked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState("");
  const user = state.currentUser;
  if (!user || !state.onboardingComplete || user.faithConsentAt !== null) return null;

  const agree = async () => {
    setSaving(true);
    setError("");
    try {
      const at = await recordFaithConsent();
      track("faith_consent_recorded", { source: "prompt" });
      dispatch({ type: "SET_USER", payload: { ...user, faithConsentAt: at || new Date().toISOString() } });
    } catch (e) {
      setError(e?.message || "Could not save. Please try again.");
      setSaving(false);
    }
  };

  const removeAccount = async () => {
    setSaving(true);
    setError("");
    try {
      track("faith_consent_declined_delete");
      await deleteAccount();
      await actions.logout();
    } catch (e) {
      setError(e?.message || "Could not delete the account. Please try again.");
      setSaving(false);
    }
  };

  const btn = { width: "100%", padding: 15, borderRadius: 14, border: "none", fontSize: 15, fontWeight: 700, fontFamily: FONT, cursor: "pointer" };

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Your faith information" style={{ position: "fixed", inset: 0, zIndex: 9650, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "flex-end", justifyContent: "center", fontFamily: FONT }}>
      <div style={{ width: "100%", maxWidth: 430, maxHeight: "92vh", overflowY: "auto", background: "#fff", borderRadius: "24px 24px 0 0", padding: "22px 20px max(28px, env(safe-area-inset-bottom, 28px))", boxSizing: "border-box" }}>
        {!confirmDelete ? (
          <>
            <Church size={34} color={C.primary} />
            <h2 style={{ fontSize: 22, fontWeight: 800, color: C.text, margin: "10px 0 8px" }}>Your faith information</h2>
            <p style={{ fontSize: 14, color: C.sub, lineHeight: 1.55, margin: "0 0 10px" }}>You agreed to this when you signed up. We now keep a record of that agreement, so we ask you once more.</p>
            <p style={{ fontSize: 14, color: C.sub, lineHeight: 1.55, margin: "0 0 10px" }}>{FAITH_CONSENT_INTRO}</p>
            <p style={{ fontSize: 14, color: C.sub, lineHeight: 1.55, margin: "0 0 10px" }}>{FAITH_CONSENT_USE}</p>
            <p style={{ fontSize: 13, color: C.sub, lineHeight: 1.55, margin: "0 0 16px" }}>{FAITH_CONSENT_WITHDRAW}</p>
            <button
              role="checkbox" aria-checked={ticked} onClick={() => setTicked(!ticked)}
              style={{ display: "flex", alignItems: "flex-start", gap: 12, width: "100%", padding: 14, borderRadius: 12, background: C.surface, border: `1.5px solid ${ticked ? C.primary : C.border}`, textAlign: "left", cursor: "pointer", fontFamily: FONT }}
            >
              <span style={{ width: 22, height: 22, minWidth: 22, borderRadius: 6, border: `2px solid ${ticked ? C.primary : "#C9C3BA"}`, background: ticked ? C.primary : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {ticked && <Check size={14} color="#fff" />}
              </span>
              <span style={{ fontSize: 14, lineHeight: 1.5, color: C.text }}>{FAITH_CONSENT_CHECKBOX}</span>
            </button>
            {error && <p role="alert" style={{ fontSize: 13, color: C.red, margin: "10px 0 0" }}>{error}</p>}
            <button onClick={agree} disabled={!ticked || saving} style={{ ...btn, marginTop: 16, background: C.primary, color: "#fff", opacity: !ticked || saving ? 0.5 : 1 }}>
              {saving ? "Saving…" : "Continue"}
            </button>
            <button onClick={() => setConfirmDelete(true)} disabled={saving} style={{ ...btn, marginTop: 6, background: "none", color: C.sub, fontWeight: 600, fontSize: 14 }}>
              I don't agree
            </button>
          </>
        ) : (
          <>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: C.text, margin: "4px 0 8px" }}>Delete your account?</h2>
            <p style={{ fontSize: 14, color: C.sub, lineHeight: 1.55, margin: "0 0 16px" }}>Agape matches people by their faith, so it can't work without this. Deleting removes your profile, photos, matches, messages and login right away, ends any Agape+ subscription, and cannot be undone.</p>
            {error && <p role="alert" style={{ fontSize: 13, color: C.red, margin: "0 0 10px" }}>{error}</p>}
            <button onClick={removeAccount} disabled={saving} style={{ ...btn, background: C.red, color: "#fff", opacity: saving ? 0.6 : 1 }}>
              {saving ? "Deleting…" : "Delete my account"}
            </button>
            <button onClick={() => { setConfirmDelete(false); setError(""); }} disabled={saving} style={{ ...btn, marginTop: 6, background: C.surface, color: C.text }}>
              Go back
            </button>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
