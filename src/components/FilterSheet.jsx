import { useState } from "react";
import { X } from "lucide-react";
import { DETAIL_FIELDS } from "../data/profiles";
import { track } from "../services/posthog";

const ALL_DENOMINATIONS = [
  "Protestant", "Catholic", "Baptist", "Methodist", "Lutheran",
  "Pentecostal", "Non-denominational", "Orthodox", "Evangelical",
];

// Which profile details can be filtered on, grouped as on the profile page
const FILTER_GROUPS = [
  { label: "Children", keys: ["hasChildren", "wantsChildren"] },
  { label: "Looking for", keys: ["lookingFor"] },
  { label: "Church attendance", keys: ["churchAttendance"] },
  { label: "Drinking", keys: ["drinking"] },
  { label: "Smoking", keys: ["smoking"] },
  { label: "Open to relocating", keys: ["relocate"] },
];

export default function FilterSheet({ filters, onApply, onClose }) {
  const [maxAge, setMaxAge] = useState(filters.maxAge ?? 35);
  const [maxDistance, setMaxDistance] = useState(filters.maxDistance ?? 80);
  const [denominations, setDenominations] = useState(filters.denominations || []);
  const [details, setDetails] = useState(filters.details || {});

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
    onApply({ minAge: 18, maxAge, maxDistance, denominations, details });
    onClose();
  };

  const handleReset = () => {
    track("filter_reset");
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

        <div className="filter-section">
          <div className="filter-label">
            Maximum age
            <span className="filter-value">{maxAge}</span>
          </div>
          <input type="range" min={18} max={60} value={maxAge} onChange={(e) => setMaxAge(+e.target.value)} />
        </div>

        <div className="filter-section">
          <div className="filter-label">
            Maximum distance
            <span className="filter-value">{maxDistance} km</span>
          </div>
          <input type="range" min={5} max={500} value={maxDistance} onChange={(e) => setMaxDistance(+e.target.value)} />
        </div>

        <div className="filter-section">
          <div className="filter-label">Denomination</div>
          <div className="filter-chips">
            {ALL_DENOMINATIONS.map((d) => (
              <button key={d} className={`filter-chip ${denominations.includes(d) ? "active" : ""}`} onClick={() => toggleDenom(d)}>
                {d}
              </button>
            ))}
          </div>
          {denominations.length === 0 && <p className="filter-hint">No selection = all denominations</p>}
        </div>

        {FILTER_GROUPS.map((group) => (
          <div className="filter-section" key={group.label}>
            <div className="filter-label">{group.label}</div>
            {group.keys.map((key) => {
              const field = DETAIL_FIELDS.find((f) => f.key === key);
              const selected = details[key] || [];
              return (
                <div key={key} style={{ marginBottom: group.keys.length > 1 ? 10 : 0 }}>
                  {group.keys.length > 1 && <p className="filter-hint" style={{ marginTop: 0, marginBottom: 6 }}>{field.label}</p>}
                  <div className="filter-chips">
                    {field.options.map((opt) => (
                      <button key={opt} className={`filter-chip ${selected.includes(opt) ? "active" : ""}`} onClick={() => toggleDetail(key, opt)}>
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
            {group.keys.every((k) => !(details[k] || []).length) && <p className="filter-hint">No selection = show everyone</p>}
          </div>
        ))}

        <div className="filter-actions">
          <button className="filter-reset-btn" onClick={handleReset}>Reset</button>
          <button className="filter-apply-btn" onClick={handleApply}>Apply</button>
        </div>
      </div>
    </div>
  );
}
