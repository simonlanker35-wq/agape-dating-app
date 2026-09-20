import { useState, useRef, useEffect } from "react";

export default function LocationPicker({ value, onChange, onSelect, placeholder = "Search city...", className = "", style = {}, inputStyle = {}, dropdownStyle = {}, itemStyle = {} }) {
  const [query, setQuery] = useState(value || "");
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef(null);
  const wrapRef = useRef(null);

  useEffect(() => { setQuery(value || ""); }, [value]);

  useEffect(() => {
    const handle = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", handle);
    return () => document.removeEventListener("pointerdown", handle);
  }, []);

  const search = (text) => {
    setQuery(text);
    onChange?.(text);
    clearTimeout(timerRef.current);
    if (text.trim().length < 2) { setResults([]); setOpen(false); return; }
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const resp = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(text)}&format=json&addressdetails=1&limit=5&accept-language=en`
        );
        const data = await resp.json();
        const items = data.map((r) => {
          const a = r.address || {};
          const city = a.city || a.town || a.village || a.municipality || a.county || "";
          const state = a.state || "";
          const country = a.country || "";
          const postcode = a.postcode || "";
          return {
            display: [city, postcode, state, country].filter(Boolean).join(", "),
            city,
            postcode,
            country,
            lat: parseFloat(r.lat),
            lng: parseFloat(r.lon),
          };
        }).filter((r) => r.city);
        const unique = [...new Map(items.map((r) => [r.display, r])).values()];
        setResults(unique);
        setOpen(unique.length > 0);
      } catch (_) {
        setResults([]);
      }
      setLoading(false);
    }, 350);
  };

  const pick = (item) => {
    setQuery(item.display);
    setOpen(false);
    setResults([]);
    onSelect?.(item);
  };

  return (
    <div ref={wrapRef} style={{ position: "relative", ...style }}>
      <input
        type="text"
        value={query}
        onChange={(e) => search(e.target.value)}
        onFocus={() => { if (results.length > 0) setOpen(true); }}
        placeholder={placeholder}
        className={className}
        style={inputStyle}
        autoComplete="off"
      />
      {open && results.length > 0 && (
        <div style={{
          position: "absolute",
          top: "100%",
          left: 0,
          right: 0,
          marginTop: 4,
          borderRadius: 12,
          background: "white",
          boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
          zIndex: 100,
          overflow: "hidden",
          maxHeight: 220,
          overflowY: "auto",
          ...dropdownStyle,
        }}>
          {results.map((r, i) => (
            <button
              key={i}
              onClick={() => pick(r)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                width: "100%",
                padding: "12px 14px",
                fontSize: 14,
                fontWeight: 500,
                color: "#1A1612",
                background: "none",
                border: "none",
                borderBottom: i < results.length - 1 ? "1px solid #E8E4DF" : "none",
                cursor: "pointer",
                textAlign: "left",
                ...itemStyle,
              }}
            >
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#8C857C" strokeWidth={2} style={{ flexShrink: 0 }}>
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              <span>{r.display}</span>
            </button>
          ))}
        </div>
      )}
      {loading && (
        <div style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", fontSize: 11, color: "#8C857C" }}>...</div>
      )}
    </div>
  );
}
