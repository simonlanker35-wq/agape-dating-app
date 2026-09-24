import { useEffect, useState } from "react";

// Typed number input with unit suffix. Clamps to [min, max] when the user leaves the field,
// and only reports a value once it is valid so parents never see NaN.
export default function NumberField({ value, onChange, onCommit, min, max, unit, dark = false, size = "md", style, inputStyle, ariaLabel }) {
  const [text, setText] = useState(String(value ?? ""));
  useEffect(() => { setText(String(value ?? "")); }, [value]);

  const clamp = (n) => Math.min(max, Math.max(min, n));
  const commit = () => {
    const n = parseInt(text, 10);
    const next = Number.isFinite(n) ? clamp(n) : value;
    setText(String(next));
    if (next !== value) onChange(next);
    onCommit?.(next);
  };

  const big = size === "lg";
  const colors = dark
    ? { bg: "#252118", border: "#3D362B", text: "#F5F0E8", sub: "#8C857C" }
    : { bg: "#FFFFFF", border: "#E8E4DF", text: "#1A1612", sub: "#8C857C" };

  return (
    <label
      style={{
        display: "flex", alignItems: "center", justifyContent: "center", gap: big ? 10 : 6,
        background: colors.bg, border: `1.5px solid ${colors.border}`, borderRadius: big ? 18 : 12,
        padding: big ? "14px 20px" : "10px 14px", cursor: "text", ...style,
      }}
    >
      <input
        type="number"
        inputMode="numeric"
        pattern="[0-9]*"
        aria-label={ariaLabel}
        value={text}
        min={min}
        max={max}
        onChange={(e) => {
          const t = e.target.value.replace(/\D/g, "");
          setText(t);
          const n = parseInt(t, 10);
          if (Number.isFinite(n) && n >= min && n <= max) onChange(n);
        }}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
        onFocus={(e) => e.currentTarget.select()}
        className="number-field-input"
        style={{
          width: big ? 110 : 52, border: "none", outline: "none", background: "transparent",
          fontSize: big ? 40 : 16, fontWeight: big ? 800 : 600, color: colors.text, textAlign: "center",
          fontFamily: "'Outfit', system-ui, sans-serif", padding: 0, ...inputStyle,
        }}
      />
      {unit && <span style={{ fontSize: big ? 18 : 14, fontWeight: 600, color: colors.sub, fontFamily: "'Outfit', system-ui, sans-serif" }}>{unit}</span>}
    </label>
  );
}
