import { useEffect, useRef, useState } from "react";
import { Play, Pause } from "lucide-react";
import { formatDuration } from "../services/media";

const FONT = "'Outfit', system-ui, sans-serif";
const BARS = 28;

// Deterministic pseudo-waveform so the same clip always looks the same
function barsFor(seed) {
  let h = 0;
  for (let i = 0; i < (seed || "").length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return Array.from({ length: BARS }, (_, i) => {
    h = (h * 1103515245 + 12345) >>> 0;
    return 0.3 + ((h >>> 8) % 70) / 100 + (i % 3 === 0 ? 0.05 : 0);
  });
}

// Real audio player: play/pause, bar progress, time. `dark` for use on a dark chat bubble.
export default function AudioPlayer({ src, duration, dark = false, accent = "#B8912A", compact = false }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(duration || 0);
  const [failed, setFailed] = useState(false);
  const bars = useRef(barsFor(src)).current;

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onTime = () => { if (a.duration && Number.isFinite(a.duration)) { setProgress(a.currentTime / a.duration); setTotal(a.duration); } };
    const onEnd = () => { setPlaying(false); setProgress(0); };
    const onMeta = () => { if (Number.isFinite(a.duration)) setTotal(a.duration); };
    const onErr = () => { setFailed(true); setPlaying(false); };
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("ended", onEnd);
    a.addEventListener("loadedmetadata", onMeta);
    a.addEventListener("error", onErr);
    return () => { a.removeEventListener("timeupdate", onTime); a.removeEventListener("ended", onEnd); a.removeEventListener("loadedmetadata", onMeta); a.removeEventListener("error", onErr); };
  }, [src]);

  const toggle = async () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) { a.pause(); setPlaying(false); return; }
    try {
      document.querySelectorAll("audio").forEach((o) => { if (o !== a) o.pause(); });
      await a.play();
      setPlaying(true);
    } catch (_) { setFailed(true); }
  };

  const seek = (e) => {
    const a = audioRef.current;
    if (!a || !a.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    a.currentTime = x * a.duration;
    setProgress(x);
  };

  const fg = dark ? "#fff" : "#1A1612";
  const dim = dark ? "rgba(255,255,255,0.35)" : "rgba(26,22,18,0.22)";
  const size = compact ? 32 : 38;
  const shown = playing || progress > 0 ? progress * total : total;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: compact ? 160 : 200 }}>
      <audio ref={audioRef} src={src} preload="metadata" />
      <button
        onClick={toggle}
        aria-label={playing ? "Pause" : "Play"}
        style={{ flexShrink: 0, width: size, height: size, borderRadius: "50%", background: dark ? "#fff" : accent, border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
      >
        {playing ? <Pause size={compact ? 14 : 16} color={dark ? "#1A1612" : "#fff"} fill={dark ? "#1A1612" : "#fff"} /> : <Play size={compact ? 14 : 16} color={dark ? "#1A1612" : "#fff"} fill={dark ? "#1A1612" : "#fff"} style={{ marginLeft: 2 }} />}
      </button>
      <div onClick={seek} style={{ flex: 1, display: "flex", alignItems: "center", gap: 2, height: compact ? 22 : 26, cursor: "pointer" }}>
        {bars.map((h, i) => (
          <div key={i} style={{ flex: 1, height: `${Math.round(h * 100)}%`, minWidth: 2, borderRadius: 2, background: i / BARS <= progress ? fg : dim, transition: "background 0.1s" }} />
        ))}
      </div>
      <span style={{ flexShrink: 0, fontSize: 11.5, fontWeight: 600, fontFamily: FONT, color: failed ? "#EF4444" : (dark ? "rgba(255,255,255,0.8)" : "#8C857C"), fontVariantNumeric: "tabular-nums" }}>
        {failed ? "Can't play" : formatDuration(shown)}
      </span>
    </div>
  );
}
