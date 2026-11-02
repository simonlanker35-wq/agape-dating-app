import { useApp } from "../context/AppContext";
import { pressable } from "../utils/a11y";
import { useState, useEffect, useRef } from "react";
import { Lock, UserPlus, Eye } from "lucide-react";
import Pip from "../components/Pip";
import AudioPlayer from "../components/AudioPlayer";
import VerifiedBadge from "../components/VerifiedBadge";
import CompatibilityRing from "../components/CompatibilityRing";
import DoveIcon from "../components/DoveIcon";
import ReliabilityBadge from "../components/ReliabilityBadge";
import HighlightPicker, { HighlightList } from "../components/HighlightPicker";
import { highlightsNeeded, HIGHLIGHTS_MAX } from "../utils/highlights";
import { getRevealsRemaining, recordReveal } from "../services/limits";
import * as api from "../services/api";
import { track } from "../services/posthog";
import PhotoCarousel from "../components/PhotoCarousel";

const C = { bg: "#FFFFFF", card: "#FAFAF8", surface: "#F4F2EE", primary: "#B8912A", primarySoft: "#FBF5E6", text: "#1A1612", sub: "#8C857C", border: "#E8E4DF" };
const FONT = "'Outfit', system-ui, sans-serif";
const SERIF = "'Lora', Georgia, serif";

