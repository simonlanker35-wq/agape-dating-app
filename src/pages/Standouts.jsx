import { useApp } from "../context/AppContext";
import { Star, Heart, MapPin, Briefcase, Sparkles } from "lucide-react";
import { useState, useMemo } from "react";
import DoveIcon from "../components/DoveIcon";
import { rankProfiles, getMostCompatible } from "../utils/algorithm";

export default function Standouts() {
  const { state, dispatch } = useApp();
  const [selectedProfile, setSelectedProfile] = useState(null);

  const standouts = useMemo(() => {
    const filtered = state.profiles.filter(
      (p) =>
        p.isStandout &&
        !state.likes.some((l) => l.profileId === p.id) &&
        p.id !== "current_user"
    );
    return rankProfiles(filtered, state.currentUser, state);
  }, [state.profiles, state.likes, state.currentUser]);

  const mostCompatible = useMemo(() => {
    const eligible = state.profiles.filter(
      (p) =>
        !state.likes.some((l) => l.profileId === p.id) &&
        p.id !== "current_user" &&
        !standouts.some((s) => s.id === p.id)
    );
    return getMostCompatible(eligible, state.currentUser, state);
  }, [state.profiles, state.likes, state.currentUser, standouts]);

  const handleSendDove = (profileId) => {
    if (state.doves <= 0) return;
    dispatch({
      type: "LIKE_PROFILE",
      payload: {
        profileId,
        targetType: "profile",
        targetIndex: 0,
        comment: null,
        isDove: true,
      },
    });
    setSelectedProfile(null);
  };

  return (
    <div className="standouts-page">
      <div className="standouts-header">
        <div className="standouts-title-row">
          <Star size={24} fill="gold" stroke="gold" />
          <h2>Standouts</h2>
        </div>
        <p className="standouts-subtitle">
          Top picks who are especially popular. Send a Dove to stand out.
        </p>
        <div className="doves-remaining">
          <DoveIcon size={16} />
          {state.doves} Doves remaining
        </div>
      </div>

      {/* Most Compatible — daily top pick */}
      {mostCompatible && (
        <div className="most-compatible-card" onClick={() => setSelectedProfile(mostCompatible)}>
          <div className="most-compatible-badge">
            <Sparkles size={14} /> Most Compatible
          </div>
          <img
            src={mostCompatible.photos[0]}
            alt={mostCompatible.name}
            className="most-compatible-photo"
            onError={(e) => {
              e.target.src = `https://ui-avatars.com/api/?name=${mostCompatible.name}&size=400&background=random`;
            }}
          />
          <div className="most-compatible-info">
            <h3>{mostCompatible.name}, {mostCompatible.age}</h3>
            <p><Briefcase size={13} /> {mostCompatible.job}</p>
            <p><MapPin size={13} /> {mostCompatible.location} &middot; {mostCompatible.distance} km</p>
            {mostCompatible.compatibilityScore && (
              <div className="compatibility-score">
                {Math.min(99, Math.round(mostCompatible.compatibilityScore))}% match
              </div>
            )}
          </div>
        </div>
      )}

      {standouts.length === 0 ? (
        <div className="standouts-empty">
          <Star size={48} />
          <h3>No standouts right now</h3>
          <p>Check back later for top picks in your area.</p>
        </div>
      ) : (
        <div className="standouts-grid">
          {standouts.map((profile) => (
            <div
              key={profile.id}
              className="standout-card"
              onClick={() => setSelectedProfile(profile)}
            >
              <img
                src={profile.photos[0]}
                alt={profile.name}
                className="standout-photo"
                onError={(e) => {
                  e.target.src = `https://ui-avatars.com/api/?name=${profile.name}&size=300&background=random`;
                }}
              />
              <div className="standout-overlay">
                <div className="standout-prompt-preview">
                  {profile.prompts[0] && (
                    <>
                      <span className="standout-prompt-q">{profile.prompts[0].prompt}</span>
                      <span className="standout-prompt-a">{profile.prompts[0].answer}</span>
                    </>
                  )}
                </div>
                <div className="standout-info">
                  <span className="standout-name">{profile.name}, {profile.age}</span>
                  <span className="standout-detail">
                    <Briefcase size={12} /> {profile.job}
                  </span>
                </div>
              </div>
              <div className="standout-dove-btn">
                <DoveIcon size={18} />
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedProfile && (
        <div className="standout-modal-overlay" onClick={() => setSelectedProfile(null)}>
          <div className="standout-modal" onClick={(e) => e.stopPropagation()}>
            <img
              src={selectedProfile.photos[0]}
              alt={selectedProfile.name}
              className="standout-modal-photo"
              onError={(e) => {
                e.target.src = `https://ui-avatars.com/api/?name=${selectedProfile.name}&size=400&background=random`;
              }}
            />
            <div className="standout-modal-info">
              <h3>{selectedProfile.name}, {selectedProfile.age}</h3>
              <p><Briefcase size={14} /> {selectedProfile.job}</p>
              <p><MapPin size={14} /> {selectedProfile.location} &middot; {selectedProfile.distance} km</p>
              {selectedProfile.prompts.map((p, i) => (
                <div key={i} className="standout-modal-prompt">
                  <div className="prompt-question">{p.prompt}</div>
                  <div className="prompt-answer">{p.answer}</div>
                </div>
              ))}
              <div className="standout-modal-actions">
                <button
                  className="dove-send-btn"
                  onClick={() => handleSendDove(selectedProfile.id)}
                  disabled={state.doves <= 0}
                >
                  <DoveIcon size={18} />
                  Send Dove ({state.doves} left)
                </button>
                <button
                  className="standout-like-btn"
                  onClick={() => {
                    dispatch({
                      type: "LIKE_PROFILE",
                      payload: {
                        profileId: selectedProfile.id,
                        targetType: "profile",
                        targetIndex: 0,
                        comment: null,
                        isDove: false,
                      },
                    });
                    setSelectedProfile(null);
                  }}
                >
                  <Heart size={18} />
                  Like
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
