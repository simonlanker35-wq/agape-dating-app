const FONT = "'Outfit', system-ui, sans-serif";

export default function ReliabilityBadge({ reliability, light = false }) {
  if (!reliability || !reliability.dates) return null;
  const { dates, noShows } = reliability;
  const bad = noShows > 0;
  const text = bad
    ? `${noShows} no-show${noShows === 1 ? "" : "s"} of ${dates}`
    : `Showed up ${dates}/${dates}`;
  const color = bad ? "#EF4444" : "#16A34A";
  const bg = light ? "rgba(255,255,255,0.18)" : bad ? "#FEF2F2" : "#F0FDF4";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 9px", borderRadius: 9999, fontSize: 11, fontWeight: 700, fontFamily: FONT, background: bg, color: light ? "white" : color, backdropFilter: light ? "blur(6px)" : undefined }}>
      {bad ? (
        <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
      ) : (
        <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
      )}
      {text}
    </span>
  );
}
