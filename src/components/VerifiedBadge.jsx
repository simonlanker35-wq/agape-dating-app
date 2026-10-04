import { BadgeCheck } from "lucide-react";

const FONT = "'Outfit', system-ui, sans-serif";

// The one verified mark used everywhere a profile is shown: a gold seal with a white tick.
// `label` adds the word "Verified" in a pill, for the larger profile views.
export default function VerifiedBadge({ size = 20, label = false, style }) {
  const seal = (
    <BadgeCheck
      size={size}
      fill="#B8912A"
      color="#FFFFFF"
      strokeWidth={2}
      aria-hidden="true"
      style={{ flexShrink: 0, display: "block", filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.3))" }}
    />
  );

  if (!label) {
    return (
      <span role="img" aria-label="Verified by Agape" title="Verified by Agape" style={{ display: "inline-flex", alignItems: "center", alignSelf: "center", flexShrink: 0, ...style }}>
        {seal}
      </span>
    );
  }

  return (
    <span
      role="img"
      aria-label="Verified by Agape"
      title="Verified by Agape"
      style={{
        display: "inline-flex", alignItems: "center", alignSelf: "center", gap: 4, flexShrink: 0,
        padding: "3px 10px 3px 4px", borderRadius: 999, background: "#FFFFFF", border: "1px solid #E9D9A8",
        boxShadow: "0 1px 4px rgba(0,0,0,0.18)", ...style,
      }}
    >
      {seal}
      <span style={{ fontSize: Math.max(11, Math.round(size * 0.6)), fontWeight: 700, color: "#8A6A12", fontFamily: FONT, letterSpacing: "0.01em", lineHeight: 1 }}>Verified</span>
    </span>
  );
}
