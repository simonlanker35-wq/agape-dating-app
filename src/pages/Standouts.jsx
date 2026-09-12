import { useState, useMemo, useRef, useEffect } from "react";
import { useApp } from "../context/AppContext";
import { Heart, X, MessageCircle } from "lucide-react";
import AgapeCross from "../components/AgapeCross";
import WaveformBar from "../components/WaveformBar";
import ReportSheet from "../components/ReportSheet";

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

export default function Standouts() {
  const { state, dispatch, actions } = useApp();
  const [idx, setIdx] = useState(0);
  const [photoIdx, setPhotoIdx] = useState(0);
  const [likeFlash, setLikeFlash] = useState(null);
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

  const standoutProfiles = useMemo(() => {
    return state.profiles.filter((p) => {
      if (!p.isStandout) return false;
      if (state.likes.some((l) => l.profileId === p.id)) return false;
      if (localLikes.has(p.id)) return false;
      if (p.id === "current_user") return false;
      if (state.blocked.includes(p.id)) return false;
      if (p.age < filters.minAge || p.age > filters.maxAge) return false;
      if (filters.denominations.length > 0 && !filters.denominations.includes(p.denomination)) return false;
      if (userLat && userLng && p.lat && p.lng) {
        const dist = haversine(userLat, userLng, p.lat, p.lng);
        if (dist > filters.maxDistance) return false;
      }
      return true;
    });
  }, [state.profiles, state.likes, state.blocked, localLikes, filters, userLat, userLng]);

  const profile = standoutProfiles[idx];

  useEffect(() => {
    if (idx >= standoutProfiles.length && standoutProfiles.length > 0) {
      setIdx(0);
    }
  }, [standoutProfiles.length, idx]);

  useEffect(() => {
    setCardEnter(true);
    setPhotoIdx(0);
    const t = setTimeout(() => setCardEnter(false), 400);
    return () => clearTimeout(t);
  }, [idx]);

  if (!profile || standoutProfiles.length === 0) {
    return (
      <div className="discover-empty">
        <span style={{ fontSize: 48 }}>⭐</span>
        <h2>No standouts right now</h2>
        <p>Check back later for top picks.</p>
      </div>
    );
  }

  const photos = profile.photos || [];
  const prompts = (profile.prompts || []).filter((p) => p.prompt && p.answer);

  const handleLike = async (targetType, targetIndex, comment = null) => {
    const flashType = comment ? "comment" : "dove";
    const likedId = profile.id;
    setCommentTarget(null);
    setCommentText("");
    setLikeFlash(flashType);

    setTimeout(async () => {
      setLocalLikes((prev) => new Set(prev).add(likedId));
      try {
        await actions.likeProfile(likedId, targetType, targetIndex, comment, true);
        setLikeFlash(null);
      } catch (err) {
        console.error("Like failed:", err);
        setLikeFlash(null);
      }
    }, 500);
  };

  const handleSkip = () => {
    setPhotoIdx(0);
    setLikeChoice(null);
    setCommentTarget(null);
    setCommentText("");
    setIdx((i) => (i + 1) % standoutProfiles.length);
  };

  const handleBlock = () => {
    dispatch({ type: "BLOCK_PROFILE", payload: profile.id });
    actions.skipProfile(profile.id).catch(() => {});
  };

  const handleReport = (reason) => {
    dispatch({ type: "BLOCK_PROFILE", payload: profile.id });
    dispatch({ type: "ADD_REPORT", payload: { profileId: profile.id, name: profile.name, reason, timestamp: Date.now() } });
    actions.skipProfile(profile.id).catch(() => {});
  };

  const onDovePress = (type, index) => {
    setLikeChoice({ type, index });
  };

  const onSendDove = () => {
    handleLike(likeChoice.type, likeChoice.index);
    setLikeChoice(null);
  };

  const onAddComment = () => {
    setCommentTarget(likeChoice);
    setLikeChoice(null);
  };

  const handleComment = () => {
    if (commentText.trim()) {
      handleLike(commentTarget.type, commentTarget.index, commentText.trim());
    }
  };

  return (
    <div className="discover">
      {likeFlash && (
        <div className={`like-flash-overlay ${likeFlash}`}>
          <span className="flash-emoji">
            {likeFlash === "comment" ? "💬" : "🕊️"}
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
                </div>
              </div>
              <div className="id-actions">
                <button className="id-btn id-skip" onClick={handleSkip}>
                  <X size={17} />
                </button>
                <button className="id-btn id-heart" onClick={() => onDovePress("profile", 0)}>
                  <span style={{ fontSize: 18, lineHeight: 1 }}>🕊️</span>
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
                  {p.voice ? (
                    <WaveformBar duration={p.voice.duration} color="#B8912A" />
                  ) : (
                    <div className="hinge-prompt-answer">{p.answer}</div>
                  )}
                </div>
                <div className="prompt-side-actions">
                  <button className="mini-btn prompt-skip" onClick={handleSkip}>
                    <X size={13} />
                  </button>
                  <button className="mini-btn prompt-heart" onClick={() => onDovePress("prompt", i)}>
                    <span style={{ fontSize: 14, lineHeight: 1 }}>🕊️</span>
                  </button>
                </div>
              </div>
            </div>
          ))}

          {/* Faith tag */}
          {profile.denomination && (
            <div className="faith-tag">
              <div className="faith-tag-icon">
                <AgapeCross size={11} strokeWidth={1.5} />
              </div>
              <div>
                <div className="faith-tag-label">{profile.denomination}</div>
                {profile.location && <div className="faith-tag-sub">{profile.location}</div>}
              </div>
            </div>
          )}

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
              <span style={{ fontSize: 20 }}>🕊️</span>
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
              <span style={{ fontSize: 18 }}>🕊️</span>
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
