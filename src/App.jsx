import { AppProvider, useApp } from "./context/AppContext";
import Navigation from "./components/Navigation";
import Onboarding from "./pages/Onboarding";
import Discover from "./pages/Discover";
import LikesYou from "./pages/LikesYou";
import Matches from "./pages/Matches";
import Standouts from "./pages/Standouts";
import Profile from "./pages/Profile";
import PasswordInput from "./components/PasswordInput";
import { useState } from "react";
import "./App.css";

// Shown after opening a password-reset email link
function RecoveryModal() {
  const { state, actions } = useApp();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  if (!state.passwordRecovery) return null;

  const save = async () => {
    if (pw.length < 6) { setErr("Password must be at least 6 characters"); return; }
    if (pw !== pw2) { setErr("Passwords don't match"); return; }
    setBusy(true);
    try { await actions.setPassword(pw); actions.clearRecovery(); }
    catch (e) { setErr(e.message); }
    setBusy(false);
  };

  const inputStyle = { width: "100%", padding: "14px 16px", background: "#F4F2EE", border: "1.5px solid #E8E4DF", borderRadius: 12, fontSize: 16, color: "#1A1612", outline: "none", fontFamily: "'Outfit', system-ui, sans-serif", boxSizing: "border-box" };
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 10000, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ background: "#fff", borderRadius: 20, padding: 24, width: "100%", maxWidth: 360 }}>
        <p style={{ fontSize: 18, fontWeight: 700, color: "#1A1612", margin: "0 0 4px", fontFamily: "'Outfit', system-ui, sans-serif" }}>Choose a new password</p>
        <p style={{ fontSize: 13, color: "#8C857C", margin: "0 0 16px" }}>You opened a password reset link.</p>
        <PasswordInput value={pw} onChange={(v) => { setPw(v); setErr(""); }} placeholder="New password" style={{ ...inputStyle, marginBottom: 10 }} autoFocus />
        <PasswordInput value={pw2} onChange={(v) => { setPw2(v); setErr(""); }} placeholder="Confirm new password" style={inputStyle} onKeyDown={(e) => e.key === "Enter" && save()} />
        {err && <p style={{ fontSize: 13, color: "#EF4444", margin: "8px 0 0" }}>{err}</p>}
        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <button onClick={() => actions.clearRecovery()} style={{ flex: 1, padding: "12px 0", borderRadius: 12, fontSize: 14, fontWeight: 600, background: "#F4F2EE", color: "#8C857C", border: "none", cursor: "pointer" }}>Later</button>
          <button onClick={save} disabled={busy} style={{ flex: 2, padding: "12px 0", borderRadius: 12, fontSize: 14, fontWeight: 700, background: "#B8912A", color: "#fff", border: "none", cursor: "pointer", opacity: busy ? 0.6 : 1 }}>{busy ? "Saving..." : "Save password"}</button>
        </div>
      </div>
    </div>
  );
}

function AppContent() {
  const { state } = useApp();

  if (!state.onboardingComplete) {
    return (
      <>
        <Onboarding />
        <RecoveryModal />
      </>
    );
  }

  const renderPage = () => {
    switch (state.activeTab) {
      case "discover":
        return <Discover />;
      case "likes":
        return <LikesYou />;
      case "matches":
        return <Matches />;
      case "standouts":
        return <Standouts />;
      case "profile":
        return <Profile />;
      default:
        return <Discover />;
    }
  };

  return (
    <div className="app-container">
      <main className="app-main no-header">{renderPage()}</main>
      <Navigation />
      <RecoveryModal />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
