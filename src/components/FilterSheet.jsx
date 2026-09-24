import { useState } from "react";
import { X } from "lucide-react";
import { DETAIL_FIELDS } from "../data/profiles";
import NumberField from "./NumberField";
import { track } from "../services/posthog";

const MAIN_DENOMINATIONS = ["Catholic", "Orthodox"];
const MORE_DENOMINATIONS = [
  "Protestant", "Baptist", "Methodist", "Lutheran",
  "Pentecostal", "Non-denominational", "Evangelical",
];

// Which profile details can be filtered on, grouped as on the profile page
const FILTER_GROUPS = [
  { label: "Children", keys: ["hasChildren", "wantsChildren"] },
  { label: "Looking for", keys: ["lookingFor"] },
  { label: "Church attendance", keys: ["churchAttendance"] },
  { label: "Prayer", keys: ["prayer"] },
  { label: "Drinking", keys: ["drinking"] },
  { label: "Smoking", keys: ["smoking"] },
  { label: "Open to relocating", keys: ["relocate"] },
];

export default function FilterSheet({ filters, onApply, onClose }) {
  const [minAge, setMinAge] = useState(filters.minAge ?? 18);
  const [maxAge, setMaxAge] = useState(filters.maxAge ?? 35);
  const [maxDistance, setMaxDistance] = useState(filters.maxDistance ?? 80);
  const [denominations, setDenominations] = useState(filters.denominations || []);
  const [details, setDetails] = useState(filters.details || {});
  // Popup opened on top of the sheet: { kind: "denoms" } or { kind: "group", label }
  const [popup, setPopup] = useState(null);

  const toggleDenom = (d) => {
    track("filter_denomination_toggled", { denomination: d });
    setDenominations((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  };

  const toggleDetail = (key, value) => {
    track("filter_detail_toggled", { key, value });
    setDetails((prev) => {
      const cur = prev[key] || [];
      const next = cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value];
      const out = { ...prev, [key]: next };
      if (next.length === 0) delete out[key];
      return out;
    });
  };

  const handleApply = () => {
    track("filter_applied", { maxAge, maxDistance, denominations, details: Object.keys(details) });
    const lo = Math.min(minAge, maxAge), hi = Math.max(minAge, maxAge);
    onApply({ minAge: lo, maxAge: hi, maxDistance, denominations, details });
    onClose();
  };

  const handleReset = () => {
    track("filter_reset");
    setMinAge(18);
    setMaxAge(35);
    setMaxDistance(80);
    setDenominations([]);
    setDetails({});
  };

  const activeCount = denominations.length + Object.values(details).reduce((n, arr) => n + arr.length, 0);

  return (
    <div className="filter-overlay" onClick={onClose}>
      <div className="filter-sheet" onClick={(e) => e.stopPropagation()} style={{ maxHeight: "88vh", overflowY: "auto" }}>
        <div className="filter-header">
          <h3>Filters{activeCount > 0 ? ` · ${activeCount}` : ""}</h3>
          <button className="filter-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="filter-section" style={{ display: "flex", gap: 12 }}>
          <div style={{ flex: 3 }}>
            <div className="filter-label">Age</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <NumberField ariaLabel="Minimum age" value={minAge} min={18} max={99} onChange={(n) => { setMinAge(n); if (n > maxAge) setMaxAge(n); }} style={{ flex: 1 }} />
              <span style={{ color: "#8C857C", fontSize: 14 }}>to</span>
              <NumberField ariaLabel="Maximum age" value={maxAge} min={18} max={99} onChange={(n) => { setMaxAge(n); if (n < minAge) setMinAge(n); }} style={{ flex: 1 }} />
            </div>
          </div>
          <div style={{ flex: 2 }}>
            <div className="filter-label">Distance</div>
            <NumberField ariaLabel="Maximum distance" value={maxDistance} min={1} max={1000} unit="km" onChange={setMaxDistance} />
          </div>
        </div>

        <div className="filter-section">
          <div className="filter-label">Denomination</div>
          <div className="filter-chips">
            {MAIN_DENOMINATIONS.map((d) => (
              <button key={d} className={`filter-chip ${denominations.includes(d) ? "active" : ""}`} onClick={() => toggleDenom(d)}>
                {d}
              </button>
            ))}
            {(() => {
              const hidden = denominations.filter((d) => MORE_DENOMINATIONS.includes(d)).length;
              return (
                <button className={`filter-chip ${hidden > 0 ? "active" : ""}`} onClick={() => setPopup({ kind: "denoms" })}>
                  More{hidden > 0 ? ` · ${hidden}` : ""}
                </button>
              );
            })()}
          </div>
          {denominations.length === 0 && <p className="filter-hint">No selection = all denominations</p>}
        </div>

        <div className="filter-section">
          <div className="filter-label">Preferences</div>
          <div className="filter-chips">
            {FILTER_GROUPS.map((group) => {
              const count = group.keys.reduce((n, k) => n + (details[k] || []).length, 0);
              return (
                <button
                  key={group.label}
                  className={`filter-chip ${count > 0 ? "active" : ""}`}
                  onClick={() => setPopup({ kind: "group", label: group.label })}
                >
                  {group.label}{count > 0 ? ` · ${count}` : ""}
                </button>
              );
            })}
          </div>
        </div>

        <div className="filter-actions">
          <button className="filter-reset-btn" onClick={handleReset}>Reset</button>
          <button className="filter-apply-btn" onClick={handleApply}>Apply</button>
        </div>

        {popup && (
          <div className="filter-popup-backdrop" onClick={() => setPopup(null)}>
            <div className="filter-popup" onClick={(e) => e.stopPropagation()}>
              {popup.kind === "denoms" && (
                <>
                  <div className="filter-popup-title">More denominations</div>
                  <div className="filter-chips">
                    {MORE_DENOMINATIONS.map((d) => (
                      <button
                        key={d}
                        className={`filter-chip ${denominations.includes(d) ? "active" : ""}`}
                        onClick={() => { toggleDenom(d); setPopup(null); }}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </>
              )}
              {popup.kind === "group" && (() => {
                const group = FILTER_GROUPS.find((g) => g.label === popup.label);
                const single = group.keys.length === 1;
                return (
                  <>
                    <div className="filter-popup-title">{group.label}</div>
                    {group.keys.map((key) => {
                      const field = DETAIL_FIELDS.find((f) => f.key === key);
                      const selected = details[key] || [];
                      return (
                        <div key={key} style={{ marginBottom: single ? 0 : 12 }}>
                          {!single && <p className="filter-hint" style={{ marginTop: 0, marginBottom: 6, textAlign: "left" }}>{field.label}</p>}
                          <div className="filter-chips">
                            {field.options.map((opt) => (
                              <button
                                key={opt}
                                className={`filter-chip ${selected.includes(opt) ? "active" : ""}`}
                                onClick={() => {
                                  toggleDetail(key, opt);
                                  // Single-question groups close on pick; multi-question groups close once every question has an answer
                                  const willHave = selected.includes(opt) ? selected.length - 1 : selected.length + 1;
                                  const othersAnswered = group.keys.filter((k) => k !== key).every((k) => (details[k] || []).length > 0);
                                  if (single || (willHave > 0 && othersAnswered)) setPopup(null);
                                }}
                              >
                                {opt}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                    {!single && (
                      <button className="filter-popup-done" onClick={() => setPopup(null)}>Done</button>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
