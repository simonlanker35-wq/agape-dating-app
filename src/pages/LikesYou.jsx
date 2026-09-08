import { useApp } from "../context/AppContext";
import { useState } from "react";

const C = { bg: "#FFFFFF", card: "#FAFAF8", surface: "#F4F2EE", primary: "#B8912A", primarySoft: "#FBF5E6", text: "#1A1612", sub: "#8C857C", border: "#E8E4DF", sent: "#111111" };
const FONT = "'Outfit', system-ui, sans-serif";

function HeartIcon({ filled, size = 10 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2}>
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

export default function LikesYou() {
  const { state, actions, dispatch } = useApp();
  const [likedBack, setLikedBack] = useState(new Set());
  const [bouncing, setBouncing] = useState(null);
  const [viewProfile, setViewProfile] = useState(null);

  const likesWithProfiles = state.likesReceived.filter((l) => l.profile);

  const handleLikeBack = async (like) => {
    try {
      await actions.matchFromLike(like);
      setLikedBack((prev) => new Set(prev).add(like.id));
      setBouncing(like.id);
      setTimeout(() => setBouncing(null), 500);
    } catch (err) {
      console.error("Match failed:", err);
    }
  };

  if (likesWithProfiles.length === 0) {
    return (
      <div className="flex flex-col h-full items-center justify-center" style={{ background: C.bg }}>
        <div style={{ color: C.sub, marginBottom: 16 }}>
          <HeartIcon size={48} />
        </div>
        <h2 style={{ color: C.text, fontFamily: FONT, fontSize: 20, fontWeight: 700 }}>No likes yet</h2>
        <p style={{ color: C.sub, fontSize: 14, marginTop: 4 }}>Keep exploring! When someone likes you, they'll appear here.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" style={{ background: C.bg }}>
      <div style={{ padding: "40px 20px 16px" }}>
        <h1
          style={{
            color: C.text,
            fontFamily: FONT,
            fontSize: 24,
            fontWeight: 700,
            letterSpacing: "-0.3px",
            margin: 0,
          }}
        >
          Your Likes
        </h1>
        <p style={{ color: C.sub, fontSize: 14, marginTop: 2 }}>
          {likesWithProfiles.length} {likesWithProfiles.length === 1 ? "person" : "people"} liked your profile
        </p>
      </div>
      <div className="likes-list-scroll" style={{ flex: 1, overflowY: "auto", padding: "0 16px 24px", display: "flex", flexDirection: "column", gap: 8 }}>
        {likesWithProfiles.map((like) => {
          const profile = like.profile;
          const likedPrompt = like.targetType === "prompt" && profile.prompts?.[like.targetIndex];

          return (
            <div
              key={like.id}
              style={{ borderRadius: 16, overflow: "hidden", background: C.card }}
            >
              <div
                style={{
                  display: "flex",
                  gap: 16,
                  padding: 16,
                  cursor: "pointer",
                }}
                onClick={() => setViewProfile(like.profile)}
              >
                <div style={{ position: "relative", flexShrink: 0 }}>
                  <img
                    src={profile.photos?.[0]}
                    alt={profile.name}
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: 12,
                      objectFit: "cover",
                    }}
                    onError={(e) => {
                      e.target.src = `https://ui-avatars.com/api/?name=${profile.name}&size=64&background=random`;
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      bottom: -4,
                      right: -4,
                      width: 20,
                      height: 20,
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: C.primary,
                      color: "white",
                    }}
                  >
                    <HeartIcon filled size={10} />
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span
                      style={{
                        fontWeight: 700,
                        fontSize: 16,
                        color: C.text,
                        fontFamily: FONT,
                      }}
                    >
                      {profile.name}, {profile.age}
                    </span>
                    <span style={{ fontSize: 12, color: C.sub }}>
                      {like.timeAgo || "Recently"}
                    </span>
                  </div>
                  <p style={{ fontSize: 12, color: C.sub, marginTop: 2 }}>
                    {profile.denomination}
                  </p>
                  {likedPrompt && (
                    <div
                      style={{
                        marginTop: 8,
                        borderRadius: 12,
                        padding: "8px 12px",
                        background: C.surface,
                      }}
                    >
                      <p
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          textTransform: "uppercase",
                          letterSpacing: "0.04em",
                          color: C.sub,
                          marginBottom: 2,
                        }}
                      >
                        {likedPrompt.prompt}
                      </p>
                      <p style={{ fontSize: 12, color: C.text }}>
                        {likedPrompt.answer}
                      </p>
                    </div>
                  )}
                  {like.comment && (
                    <div
                      style={{
                        marginTop: 8,
                        borderRadius: 12,
                        padding: "8px 12px",
                        background: C.surface,
                      }}
                    >
                      <p
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          textTransform: "uppercase",
                          letterSpacing: "0.04em",
                          color: C.sub,
                          marginBottom: 2,
                        }}
                      >
                        Comment
                      </p>
                      <p style={{ fontSize: 12, color: C.text }}>
                        "{like.comment}"
                      </p>
                    </div>
                  )}
                </div>
              </div>
              <div style={{ padding: "0 16px 16px", display: "flex", gap: 8 }}>
                <button
                  onClick={(e) => { e.stopPropagation(); handleLikeBack(like); }}
                  style={{
                    flex: 1,
                    padding: "12px 0",
                    borderRadius: 12,
                    fontSize: 14,
                    fontWeight: 700,
                    color: "white",
                    border: "none",
                    cursor: "pointer",
                    transition: "all 0.2s",
                    background: likedBack.has(like.id) ? "#444" : C.primary,
                  }}
                >
                  {likedBack.has(like.id) ? "Matched!" : "Like Back"}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setViewProfile(like.profile); }}
                  style={{
                    flex: 1,
                    padding: "12px 0",
                    borderRadius: 12,
                    fontSize: 14,
                    fontWeight: 700,
                    background: C.surface,
                    color: C.text,
                    border: "none",
                    cursor: "pointer",
                    transition: "all 0.2s",
                  }}
                >
                  View Profile
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {viewProfile && (
        <div
          style={{
            position: "fixed", inset: 0, maxWidth: 430, margin: "0 auto",
            zIndex: 200, background: C.bg, overflowY: "auto",
          }}
        >
          <div style={{ position: "relative" }}>
            <img
              src={viewProfile.photos?.[0]}
              alt={viewProfile.name}
              style={{ width: "100%", aspectRatio: "3/4", maxHeight: "56vh", objectFit: "cover" }}
              onError={(e) => { e.target.src = `https://ui-avatars.com/api/?name=${viewProfile.name}&size=600&background=random`; }}
            />
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 50%)", pointerEvents: "none" }} />
            <button
              onClick={() => setViewProfile(null)}
              style={{
                position: "absolute", top: 44, left: 16, width: 36, height: 36, borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center",
                background: "rgba(0,0,0,0.4)", backdropFilter: "blur(10px)", border: "none", cursor: "pointer",
              }}
            >
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5}><polyline points="15 18 9 12 15 6" /></svg>
            </button>
            <div style={{ position: "absolute", bottom: 20, left: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ color: "white", fontSize: 28, fontWeight: 700 }}>{viewProfile.name}</span>
                <span style={{ color: "rgba(255,255,255,0.8)", fontSize: 22, fontWeight: 300 }}>{viewProfile.age}</span>
              </div>
              <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, marginTop: 4 }}>
                {viewProfile.denomination}{viewProfile.location ? ` · ${viewProfile.location}` : ""}
              </p>
            </div>
          </div>
          <div style={{ padding: "20px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
            {(viewProfile.prompts || []).filter(p => p.prompt && p.answer).map((p, i) => (
              <div key={i} style={{ borderRadius: 16, overflow: "hidden", background: C.primarySoft }}>
                <div style={{ display: "flex" }}>
                  <div style={{ width: 4, flexShrink: 0, background: C.primary }} />
                  <div style={{ flex: 1, padding: "14px" }}>
                    <p style={{ fontSize: 10, fontWeight: 600, color: C.primary, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>{p.prompt}</p>
                    <p style={{ fontSize: 16, fontWeight: 600, color: C.text }}>{p.answer}</p>
                  </div>
                </div>
              </div>
            ))}
            {viewProfile.interests?.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: "8px 0" }}>
                {viewProfile.interests.map((v) => (
                  <span key={v} style={{ fontSize: 12, fontWeight: 600, padding: "6px 12px", borderRadius: 9999, background: C.surface, color: C.sub }}>{v}</span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
