import { useEffect, useRef, useState } from "react";
import { track } from "../services/posthog";

const FONT = "'Outfit', system-ui, sans-serif";
const C = { primary: "#B8912A", text: "#1A1612", sub: "#8C857C", border: "#E8E4DF" };

// One tour per tab; steps with a selector spotlight that element, `full` steps are a centered intro card
const TOURS = {
  discover: [
    { selector: 'button[aria-label="Like"]', title: "Send a heart", text: "Like this person. You have 8 likes a day — 15 with Agape+. The number on the button is what's left today." },
    { selector: 'button[aria-label="Send a Dove"]', title: "Send a Dove", text: "A Dove says you're serious: you're revealed to them instantly, ahead of everyone else. 1 per week, 3 with Agape+." },
    { selector: ".prompt-heart", title: "Like a prompt or photo", text: "Tap the heart on a prompt to like that exact thing and add a comment. Comments get about 3× more matches." },
    { selector: ".discover-skip-btn", title: "Not for you?", text: "Skip and move on — they won't know." },
    { selector: 'button[aria-label="Safety"]', title: "Safety", text: "Report or block anyone, at any time. Reports go to our team." },
    { selector: 'button[aria-label="Filters"]', title: "Filters", text: "Set the age range, distance and denominations you want to see." },
  ],
  chat: [
    { selector: 'button[aria-label="Safety options"]', title: "Safety options", text: "Report, block or unmatch from here — anytime." },
    { selector: 'button[aria-label="Plan a date"]', title: "Plan a date", text: "Pick what, where and the dress code. She then says when she's free and you choose one of her times. You have 5 days after the first message." },
    { selector: 'button[aria-label="Send a rose"]', title: "Send a rose", text: "Tell him you'd love to go on a date — it gives him 36 extra hours to plan one." },
    { selector: 'button[aria-label="Video call"]', title: "Video call", text: "Rather meet on a call first? Schedule one here — it pauses the deadline." },
  ],
  standouts: [
    { full: true, title: "Chosen", text: "Every Wednesday we handpick one profile for you, based on your faith and values. Send them a Dove if you like what you see." },
  ],
  likes: [
    { full: true, title: "Sparks", text: "People who liked you land here. Free members reveal one a week — with Agape+ you see everyone. Like back to match." },
  ],
  matches: [
    { full: true, title: "Messages", text: "No small talk on Agape. He plans the date, she says when she's free, he picks one of her times — and only then does the chat open." },
  ],
};

const key = (screen) => `agape_tour_${screen}`;

export default function TutorialOverlay({ screen }) {
  const steps = TOURS[screen];
  const [visible, setVisible] = useState(false);
  const [idx, setIdx] = useState(0);
  const [rect, setRect] = useState(null);
  const shown = useRef(0);

  useEffect(() => {
    let done = false;
    try { done = localStorage.getItem(key(screen)) === "1"; } catch {}
    shown.current = 0;
    setIdx(0);
    setRect(null);
    setVisible(!!steps && !done);
  }, [screen]);

  const finish = (skipped = false) => {
    if (shown.current > 0) {
      try { localStorage.setItem(key(screen), "1"); } catch {}
      track(skipped ? "tour_skipped" : "tour_completed", { screen, steps: shown.current });
    }
    setVisible(false);
  };

  const next = () => {
    if (!steps) return;
    if (idx + 1 >= steps.length) finish();
    else setIdx(idx + 1);
  };

  const step = visible && steps ? steps[idx] : null;

  useEffect(() => {
    if (!step) return;
    setRect(null);
    let cancelled = false;
    let tries = 0;
    const measure = () => {
      if (step.full) { setRect(null); return true; }
      const el = document.querySelector(step.selector);
      const r = el?.getBoundingClientRect();
      if (!r || r.width === 0) return false;
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
      return true;
    };
    const tick = () => {
      if (cancelled) return;
      if (measure()) { shown.current += 1; return; }
      tries += 1;
      if (tries < 16) setTimeout(tick, 250);
      else if (idx + 1 < steps.length) setIdx(idx + 1);
      else finish();
    };
    tick();
    window.addEventListener("resize", measure);
    return () => { cancelled = true; window.removeEventListener("resize", measure); };
  }, [step, idx]);

  if (!step) return null;
  if (!step.full && !rect) return null;

  const pad = 8;
  const vh = window.innerHeight;
  const vw = Math.min(window.innerWidth, 430);
  const vLeft = (window.innerWidth - vw) / 2;
  const placeBelow = !rect || vh - (rect.top + rect.height) > 200;
  const bubblePos = rect
    ? placeBelow
      ? { top: rect.top + rect.height + pad + 14 }
      : { bottom: vh - rect.top + pad + 14 }
    : { top: "50%", transform: "translateY(-50%)" };
  const arrowX = rect ? Math.max(14, Math.min(vw - 48, rect.left + rect.width / 2 - vLeft - 16 - 8)) : 0;
  const isLast = idx + 1 >= steps.length;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9000, fontFamily: FONT }} onClick={next}>
      {rect ? (
        <div style={{ position: "absolute", top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2, borderRadius: 16, boxShadow: "0 0 0 9999px rgba(0,0,0,0.64)", border: "2px solid rgba(255,255,255,0.9)", pointerEvents: "none" }} />
      ) : (
        <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.64)" }} />
      )}

      <div onClick={(e) => e.stopPropagation()} style={{ position: "absolute", left: vLeft + 16, width: vw - 32, ...bubblePos, background: "#fff", borderRadius: 18, padding: "16px 16px 12px", boxShadow: "0 12px 40px rgba(0,0,0,0.3)" }}>
        {rect && (
          <div style={{ position: "absolute", left: arrowX, [placeBelow ? "top" : "bottom"]: -8, width: 16, height: 16, background: "#fff", transform: "rotate(45deg)", borderRadius: 3 }} />
        )}
        <p style={{ fontSize: 17, fontWeight: 800, color: C.text, margin: "0 0 6px" }}>{step.title}</p>
        <p style={{ fontSize: 14, color: C.sub, lineHeight: 1.5, margin: 0 }}>{step.text}</p>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14 }}>
          {steps.length > 1 && (
            <div style={{ display: "flex", gap: 5, flex: 1 }}>
              {steps.map((_, i) => <span key={i} style={{ width: 6, height: 6, borderRadius: 3, background: i === idx ? C.primary : C.border }} />)}
            </div>
          )}
          {steps.length === 1 && <div style={{ flex: 1 }} />}
          {!isLast && (
            <button onClick={() => finish(true)} style={{ background: "none", border: "none", color: C.sub, fontSize: 13, fontWeight: 600, cursor: "pointer", padding: "8px 4px", fontFamily: FONT }}>Skip</button>
          )}
          <button onClick={next} style={{ padding: "10px 18px", borderRadius: 9999, background: C.primary, color: "#fff", border: "none", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: FONT }}>
            {isLast ? "Got it" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}
