import { useEffect, useRef, useState } from "react";
import { checkForUpdate } from "../services/version";
import { track } from "../services/posthog";

const FONT = "'Outfit', system-ui, sans-serif";
const CHECK_EVERY = 5 * 60 * 1000;      // while the app is open
const AUTO_AFTER_HIDDEN = 30 * 60 * 1000; // away this long: update silently on return
const RELOADED_FOR = "agape_updated_to";

// Keeps open tabs from running an old version: shows a small "Update" bar when a new build is live,
// and updates by itself when the user comes back after a long break.
export default function UpdateBanner() {
  const [target, setTarget] = useState(null);
  const hiddenAt = useRef(null);

  useEffect(() => {
    let stopped = false;

    const run = async (returning) => {
      const next = await checkForUpdate();
      if (stopped || !next) return;
      let already = null;
      try { already = sessionStorage.getItem(RELOADED_FOR); } catch (_) {}
      // Coming back after a long break is a safe moment to reload. Only once per version, so a
      // stale cache can never cause a reload loop.
      if (returning && already !== next) {
        try { sessionStorage.setItem(RELOADED_FOR, next); } catch (_) {}
        track("app_auto_updated");
        window.location.reload();
        return;
      }
      setTarget(next);
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") { hiddenAt.current = Date.now(); return; }
      const away = hiddenAt.current ? Date.now() - hiddenAt.current : 0;
      hiddenAt.current = null;
      run(away >= AUTO_AFTER_HIDDEN);
    };

    run(false);
    const timer = setInterval(() => { if (document.visibilityState === "visible") run(false); }, CHECK_EVERY);
    document.addEventListener("visibilitychange", onVisibility);
    return () => { stopped = true; clearInterval(timer); document.removeEventListener("visibilitychange", onVisibility); };
  }, []);

  if (!target) return null;

  const update = () => {
    try { sessionStorage.setItem(RELOADED_FOR, target); } catch (_) {}
    track("app_update_tapped");
    window.location.reload();
  };

  return (
    <div role="status" style={{ position: "fixed", top: "calc(env(safe-area-inset-top, 0px) + 10px)", left: 0, right: 0, zIndex: 9500, display: "flex", justifyContent: "center", padding: "0 16px", pointerEvents: "none" }}>
      <div style={{ pointerEvents: "auto", display: "flex", alignItems: "center", gap: 12, padding: "8px 8px 8px 16px", borderRadius: 999, background: "#111111", boxShadow: "0 8px 24px rgba(0,0,0,0.28)", fontFamily: FONT, maxWidth: 398 }}>
        <span style={{ fontSize: 13.5, fontWeight: 500, color: "#fff" }}>A new version of Agape is ready</span>
        <button onClick={update} style={{ padding: "8px 16px", borderRadius: 999, background: "#B8912A", color: "#fff", border: "none", fontFamily: FONT, fontSize: 13.5, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>
          Update
        </button>
      </div>
    </div>
  );
}