function when(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

const targetName = (t) => (t === "prompt" ? "answer" : t === "photo" ? "photo" : "profile");

export default function LikesYou() {
  const { state, actions, dispatch } = useApp();
  const [likedBack, setLikedBack] = useState(new Set());
  const [dismissed, setDismissed] = useState(new Set());
  const [openLike, setOpenLike] = useState(null);
  const isPremium = state.currentUser?.subscriptionStatus === "active";
  // Friends side: waves are never hidden, there is nothing to reveal or pick
  const friends = state.mode === "friends";
  const [revealsLeft, setRevealsLeft] = useState(getRevealsRemaining(isPremium));
  // Revealed likes are remembered per account, so a reveal is not lost on reload
  const revealKey = `agape_revealed_${state.currentUser?.id || "anon"}`;
  const [revealedIds, setRevealedIds] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem(revealKey) || "[]")); } catch (_) { return new Set(); }
  });

  useEffect(() => {
    setRevealsLeft(getRevealsRemaining(isPremium));
  }, [isPremium, state.usage]);

  const allLikes = state.likesReceived.filter(
    (l) => l.profile && !dismissed.has(l.id) && !likedBack.has(l.id)
  );
  // Doves first, then newest first
  const likes = [...allLikes.filter((l) => l.isDove), ...allLikes.filter((l) => !l.isDove)];

  const [likeError, setLikeError] = useState("");
  const handleLikeBack = async (like, highlights = []) => {
    track("sparks_like_back", { isDove: !!like.isDove, highlights: highlights.length });
    setLikedBack((prev) => new Set(prev).add(like.id));
    try {
      await actions.matchFromLike(like, highlights);
    } catch (err) {
      console.error("Match failed:", err);
      setLikedBack((prev) => { const n = new Set(prev); n.delete(like.id); return n; });
      // Say what went wrong instead of quietly putting the row back
      setLikeError(err?.message || "That didn't go through. Please try again.");
      setTimeout(() => setLikeError(""), 6000);
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

  const handleReveal = async (like) => {
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

  if (likes.length === 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", padding: "60px 20px", textAlign: "center" }}>
        <Pip pose="love" size={160} float style={{ marginBottom: 12 }} />
        <h2 style={{ color: C.text, fontFamily: FONT, fontSize: 20, fontWeight: 700 }}>{friends ? "No new waves" : "No new likes"}</h2>
        <p style={{ color: C.sub, fontSize: 14, marginTop: 4 }}>{friends ? "Keep exploring! When someone waves at you, they'll appear here." : "Keep exploring! When someone likes you, they'll appear here."}</p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: C.bg }}>
      {likeError && (
        <div style={{ position: "fixed", top: "max(56px, calc(env(safe-area-inset-top, 0px) + 52px))", left: "50%", transform: "translateX(-50%)", zIndex: 400, background: "#1A1612", color: "#F5F0E8", padding: "10px 16px", borderRadius: 12, fontSize: 13.5, fontFamily: FONT, maxWidth: 340, textAlign: "center" }}>
          {likeError}
        </div>
      )}
      <div style={{ padding: "max(64px, calc(env(safe-area-inset-top, 0px) + 60px)) 20px 8px" }}>
        <h1 style={{ color: C.text, fontFamily: FONT, fontSize: 24, fontWeight: 700, letterSpacing: "-0.4px", margin: 0 }}>{friends ? "Waves" : "Sparks"}</h1>
        <p style={{ color: C.sub, fontSize: 13, marginTop: 4 }}>
          {likes.length} {likes.length === 1 ? "person" : "people"} {friends ? "waved at you" : "liked you"}
          {!friends && " · open one to answer"}
        </p>
        {!isPremium && !friends && (
          <p style={{ color: C.primary, fontSize: 12, fontWeight: 600, marginTop: 6, fontFamily: FONT, lineHeight: 1.4 }}>
            Your first 10 reveals are free, then one a week. With Agape+ you see everyone right away.
          </p>
        )}
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "0 0 24px" }}>
        {likes.map((like) => {
          const profile = like.profile;
          const isLocked = !(friends || like.isDove || like.revealed || revealedIds.has(like.id) || isPremium);
          const open = () => { track("sparks_profile_viewed"); setOpenLike(like); };
          const preview = like.comment
            ? `“${like.comment}”`
            : friends ? "Waved at you" : like.isDove ? "Sent you a Dove" : `Liked your ${targetName(like.targetType)}`;

          return (
            <div key={like.id} {...(isLocked ? {} : pressable(open))}
              style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 20px", cursor: isLocked ? "default" : "pointer", borderBottom: `1px solid ${C.surface}`, background: like.isDove && !isLocked ? C.primarySoft : C.bg }}>
              <div style={{ position: "relative", width: 56, height: 56, flexShrink: 0 }}>
                <div style={{ width: 56, height: 56, borderRadius: "50%", overflow: "hidden", background: "linear-gradient(135deg, #EFE9DB 0%, #D9CFBE 60%, #C9BBA2 100%)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {isLocked ? (
                    <Lock size={20} strokeWidth={1.9} color="#fff" />
                  ) : (
                    <img src={profile.photos?.[0]} alt="" aria-hidden="true"
                      style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 20%", display: "block", filter: friends ? "none" : "blur(7px)", transform: friends ? "none" : "scale(1.25)" }}
                      onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} />
                  )}
                </div>
                {like.isDove && !isLocked && (
                  <span style={{ position: "absolute", right: -2, bottom: -2, width: 22, height: 22, borderRadius: 11, background: C.primary, border: "2px solid #fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <DoveIcon size={11} color="white" strokeWidth={2.2} />
                  </span>
                )}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
                  <span style={{ fontFamily: SERIF, fontSize: 18, fontWeight: 600, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 5 }}>
                    {isLocked ? "Someone likes you" : `${profile.name}, ${profile.age}`}
                    {!isLocked && profile.isVerified && <VerifiedBadge size={16} />}
                  </span>
                  <span style={{ fontSize: 11, color: C.sub, fontFamily: FONT, flexShrink: 0 }}>{when(like.timestamp)}</span>
                </div>
                {isLocked ? (
                  <div style={{ marginTop: 6 }}>
                    {revealsLeft > 0 ? (
                      <button onClick={() => handleReveal(like)} style={{ padding: "6px 14px", borderRadius: 10, fontSize: 12, fontWeight: 700, fontFamily: FONT, background: C.primary, color: "white", border: "none", cursor: "pointer" }}>
                        Reveal ({revealsLeft} left)
                      </button>
                    ) : (
                      <button onClick={() => { track("upgrade_tapped", { source: "sparks_locked" }); dispatch({ type: "SET_TAB", payload: "profile" }); }}
                        style={{ padding: "6px 14px", borderRadius: 10, fontSize: 12, fontWeight: 700, fontFamily: FONT, background: C.primarySoft, color: C.primary, border: `1px solid #EFE3C4`, cursor: "pointer" }}>
                        Get Agape+ to see all
                      </button>
                    )}
                  </div>
                ) : (
                  <p style={{ fontSize: 14, color: C.sub, fontFamily: FONT, margin: "3px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontStyle: like.comment ? "italic" : "normal" }}>{preview}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {openLike && (
        <SparkView
          like={openLike}
          friends={friends}
          onClose={() => setOpenLike(null)}
          onDecline={() => { handleDismiss(openLike); setOpenLike(null); }}
          onAccept={(picks) => { handleLikeBack(openLike, picks); setOpenLike(null); }}
        />
      )}
    </div>
  );
}

// One Spark opened: their photos stay blurred until you've picked what you like about them,
// then you accept (with your picks) or decline. Waves on the friends side skip the picking.
function SparkView({ like, friends, onClose, onDecline, onAccept }) {
  const profile = like.profile;
  const [picks, setPicks] = useState([]);
  const pickerRef = useRef(null);
  const needed = friends ? 0 : highlightsNeeded(profile);
  const ready = picks.length >= needed;
  const prompts = (profile.prompts || []).filter((p) => p.prompt && (p.answer || p.voice?.url));

  return (
    <div role="dialog" aria-label={profile.name} style={{ position: "fixed", inset: 0, maxWidth: 430, margin: "0 auto", zIndex: 300, background: C.bg, display: "flex", flexDirection: "column", fontFamily: FONT }}>
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
        <PhotoCarousel photos={profile.photos} name={profile.name} maxHeight="56vh" blurred={!ready}>
          <button aria-label="Close" onClick={onClose} style={{ zIndex: 3, position: "absolute", top: "max(40px, calc(env(safe-area-inset-top, 0px) + 28px))", left: 16, width: 36, height: 36, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.4)", backdropFilter: "blur(10px)", border: "none", cursor: "pointer" }}>
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5}><polyline points="15 18 9 12 15 6" /></svg>
          </button>
          {!ready && (
            <button onClick={() => pickerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
              style={{ position: "absolute", zIndex: 3, top: "42%", left: "50%", transform: "translate(-50%, -50%)", display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 16px", borderRadius: 9999, border: "1px solid rgba(255,255,255,0.35)", background: "rgba(0,0,0,0.45)", backdropFilter: "blur(6px)", color: "#fff", fontSize: 13.5, fontWeight: 600, fontFamily: FONT, cursor: "pointer", whiteSpace: "nowrap" }}>
              <Eye size={16} /> Pick {needed} things you like to see {profile.name}
            </button>
          )}
          <div style={{ position: "absolute", zIndex: 2, bottom: 18, left: 16, right: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ color: "white", fontSize: 28, fontWeight: 600, fontFamily: SERIF }}>{profile.name}</span>
              <span style={{ color: "rgba(255,255,255,0.8)", fontSize: 22, fontWeight: 300 }}>{profile.age}</span>
              {profile.isVerified && <VerifiedBadge size={20} label />}
              {!friends && <CompatibilityRing profile={profile} size={44} light style={{ marginLeft: "auto" }} />}
            </div>
            <p style={{ color: "rgba(255,255,255,0.75)", fontSize: 12, marginTop: 4 }}>{profile.denomination}{profile.location ? ` · ${profile.location}` : ""}</p>
            {profile.reliability?.dates > 0 && <div style={{ marginTop: 8 }}><ReliabilityBadge reliability={profile.reliability} light /></div>}
          </div>
        </PhotoCarousel>

        <div style={{ padding: "18px 16px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
          {/* What they sent: their comment and what they like about you */}
          {(like.comment || like.highlights?.length > 0 || like.isDove) && (
            <div style={{ borderRadius: 18, padding: 16, background: C.primarySoft, border: "1px solid #EFE3C4", display: "flex", flexDirection: "column", gap: 12 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: C.primary, margin: 0, display: "flex", alignItems: "center", gap: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {like.isDove && <DoveIcon size={14} strokeWidth={2.2} color={C.primary} />}
                {friends ? `${profile.name} waved at you` : `${profile.name} ${like.isDove ? "sent you a Dove" : `liked your ${targetName(like.targetType)}`}`}
              </p>
              {like.comment && <p style={{ fontSize: 17, fontFamily: SERIF, color: C.text, lineHeight: 1.45, margin: 0 }}>“{like.comment}”</p>}
              <HighlightList title={`What ${profile.name} likes about you`} items={like.highlights} />
            </div>
          )}

          {prompts.map((p, i) => (
            <div key={i} style={{ borderRadius: 16, overflow: "hidden", background: C.card, border: `1px solid ${C.border}` }}>
              <div style={{ padding: 14 }}>
                <p style={{ fontSize: 10, fontWeight: 600, color: C.primary, textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 8px" }}>{p.prompt}</p>
                {p.answer && <p style={{ fontSize: 16, fontWeight: 600, color: C.text, margin: p.voice?.url ? "0 0 10px" : 0 }}>{p.answer}</p>}
                {p.voice?.url && <AudioPlayer src={p.voice.url} duration={p.voice.duration} compact />}
              </div>
            </div>
          ))}

          {friends ? (
            profile.interests?.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: "4px 0" }}>
                {profile.interests.map((v) => (
                  <span key={v} style={{ fontSize: 12, fontWeight: 600, padding: "6px 12px", borderRadius: 9999, background: C.surface, color: C.sub }}>{v}</span>
                ))}
              </div>
            )
          ) : (
            <div ref={pickerRef} style={{ scrollMarginTop: 16, borderRadius: 18, padding: 16, border: `1.5px solid ${ready ? C.border : C.primary}` }}>
              <p style={{ fontFamily: SERIF, fontSize: 19, fontWeight: 600, color: C.text, margin: "0 0 4px" }}>What do you like about {profile.name}?</p>
              <p style={{ fontSize: 13, color: C.sub, margin: "0 0 14px", lineHeight: 1.45 }}>
                Pick {needed === HIGHLIGHTS_MAX ? needed : `${needed} to ${HIGHLIGHTS_MAX}`}. Their photos clear once you've picked {needed}, and {profile.name} sees what you chose if you like back.
              </p>
              <HighlightPicker profile={profile} selected={picks} onChange={setPicks} />
            </div>
          )}
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, padding: "12px 16px max(16px, env(safe-area-inset-bottom, 16px))", background: C.bg, borderTop: `1px solid ${C.border}` }}>
        <button onClick={onDecline} style={{ flex: 1, padding: 14, borderRadius: 14, border: `1px solid ${C.border}`, background: C.bg, color: C.text, fontSize: 15, fontWeight: 600, fontFamily: FONT, cursor: "pointer" }}>Not for me</button>
        <button onClick={() => ready && onAccept(picks)} disabled={!ready}
          style={{ flex: 2, padding: 14, borderRadius: 14, border: "none", background: ready ? C.primary : C.border, color: "#fff", fontSize: 15, fontWeight: 700, fontFamily: FONT, cursor: ready ? "pointer" : "default", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          {friends && <UserPlus size={17} strokeWidth={2.3} />}
          {ready ? (friends ? "Wave back" : "Like back") : `Pick ${needed - picks.length} more`}
        </button>
      </div>
    </div>
  );
}
