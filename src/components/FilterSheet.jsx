import { useState } from "react";
import { X } from "lucide-react";

const ALL_DENOMINATIONS = [
  "Protestant", "Catholic", "Baptist", "Methodist", "Lutheran",
  "Pentecostal", "Non-denominational", "Orthodox", "Evangelical",
];

export default function FilterSheet({ filters, onApply, onClose }) {
  const [maxAge, setMaxAge] = useState(filters.maxAge ?? 35);
  const [maxDistance, setMaxDistance] = useState(filters.maxDistance ?? 80);
  const [denominations, setDenominations] = useState(filters.denominations || []);

  const toggleDenom = (d) => {
    setDenominations((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]
    );
  };

  const handleApply = () => {
    onApply({ minAge: 18, maxAge, maxDistance, denominations });
    onClose();
  };

  const handleReset = () => {
    setMaxAge(35);
    setMaxDistance(80);
    setDenominations([]);
  };

  return (
    <div className="filter-overlay" onClick={onClose}>
      <div className="filter-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="filter-header">
          <h3>Filters</h3>
          <button className="filter-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="filter-section">
          <div className="filter-label">
            Maximum Age
            <span className="filter-value">{maxAge}</span>
          </div>
          <input
            type="range"
            min={18}
            max={60}
            value={maxAge}
            onChange={(e) => setMaxAge(+e.target.value)}
          />
        </div>

        <div className="filter-section">
          <div className="filter-label">
            Maximum Distance
            <span className="filter-value">{maxDistance} km</span>
          </div>
          <input
            type="range"
            min={5}
            max={500}
            value={maxDistance}
            onChange={(e) => setMaxDistance(+e.target.value)}
          />
        </div>

        <div className="filter-section">
          <div className="filter-label">Denomination</div>
          <div className="filter-chips">
            {ALL_DENOMINATIONS.map((d) => (
              <button
                key={d}
                className={`filter-chip ${denominations.includes(d) ? "active" : ""}`}
                onClick={() => toggleDenom(d)}
              >
                {d}
              </button>
            ))}
          </div>
          {denominations.length === 0 && (
            <p className="filter-hint">No selection = all denominations</p>
          )}
        </div>

        <div className="filter-actions">
          <button className="filter-reset-btn" onClick={handleReset}>Reset</button>
          <button className="filter-apply-btn" onClick={handleApply}>Apply</button>
        </div>
      </div>
    </div>
  );
}
