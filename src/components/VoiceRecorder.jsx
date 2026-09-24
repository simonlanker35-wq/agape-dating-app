import { useEffect, useRef, useState } from "react";
import { Mic, Square, Trash2, Check } from "lucide-react";
import { startRecording, formatDuration, isRecordingSupported } from "../services/media";
import AudioPlayer from "./AudioPlayer";

const FONT = "'Outfit', system-ui, sans-serif";

// Record → review → confirm. Calls onDone({ blob, mime, duration }) when the user confirms.
// `autoStart` begins recording as soon as it mounts (used by the chat mic button).
export default function VoiceRecorder({ onDone, onCancel, maxSeconds = 60, autoStart = false, confirmLabel = "Send", dark = false, busy = false }) {
  const [phase, setPhase] = useState("idle"); // idle | recording | review | error
  const [elapsed, setElapsed] = useState(0);
  const [clip, setClip] = useState(null); // { blob, mime, duration, url }
  const [error, setError] = useState("");
  const recRef = useRef(null);
  const timerRef = useRef(null);

  const begin = async () => {
    if (!isRecordingSupported()) { setError("Recording is not supported in this browser."); setPhase("error"); return; }
    try {
      recRef.current = await startRecording();
      setElapsed(0);
      setPhase("recording");
      const startedAt = Date.now();
      timerRef.current = setInterval(() => {
        const s = (Date.now() - startedAt) / 1000;
        setElapsed(s);
        if (s >= maxSeconds) finish();
      }, 200);
    } catch (e) {
      setError(e?.name === "NotAllowedError" ? "Microphone access was blocked. Allow it in your browser settings." : "Could not start the microphone.");
      setPhase("error");
    }
  };

  const finish = async () => {
    clearInterval(timerRef.current);
    const rec = recRef.current;
    recRef.current = null;
    if (!rec) return;
    const out = await rec.stop();
    if (out.duration < 0.8) { setPhase("idle"); onCancel?.(); return; }
    setClip({ ...out, url: URL.createObjectURL(out.blob) });
    setPhase("review");
  };

  const discard = () => {
    clearInterval(timerRef.current);
    recRef.current?.cancel();
    recRef.current = null;
    if (clip?.url) URL.revokeObjectURL(clip.url);
    setClip(null);
    setPhase("idle");
    onCancel?.();
  };

  useEffect(() => {
    if (autoStart) begin();
    return () => { clearInterval(timerRef.current); recRef.current?.cancel(); if (clip?.url) URL.revokeObjectURL(clip.url); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fg = dark ? "#F5F0E8" : "#1A1612";
  const sub = dark ? "#8C857C" : "#8C857C";
  const bg = dark ? "#2E281F" : "#F4F2EE";
  const round = (extra) => ({ width: 40, height: 40, borderRadius: 20, border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, ...extra });

  if (phase === "error") {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 14, background: bg }}>
        <span style={{ flex: 1, fontSize: 13, color: "#EF4444", fontFamily: FONT }}>{error}</span>
        <button onClick={discard} style={{ background: "none", border: "none", color: sub, fontFamily: FONT, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Close</button>
      </div>
    );
  }

  if (phase === "idle") {
    return (
      <button onClick={begin} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: 14, background: bg, border: "none", cursor: "pointer", width: "100%", textAlign: "left" }}>
        <span style={round({ background: "#B8912A" })}><Mic size={18} color="#fff" /></span>
        <span style={{ fontSize: 14, fontWeight: 600, color: fg, fontFamily: FONT }}>Record a voice answer</span>
        <span style={{ marginLeft: "auto", fontSize: 12, color: sub, fontFamily: FONT }}>up to {maxSeconds}s</span>
      </button>
    );
  }

  if (phase === "recording") {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 6px 6px 14px", borderRadius: 24, background: bg }}>
        <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#EF4444", animation: "rosePulse 1s ease-in-out infinite" }} />
        <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: fg, fontFamily: FONT, fontVariantNumeric: "tabular-nums" }}>Recording · {formatDuration(elapsed)}</span>
        <button onClick={discard} aria-label="Cancel recording" style={round({ background: "transparent" })}><Trash2 size={18} color={sub} /></button>
        <button onClick={finish} aria-label="Stop recording" style={round({ background: "#1A1612" })}><Square size={14} color="#fff" fill="#fff" /></button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 6px 6px 10px", borderRadius: 24, background: bg }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <AudioPlayer src={clip.url} duration={clip.duration} compact dark={dark} />
      </div>
      <button onClick={discard} aria-label="Delete recording" style={round({ background: "transparent" })}><Trash2 size={18} color={sub} /></button>
      <button
        onClick={() => onDone({ blob: clip.blob, mime: clip.mime, duration: Math.round(clip.duration) })}
        disabled={busy}
        aria-label={confirmLabel}
        style={round({ background: "#B8912A", opacity: busy ? 0.6 : 1, width: "auto", padding: "0 14px", gap: 6 })}
      >
        <Check size={16} color="#fff" strokeWidth={2.5} />
        <span style={{ color: "#fff", fontSize: 13, fontWeight: 700, fontFamily: FONT }}>{busy ? "…" : confirmLabel}</span>
      </button>
    </div>
  );
}
