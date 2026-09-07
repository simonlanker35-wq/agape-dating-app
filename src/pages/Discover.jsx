import { useState, useRef, useEffect } from "react";
import { useApp } from "../context/AppContext";
import {
  Heart, X, MessageCircle, Star, MapPin, Briefcase,
  GraduationCap, Church, Ruler,
} from "lucide-react";
import DoveIcon from "../components/DoveIcon";

export default function Discover() {
  const { state, dispatch, actions } = useApp();
  const [commentTarget, setCommentTarget] = useState(null);
  const [commentText, setCommentText] = useState("");
  const [showDove, setShowDove] = useState(false);
  const [exitAnimation, setExitAnimation] = useState(null);
  const [likeFlash, setLikeFlash] = useState(null);
  const [matchCelebration, setMatchCelebration] = useState(null);
  const [cardEnter, setCardEnter] = useState(true);
  const cardRef = useRef(null);

  const profile = state.profiles[state.currentProfileIndex];

  useEffect(() => {
    setCardEnter(true);
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
    setLikeFlash(isDove ? "dove" : "heart");
    setTimeout(() => setLikeFlash(null), 600);

    setExitAnimation("like");
    setTimeout(async () => {
      try {
        const res = await actions.likeProfile(profile.id, targetType, targetIndex, comment, isDove);
        setExitAnimation(null);
        setCommentTarget(null);
        setCommentText("");
        setShowDove(false);

        if (res.matched) {
          setMatchCelebration(profile);
          setTimeout(() => setMatchCelebration(null), 3000);
        }
      } catch (err) {
        console.error("Like failed:", err);
        setExitAnimation(null);
      }
    }, 400);
  };

  const handleSkip = async () => {
    setExitAnimation("skip");
    setTimeout(async () => {
      try {
        await actions.skipProfile(profile.id);
      } catch (err) {
        console.error("Skip failed:", err);
      }
      setExitAnimation(null);
    }, 350);
  };

  const handleComment = () => {
    if (commentText.trim()) {
      handleLike(commentTarget.type, commentTarget.index, commentText.trim(), showDove);
    }
  };

  const contentBlocks = buildContentBlocks(profile);

  return (
    <div className="discover">
      <div className={`profile-card ${exitAnimation || ""} ${cardEnter ? "enter" : ""}`} ref={cardRef}>
        {likeFlash && (
          <div className={`like-flash-overlay ${likeFlash}`}>
            {likeFlash === "dove" ? (
              <DoveIcon size={80} color="white" strokeWidth={1} />
            ) : (
              <Heart size={80} fill="white" stroke="white" />
            )}
          </div>
        )}

        {contentBlocks.map((block, i) => {
          if (block.type === "photo") {
            return (
              <ProfilePhoto
                key={`photo-${block.index}`}
                profile={profile}
                photoIndex={block.index}
                totalPhotos={profile.photos.length}
                onLike={() => handleLike("photo", block.index)}
                onComment={() => setCommentTarget({ type: "photo", index: block.index })}
                isFirst={block.index === 0}
              />
            );
          }
          if (block.type === "info") {
            return (
              <div key="info" className="profile-info-section">
                <div className="profile-name-age">
                  <h2>{profile.name}, {profile.age}</h2>
                </div>
                <div className="profile-vitals">
                  {profile.height && (
                    <span className="vital-chip"><Ruler size={13} /> {profile.height}</span>
                  )}
                  {profile.location && (
                    <span className="vital-chip"><MapPin size={13} /> {profile.location}</span>
                  )}
                  {profile.denomination && (
                    <span className="vital-chip"><Church size={13} /> {profile.denomination}</span>
                  )}
                </div>
                {(profile.job || profile.school) && (
                  <div className="profile-details-row">
                    {profile.job && (
                      <span className="detail-item"><Briefcase size={13} /> {profile.job}</span>
                    )}
                    {profile.school && (
                      <span className="detail-item"><GraduationCap size={13} /> {profile.school}</span>
                    )}
                  </div>
                )}
              </div>
            );
          }
          if (block.type === "prompt") {
            return (
              <div key={`prompt-${block.index}`} className="hinge-prompt-card">
                <div className="hinge-prompt-label">{block.prompt}</div>
                <div className="hinge-prompt-answer">{block.answer}</div>
                <div className="hinge-prompt-actions">
                  <button className="hinge-action-btn" onClick={() => handleLike("prompt", block.index)}>
                    <Heart size={20} />
                  </button>
                  <button className="hinge-action-btn" onClick={() => setCommentTarget({ type: "prompt", index: block.index })}>
                    <MessageCircle size={20} />
                  </button>
                </div>
              </div>
            );
          }
          if (block.type === "interests") {
            return (
              <div key="interests" className="profile-interests-section">
                <div className="interests-label">Interests</div>
                <div className="interests-wrap">
                  {profile.interests.map((interest) => (
                    <span key={interest} className="interest-chip">{interest}</span>
                  ))}
                </div>
              </div>
            );
          }
          return null;
        })}

        <div className="profile-bottom-actions">
          <button className="action-btn skip-btn" onClick={handleSkip}>
            <X size={28} />
          </button>
          <button
            className="action-btn dove-btn"
            onClick={() => {
              setShowDove(true);
              setCommentTarget({ type: "profile", index: 0 });
            }}
            disabled={state.doves <= 0}
          >
            <DoveIcon size={24} />
            <span className="dove-count">{state.doves}</span>
          </button>
          <button
            className="action-btn like-btn"
            onClick={() => handleLike("profile", 0)}
          >
            <Heart size={28} />
          </button>
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
        <div className="match-celebration-overlay">
          <div className="match-celebration">
            <div className="match-hearts">
              {Array.from({ length: 12 }, (_, i) => (
                <Heart
                  key={i}
                  size={16 + Math.random() * 20}
                  fill="var(--gold)"
                  stroke="var(--gold)"
                  className="floating-heart"
                  style={{
                    left: `${10 + Math.random() * 80}%`,
                    animationDelay: `${Math.random() * 0.5}s`,
                    animationDuration: `${1.5 + Math.random() * 1}s`,
                  }}
                />
              ))}
            </div>
            <h2>It's a Match!</h2>
            <p>You and {matchCelebration.name} liked each other</p>
            <img
              src={matchCelebration.photos[0]}
              alt={matchCelebration.name}
              className="match-celebration-photo"
              onError={(e) => {
                e.target.src = `https://ui-avatars.com/api/?name=${matchCelebration.name}&size=120&background=random`;
              }}
            />
            <button
              className="match-celebration-btn"
              onClick={() => {
                setMatchCelebration(null);
                dispatch({ type: "SET_TAB", payload: "matches" });
              }}
            >
              Send a Message
            </button>
            <button
              className="match-celebration-dismiss"
              onClick={() => setMatchCelebration(null)}
            >
              Keep Swiping
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function buildContentBlocks(profile) {
  const blocks = [];
  const photos = profile.photos || [];
  const prompts = (profile.prompts || []).filter(p => p.prompt && p.answer);

  blocks.push({ type: "photo", index: 0 });
  blocks.push({ type: "info" });

  if (prompts[0]) blocks.push({ type: "prompt", index: 0, ...prompts[0] });
  if (photos[1]) blocks.push({ type: "photo", index: 1 });
  if (prompts[1]) blocks.push({ type: "prompt", index: 1, ...prompts[1] });
  if (photos[2]) blocks.push({ type: "photo", index: 2 });
  if (prompts[2]) blocks.push({ type: "prompt", index: 2, ...prompts[2] });

  for (let i = 3; i < photos.length; i++) {
    blocks.push({ type: "photo", index: i });
  }

  if (profile.interests?.length > 0) {
    blocks.push({ type: "interests" });
  }

  return blocks;
}

function ProfilePhoto({ profile, photoIndex, totalPhotos, onLike, onComment, isFirst }) {
  return (
    <div className="hinge-photo-block">
      <img
        src={profile.photos[photoIndex]}
        alt={`${profile.name}'s photo`}
        className="hinge-photo"
        onError={(e) => {
          e.target.src = `https://ui-avatars.com/api/?name=${profile.name}&size=400&background=random`;
        }}
      />
      {isFirst && totalPhotos > 1 && (
        <div className="photo-indicators">
          {profile.photos.map((_, i) => (
            <div key={i} className={`photo-indicator ${i === photoIndex ? "active" : ""}`} />
          ))}
        </div>
      )}
      <div className="hinge-photo-actions">
        <button className="hinge-action-btn" onClick={onLike}>
          <Heart size={20} />
        </button>
        <button className="hinge-action-btn" onClick={onComment}>
          <MessageCircle size={20} />
        </button>
      </div>
      {profile.isStandout && isFirst && (
        <div className="standout-badge">
          <Star size={14} fill="gold" stroke="gold" /> Standout
        </div>
      )}
    </div>
  );
}
