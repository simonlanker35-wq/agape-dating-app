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
  const { state, actions } = useApp();
  const [open, setOpen] = useState(null);
  const [likedBack, setLikedBack] = useState(new Set());
  const [bouncing, setBouncing] = useState(null);

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
          const isOpen = open === like.id;

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
                onClick={() => setOpen(isOpen ? null : like.id)}
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
              {isOpen && (
                <div style={{ padding: "0 16px 16px", display: "flex", gap: 8 }}>
                  <button
                    onClick={() => handleLikeBack(like)}
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
                    {likedBack.has(like.id) ? "✓ Matched!" : "Like Back"}
                  </button>
                  <button
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
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
