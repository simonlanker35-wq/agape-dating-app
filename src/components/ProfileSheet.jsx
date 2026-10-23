import { createPortal } from "react-dom";
import { ChevronLeft, MapPin, Ban, Flag } from "lucide-react";
import VerifiedBadge from "./VerifiedBadge";
import AudioPlayer from "./AudioPlayer";
import PhotoCarousel from "./PhotoCarousel";

const C = { bg: "#FFFFFF", card: "#FAFAF8", surface: "#F4F2EE", primary: "#B8912A", primarySoft: "#FBF5E6", text: "#1A1612", sub: "#8C857C", border: "#E8E4DF" };
const FONT = "'Outfit', system-ui, sans-serif";
const SERIF = "'Lora', Georgia, serif";

// A full-screen look at someone's profile, opened from places that are not Seek (the community, a chat).
// `actions` is a list of { label, onClick, primary, icon } for the bar at the bottom.
export default function ProfileSheet({ profile, onClose, actions = [], onReport, onBlock }) {
  if (!profile) return null;
  const prompts = (profile.prompts || []).filter((p) => p.prompt && (p.answer || p.voice?.url));

  return createPortal(
    <div style={{ position: "fixed", inset: 0, maxWidth: 430, margin: "0 auto", zIndex: 800, background: C.bg, display: "flex", flexDirection: "column", fontFamily: FONT }}>
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", WebkitOverflowScrolling: "touch", paddingBottom: actions.length ? 96 : 24 }}>
        <PhotoCarousel photos={profile.photos} name={profile.name} maxHeight="60vh">
          <button onClick={onClose} aria-label="Back" style={{ zIndex: 3, position: "absolute", top: "max(40px, calc(env(safe-area-inset-top, 0px) + 28px))", left: 14, width: 38, height: 38, borderRadius: 19, border: "none", background: "rgba(0,0,0,0.45)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <ChevronLeft size={22} strokeWidth={2.2} />
          </button>
          {(onReport || onBlock) && (
            <div style={{ position: "absolute", zIndex: 3, top: "max(40px, calc(env(safe-area-inset-top, 0px) + 28px))", right: 14, display: "flex", gap: 8 }}>
              {onReport && <button onClick={onReport} aria-label="Report" style={{ width: 38, height: 38, borderRadius: 19, border: "none", background: "rgba(0,0,0,0.45)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><Flag size={17} strokeWidth={2} /></button>}
              {onBlock && <button onClick={onBlock} aria-label="Block" style={{ width: 38, height: 38, borderRadius: 19, border: "none", background: "rgba(0,0,0,0.45)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><Ban size={17} strokeWidth={2} /></button>}
            </div>
          )}
          <div style={{ position: "absolute", zIndex: 2, left: 18, right: 18, bottom: 16, color: "#fff" }}>
            <p style={{ margin: 0, fontFamily: SERIF, fontSize: 30, fontWeight: 600, lineHeight: 1.1, display: "flex", alignItems: "center", gap: 8, textShadow: "0 2px 10px rgba(0,0,0,0.35)" }}>
              {profile.name}{profile.age ? <span style={{ fontFamily: FONT, fontWeight: 400, fontSize: 22 }}>, {profile.age}</span> : null}
              {profile.isVerified && <VerifiedBadge size={20} />}
            </p>
            <p style={{ margin: "6px 0 0", fontSize: 13.5, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", opacity: 0.95 }}>
              {profile.location && <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><MapPin size={13} /> {profile.location}</span>}
              {profile.denomination && <span>· ✝ {profile.denomination}</span>}
              {profile.job && <span>· {profile.job}</span>}
              {profile.points > 0 && <span>· ✦ {profile.points} community points</span>}
            </p>
          </div>
        </PhotoCarousel>

        <div style={{ padding: "16px 16px 0" }}>
          {prompts.map((p, i) => (
            <div key={i} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: "14px 16px", marginBottom: 10 }}>
              <p style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 700, color: C.text }}>{p.prompt}</p>
              {p.answer && <p style={{ margin: 0, fontSize: 15, color: C.text, lineHeight: 1.5, fontFamily: SERIF }}>{p.answer}</p>}
              {p.voice?.url && <div style={{ marginTop: p.answer ? 8 : 0 }}><AudioPlayer src={p.voice.url} duration={p.voice.duration} /></div>}
            </div>
          ))}
          {profile.interests?.length > 0 && (
            <div style={{ marginTop: 6 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: C.sub, textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 8px" }}>Interests</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {profile.interests.map((t) => <span key={t} style={{ padding: "7px 12px", borderRadius: 9999, border: `1px solid ${C.border}`, background: C.bg, fontSize: 13, fontWeight: 600, color: C.text }}>{t}</span>)}
              </div>
            </div>
          )}
        </div>
      </div>

      {actions.length > 0 && (
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "12px 16px max(20px, env(safe-area-inset-bottom, 20px))", background: C.bg, borderTop: `1px solid ${C.border}`, display: "flex", gap: 10 }}>
          {actions.map((a) => (
            <button key={a.label} onClick={a.onClick} disabled={a.disabled}
              style={{ flex: a.primary ? 2 : 1, padding: "14px 0", borderRadius: 14, border: a.primary ? "none" : `1px solid ${C.border}`, background: a.primary ? (a.disabled ? C.border : C.primary) : C.bg, color: a.primary ? "#fff" : C.text, fontSize: 15, fontWeight: 700, fontFamily: FONT, cursor: a.disabled ? "default" : "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              {a.icon}{a.label}
            </button>
          ))}
        </div>
      )}
    </div>,
    document.body
  );
}
