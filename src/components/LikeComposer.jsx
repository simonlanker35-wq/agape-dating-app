import { useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, X } from "lucide-react";
import DoveIcon from "./DoveIcon";
import HighlightPicker from "./HighlightPicker";
import { highlightsNeeded, wordCount, COMMENT_MIN_WORDS, HIGHLIGHTS_MAX } from "../utils/highlights";

const C = { bg: "#FFFFFF", surface: "#F4F2EE", primary: "#B8912A", text: "#1A1612", sub: "#8C857C", border: "#E8E4DF" };
const FONT = "'Outfit', system-ui, sans-serif";
const SERIF = "'Lora', Georgia, serif";

// A dating like is always sent with picks and a comment:
// step 1, pick 3 to 5 things you like about them; step 2, write at least 3 words.
// dove: start as a Dove. doveLocked: always a Dove (Chosen). dovesLeft: offer switching to a Dove.
export default function LikeComposer({ profile, target = { type: "profile", index: 0 }, dove = false, doveLocked = false, dovesLeft = 0, onSend, onClose }) {
  const needed = highlightsNeeded(profile);
  const [step, setStep] = useState(needed > 0 ? 1 : 2);
  const [picks, setPicks] = useState([]);
  const [comment, setComment] = useState("");
  const [isDove, setIsDove] = useState(dove || doveLocked);
  const words = wordCount(comment);
  const canNext = picks.length >= needed;
  const canSend = canNext && words >= COMMENT_MIN_WORDS;
  const prompt = target.type === "prompt" ? profile.prompts?.[target.index]?.prompt : null;

  const send = () => { if (canSend) onSend({ comment: comment.trim(), highlights: picks, isDove }); };

  return createPortal(
    <div data-dismiss className="comment-modal-overlay" onClick={onClose} style={{ zIndex: 900 }}>
      <div role="dialog" aria-label={`Like ${profile.name}`} onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 430, maxHeight: "88dvh", display: "flex", flexDirection: "column", background: C.bg, borderRadius: "20px 20px 0 0", fontFamily: FONT, animation: "sheetSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px 16px 6px" }}>
          {step === 2 && needed > 0 ? (
            <button onClick={() => setStep(1)} aria-label="Back" style={{ width: 34, height: 34, borderRadius: 17, border: "none", background: C.surface, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><ChevronLeft size={18} /></button>
          ) : <span style={{ width: 34 }} />}
          <p style={{ flex: 1, textAlign: "center", fontSize: 12, fontWeight: 700, color: C.sub, letterSpacing: "0.06em", textTransform: "uppercase", margin: 0 }}>
            {needed > 0 ? `Step ${step} of 2` : "Your comment"}
          </p>
          <button onClick={onClose} aria-label="Close" style={{ width: 34, height: 34, borderRadius: 17, border: "none", background: C.surface, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><X size={17} /></button>
        </div>

        {step === 1 ? (
          <>
            <div style={{ padding: "6px 20px 0" }}>
              <h3 style={{ fontFamily: SERIF, fontSize: 21, fontWeight: 600, color: C.text, margin: "0 0 4px" }}>What do you like about {profile.name}?</h3>
              <p style={{ fontSize: 13, color: C.sub, margin: "0 0 14px", lineHeight: 1.45 }}>
                Pick {needed === HIGHLIGHTS_MAX ? needed : `${needed} to ${HIGHLIGHTS_MAX}`}. {profile.name} will see what you chose.
              </p>
            </div>
            <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "0 20px 12px" }}>
              <HighlightPicker profile={profile} selected={picks} onChange={setPicks} />
            </div>
            <div style={{ padding: "12px 20px max(20px, env(safe-area-inset-bottom, 20px))", borderTop: `1px solid ${C.border}` }}>
              <button onClick={() => setStep(2)} disabled={!canNext}
                style={{ width: "100%", padding: 15, borderRadius: 14, border: "none", background: canNext ? C.primary : C.border, color: "#fff", fontSize: 15, fontWeight: 700, fontFamily: FONT, cursor: canNext ? "pointer" : "default" }}>
                {canNext ? "Next" : `Pick ${needed - picks.length} more`}
              </button>
            </div>
          </>
        ) : (
          <div style={{ padding: "6px 20px max(20px, env(safe-area-inset-bottom, 20px))", overflowY: "auto" }}>
            {!doveLocked && (dovesLeft > 0 || isDove) && (
              <button onClick={() => setIsDove((v) => !v)} aria-pressed={isDove}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 9999, fontSize: 12, fontWeight: 700, marginBottom: 10, cursor: "pointer", fontFamily: FONT, background: isDove ? C.primary : C.surface, color: isDove ? "#fff" : C.sub, border: "none" }}>
                <DoveIcon size={14} strokeWidth={2.2} />
                {isDove ? "Sending with a Dove" : `Send with a Dove · ${dovesLeft} left`}
              </button>
            )}
            {doveLocked && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, fontSize: 13, color: C.primary, fontWeight: 600 }}>
                <DoveIcon size={18} strokeWidth={2} /> Sending with a Dove
              </div>
            )}
            <h3 style={{ fontFamily: SERIF, fontSize: 20, fontWeight: 600, color: C.text, margin: "0 0 4px" }}>{prompt || `Say something to ${profile.name}`}</h3>
            <p style={{ fontSize: 13, color: C.sub, margin: "0 0 12px" }}>At least {COMMENT_MIN_WORDS} words. A real comment gives them something to answer.</p>
            <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Write your comment…" maxLength={300} autoFocus rows={4}
              style={{ width: "100%", boxSizing: "border-box", padding: 14, borderRadius: 14, border: `1.5px solid ${C.border}`, fontSize: 16, fontFamily: FONT, lineHeight: 1.45, resize: "none", outline: "none", color: C.text }} />
            <p aria-live="polite" style={{ fontSize: 12, color: words >= COMMENT_MIN_WORDS ? "#2E7D32" : C.sub, margin: "6px 2px 14px", textAlign: "right" }}>
              {words >= COMMENT_MIN_WORDS ? "Ready to send" : `${COMMENT_MIN_WORDS - words} more word${COMMENT_MIN_WORDS - words === 1 ? "" : "s"}`}
            </p>
            <button onClick={send} disabled={!canSend}
              style={{ width: "100%", padding: 15, borderRadius: 14, border: "none", background: canSend ? C.primary : C.border, color: "#fff", fontSize: 15, fontWeight: 700, fontFamily: FONT, cursor: canSend ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              {isDove && <DoveIcon size={17} strokeWidth={2.2} />}
              Send {isDove ? "Dove" : "like"}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
