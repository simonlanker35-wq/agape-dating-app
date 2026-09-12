import { useState, useRef, useEffect, useMemo } from "react";
import { useApp } from "../context/AppContext";
import { Heart, X, MessageCircle } from "lucide-react";
import DoveIcon from "../components/DoveIcon";
import AgapeCross from "../components/AgapeCross";
import WaveformBar from "../components/WaveformBar";
import FilterSheet from "../components/FilterSheet";
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

export default function Discover() {
  const { state, dispatch, actions } = useApp();
  const [commentTarget, setCommentTarget] = useState(null);
  const [commentText, setCommentText] = useState("");
  const [showDove, setShowDove] = useState(false);
  const [likeFlash, setLikeFlash] = useState(null);
  const [matchCelebration, setMatchCelebration] = useState(null);
  const [cardEnter, setCardEnter] = useState(true);
  const [photoIdx, setPhotoIdx] = useState(0);
  const [localSkips, setLocalSkips] = useState(new Set());
  const [showFilter, setShowFilter] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const cardRef = useRef(null);

  const userLat = state.currentUser?.location?.lat;
  const userLng = state.currentUser?.location?.lng;
  const filters = state.filters;

  const filteredProfiles = useMemo(() => {
    return state.profiles.filter((p) => {
      if (state.likes.some((l) => l.profileId === p.id)) return false;
      if (state.blocked.includes(p.id)) return false;
      if (localSkips.has(p.id)) return false;
      if (p.age < filters.minAge || p.age > filters.maxAge) return false;
      if (filters.denominations.length > 0 && !filters.denominations.includes(p.denomination)) return false;
      if (userLat && userLng && p.lat && p.lng) {
        const dist = haversine(userLat, userLng, p.lat, p.lng);
        if (dist > filters.maxDistance) return false;
      }
      return true;
    });
  }, [state.profiles, state.likes, state.blocked, localSkips, filters, userLat, userLng]);

  const profile = filteredProfiles[0];

  const handleApplyFilters = (newFilters) => {
    dispatch({ type: "UPDATE_FILTERS", payload: newFilters });
  };

  useEffect(() => {
    setCardEnter(true);
    setPhotoIdx(0);
    const t = setTimeout(() => setCardEnter(false), 400);
    return () => clearTimeout(t);
  }, [profile?.id]);

  if (!profile) {
    return (
      <div className="discover-empty">
        <Heart size={48} />
        <h2>You've seen everyone!</h2>
        <p>Check back later for new profiles or adjust your filters.</p>
        <button className="filter-apply-btn" style={{ marginTop: 16 }} onClick={() => setShowFilter(true)}>
          Adjust Filters
        </button>
        {showFilter && (
          <FilterSheet
            filters={filters}
            onApply={handleApplyFilters}
            onClose={() => setShowFilter(false)}
          />
        )}
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
      setLocalSkips((prev) => new Set(prev).add(profile.id));
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
    handleLike(type, index);
  };

  const onCommentPress = (type, index) => {
    setCommentTarget({ type, index });
  };

  const handleBlock = () => {
    dispatch({ type: "BLOCK_PROFILE", payload: profile.id });
    actions.skipProfile(profile.id).catch(() => {});
  };

  const handleReport = (reason) => {
    dispatch({ type: "BLOCK_PROFILE", payload: profile.id });
    actions.skipProfile(profile.id).catch(() => {});
  };

  const photos = profile.photos || [];
  const prompts = (profile.prompts || []).filter((p) => p.prompt && p.answer);

  return (
    <div className="discover">
      {likeFlash && (
        <div className={`like-flash-overlay ${likeFlash}`}>
          <span className="flash-emoji">
            {likeFlash === "dove" ? "🕊️" : likeFlash === "comment" ? "💬" : "❤️"}
          </span>
        </div>
      )}
      <div className={`profile-card ${cardEnter ? "enter" : ""}`} ref={cardRef}>
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
              <button className="photo-overlay-btn" onClick={() => setShowReport(true)}>
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5}>
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              </button>
              <button className="photo-overlay-btn" onClick={() => setShowFilter(true)}>
                <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2}>
                  <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
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

            {/* Identity block — pinned to bottom of photo */}
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
                <button className="id-btn id-comment" onClick={() => onCommentPress("profile", 0)}>
                  <MessageCircle size={15} />
                </button>
                <button className="id-btn id-heart" onClick={() => onHeartPress("profile", 0)}>
                  <Heart size={17} fill="white" stroke="white" />
                </button>
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
                </div>
                <div className="prompt-side-actions">
                  <button className="mini-btn prompt-skip" onClick={handleSkip}>
                    <X size={13} />
                  </button>
                  <button className="mini-btn prompt-comment" onClick={() => onCommentPress("prompt", i)}>
                    <MessageCircle size={11} />
                  </button>
                  <button className="mini-btn prompt-heart" onClick={() => onHeartPress("prompt", i)}>
                    <Heart size={13} fill="white" stroke="white" />
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

      {showFilter && (
        <FilterSheet
          filters={filters}
          onApply={handleApplyFilters}
          onClose={() => setShowFilter(false)}
        />
      )}

      {showReport && (
        <ReportSheet
          profileName={profile.name}
          onReport={handleReport}
          onBlock={handleBlock}
          onClose={() => setShowReport(false)}
        />
      )}

      {matchCelebration && (
        <div className="match-celebration-overlay" onClick={() => setMatchCelebration(null)}>
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
