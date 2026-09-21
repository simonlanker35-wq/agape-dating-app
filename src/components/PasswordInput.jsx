import { useEffect, useRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

// Masked field that briefly shows the last typed character, plus an eye toggle to reveal everything.
// With peek=false it is a plain password input with the eye toggle (keeps browser autofill for sign-in).
export default function PasswordInput({ value, onChange, placeholder, style = {}, autoComplete = "new-password", onKeyDown, autoFocus, id, peek = true, peekMs = 3000, iconColor = "#A39888" }) {
  const [show, setShow] = useState(false);
  const [peeking, setPeeking] = useState(false);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  const masked = !show && peek;
  const display = show
    ? value
    : masked
    ? "•".repeat(Math.max(0, value.length - (peeking ? 1 : 0))) + (peeking ? value.slice(-1) : "")
    : value;

  const handleChange = (e) => {
    const next = e.target.value;
    let real = next;
    if (masked) {
      if (!next.includes("•")) real = next;
      else if (next.length > value.length) real = value + next.slice(value.length);
      else if (next.length < value.length) real = value.slice(0, next.length);
      else real = value.slice(0, -1) + next.slice(-1);
      setPeeking(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setPeeking(false), peekMs);
    }
    onChange(real);
  };

  const { marginBottom, marginTop, ...inputStyle } = style;

  return (
    <div style={{ position: "relative", width: "100%", marginBottom, marginTop }}>
      <input
        id={id}
        type={show || masked ? "text" : "password"}
        value={display}
        onChange={handleChange}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        autoComplete={autoComplete}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        autoFocus={autoFocus}
        style={{ ...inputStyle, paddingRight: 48, boxSizing: "border-box" }}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? "Hide password" : "Show password"}
        style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", padding: 6, cursor: "pointer", color: iconColor, display: "flex" }}
      >
        {show ? <EyeOff size={20} /> : <Eye size={20} />}
      </button>
    </div>
  );
}
