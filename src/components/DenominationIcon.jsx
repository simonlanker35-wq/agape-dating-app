// A small symbol for each denomination, drawn in the same line style as the lucide icons.
// Unknown or self-written denominations get a plain cross.

const PATHS = {
  // crucifix: a wide outlined cross (thin line) with the figure of Christ inside
  catholic: [
    { thin: "M9.5 1.5h5v4h6.5v5h-6.5v12h-5v-12H3v-5h6.5z" },
    { fill: "M4.6 7.1 12 7.9l7.4-.8v1.3l-6.3.9-.2 4.7-.5 6.5h-.8l-.5-6.5-.2-4.7-6.3-.9z" },
    { fillCircle: [12, 4.6, 1.15] },
  ],
  // three-bar cross with the slanted foot bar
  orthodox: ["M12 2v20", "M9.5 5h5", "M6 9h12", "M8.5 15l7 2.5"],
  // burning bush
  reformed: [
    "M12 2c3.5 3 7 6.5 7 11a7 7 0 0 1-14 0c0-2.3 1.2-4.3 2.6-5.8.4 1.7 1.4 2.8 2.8 2.8C9.8 7 10.4 4.4 12 2z",
    "M12 19v-6", "M12 16l-2.6-2", "M12 15l2.6-2",
  ],
  // Luther's rose: a heart with a cross
  lutheran: [
    "M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z",
    "M12 8v7", "M9.5 10.5h5",
  ],
  // open Bible
  protestant: [
    "M12 7v14",
    "M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z",
    "M17 7v5", "M15 8.8h4",
  ],
  // ichthys fish
  evangelical: ["M2.5 12C7 5.5 15 5.5 20 15", "M2.5 12C7 18.5 15 18.5 20 9"],
  // drop of water above waves (baptism)
  baptist: [
    "M12 2.5c2.8 3.6 4.5 6 4.5 8.3a4.5 4.5 0 0 1-9 0c0-2.3 1.7-4.7 4.5-8.3z",
    "M3 20c1.5 1 3 1 4.5 0s3-1 4.5 0 3 1 4.5 0 3-1 4.5 0",
  ],
  // tongues of fire
  pentecostal: [
    "M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z",
  ],
  // cross and flame
  methodist: [
    "M9 3v18", "M5 8h8",
    "M16.5 7c2.2 2.4 3.5 4.3 3.5 6.5a3.5 3.5 0 0 1-7 0c0-1.6 1-2.8 1.8-3.8.2 1.1.8 1.8 1.7 1.8 0-1.6-.6-2.9 0-4.5z",
  ],
  // plain Latin cross
  cross: ["M12 3v18", "M7 8h10"],
};

export function denominationKind(denomination) {
  const d = String(denomination || "").toLowerCase();
  if (d.includes("cathol")) return "catholic";
  if (d.includes("orthodox")) return "orthodox";
  if (d.includes("reform") || d.includes("calvin") || d.includes("presbyter")) return "reformed";
  if (d.includes("luther")) return "lutheran";
  if (d.includes("evangel")) return "evangelical";
  if (d.includes("baptist")) return "baptist";
  if (d.includes("pentecost") || d.includes("charismat")) return "pentecostal";
  if (d.includes("method")) return "methodist";
  if (d.includes("protestant")) return "protestant";
  return "cross";
}

export default function DenominationIcon({ denomination, size = 16, color = "currentColor", strokeWidth = 2, style }) {
  const parts = PATHS[denominationKind(denomination)];
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"
      style={{ flexShrink: 0, display: "inline-block", verticalAlign: "-0.15em", ...style }}
    >
      {parts.map((p, i) => {
        if (typeof p === "string") return <path key={i} d={p} />;
        if (p.thin) return <path key={i} d={p.thin} strokeWidth={strokeWidth * 0.7} />;
        if (p.fill) return <path key={i} d={p.fill} fill={color} stroke="none" />;
        if (p.fillCircle) return <circle key={i} cx={p.fillCircle[0]} cy={p.fillCircle[1]} r={p.fillCircle[2]} fill={color} stroke="none" />;
        return <circle key={i} cx={p.circle[0]} cy={p.circle[1]} r={p.circle[2]} />;
      })}
    </svg>
  );
}
