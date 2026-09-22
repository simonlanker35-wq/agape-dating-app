import { useState, useRef, useEffect, useMemo } from "react";
import { useApp } from "../context/AppContext";
import { Heart, X, MessageCircle, Ban, Flag } from "lucide-react";
import DoveIcon from "../components/DoveIcon";
import ReliabilityBadge from "../components/ReliabilityBadge";
import AgapeCross from "../components/AgapeCross";
import WaveformBar from "../components/WaveformBar";
import FilterSheet from "../components/FilterSheet";
import ReportSheet from "../components/ReportSheet";
import { getLikesRemaining, getDovesRemaining, recordLike, recordDove, LIMITS } from "../services/limits";
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

export default function Discover() {
  const { state, dispatch, actions } = useApp();
  const [commentTarget, setCommentTarget] = useState(null);
  const [commentText, setCommentText] = useState("");
  const [showDove, setShowDove] = useState(false);
  const [doveSheet, setDoveSheet] = useState(false);
  const [likeFlash, setLikeFlash] = useState(null);
  const [likeError, setLikeError] = useState("");
  const [matchCelebration, setMatchCelebration] = useState(null);
  const [cardEnter, setCardEnter] = useState(true);
  const [photoIdx, setPhotoIdx] = useState(0);
  const [likeChoice, setLikeChoice] = useState(null);
  const [localSkips, setLocalSkips] = useState(new Set());
  const [localLikes, setLocalLikes] = useState(new Set());
  const [showFilter, setShowFilter] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const cardRef = useRef(null);
  const isPremium = state.currentUser?.subscriptionStatus === "active";
  const [likesLeft, setLikesLeft] = useState(getLikesRemaining(isPremium));
  const [dovesLeft, setDovesLeft] = useState(getDovesRemaining(isPremium));

  useEffect(() => {
    setLikesLeft(getLikesRemaining(isPremium));
    setDovesLeft(getDovesRemaining(isPremium));
  }, [isPremium]);

  const userLat = state.currentUser?.location?.lat;
  const userLng = state.currentUser?.location?.lng;
  const filters = state.filters;

  const filteredProfiles = useMemo(() => {
    return state.profiles.filter((p) => {
      if (state.likes.some((l) => l.profileId === p.id)) return false;
      if (state.blocked.some((b) => (b.id || b) === p.id)) return false;
      if (localSkips.has(p.id)) return false;
      if (localLikes.has(p.id)) return false;
      if (p.age < filters.minAge || p.age > filters.maxAge) return false;
      if (filters.denominations.length > 0 && !filters.denominations.includes(p.denomination)) return false;
      if (userLat && userLng && p.lat && p.lng) {
        const dist = haversine(userLat, userLng, p.lat, p.lng);
        if (dist > filters.maxDistance) return false;
      }
      return true;
    });
  }, [state.profiles, state.likes, state.blocked, localSkips, localLikes, filters, userLat, userLng]);

  const profile = filteredProfiles[0];

  const handleApplyFilters = async (newFilters) => {
    track("filters_applied", { maxAge: newFilters.maxAge, maxDistance: newFilters.maxDistance, denominations: newFilters.denominations });
    dispatch({ type: "UPDATE_FILTERS", payload: newFilters });
    await actions.updateProfile({ filters: { ...state.currentUser?.filters, ...newFilters } });
    actions.refreshDiscover();
  };

  useEffect(() => {
    setCardEnter(true);
    setPhotoIdx(0);
    const t = setTimeout(() => setCardEnter(false), 400);
    return () => clearTimeout(t);
  }, [profile?.id]);

  if (likesLeft <= 0) {
    const limit = isPremium ? LIMITS.PREMIUM.dailyLikes : LIMITS.FREE.dailyLikes;
    return (
      <div className="discover-empty">
        <Heart size={48} />
        <h2>No likes left today</h2>
        <p>You've used all {limit} {isPremium ? "" : "free "}likes for today. Come back tomorrow!</p>
        {!isPremium && (
          <button className="filter-apply-btn" style={{ marginTop: 16, flex: "none", background: "#B8912A" }} onClick={() => { track("upgrade_tapped", { source: "no_likes_left" }); dispatch({ type: "SET_TAB", payload: "profile" }); }}>
            Get Agape+ for {LIMITS.PREMIUM.dailyLikes} likes/day
          </button>
        )}
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="discover-empty">
        <Heart size={48} />
        <h2>You've seen everyone!</h2>
        <p>Check back later for new profiles or adjust your filters.</p>
        <button className="filter-apply-btn" style={{ marginTop: 16, flex: "none" }} onClick={() => setShowFilter(true)}>
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
    if (isDove && dovesLeft <= 0) return;
    if (likesLeft <= 0) return;
    const flashType = comment ? "comment" : isDove ? "dove" : "heart";
    const likedId = profile.id;
    const likedProfile = profile;
    setCommentTarget(null);
    setCommentText("");
    setShowDove(false);
    setLikeFlash(flashType);
    recordLike();
    setLikesLeft(getLikesRemaining(isPremium));
    if (isDove) { recordDove(); setDovesLeft(getDovesRemaining(isPremium)); }

    setTimeout(async () => {
      setLocalLikes((prev) => new Set(prev).add(likedId));
      try {
        const res = await actions.likeProfile(likedId, targetType, targetIndex, comment, isDove);
        setLikeFlash(null);

        if (res.matched) {
          setMatchCelebration(likedProfile);
          setTimeout(() => setMatchCelebration(null), 3000);
        }
      } catch (err) {
        console.error("Like failed:", err);
        setLikeFlash(null);
        setLocalLikes((prev) => { const n = new Set(prev); n.delete(likedId); return n; });
        setLikeError("Your like didn't go through — please try again");
        setTimeout(() => setLikeError(""), 4000);
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
      track("comment_sent", { isDove: showDove, targetType: commentTarget.type });
      handleLike(commentTarget.type, commentTarget.index, commentText.trim(), showDove);
    }
  };

  const onHeartPress = (type, index) => {
    track("like_options_opened", { targetType: type });
    setLikeChoice({ type, index });
  };

  const onSendHeart = () => {
    track("heart_sent", { targetType: likeChoice.type });
    handleLike(likeChoice.type, likeChoice.index);
    setLikeChoice(null);
  };

  const onAddComment = () => {
    track("comment_modal_opened");
    setCommentTarget(likeChoice);
    setLikeChoice(null);
  };

  const onSendDove = () => {
    if (dovesLeft <= 0) return;
    track("dove_sent", { source: "discover" });
    setDoveSheet(false);
    handleLike("profile", 0, null, true);
  };

  const onDoveWithComment = () => {
    if (dovesLeft <= 0) return;
    track("dove_comment_modal_opened", { source: "discover" });
    setDoveSheet(false);
    setShowDove(true);
    setCommentTarget({ type: "profile", index: 0 });
  };


  const handleBlock = () => {
    track("profile_blocked", { source: "discover" });
    setLikeFlash("block");
    setTimeout(() => {
      setLikeFlash(null);
      dispatch({ type: "BLOCK_PROFILE", payload: { id: profile.id, name: profile.name, photo: profile.photos?.[0] } });
      actions.skipProfile(profile.id).catch(() => {});
    }, 1200);
  };

  const handleReport = (reason) => {
    track("profile_reported", { source: "discover", reason });
    setLikeFlash("report");
    setTimeout(() => {
      setLikeFlash(null);
      dispatch({ type: "BLOCK_PROFILE", payload: { id: profile.id, name: profile.name, photo: profile.photos?.[0] } });
      dispatch({ type: "ADD_REPORT", payload: { profileId: profile.id, name: profile.name, photo: profile.photos?.[0], reason, timestamp: Date.now() } });
      actions.skipProfile(profile.id).catch(() => {});
    }, 1200);
  };

  const photos = profile.photos || [];
  const prompts = (profile.prompts || []).filter((p) => p.prompt && p.answer);

  return (
    <div className="discover">
      {likeError && (
        <div style={{ position: "fixed", top: "max(16px, env(safe-area-inset-top, 16px))", left: "50%", transform: "translateX(-50%)", zIndex: 300, background: "#1A1612", color: "#F5F0E8", padding: "10px 16px", borderRadius: 999, fontSize: 13, fontWeight: 600, fontFamily: "'Outfit', system-ui, sans-serif", boxShadow: "0 4px 16px rgba(0,0,0,0.25)", whiteSpace: "nowrap" }}>
          {likeError}
        </div>
      )}
      {likeFlash && (
        <div className={`like-flash-overlay ${likeFlash}`}>
          <span className="flash-emoji">
            {likeFlash === "dove" ? <DoveIcon size={120} color="#B8912A" strokeWidth={1.2} /> : likeFlash === "comment" ? <MessageCircle size={120} strokeWidth={1.4} color="#B8912A" /> : likeFlash === "block" ? <Ban size={120} strokeWidth={1.4} color="#EF4444" /> : likeFlash === "report" ? <Flag size={120} strokeWidth={1.4} color="#EF4444" /> : <Heart size={120} strokeWidth={1.4} fill="#DC3232" color="#DC3232" />}
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

            {/* Top overlay: skip left, shield + filter right */}
            <div className="photo-overlay-icons">
              <button className="photo-overlay-btn discover-skip-btn" onClick={handleSkip}>
                <X size={18} strokeWidth={2.5} />
              </button>
              <div style={{ display: "flex", gap: 8 }}>
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
                  {profile.reliability?.dates > 0 && <span className="id-dot">·</span>}
                  {profile.reliability?.dates > 0 && <ReliabilityBadge reliability={profile.reliability} light />}
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => onHeartPress("profile", 0)}
                    aria-label="Like"
                    style={{ width: 56, height: 38, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", background: "#B8912A", border: "none", cursor: "pointer", boxShadow: "0 3px 12px rgba(184,145,42,0.45)" }}
                  >
                    <Heart size={18} fill="white" stroke="white" />
                  </button>
                  <button
                    onClick={() => { track("dove_button_tapped", { source: "discover" }); setDoveSheet(true); }}
                    aria-label="Send a Dove"
                    style={{ width: 56, height: 38, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", background: "#B8912A", border: "none", cursor: "pointer", boxShadow: "0 3px 12px rgba(184,145,42,0.45)", opacity: dovesLeft > 0 ? 1 : 0.5, position: "relative" }}
                  >
                    <DoveIcon size={20} color="white" strokeWidth={2.2} />
                    <span style={{ position: "absolute", top: -6, right: -6, minWidth: 18, height: 18, padding: "0 5px", borderRadius: 9, background: "white", color: "#B8912A", fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Outfit', system-ui, sans-serif", boxShadow: "0 1px 4px rgba(0,0,0,0.2)" }}>{dovesLeft}</span>
                  </button>
                </div>
                <div style={{ background: "rgba(0,0,0,0.5)", borderRadius: 20, padding: "4px 10px", display: "flex", alignItems: "center", gap: 4 }}>
                  <Heart size={10} fill="white" stroke="white" />
                  <span style={{ color: "white", fontSize: 11, fontWeight: 700, fontFamily: "'Outfit', system-ui, sans-serif" }}>{likesLeft}</span>
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
                    <WaveformBar duration={p.voice.duration} color="#8C857C" />
                  ) : (
                    <div className="hinge-prompt-answer">{p.answer}</div>
                  )}
                </div>
                <div className="prompt-side-actions">
                  <button className="mini-btn prompt-heart" onClick={() => onHeartPress("prompt", i)}>
                    <Heart size={13} fill="white" stroke="white" />
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


      {likeChoice && (() => {
        const theyLikedYou = state.likesReceived.find((l) => l.fromId === profile.id);
        const theyCommented = theyLikedYou?.comment;
        return (
          <div className="like-choice-overlay" onClick={() => setLikeChoice(null)}>
            <div className="like-choice-sheet" onClick={(e) => e.stopPropagation()}>
              {theyCommented && (
                <p style={{ fontSize: 12, color: "#8C857C", textAlign: "center", margin: "0 0 8px", fontFamily: "'Outfit', system-ui, sans-serif" }}>
                  {profile.name} already commented on your profile
                </p>
              )}
              <button className="like-choice-btn heart-choice" onClick={onSendHeart}>
                <Heart size={20} fill="white" stroke="white" />
                <span>Send Heart</span>
              </button>
              {!theyCommented && (
                <button className="like-choice-btn comment-choice" onClick={onAddComment}>
                  <MessageCircle size={18} />
                  <span>Add a Comment</span>
                </button>
              )}
            </div>
          </div>
        );
      })()}

      {doveSheet && (
        <div className="like-choice-overlay" onClick={() => setDoveSheet(false)}>
          <div className="like-choice-sheet" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <span style={{ width: 40, height: 40, borderRadius: "50%", background: "#B8912A", color: "white", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><DoveIcon size={20} strokeWidth={2} /></span>
              <div>
                <p style={{ fontSize: 16, fontWeight: 700, color: "#1A1612", margin: 0, fontFamily: "'Outfit', system-ui, sans-serif" }}>Send {profile.name} a Dove</p>
                <p style={{ fontSize: 12, color: "#8C857C", margin: "2px 0 0", fontFamily: "'Outfit', system-ui, sans-serif" }}>
                  {dovesLeft > 0 ? `${dovesLeft} left this week · you're shown to them instantly` : "No Doves left this week"}
                </p>
              </div>
            </div>
            <button className="like-choice-btn dove-choice" onClick={onSendDove} disabled={dovesLeft <= 0} style={{ opacity: dovesLeft <= 0 ? 0.45 : 1 }}>
              <DoveIcon size={20} strokeWidth={2} />
              <span>Send Dove</span>
            </button>
            <button className="like-choice-btn comment-choice" onClick={onDoveWithComment} disabled={dovesLeft <= 0} style={{ opacity: dovesLeft <= 0 ? 0.45 : 1 }}>
              <MessageCircle size={18} />
              <span>Dove with a Comment</span>
            </button>
          </div>
        </div>
      )}

      {commentTarget && (
        <div className="comment-modal-overlay" onClick={() => { setCommentTarget(null); setShowDove(false); }}>
          <div className="comment-modal" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => { if (dovesLeft > 0 || showDove) setShowDove((v) => !v); }}
              disabled={dovesLeft <= 0 && !showDove}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 9999, fontSize: 12, fontWeight: 700, marginBottom: 10, cursor: "pointer", fontFamily: "'Outfit', system-ui, sans-serif", background: showDove ? "#B8912A" : "#F4F2EE", color: showDove ? "white" : "#8C857C", border: "none", opacity: dovesLeft <= 0 && !showDove ? 0.5 : 1 }}
            >
              <DoveIcon size={14} strokeWidth={2.2} />
              {showDove ? "Sending as a Dove" : `Send as a Dove · ${dovesLeft} left`}
            </button>
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
                track("match_send_message_tapped");
                setMatchCelebration(null);
                dispatch({ type: "SET_TAB", payload: "matches" });
              }}
            >
              Send a message
            </button>
            <button
              className="match-celebration-dismiss"
              onClick={(e) => { e.stopPropagation(); track("match_keep_browsing_tapped"); setMatchCelebration(null); }}
            >
              Keep browsing
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
