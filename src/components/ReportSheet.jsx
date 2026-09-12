import { useState } from "react";
import { X } from "lucide-react";

const REPORT_REASONS = [
  "Inappropriate photos",
  "Fake profile",
  "Offensive behavior",
  "Spam or scam",
];

export default function ReportSheet({ profileName, onReport, onBlock, onClose }) {
  const [reason, setReason] = useState(null);
  const [submitted, setSubmitted] = useState(false);

  const handleReport = () => {
    onReport(reason);
    setSubmitted(true);
    setTimeout(onClose, 1500);
  };

  const handleBlock = () => {
    onBlock();
    onClose();
  };

  if (submitted) {
    return (
      <div className="report-overlay" onClick={onClose}>
        <div className="report-sheet" onClick={(e) => e.stopPropagation()}>
          <div className="report-success">
            <svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke="#4a9d7f" strokeWidth={2.5}>
              <circle cx="12" cy="12" r="10" />
              <path d="M9 12l2 2 4-4" />
            </svg>
            <p>Report submitted. Thank you.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="report-overlay" onClick={onClose}>
      <div className="report-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="report-header">
          <h3>Report or Block</h3>
          <button className="report-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="report-section">
          <div className="report-label">Report {profileName}</div>
          <div className="report-reasons">
            {REPORT_REASONS.map((r) => (
              <button
                key={r}
                className={`report-reason ${reason === r ? "active" : ""}`}
                onClick={() => setReason(r)}
              >
                {r}
              </button>
            ))}
          </div>
          <button
            className="report-submit-btn"
            onClick={handleReport}
            disabled={!reason}
          >
            Submit Report
          </button>
        </div>

        <div className="report-divider" />

        <div className="report-section">
          <div className="report-label">Block {profileName}</div>
          <p className="report-hint">They won't be able to see your profile or contact you.</p>
          <button className="report-block-btn" onClick={handleBlock}>Block</button>
        </div>
      </div>
    </div>
  );
}
