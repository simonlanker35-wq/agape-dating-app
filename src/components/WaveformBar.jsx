import { useState, useEffect, useRef } from "react";

export default function WaveformBar({ duration = "0:32", color = "#B8912A" }) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (playing) {
      intervalRef.current = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 1) {
            setPlaying(false);
            return 0;
          }
          return prev + 0.018;
        });
      }, 100);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [playing]);

  const DOTS = 24;
  const filled = Math.floor(progress * DOTS);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <button
        onClick={() => setPlaying((p) => !p)}
        style={{
          flexShrink: 0,
          width: 36,
          height: 36,
          borderRadius: 10,
          background: color,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: "none",
          cursor: "pointer",
          transition: "transform 0.15s",
          boxShadow: `0 2px 8px ${color}55`,
        }}
      >
        {playing ? (
          <svg width={11} height={11} viewBox="0 0 11 11" fill="white">
            <rect x="1.5" y="1" width="3" height="9" rx="1" />
            <rect x="6.5" y="1" width="3" height="9" rx="1" />
          </svg>
        ) : (
          <svg width={11} height={11} viewBox="0 0 11 11" fill="white">
            <polygon points="2,1 10,5.5 2,10" />
          </svg>
        )}
      </button>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 5 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
          {Array.from({ length: DOTS }, (_, i) => {
            const isFilled = i < filled;
            const size = 3 + Math.round(Math.abs(Math.sin(i * 1.1 + 0.5)) * 2.5);
            return (
              <div
                key={i}
                style={{
                  width: size,
                  height: size,
                  borderRadius: "50%",
                  flexShrink: 0,
                  background: isFilled ? color : "#D8D4CE",
                  transition: "background 0.08s",
                  alignSelf: "center",
                }}
              />
            );
          })}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 10, fontWeight: 600, color: "#9E9891" }}>
            {playing ? "playing..." : "voice note"}
          </span>
          <span style={{ fontSize: 10, fontWeight: 700, color }}>
            {duration}
          </span>
        </div>
      </div>
    </div>
  );
}
