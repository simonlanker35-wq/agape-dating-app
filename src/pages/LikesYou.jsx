import { useApp } from "../context/AppContext";
import { Heart, X, MessageCircle, MapPin, Briefcase, GraduationCap, Church, ChevronDown } from "lucide-react";
import { useState, useRef, useMemo } from "react";
import DoveIcon from "../components/DoveIcon";
import { scoreLikeQuality } from "../utils/algorithm";

export default function LikesYou() {
  const { state, dispatch } = useApp();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [photoIndex, setPhotoIndex] = useState(0);
  const cardRef = useRef(null);

  const likesWithProfiles = useMemo(() => {
    return state.likesReceived
      .map((like) => {
        const profile = state.profiles.find((p) => p.id === like.fromId);
        return profile ? { ...like, profile, quality: scoreLikeQuality(like) } : null;
      })
      .filter(Boolean)
      .sort((a, b) => b.quality - a.quality);
  }, [state.likesReceived, state.profiles]);

  const handleMatch = (profileId) => {
    dispatch({ type: "MATCH_FROM_LIKES", payload: { profileId } });
    setPhotoIndex(0);
    if (currentIndex >= likesWithProfiles.length - 1) {
      setCurrentIndex(Math.max(0, likesWithProfiles.length - 2));
    }
  };

  const handleDismiss = (profileId) => {
    dispatch({ type: "DISMISS_LIKE", payload: profileId });
    setPhotoIndex(0);
    if (currentIndex >= likesWithProfiles.length - 1) {
      setCurrentIndex(Math.max(0, likesWithProfiles.length - 2));
    }
  };

  if (likesWithProfiles.length === 0) {
    return (
      <div className="likes-empty">
        <Heart size={48} />
        <h2>No likes yet</h2>
        <p>Keep swiping! When someone likes you, they'll appear here.</p>
      </div>
    );
  }

  const currentLike = likesWithProfiles[currentIndex];
  if (!currentLike) return null;
  const profile = currentLike.profile;

  const handlePhotoTap = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (x > rect.width / 2) {
      setPhotoIndex((prev) => Math.min(prev + 1, profile.photos.length - 1));
    } else {
      setPhotoIndex((prev) => Math.max(prev - 1, 0));
    }
  };

  return (
    <div className="likes-feed-page">
      <div className="likes-feed-header">
        <h2>
          Likes You <span className="likes-count">{likesWithProfiles.length}</span>
        </h2>
      </div>

      <div className="likes-feed-card" ref={cardRef}>
        {/* Comment / Dove badge */}
        {(currentLike.comment || currentLike.isDove) && (
          <div className="likes-feed-badge">
            {currentLike.isDove && <DoveIcon size={14} color="#b8860b" />}
            {currentLike.comment ? (
              <span className="likes-feed-badge-text">
                <MessageCircle size={12} />
                "{currentLike.comment}"
              </span>
            ) : (
              <span className="likes-feed-badge-text">Sent you a Dove</span>
            )}
          </div>
        )}

        {/* Photo with tap navigation */}
        <div className="likes-feed-photo-container" onClick={handlePhotoTap}>
          <div className="likes-feed-photo-dots">
            {profile.photos.map((_, i) => (
              <div
                key={i}
                className={`photo-dot ${i === photoIndex ? "active" : ""}`}
              />
            ))}
          </div>
          <img
            src={profile.photos[photoIndex]}
            alt={profile.name}
            className="likes-feed-photo"
            onError={(e) => {
              e.target.src = `https://ui-avatars.com/api/?name=${profile.name}&size=600&background=random`;
            }}
          />
          <div className="likes-feed-photo-gradient" />
          <div className="likes-feed-name-overlay">
            <h3>{profile.name}, {profile.age}</h3>
            {profile.location && (
              <span className="likes-feed-location">
                <MapPin size={13} /> {profile.distance} km away
              </span>
            )}
          </div>
        </div>

        {/* Profile details */}
        <div className="likes-feed-details">
          {profile.denomination && (
            <div className="likes-feed-detail-row">
              <Church size={15} className="detail-icon gold" />
              <span>{profile.denomination}</span>
            </div>
          )}
          {profile.job && (
            <div className="likes-feed-detail-row">
              <Briefcase size={15} className="detail-icon" />
              <span>{profile.job}</span>
            </div>
          )}
          {profile.school && (
            <div className="likes-feed-detail-row">
              <GraduationCap size={15} className="detail-icon" />
              <span>{profile.school}</span>
            </div>
          )}
          {profile.location && (
            <div className="likes-feed-detail-row">
              <MapPin size={15} className="detail-icon" />
              <span>{profile.location}</span>
            </div>
          )}
        </div>

        {/* Prompts */}
        {profile.prompts?.filter(p => p.prompt && p.answer).length > 0 && (
          <div className="likes-feed-prompts">
            {profile.prompts.filter(p => p.prompt && p.answer).map((p, i) => (
              <div key={i} className="likes-feed-prompt-card">
                <div className="likes-feed-prompt-q">{p.prompt}</div>
                <div className="likes-feed-prompt-a">{p.answer}</div>
              </div>
            ))}
          </div>
        )}

        {/* Interests */}
        {profile.interests?.length > 0 && (
          <div className="likes-feed-interests">
            {profile.interests.map((interest) => (
              <span key={interest} className="likes-feed-interest-chip">{interest}</span>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="likes-feed-actions">
          <button
            className="likes-feed-dismiss-btn"
            onClick={() => handleDismiss(currentLike.fromId)}
          >
            <X size={28} />
          </button>
          <button
            className="likes-feed-match-btn"
            onClick={() => handleMatch(currentLike.fromId)}
          >
            <Heart size={20} />
            Match with {profile.name}
          </button>
        </div>

        {/* Navigation hint */}
        {likesWithProfiles.length > 1 && (
          <div className="likes-feed-nav">
            <span>{currentIndex + 1} of {likesWithProfiles.length}</span>
            {currentIndex < likesWithProfiles.length - 1 && (
              <button
                className="likes-feed-next-btn"
                onClick={() => { setCurrentIndex(currentIndex + 1); setPhotoIndex(0); }}
              >
                Next person <ChevronDown size={16} />
              </button>
            )}
            {currentIndex > 0 && (
              <button
                className="likes-feed-prev-btn"
                onClick={() => { setCurrentIndex(currentIndex - 1); setPhotoIndex(0); }}
              >
                Previous
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
