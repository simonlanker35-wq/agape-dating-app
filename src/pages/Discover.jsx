import { useState, useRef, useEffect } from "react";
import { useApp } from "../context/AppContext";
import { Heart, X, MessageCircle, MapPin, Church } from "lucide-react";
import DoveIcon from "../components/DoveIcon";
import AgapeCross from "../components/AgapeCross";
import WaveformBar from "../components/WaveformBar";

export default function Discover() {
  const { state, dispatch, actions } = useApp();
  const [commentTarget, setCommentTarget] = useState(null);
  const [commentText, setCommentText] = useState("");
  const [showDove, setShowDove] = useState(false);
  const exitAnimation = null;
  const [likeFlash, setLikeFlash] = useState(null);
  const [matchCelebration, setMatchCelebration] = useState(null);
  const [cardEnter, setCardEnter] = useState(true);
  const [photoIdx, setPhotoIdx] = useState(0);
  const [likeChoice, setLikeChoice] = useState(null);
  const cardRef = useRef(null);

  const profile = state.profiles[state.currentProfileIndex];

  useEffect(() => {
    setCardEnter(true);
    setPhotoIdx(0);
    const t = setTimeout(() => setCardEnter(false), 400);
    return () => clearTimeout(t);
  }, [state.currentProfileIndex]);

  if (!profile) {
    return (
      <div className="discover-empty">
        <Heart size={48} />
        <h2>You've seen everyone!</h2>
        <p>Check back later for new profiles or adjust your filters.</p>
      </div>
    );
  }

  const handleLike = async (targetType, targetIndex, comment = null, isDove = false) => {
    const flashType = comment ? "comment" : isDove ? "dove" : "heart";
    setCommentTarget(null);
    setCommentText("");
    setShowDove(false);
    setLikeFlash(flashType);

    setTimeout(async () => {
      try {
        const res = await actions.likeProfile(profile.id, targetType, targetIndex, comment, isDove);
        setLikeFlash(null);

        if (res.matched) {
          setMatchCelebration(profile);
          setTimeout(() => setMatchCelebration(null), 3000);
        }
      } catch (err) {
        console.error("Like failed:", err);
        setLikeFlash(null);
      }
    }, 500);
  };

  const handleSkip = async () => {
    try {
      await actions.skipProfile(profile.id);
    } catch (err) {
      console.error("Skip failed:", err);
    }
  };

  const handleComment = () => {
    if (commentText.trim()) {
      handleLike(commentTarget.type, commentTarget.index, commentText.trim(), showDove);
    }
  };

  const onHeartPress = (type, index) => {
    setLikeChoice({ type, index });
  };

  const onSendHeart = () => {
    handleLike(likeChoice.type, likeChoice.index);
    setLikeChoice(null);
  };

  const onAddComment = () => {
    setCommentTarget(likeChoice);
    setLikeChoice(null);
  };

  const photos = profile.photos || [];
  const prompts = (profile.prompts || []).filter(p => p.prompt && p.answer);

  return (
    <div className="discover">
      {likeFlash && (
        <div className={`like-flash-overlay ${likeFlash}`}>
          <span className="flash-emoji">
            {likeFlash === "dove" ? "🕊️" : likeFlash === "comment" ? "💬" : "❤️"}
          </span>
        </div>
      )}
      <div className={`profile-card ${exitAnimation || ""} ${cardEnter ? "enter" : ""}`} ref={cardRef}>
        {/* Hero photo — full bleed with overlay */}
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

            {/* Photo progress dots */}
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

            {/* Shield + filter icons */}
            <div className="photo-overlay-icons">
              <button className="photo-overlay-btn">
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5}>
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              </button>
              <button className="photo-overlay-btn">
                <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2}>
                  <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                </svg>
              </button>
            </div>

            {/* Tap zones for photo navigation */}
            <div className="hero-tap-zones">
              <div className="hero-tap-zone" onClick={() => setPhotoIdx(p => Math.max(0, p - 1))} />
              <div className="hero-tap-zone" onClick={() => setPhotoIdx(p => Math.min(photos.length - 1, p + 1))} />
            </div>

            {/* Bottom gradient overlay — name + buttons ON photo */}
            <div className="hero-overlay">
              <div className="hero-name-row">
                <span className="hero-name">{profile.name}</span>
                <span className="hero-age">{profile.age}</span>
                <span className="verified-badge">
                  <svg width={16} height={16} viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" fill="#B8912A" />
                    <path d="M9 12l2 2 4-4" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
                  </svg>
                </span>
              </div>

              {/* Details + buttons on same row */}
              <div className="hero-bottom-row">
                <div className="hero-details-row">
                  {profile.location && (
                    <span className="hero-detail">
                      <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth={2}>
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                        <circle cx="12" cy="10" r="3" />
                      </svg>
                      <span>{profile.location}</span>
                    </span>
                  )}
                  {profile.location && profile.denomination && (
                    <span className="hero-sep">·</span>
                  )}
                  {profile.denomination && (
                    <span className="hero-detail">
                      <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 11 }}>✝</span>
                      <span>{profile.denomination}</span>
                    </span>
                  )}
                </div>
                <div className="hero-actions-mini">
                  <button className="mini-btn skip-mini" onClick={handleSkip}>
                    <X size={18} />
                  </button>
                  <button className="mini-btn heart-mini" onClick={() => onHeartPress("profile", 0)}>
                    <Heart size={18} fill="white" stroke="white" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Prompts — white sheet with rounded top overlapping photo */}
        <div className="prompts-sheet">
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
                  <div className="prompt-mini-actions">
                    <button className="mini-btn skip-mini prompt-skip" onClick={handleSkip}>
                      <X size={14} />
                    </button>
                    <button className="mini-btn heart-mini prompt-heart" onClick={() => onHeartPress("prompt", i)}>
                      <Heart size={14} fill="white" stroke="white" />
                    </button>
                  </div>
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
            <div className="like-choice-handle" />
            <button className="like-choice-btn heart-choice" onClick={onSendHeart}>
              <Heart size={20} fill="white" stroke="white" />
              <span>Send Heart</span>
            </button>
            <button className="like-choice-btn comment-choice" onClick={onAddComment}>
              <MessageCircle size={18} />
              <span>Add a Comment</span>
            </button>
          </div>
        </div>
      )}

      {commentTarget && (
        <div className="comment-modal-overlay" onClick={() => { setCommentTarget(null); setShowDove(false); }}>
          <div className="comment-modal" onClick={(e) => e.stopPropagation()}>
            {showDove && (
              <div className="dove-badge">
                <DoveIcon size={20} />
                Sending with a Dove
              </div>
            )}
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
              Send {showDove ? "Dove" : "Like"} with Comment
            </button>
          </div>
        </div>
      )}

      {matchCelebration && (
        <div className="match-celebration-overlay" onClick={() => setMatchCelebration(null)}>
          {/* Confetti */}
          <div className="match-confetti">
            {Array.from({ length: 28 }, (_, i) => {
              const colors = ["#B8912A", "#F5D878", "#E8C44A", "#ffffff", "#111111", "#D4AF37"];
              return (
                <div
                  key={i}
                  className="confetti-piece"
                  style={{
                    left: `${5 + ((i * 3.3) % 90)}%`,
                    width: i % 3 === 0 ? 8 : i % 3 === 1 ? 6 : 10,
                    height: i % 3 === 0 ? 8 : i % 3 === 1 ? 12 : 5,
                    background: colors[i % colors.length],
                    borderRadius: i % 4 === 0 ? "50%" : "2px",
                    "--spin": `${(i % 2 === 0 ? 1 : -1) * (180 + ((i * 37) % 360))}deg`,
                    "--dur": `${0.9 + ((i * 0.07) % 0.7)}s`,
                    "--delay": `${(i * 0.045) % 0.5}s`,
                  }}
                />
              );
            })}
          </div>

          <div className="match-reveal">
            <div className="match-cross">
              <AgapeCross size={22} strokeWidth={1.5} />
            </div>
            <div className="match-label">It's a Match</div>
            <h2 className="match-title shimmer-gold">You & {matchCelebration.name}</h2>
            <div className="match-subtitle">You both liked each other ✦</div>

            <div className="match-photos">
              <div className="pulse-ring">
                <img
                  src={state.user?.photos?.[0] || "/profile.jpg"}
                  alt="You"
                  onError={(e) => { e.target.src = `https://ui-avatars.com/api/?name=You&size=200&background=random`; }}
                />
              </div>
              <span className="match-sparkle">✦</span>
              <div className="pulse-ring">
                <img
                  src={matchCelebration.photos[0]}
                  alt={matchCelebration.name}
                  onError={(e) => { e.target.src = `https://ui-avatars.com/api/?name=${matchCelebration.name}&size=200&background=random`; }}
                />
              </div>
            </div>

            <button
              className="match-celebration-btn"
              onClick={(e) => {
                e.stopPropagation();
                setMatchCelebration(null);
                dispatch({ type: "SET_TAB", payload: "matches" });
              }}
            >
              Send a message
            </button>
            <button
              className="match-celebration-dismiss"
              onClick={(e) => { e.stopPropagation(); setMatchCelebration(null); }}
            >
              Keep browsing
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
