import { useApp } from "../context/AppContext";
import { useState } from "react";
import { Heart, X } from "lucide-react";

export default function LikesYou() {
  const { state, actions, dispatch } = useApp();
  const [likedBack, setLikedBack] = useState(new Set());
  const [dismissed, setDismissed] = useState(new Set());
  const [viewProfile, setViewProfile] = useState(null);

  const likesWithProfiles = state.likesReceived.filter(
    (l) => l.profile && !dismissed.has(l.id) && !likedBack.has(l.id)
  );

  const handleLikeBack = async (like) => {
    setLikedBack((prev) => new Set(prev).add(like.id));
    try {
      await actions.matchFromLike(like);
    } catch (err) {
      console.error("Match failed:", err);
      setLikedBack((prev) => { const n = new Set(prev); n.delete(like.id); return n; });
    }
  };

  const handleDismiss = async (like) => {
    try {
      setDismissed((prev) => new Set(prev).add(like.id));
      await actions.dismissLike(like.id);
    } catch (err) {
      console.error("Dismiss failed:", err);
    }
  };

  if (likesWithProfiles.length === 0) {
    return (
      <div className="discover-empty">
        <Heart size={48} />
        <h2>No likes yet</h2>
        <p>Keep exploring! When someone likes you, they'll appear here.</p>
      </div>
    );
  }

  return (
    <div className="likes-page">
      <div className="likes-header">
        <h1>Sparks</h1>
        <p>
          {likesWithProfiles.length} {likesWithProfiles.length === 1 ? "person" : "people"} liked your profile
        </p>
      </div>
      <div className="likes-list">
        {likesWithProfiles.map((like) => {
          const profile = like.profile;
          const likedPrompt = like.targetType === "prompt" && profile.prompts?.[like.targetIndex];
          const matched = likedBack.has(like.id);

          return (
            <div key={like.id} className="like-card" onClick={() => setViewProfile(profile)}>
              <div className="like-card-content">
                <div className="like-card-photo-wrap">
                  <img
                    src={profile.photos?.[0]}
                    alt={profile.name}
                    className="like-card-photo"
                    onError={(e) => {
                      e.target.src = `https://ui-avatars.com/api/?name=${profile.name}&size=64&background=random`;
                    }}
                  />
                </div>
                <div className="like-card-info">
                  <div className="like-card-top">
                    <span className="like-card-name">{profile.name}, {profile.age}</span>
                    <span className="like-card-time">{like.timeAgo || "Recently"}</span>
                  </div>
                  <p className="like-card-denom">{profile.denomination}</p>
                  {likedPrompt && (
                    <div className="like-card-prompt">
                      <p className="like-card-prompt-label">{likedPrompt.prompt}</p>
                      <p className="like-card-prompt-answer">{likedPrompt.answer}</p>
                    </div>
                  )}
                  {like.comment && (
                    <div className="like-card-prompt">
                      <p className="like-card-prompt-label">Comment</p>
                      <p className="like-card-prompt-answer">"{like.comment}"</p>
                    </div>
                  )}
                </div>
              </div>
              <div className="like-card-actions">
                <button
                  className="id-btn id-skip"
                  onClick={(e) => { e.stopPropagation(); handleDismiss(like); }}
                >
                  <X size={17} />
                </button>
                <button
                  className={`id-btn ${matched ? "id-matched" : "id-heart"}`}
                  onClick={(e) => { e.stopPropagation(); if (!matched) handleLikeBack(like); }}
                >
                  {matched ? (
                    <svg width={15} height={15} viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10" fill="white" />
                      <path d="M9 12l2 2 4-4" stroke="#B8912A" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
                    </svg>
                  ) : (
                    <Heart size={17} fill="white" stroke="white" />
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {viewProfile && (
        <div className="like-profile-overlay" onClick={() => setViewProfile(null)}>
          <div className="like-profile-view" onClick={(e) => e.stopPropagation()}>
            <div style={{ position: "relative" }}>
              <img
                src={viewProfile.photos?.[0]}
                alt={viewProfile.name}
                style={{ width: "100%", aspectRatio: "3/4", maxHeight: "56vh", objectFit: "cover" }}
                onError={(e) => { e.target.src = `https://ui-avatars.com/api/?name=${viewProfile.name}&size=600&background=random`; }}
              />
              <div className="hero-gradient" />
              <button className="like-profile-back" onClick={() => setViewProfile(null)}>
                <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5}><polyline points="15 18 9 12 15 6" /></svg>
              </button>
              <div className="id-block">
                <div className="id-info">
                  <div className="id-line1">
                    <span className="id-name">{viewProfile.name},</span>
                    <span className="id-age">{viewProfile.age}</span>
                  </div>
                  <div className="id-line2">
                    {viewProfile.location && (
                      <span className="id-detail">
                        <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                          <circle cx="12" cy="10" r="3" />
                        </svg>
                        {viewProfile.location}
                      </span>
                    )}
                    {viewProfile.location && viewProfile.denomination && <span className="id-dot">·</span>}
                    {viewProfile.denomination && (
                      <span className="id-detail">✝ {viewProfile.denomination}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="prompts-sheet">
              {(viewProfile.prompts || []).filter(p => p.prompt && p.answer).map((p, i) => (
                <div key={i} className="hinge-prompt-card">
                  <div className="hinge-prompt-inner">
                    <div className="hinge-prompt-accent" />
                    <div className="hinge-prompt-content">
                      <div className="hinge-prompt-label">{p.prompt}</div>
                      <div className="hinge-prompt-answer">{p.answer}</div>
                    </div>
                  </div>
                </div>
              ))}
              {viewProfile.interests?.length > 0 && (
                <div className="profile-interests-section">
                  <div className="interests-label">Interests</div>
                  <div className="interests-wrap">
                    {viewProfile.interests.map((v) => (
                      <span key={v} className="interest-chip">{v}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
