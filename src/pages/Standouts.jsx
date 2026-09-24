import { useState, useMemo, useRef, useEffect } from "react";
import { useApp } from "../context/AppContext";
import { Heart, X, MessageCircle, Ban, Flag, Star } from "lucide-react";
import AgapeCross from "../components/AgapeCross";
import DoveIcon from "../components/DoveIcon";
import ReliabilityBadge from "../components/ReliabilityBadge";
import WaveformBar from "../components/WaveformBar";
import AudioPlayer from "../components/AudioPlayer";
import ReportSheet from "../components/ReportSheet";
import { getDovesRemaining, recordDove } from "../services/limits";
import { track } from "../services/posthog";

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const C = { bg: "#FFFFFF", card: "#FAFAF8", surface: "#F4F2EE", primary: "#B8912A", primarySoft: "#FBF5E6", text: "#1A1612", sub: "#8C857C", border: "#E8E4DF", sent: "#111111" };
const FONT = "'Outfit', system-ui, sans-serif";

export default function Standouts() {
  const { state, dispatch, actions } = useApp();
  const [idx, setIdx] = useState(0);
  const [photoIdx, setPhotoIdx] = useState(0);
  const [likeFlash, setLikeFlash] = useState(null);
  const [likeError, setLikeError] = useState("");
  const [likeChoice, setLikeChoice] = useState(null);
  const [commentTarget, setCommentTarget] = useState(null);
  const [commentText, setCommentText] = useState("");
  const [cardEnter, setCardEnter] = useState(true);
  const [showReport, setShowReport] = useState(false);
  const [localLikes, setLocalLikes] = useState(new Set());
  const cardRef = useRef(null);

  const userLat = state.currentUser?.location?.lat;
  const userLng = state.currentUser?.location?.lng;
  const filters = state.filters;

  const now = new Date();
  const isWednesday = now.getDay() === 3;
  const weekKey = `${now.getFullYear()}-W${Math.ceil(((now - new Date(now.getFullYear(),0,1)) / 86400000 + new Date(now.getFullYear(),0,1).getDay() + 1) / 7)}`;

  const [doveSentData, setDoveSentData] = useState(() => {
    try {
      const raw = localStorage.getItem("agape_dove_sent");
      if (raw) {
        const data = JSON.parse(raw);
        if (data.weekKey === weekKey) return data;
      }
    } catch {}
    return null;
  });

  const weeklyPick = useMemo(() => {
    const matching = state.profiles.filter((p) => {
      if (state.likes.some((l) => l.profileId === p.id)) return false;
      if (localLikes.has(p.id)) return false;
      if (p.id === "current_user") return false;
      if (state.blocked.some((b) => (b.id || b) === p.id)) return false;
      if (p.age < filters.minAge || p.age > filters.maxAge) return false;
      if (filters.denominations.length > 0 && !filters.denominations.includes(p.denomination)) return false;
      for (const [key, wanted] of Object.entries(filters.details || {})) {
        if (wanted.length > 0 && !wanted.includes(p.details?.[key])) return false;
      }
      if (userLat && userLng && p.lat && p.lng) {
        const dist = haversine(userLat, userLng, p.lat, p.lng);
        if (dist > filters.maxDistance) return false;
      }
      return true;
    });
    // Prefer standout profiles, but with a small pool fall back to anyone who fits the filters
    const standouts = matching.filter((p) => p.isStandout);
    const eligible = standouts.length ? standouts : matching;
    if (eligible.length === 0) return null;
    const seed = weekKey + (state.currentUser?.id || "");
    let hash = 0;
    for (let i = 0; i < seed.length; i++) hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
    return eligible[Math.abs(hash) % eligible.length];
  }, [state.profiles, state.likes, state.blocked, localLikes, filters, userLat, userLng, weekKey, state.currentUser?.id]);

  const profile = isWednesday ? weeklyPick : null;

  useEffect(() => {
    setCardEnter(true);
    setPhotoIdx(0);
    const t = setTimeout(() => setCardEnter(false), 400);
    return () => clearTimeout(t);
  }, [idx]);

  // Hooks must come before any early return
  const isPremium = state.currentUser?.subscriptionStatus === "active";
  const [standoutLikesLeft, setStandoutLikesLeft] = useState(getDovesRemaining(isPremium));
  useEffect(() => {
    setStandoutLikesLeft(getDovesRemaining(isPremium));
  }, [isPremium]);

  if (doveSentData) {
    const nextWed = new Date(now);
    nextWed.setDate(now.getDate() + ((3 - now.getDay() + 7) % 7 || 7));
    const dayName = nextWed.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
    const diff = nextWed - now;
    const daysLeft = Math.floor(diff / 86400000);
    const hoursLeft = Math.floor((diff % 86400000) / 3600000);
    return (
      <div className="discover-empty" style={{ background: C.surface }}>
        <DoveIcon size={64} color={C.primary} strokeWidth={1.2} />
        <h2 style={{ fontFamily: FONT, fontSize: 22, fontWeight: 700, color: C.text }}>Your Dove has been sent!</h2>
        <p style={{ color: C.sub, fontSize: 14, lineHeight: 1.5 }}>
          {doveSentData.name} will see your Dove. Good things take time.
        </p>
        <div style={{ background: C.primarySoft, borderRadius: 16, padding: "16px 24px", marginTop: 16 }}>
          <p style={{ color: C.sub, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>Next Chosen pick</p>
          <p style={{ color: C.text, fontSize: 20, fontWeight: 700, fontFamily: FONT }}>{dayName}</p>
          <p style={{ color: C.primary, fontSize: 13, fontWeight: 600, fontFamily: FONT, marginTop: 4 }}>
            {daysLeft > 0 ? `${daysLeft}d ${hoursLeft}h remaining` : `${hoursLeft}h remaining`}
          </p>
        </div>
        <p style={{ color: C.sub, fontSize: 12, marginTop: 16 }}>Every Wednesday you receive a handpicked match</p>
      </div>
    );
  }

  if (!profile) {
    const nextWed = new Date(now);
    nextWed.setDate(now.getDate() + ((3 - now.getDay() + 7) % 7 || 7));
    const dayName = nextWed.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", padding: "60px 20px", textAlign: "center" }}>
        <Star size={48} strokeWidth={1.4} color={C.primary} style={{ marginBottom: 16 }} />
        <h2 style={{ color: C.text, fontFamily: FONT, fontSize: 20, fontWeight: 700 }}>{isWednesday ? "No pick this week" : "Your next pick arrives Wednesday"}</h2>
        <p style={{ color: C.sub, fontSize: 14, marginTop: 4 }}>
          {isWednesday
            ? "Nobody new matches your filters right now. Widen your age range or distance in Seek and check back — the next pick comes next Wednesday."
            : `Every Wednesday you get 1 handpicked profile chosen just for you. Come back ${dayName}.`}
        </p>
      </div>
    );
  }

  const photos = profile.photos || [];
  const prompts = (profile.prompts || []).filter((p) => p.prompt && (p.answer || p.voice?.url));

  const handleLike = async (targetType, targetIndex, comment = null) => {
    if (standoutLikesLeft <= 0) return;
    const flashType = comment ? "comment" : "dove";
    const likedId = profile.id;
    setCommentTarget(null);
    setCommentText("");
    setLikeFlash(flashType);
    recordDove();
    setStandoutLikesLeft(getDovesRemaining(isPremium));

    const doveData = { weekKey, photo: photos[0], name: profile.name, sentAt: Date.now() };
    try { localStorage.setItem("agape_dove_sent", JSON.stringify(doveData)); } catch {}

    setTimeout(async () => {
      setDoveSentData(doveData);
      try {
        await actions.likeProfile(likedId, targetType, targetIndex, comment, true);
        setLikeFlash(null);
      } catch (err) {
        console.error("Like failed:", err);
        setLikeFlash(null);
        setDoveSentData(null);
        try { localStorage.removeItem("agape_dove_sent"); } catch {}
        setLikeError("Your Dove didn't go through — please try again");
        setTimeout(() => setLikeError(""), 4000);
      }
    }, 500);
  };

  const handleSkip = () => {
    track("chosen_skipped");
    setPhotoIdx(0);
    setLikeChoice(null);
    setCommentTarget(null);
    setCommentText("");
    setLocalLikes((prev) => new Set(prev).add(profile.id));
    actions.skipProfile(profile.id).catch(() => {});
  };

  const handleBlock = () => {
    track("profile_blocked", { source: "chosen" });
    setLikeFlash("block");
    setTimeout(() => {
      setLikeFlash(null);
      dispatch({ type: "BLOCK_PROFILE", payload: { id: profile.id, name: profile.name, photo: profile.photos?.[0] } });
      actions.skipProfile(profile.id).catch(() => {});
    }, 1200);
  };

  const handleReport = (reason) => {
    track("profile_reported", { source: "chosen", reason });
    setLikeFlash("report");
    setTimeout(() => {
      setLikeFlash(null);
      dispatch({ type: "BLOCK_PROFILE", payload: { id: profile.id, name: profile.name, photo: profile.photos?.[0] } });
      dispatch({ type: "ADD_REPORT", payload: { profileId: profile.id, name: profile.name, photo: profile.photos?.[0], reason, timestamp: Date.now() } });
      actions.skipProfile(profile.id).catch(() => {});
    }, 1200);
  };

  const onDovePress = (type, index) => {
    track("dove_options_opened", { targetType: type });
    setLikeChoice({ type, index });
  };

  const onSendDove = () => {
    track("dove_sent");
    handleLike(likeChoice.type, likeChoice.index);
    setLikeChoice(null);
  };

  const onAddComment = () => {
    track("dove_comment_modal_opened");
    setCommentTarget(likeChoice);
    setLikeChoice(null);
  };

  const handleComment = () => {
    if (commentText.trim()) {
      track("dove_comment_sent");
      handleLike(commentTarget.type, commentTarget.index, commentText.trim());
    }
  };

  return (
    <div className="discover">
      {likeError && (
        <div style={{ position: "fixed", top: "max(16px, env(safe-area-inset-top, 16px))", left: "50%", transform: "translateX(-50%)", zIndex: 300, background: "#1A1612", color: "#F5F0E8", padding: "10px 16px", borderRadius: 999, fontSize: 13, fontWeight: 600, fontFamily: FONT, boxShadow: "0 4px 16px rgba(0,0,0,0.25)", whiteSpace: "nowrap" }}>
          {likeError}
        </div>
      )}
      {likeFlash && (
        <div className={`like-flash-overlay ${likeFlash}`}>
          <span className="flash-emoji">
            {likeFlash === "comment" ? <MessageCircle size={120} strokeWidth={1.4} color={C.primary} /> : likeFlash === "block" ? <Ban size={120} strokeWidth={1.4} color="#EF4444" /> : likeFlash === "report" ? <Flag size={120} strokeWidth={1.4} color="#EF4444" /> : <DoveIcon size={120} color={C.primary} strokeWidth={1.2} />}
          </span>
        </div>
      )}

      <div className={`profile-card ${cardEnter ? "enter" : ""}`} ref={cardRef}>
        {/* Hero photo */}
        <div className="hero-section">
          <div className="hero-photo-block">
            <img
              src={photos[photoIdx] || photos[0]}
              alt={`${profile.name}'s photo`}
              className="hero-photo"
              onError={(e) => {
                e.target.src = `https://ui-avatars.com/api/?name=${profile.name}&size=400&background=random`;
              }}
            />

            {/* Top gradient */}
            <div className="hero-top-gradient" />

            {/* Photo progress bars */}
            {photos.length > 1 && (
              <div className="photo-indicators">
                {photos.map((_, i) => (
                  <div
                    key={i}
                    className={`photo-indicator ${i === photoIdx ? "active" : ""}`}
                    onClick={() => setPhotoIdx(i)}
                  />
                ))}
              </div>
            )}

            {/* CHOSEN FOR YOU badge */}
            <div className="chosen-badge">
              <span style={{ fontSize: 11 }}>✦</span>
              <span>CHOSEN FOR YOU</span>
            </div>

            {/* Shield icon */}
            <div className="photo-overlay-icons">
              <button className="photo-overlay-btn" onClick={() => setShowReport(true)}>
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5}>
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              </button>
            </div>

            {/* Tap zones for photo navigation */}
            <div className="hero-tap-zones">
              <div className="hero-tap-zone" onClick={() => setPhotoIdx((p) => Math.max(0, p - 1))} />
              <div className="hero-tap-zone" onClick={() => setPhotoIdx((p) => Math.min(photos.length - 1, p + 1))} />
            </div>

            {/* Bottom gradient */}
            <div className="hero-gradient" />

            {/* Identity block */}
            <div className="id-block">
              <div className="id-info">
                <div className="id-line1">
                  <span className="id-name">{profile.name},</span>
                  <span className="id-age">{profile.age}</span>
                  <svg className="id-verified" width={15} height={15} viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" fill="#B8912A" />
                    <path d="M9 12l2 2 4-4" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
                  </svg>
                </div>
                <div className="id-line2">
                  {profile.location && (
                    <span className="id-detail">
                      <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                        <circle cx="12" cy="10" r="3" />
                      </svg>
                      {profile.location}
                    </span>
                  )}
                  {profile.location && profile.denomination && <span className="id-dot">·</span>}
                  {profile.denomination && (
                    <span className="id-detail">✝ {profile.denomination}</span>
                  )}
                  {profile.reliability?.dates > 0 && <span className="id-dot">·</span>}
                  {profile.reliability?.dates > 0 && <ReliabilityBadge reliability={profile.reliability} light />}
                </div>
              </div>
              <div className="id-actions">
                <button className="id-btn id-skip" onClick={handleSkip}>
                  <X size={17} />
                </button>
                <button className="id-btn id-heart" onClick={() => onDovePress("profile", 0)}>
                  <DoveIcon size={18} strokeWidth={2} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Prompts sheet */}
        <div className="prompts-sheet">
          {/* Why they were chosen */}
          {profile.compatibilityReason && (
            <div className="hinge-prompt-card">
              <div className="hinge-prompt-inner">
                <div className="hinge-prompt-accent" />
                <div className="hinge-prompt-content">
                  <div className="hinge-prompt-label">✦ Why they were chosen</div>
                  <div className="hinge-prompt-answer">{profile.compatibilityReason}</div>
                </div>
              </div>
            </div>
          )}

          {prompts.map((p, i) => (
            <div key={`prompt-${i}`} className="hinge-prompt-card">
              <div className="hinge-prompt-inner">
                <div className="hinge-prompt-accent" />
                <div className="hinge-prompt-content">
                  <div className="hinge-prompt-label">{p.prompt}</div>
                  {p.answer && <div className="hinge-prompt-answer" style={{ marginBottom: p.voice?.url ? 10 : 0 }}>{p.answer}</div>}
                  {p.voice?.url ? (
                    <AudioPlayer src={p.voice.url} duration={p.voice.duration} />
                  ) : p.voice && !p.answer ? (
                    <WaveformBar duration={p.voice.duration} color="#8C857C" />
                  ) : null}
                </div>
                <div className="prompt-side-actions">
                  <button className="mini-btn prompt-skip" onClick={handleSkip}>
                    <X size={13} />
                  </button>
                  <button className="mini-btn prompt-heart" onClick={() => onDovePress("prompt", i)}>
                    <DoveIcon size={14} strokeWidth={2} />
                  </button>
                </div>
              </div>
            </div>
          ))}

          {/* Interests */}
          {profile.interests?.length > 0 && (
            <div className="profile-interests-section">
              <div className="interests-label">Interests</div>
              <div className="interests-wrap">
                {profile.interests.map((interest) => (
                  <span key={interest} className="interest-chip">{interest}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {likeChoice && (
        <div className="like-choice-overlay" onClick={() => setLikeChoice(null)}>
          <div className="like-choice-sheet" onClick={(e) => e.stopPropagation()}>
            <button className="like-choice-btn dove-choice" onClick={onSendDove}>
              <DoveIcon size={20} strokeWidth={2} />
              <span>Send Dove</span>
            </button>
            <button className="like-choice-btn comment-choice" onClick={onAddComment}>
              <MessageCircle size={18} />
              <span>Add a Comment</span>
            </button>
          </div>
        </div>
      )}

      {/* Comment modal */}
      {commentTarget && (
        <div className="comment-modal-overlay" onClick={() => { setCommentTarget(null); setCommentText(""); }}>
          <div className="comment-modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, fontSize: 13, color: "#B8912A", fontWeight: 600 }}>
              <DoveIcon size={18} strokeWidth={2} />
              Sending with a Dove
            </div>
            <h3>
              {commentTarget.type === "prompt"
                ? profile.prompts[commentTarget.index]?.prompt
                : `Say something to ${profile.name}...`}
            </h3>
            <p className="comment-hint">Commenting has a 3x higher chance for a match than just liking</p>
            <textarea
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Add a comment..."
              maxLength={300}
              autoFocus
              rows={3}
            />
            <button
              className="send-comment-btn"
              onClick={handleComment}
              disabled={!commentText.trim()}
            >
              Send Dove with Comment
            </button>
          </div>
        </div>
      )}

      {showReport && (
        <ReportSheet
          profileName={profile.name}
          onReport={handleReport}
          onBlock={handleBlock}
          onClose={() => setShowReport(false)}
        />
      )}
    </div>
  );
}
