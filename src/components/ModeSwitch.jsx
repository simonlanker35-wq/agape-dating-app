import { Heart, Users } from "lucide-react";
import { useApp } from "../context/AppContext";
import { track } from "../services/posthog";

const FONT = "'Outfit', system-ui, sans-serif";

// The switch between the two front ends: dating and friends. Only shown to people who are here for both.
export default function ModeSwitch() {
  const { state, actions } = useApp();
  const intent = state.currentUser?.intent || "date";
  if (intent !== "both") return null;
  if (state.activeTab === "profile") return null;
  const mode = state.mode;

  const seg = (id, label, Icon) => {
    const on = mode === id;
    return (
      <button
        key={id}
        onClick={() => { if (!on) { track("mode_switched", { mode: id }); actions.setMode(id); } }}
        aria-pressed={on}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 9999, border: "none", cursor: "pointer",
          fontFamily: FONT, fontSize: 13, fontWeight: 700, letterSpacing: "0.01em",
          background: on ? "#B8912A" : "transparent", color: on ? "#fff" : "rgba(255,255,255,0.75)", transition: "background 160ms, color 160ms",
        }}
      >
        <Icon size={14} strokeWidth={2.2} color={on ? "#fff" : "rgba(255,255,255,0.75)"} fill={on && id === "date" ? "#fff" : "none"} />
        {label}
      </button>
    );
  };

  return (
    <div style={{ position: "fixed", top: "max(10px, env(safe-area-inset-top, 10px))", left: "50%", transform: "translateX(-50%)", zIndex: 150, display: "inline-flex", padding: 3, borderRadius: 9999, background: "rgba(17,17,17,0.9)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", boxShadow: "0 6px 20px rgba(0,0,0,0.25)" }}>
      {seg("date", "Dating", Heart)}
      {seg("friends", "Friends", Users)}
    </div>
  );
}
