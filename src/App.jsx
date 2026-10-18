import { useState, useEffect, useRef, useCallback } from "react";
import { AppProvider, useApp } from "./context/AppContext";
import Navigation from "./components/Navigation";
import Onboarding from "./pages/Onboarding";
import Discover from "./pages/Discover";
import LikesYou from "./pages/LikesYou";
import Matches from "./pages/Matches";
import Standouts from "./pages/Standouts";
import Profile from "./pages/Profile";
import Community from "./pages/Community";
import PasswordInput from "./components/PasswordInput";
import TutorialOverlay from "./components/TutorialOverlay";
import ModeSwitch from "./components/ModeSwitch";
import IntentPrompt from "./components/IntentPrompt";
import RoseAlert from "./components/RoseAlert";
import MatchAlert from "./components/MatchAlert";
import ReviewAlert from "./components/ReviewAlert";
import ErrorBoundary from "./components/ErrorBoundary";
import UpdateBanner from "./components/UpdateBanner";
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

// Shown for the moment it takes to restore a stored login, instead of flashing the sign-up screen
// How long opening the app usually takes on this device: a running average of the measured start-ups,
// so the bar below moves at a believable pace (1.5 s until the first measurement exists)
const BOOT_KEY = "agape_boot_ms";
const readBootEstimate = () => { try { const v = Number(localStorage.getItem(BOOT_KEY)); return v >= 400 && v <= 8000 ? v : 1500; } catch { return 1500; } };
const recordBoot = (ms) => { try { const prev = readBootEstimate(); localStorage.setItem(BOOT_KEY, String(Math.round(Math.min(8000, Math.max(400, prev * 0.7 + ms * 0.3))))); } catch {} };

// Shown while a stored login is restored, instead of flashing the sign-up screen. The bar eases
// towards 90% over the expected start-up time and completes when the session is known.
function Splash({ done, onFinished }) {
  const [progress, setProgress] = useState(0);
  const [fading, setFading] = useState(false);
  const started = useRef(performance.now());
  const estimate = useRef(readBootEstimate());

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const t = performance.now() - started.current;
      // fast at first, then slower and slower, never quite reaching the end on its own
      const eased = 0.9 * (1 - Math.exp(-(t / estimate.current) * 2.2));
      setProgress((p) => Math.max(p, eased));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    if (!done) return;
    recordBoot(performance.now() - started.current);
    setProgress(1);
    const t1 = setTimeout(() => setFading(true), 180);
    const t2 = setTimeout(onFinished, 420);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [done, onFinished]);

  return (
    <div aria-busy={!done} style={{ position: "fixed", inset: 0, zIndex: 20000, background: "#FFFFFF", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 28, opacity: fading ? 0 : 1, transition: "opacity 240ms ease", pointerEvents: fading ? "none" : "auto" }}>
      <img src="/logo.svg" alt="Agape" width={88} height={88} style={{ borderRadius: 22, boxShadow: "0 4px 24px rgba(0,0,0,0.08)" }} />
      <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)} style={{ width: 140, height: 4, borderRadius: 2, background: "#EFEBE4", overflow: "hidden" }}>
        <div style={{ width: `${progress * 100}%`, height: "100%", borderRadius: 2, background: "#B8912A", transition: done ? "width 160ms ease-out" : "width 120ms linear" }} />
      </div>
    </div>
  );
}

function Notice() {
  const { state, dispatch } = useApp();
  useEffect(() => {
    if (!state.notice) return;
    const t = setTimeout(() => dispatch({ type: "SET_NOTICE", payload: null }), 8000);
    return () => clearTimeout(t);
  }, [state.notice, dispatch]);
  if (!state.notice) return null;
  return (
    <div onClick={() => dispatch({ type: "SET_NOTICE", payload: null })} style={{ position: "fixed", top: "max(56px, calc(env(safe-area-inset-top, 0px) + 52px))", left: "50%", transform: "translateX(-50%)", zIndex: 9400, background: "#1A1612", color: "#F5F0E8", padding: "12px 16px", borderRadius: 14, fontSize: 14, fontFamily: "'Outfit', system-ui, sans-serif", maxWidth: 340, textAlign: "center", boxShadow: "0 8px 24px rgba(0,0,0,0.3)", cursor: "pointer" }}>
      {state.notice}
    </div>
  );
}

function AppContent() {
  const { state } = useApp();
  // The splash stays a moment after the session is known so the bar can finish and fade out
  const [splashGone, setSplashGone] = useState(false);
  const hideSplash = useCallback(() => setSplashGone(true), []);

  if (!state.sessionChecked) return <Splash done={false} onFinished={hideSplash} />;
  const splash = !splashGone ? <Splash done onFinished={hideSplash} /> : null;

  if (!state.onboardingComplete) {
    return (
      <>
        <Onboarding />
        <RecoveryModal />
        {splash}
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
      case "community":
        return <Community />;
      case "profile":
        return <Profile />;
      default:
        return <Discover />;
    }
  };

  return (
    <div className="app-container">
      <main className="app-main no-header">
        {/* A crash on one tab keeps the navigation usable; switching tabs resets it */}
        <ErrorBoundary key={state.activeTab} name={state.activeTab} compact>{renderPage()}</ErrorBoundary>
      </main>
      <Navigation />
      <ModeSwitch />
      <TutorialOverlay screen={state.mode === "friends" && ["discover", "likes", "matches", "community"].includes(state.activeTab) ? `${state.activeTab}-friends` : state.activeTab} />
      <RecoveryModal />
      <MatchAlert />
      <RoseAlert />
      <ReviewAlert />
      <IntentPrompt />
      <Notice />
      {splash}
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary name="app">
      <UpdateBanner />
      <AppProvider>
        <ErrorBoundary name="content">
          <AppContent />
        </ErrorBoundary>
      </AppProvider>
    </ErrorBoundary>
  );
}

