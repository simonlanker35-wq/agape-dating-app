import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import { enablePush, getPermission, isPushEnabled, isPushSupported, needsHomeScreenInstall } from "../services/push";
import { track } from "../services/posthog";

const C = { primary: "#B8912A", primarySoft: "#FBF5E6", text: "#1A1612", sub: "#8C857C", border: "#E8E4DF" };
const FONT = "'Outfit', system-ui, sans-serif";

export default function NotificationPrompt() {
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const install = needsHomeScreenInstall();

  useEffect(() => {
    let dismissed = false;
    try { dismissed = localStorage.getItem("agape_push_prompt_dismissed") === "1"; } catch {}
    if (dismissed || getPermission() === "denied") return;
    if (install) { setVisible(true); return; }
    if (!isPushSupported()) return;
    isPushEnabled().then((on) => setVisible(!on));
  }, [install]);

  if (!visible) return null;

  const dismiss = () => {
    try { localStorage.setItem("agape_push_prompt_dismissed", "1"); } catch {}
    setVisible(false);
  };

  const enable = async () => {
    setBusy(true);
    setError("");
    try {
      await enablePush();
      track("push_enabled", { source: "prompt" });
      setVisible(false);
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  };

  return (
    <div style={{ margin: "0 16px 12px", borderRadius: 16, padding: "14px 14px 14px 16px", background: C.primarySoft, border: `1.5px solid ${C.primary}`, display: "flex", gap: 12, alignItems: "flex-start" }}>
      <Bell size={20} color={C.primary} style={{ flexShrink: 0, marginTop: 2 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 14, fontWeight: 700, color: C.text, fontFamily: FONT, margin: "0 0 4px" }}>
          {install ? "Get notified on your iPhone" : "Don't miss a match or a date"}
        </p>
        <p style={{ fontSize: 12, color: C.sub, fontFamily: FONT, lineHeight: 1.5, margin: 0 }}>
          {install
            ? "Add Agape to your Home Screen first: tap the Share button in Safari, then \"Add to Home Screen\". Open it from there and turn notifications on."
            : "Get a notification for new likes, matches, date plans and messages."}
        </p>
        {error && <p style={{ fontSize: 12, color: "#EF4444", fontFamily: FONT, margin: "6px 0 0" }}>{error}</p>}
        {!install && (
          <button onClick={enable} disabled={busy} style={{ marginTop: 10, padding: "9px 16px", borderRadius: 9999, fontSize: 13, fontWeight: 700, fontFamily: FONT, background: C.primary, color: "white", border: "none", cursor: "pointer" }}>
            {busy ? "Turning on..." : "Turn on notifications"}
          </button>
        )}
      </div>
      <button onClick={dismiss} aria-label="Dismiss" style={{ background: "none", border: "none", cursor: "pointer", padding: 2, color: C.sub, flexShrink: 0 }}>
        <X size={16} />
      </button>
    </div>
  );
}
