import { useApp } from "../context/AppContext";
import { useState, useEffect } from "react";
import { Heart, X, Lock } from "lucide-react";
import AudioPlayer from "../components/AudioPlayer";
import VerifiedBadge from "../components/VerifiedBadge";
import CompatibilityRing from "../components/CompatibilityRing";
import AgapeCross from "../components/AgapeCross";
import DoveIcon from "../components/DoveIcon";
import ReliabilityBadge from "../components/ReliabilityBadge";
import { getRevealsRemaining, recordReveal, LIMITS } from "../services/limits";
import * as api from "../services/api";
import { track } from "../services/posthog";

const C = { bg: "#FFFFFF", card: "#FAFAF8", surface: "#F4F2EE", primary: "#B8912A", primarySoft: "#FBF5E6", text: "#1A1612", sub: "#8C857C", border: "#E8E4DF" };
const FONT = "'Outfit', system-ui, sans-serif";
const SERIF = "'Lora', Georgia, serif";

export default function LikesYou() {
  const { state, actions, dispatch } = useApp();
  const [likedBack, setLikedBack] = useState(new Set());
  const [dismissed, setDismissed] = useState(new Set());
  const [viewProfile, setViewProfile] = useState(null);
  const isPremium = state.currentUser?.subscriptionStatus === "active";
  const [revealsLeft, setRevealsLeft] = useState(getRevealsRemaining(isPremium));
  // Revealed likes are remembered per account, so a reveal is not lost on reload
  const revealKey = `agape_revealed_${state.currentUser?.id || "anon"}`;
  const [revealedIds, setRevealedIds] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem(revealKey) || "[]")); } catch (_) { return new Set(); }
  });
  const [heartFlash, setHeartFlash] = useState(null);

  useEffect(() => {
    setRevealsLeft(getRevealsRemaining(isPremium));
  }, [isPremium, state.usage]);

  const allLikes = state.likesReceived.filter(
    (l) => l.profile && !dismissed.has(l.id) && !likedBack.has(l.id)
  );

  const doveLikes = allLikes.filter((l) => l.isDove);
  const regularLikes = allLikes.filter((l) => !l.isDove);
  const likesWithProfiles = [...doveLikes, ...regularLikes];

  const handleLikeBack = async (like) => {
    track("sparks_like_back", { isDove: !!like.isDove });
    setHeartFlash(like.id);
    setTimeout(() => setHeartFlash(null), 800);
    setLikedBack((prev) => new Set(prev).add(like.id));
    try {
      await actions.matchFromLike(like);
    } catch (err) {
      console.error("Match failed:", err);
      setLikedBack((prev) => { const n = new Set(prev); n.delete(like.id); return n; });
    }
  };

  const handleDismiss = async (like) => {
    track("sparks_dismiss");
    try {
      setDismissed((prev) => new Set(prev).add(like.id));
      await actions.dismissLike(like.id);
    } catch (err) {
      console.error("Dismiss failed:", err);
    }
  };

  if (likesWithProfiles.length === 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", padding: "60px 20px", textAlign: "center" }}>
        <Heart size={48} strokeWidth={1.4} color={C.primary} style={{ marginBottom: 16 }} />
        <h2 style={{ color: C.text, fontFamily: FONT, fontSize: 20, fontWeight: 700 }}>No new likes</h2>
        <p style={{ color: C.sub, fontSize: 14, marginTop: 4 }}>Keep exploring! When someone likes you, they'll appear here.</p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: C.bg }}>
      <div style={{ padding: "40px 20px 8px" }}>
        <h1 style={{ color: C.text, fontFamily: FONT, fontSize: 24, fontWeight: 700, letterSpacing: "-0.4px", margin: 0 }}>Sparks</h1>
        <p style={{ color: C.sub, fontSize: 13, marginTop: 4 }}>
          {likesWithProfiles.length} {likesWithProfiles.length === 1 ? "person" : "people"} liked you
        </p>
        {!isPremium && (
          <p style={{ color: C.primary, fontSize: 12, fontWeight: 600, marginTop: 6, fontFamily: FONT, lineHeight: 1.4 }}>
            Free members reveal one new like a week. With Agape+ you see everyone right away.
          </p>
        )}
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "0 12px 24px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {likesWithProfiles.map((like, idx) => {
            const profile = like.profile;
            const matched = likedBack.has(like.id);
            const isDoveLike = like.isDove;
            const isRevealed = isDoveLike || like.revealed || revealedIds.has(like.id) || isPremium;
            const isLocked = !isRevealed;

            const handleReveal = async (e) => {
              e.stopPropagation();
              if (revealsLeft <= 0) return;
              // The database records the reveal and refuses it once the weekly allowance is used
              try {
                await actions.revealLike(like.id);
              } catch (err) {
                console.error("Reveal failed:", err);
                if (api.isLimitError(err)) setRevealsLeft(0);
                return;
              }
              track("sparks_reveal", { revealsLeft: revealsLeft - 1 });
              recordReveal();
              setRevealsLeft(getRevealsRemaining(isPremium));
              setRevealedIds((prev) => {
                const next = new Set(prev).add(like.id);
                try { localStorage.setItem(revealKey, JSON.stringify([...next])); } catch (_) {}
                return next;
              });
            };

            return (
              <div
                key={like.id}
                onClick={() => { if (!isLocked) { track("sparks_profile_viewed"); setViewProfile(profile); } }}
                style={{
                  position: "relative",
                  borderRadius: 20,
                  overflow: "hidden",
                  cursor: isLocked ? "default" : "pointer",
                  aspectRatio: "3/4",
                  background: C.surface,
                  border: isDoveLike ? `2px solid ${C.primary}` : "none",
                }}
              >
                <img
                  src={profile.photos?.[0]}
                  alt={profile.name}
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", filter: isLocked ? "blur(20px)" : "none" }}
                  onError={(e) => { e.target.src = `https://ui-avatars.com/api/?name=${profile.name}&size=400&background=random`; }}
                />
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 50%)", pointerEvents: "none" }} />

                {isDoveLike && !isLocked && (
                  <div style={{ position: "absolute", top: 8, left: 8, background: C.primary, borderRadius: 20, padding: "4px 10px", display: "flex", alignItems: "center", gap: 4 }}>
                    <DoveIcon size={12} color="white" strokeWidth={2} />
                    <span style={{ color: "white", fontSize: 10, fontWeight: 700, fontFamily: FONT }}>Dove</span>
                  </div>
                )}

                {heartFlash === like.id && (
                  <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10, pointerEvents: "none" }}>
                    <span style={{ display: "flex", animation: "heartPop 0.8s ease-out forwards" }}><Heart size={64} fill={C.primary} color={C.primary} /></span>
                  </div>
                )}

                {isLocked ? (
                  <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }}>
                    <Lock size={28} strokeWidth={1.8} color="white" />
                    {revealsLeft > 0 ? (
                      <button
                        onClick={handleReveal}
                        style={{
                          padding: "8px 16px", borderRadius: 12, fontSize: 12, fontWeight: 700, fontFamily: FONT,
                          background: C.primary, color: "white", border: "none", cursor: "pointer",
                        }}
                      >
                        Reveal ({revealsLeft} left)
                      </button>
                    ) : (
                      <button
                        onClick={(e) => { e.stopPropagation(); track("upgrade_tapped", { source: "sparks_locked" }); dispatch({ type: "SET_TAB", payload: "profile" }); }}
                        style={{ color: "white", fontSize: 12, fontWeight: 600, fontFamily: FONT, textAlign: "center", padding: "8px 16px", textShadow: "0 1px 4px rgba(0,0,0,0.5)", background: "rgba(184,145,42,0.6)", border: "1.5px solid rgba(255,255,255,0.4)", borderRadius: 12, cursor: "pointer", backdropFilter: "blur(4px)" }}
                      >
                        Get Agape+ to see all
                      </button>
                    )}
                  </div>
                ) : (
                  <>
                    <div style={{ position: "absolute", top: 10, right: 10 }}>
                      <CompatibilityRing profile={profile} size={40} light />
                    </div>
                    <div style={{ position: "absolute", bottom: 56, left: 12, right: 12 }}>
                      <p style={{ color: "white", fontSize: 19, fontWeight: 600, fontFamily: SERIF, margin: 0, textShadow: "0 1px 4px rgba(0,0,0,0.4)", display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{profile.name}, {profile.age}</span>
                        {profile.isVerified && <VerifiedBadge size={20} />}
                      </p>
                      <p style={{ color: "rgba(255,255,255,0.8)", fontSize: 12, fontWeight: 600, marginTop: 2 }}>
                        {profile.denomination}
                      </p>
                      {like.comment && (
                        <p style={{ color: "rgba(255,255,255,0.9)", fontSize: 11, fontStyle: "italic", marginTop: 4, lineHeight: 1.3 }}>
                          "{like.comment}"
                        </p>
                      )}
                    </div>
                    <div style={{ position: "absolute", bottom: 10, left: 12, right: 12, display: "flex", gap: 8 }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDismiss(like); }}
                        style={{
                          flex: 1, height: 38, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center",
                          background: "rgba(255,255,255,0.2)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.3)", cursor: "pointer",
                        }}
                      >
                        <X size={18} color="white" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); if (!matched) handleLikeBack(like); }}
                        style={{
                          flex: 1, height: 38, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center",
                          background: matched ? "#22C55E" : C.primary, border: "none", cursor: "pointer",
                        }}
                      >
                        {matched ? (
                          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3}><path d="M20 6L9 17l-5-5" /></svg>
                        ) : (
                          <Heart size={18} fill="white" stroke="white" />
                        )}
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {viewProfile && (
        <div style={{ position: "fixed", inset: 0, maxWidth: 430, margin: "0 auto", zIndex: 300, background: C.bg, overflowY: "auto" }}>
          <div style={{ position: "relative" }}>
            <img
              src={viewProfile.photos?.[0]}
              alt={viewProfile.name}
              style={{ width: "100%", aspectRatio: "3/4", maxHeight: "56vh", objectFit: "cover" }}
              onError={(e) => { e.target.src = `https://ui-avatars.com/api/?name=${viewProfile.name}&size=600&background=random`; }}
            />
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 50%)", pointerEvents: "none" }} />
            <button onClick={() => setViewProfile(null)} style={{ position: "absolute", top: 44, left: 16, width: 36, height: 36, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.4)", backdropFilter: "blur(10px)", border: "none", cursor: "pointer" }}>
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5}><polyline points="15 18 9 12 15 6" /></svg>
            </button>
            <div style={{ position: "absolute", bottom: 20, left: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ color: "white", fontSize: 28, fontWeight: 600, fontFamily: SERIF }}>{viewProfile.name}</span>
                <span style={{ color: "rgba(255,255,255,0.8)", fontSize: 22, fontWeight: 300 }}>{viewProfile.age}</span>
                {viewProfile.isVerified && <VerifiedBadge size={20} label />}
                <CompatibilityRing profile={viewProfile} size={44} light style={{ marginLeft: "auto" }} />
              </div>
              <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, marginTop: 4 }}>{viewProfile.denomination}{viewProfile.location ? ` · ${viewProfile.location}` : ""}</p>
              {viewProfile.reliability?.dates > 0 && <div style={{ marginTop: 8 }}><ReliabilityBadge reliability={viewProfile.reliability} light /></div>}
            </div>
          </div>
          <div style={{ padding: "20px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
            {(viewProfile.prompts || []).filter(p => p.prompt && (p.answer || p.voice?.url)).map((p, i) => (
              <div key={i} style={{ borderRadius: 16, overflow: "hidden", background: C.primarySoft }}>
                <div style={{ display: "flex" }}>
                  <div style={{ width: 4, flexShrink: 0, background: C.primary }} />
                  <div style={{ flex: 1, padding: "14px" }}>
                    <p style={{ fontSize: 10, fontWeight: 600, color: C.primary, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>{p.prompt}</p>
                    {p.answer && <p style={{ fontSize: 16, fontWeight: 600, color: C.text, marginBottom: p.voice?.url ? 10 : 0 }}>{p.answer}</p>}
                    {p.voice?.url && <AudioPlayer src={p.voice.url} duration={p.voice.duration} compact />}
                  </div>
                </div>
              </div>
            ))}
            {viewProfile.interests?.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: "8px 0" }}>
                {viewProfile.interests.map((v) => (
                  <span key={v} style={{ fontSize: 12, fontWeight: 600, padding: "6px 12px", borderRadius: 9999, background: C.surface, color: C.sub }}>{v}</span>
                ))}
              </div>
            )}
          </div>
          {(() => {
            const like = likesWithProfiles.find((lk) => lk.profile?.id === viewProfile.id);
            if (!like) return null;
            return (
              <div style={{ position: "sticky", bottom: 0, display: "flex", gap: 10, padding: "12px 16px calc(env(safe-area-inset-bottom, 0px) + 16px)", background: C.bg, borderTop: `1px solid ${C.border}` }}>
                <button onClick={() => { handleDismiss(like); setViewProfile(null); }} style={{ flex: 1, padding: 14, borderRadius: 14, border: `1px solid ${C.border}`, background: C.bg, color: C.text, fontSize: 15, fontWeight: 600, fontFamily: FONT, cursor: "pointer" }}>Not for me</button>
                <button onClick={() => { handleLikeBack(like); setViewProfile(null); }} style={{ flex: 2, padding: 14, borderRadius: 14, border: "none", background: C.primary, color: "#fff", fontSize: 15, fontWeight: 700, fontFamily: FONT, cursor: "pointer" }}>Like back</button>
              </div>
            );
          })()}
        </div>
      )}

      <style>{`
        @keyframes heartPop {
          0% { transform: scale(0); opacity: 1; }
          50% { transform: scale(1.3); opacity: 1; }
          100% { transform: scale(1); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
