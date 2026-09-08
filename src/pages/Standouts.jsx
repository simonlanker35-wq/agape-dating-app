import { useState, useMemo } from "react";
import { useApp } from "../context/AppContext";
import AgapeCross from "../components/AgapeCross";

const C = { bg: "#FFFFFF", card: "#FAFAF8", surface: "#F4F2EE", primary: "#B8912A", primarySoft: "#FBF5E6", text: "#1A1612", sub: "#8C857C", border: "#E8E4DF", sent: "#111111" };
const FONT = "'Outfit', system-ui, sans-serif";
const SERIF = "'Lora', Georgia, serif";

export default function Standouts() {
  const { state, dispatch } = useApp();
  const [idx, setIdx] = useState(0);
  const [photoIdx, setPhotoIdx] = useState(0);
  const [dovePhase, setDovePhase] = useState("idle");

  const standoutProfiles = useMemo(() => {
    return state.profiles.filter(
      (p) =>
        p.isStandout &&
        !state.likes.some((l) => l.profileId === p.id) &&
        p.id !== "current_user"
    );
  }, [state.profiles, state.likes]);

  const profile = standoutProfiles[idx];

  if (!profile || standoutProfiles.length === 0) {
    return (
      <div className="flex flex-col h-full items-center justify-center" style={{ background: C.bg }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⭐</div>
        <h2 style={{ color: C.text, fontFamily: FONT, fontSize: 20, fontWeight: 700 }}>No standouts right now</h2>
        <p style={{ color: C.sub, fontSize: 14, marginTop: 4 }}>Check back later for top picks.</p>
      </div>
    );
  }

  const photos = profile.photos || [];
  const prompts = (profile.prompts || []).filter(p => p.prompt && p.answer);

  const advance = () => {
    setDovePhase("idle");
    setPhotoIdx(0);
    setIdx((i) => (i + 1) % standoutProfiles.length);
  };

  const handleDove = () => {
    if (dovePhase !== "idle" || state.doves <= 0) return;
    setDovePhase("burst");
    dispatch({
      type: "LIKE_PROFILE",
      payload: {
        profileId: profile.id,
        targetType: "profile",
        targetIndex: 0,
        comment: null,
        isDove: true,
      },
    });
    setTimeout(() => setDovePhase("sent"), 500);
    setTimeout(() => advance(), 1600);
  };

  return (
    <div className="flex flex-col h-full relative" style={{ background: C.bg }}>
      {/* Dove animation overlay */}
      {dovePhase !== "idle" && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
            zIndex: 50,
          }}
        >
          <div style={{ animation: "bigDoveIn 0.5s cubic-bezier(.34,1.56,.64,1) forwards" }}>
            <span style={{ fontSize: 96, lineHeight: 1, filter: "drop-shadow(0 8px 24px rgba(0,0,0,0.3))" }}>
              🕊️
            </span>
          </div>
          <p
            style={{
              marginTop: 12,
              fontSize: 14,
              fontWeight: 700,
              color: "white",
              letterSpacing: "0.04em",
              animation: "bigDoveIn 0.5s 0.1s cubic-bezier(.34,1.56,.64,1) both",
              textShadow: "0 2px 8px rgba(0,0,0,0.5)",
            }}
          >
            Dove sent to {profile.name}
          </p>
        </div>
      )}

      <div style={{ flex: 1, overflowY: "auto", position: "relative" }}>
        {/* Hero photo */}
        <div style={{ position: "relative", background: "#ddd" }}>
          <div style={{ aspectRatio: "3/4", maxHeight: "56vh", position: "relative" }}>
            <img
              src={photos[photoIdx] || photos[0]}
              alt={profile.name}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                opacity: dovePhase === "sent" ? 0.3 : 1,
                transition: "opacity 0.3s",
              }}
              onError={(e) => {
                e.target.src = `https://ui-avatars.com/api/?name=${profile.name}&size=600&background=random`;
              }}
            />
            {/* Tap zones */}
            <div style={{ position: "absolute", inset: 0, display: "flex" }}>
              <div style={{ flex: 1 }} onClick={() => setPhotoIdx((p) => Math.max(0, p - 1))} />
              <div style={{ flex: 1 }} onClick={() => setPhotoIdx((p) => Math.min(photos.length - 1, p + 1))} />
            </div>
          </div>

          {/* Top gradient */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(to bottom, rgba(0,0,0,0.44) 0%, rgba(0,0,0,0.08) 35%, transparent 55%)",
              pointerEvents: "none",
            }}
          />

          {/* Photo dots */}
          {photos.length > 1 && (
            <div style={{ position: "absolute", left: 12, right: 12, top: 52, display: "flex", gap: 4 }}>
              {photos.map((_, i) => (
                <div
                  key={i}
                  style={{
                    height: 4,
                    flex: 1,
                    borderRadius: 9999,
                    transition: "all 0.2s",
                    background: i === photoIdx ? "white" : "rgba(255,255,255,0.4)",
                  }}
                />
              ))}
            </div>
          )}

          {/* Badge + buttons row */}
          <div
            style={{
              position: "absolute",
              top: 64,
              left: 12,
              right: 12,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              zIndex: 11,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                background: "rgba(184,145,42,0.9)",
                backdropFilter: "blur(8px)",
                borderRadius: 20,
                padding: "5px 12px",
              }}
            >
              <span style={{ fontSize: 11 }}>✦</span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "white",
                  fontFamily: FONT,
                  letterSpacing: "0.04em",
                }}
              >
                CHOSEN FOR YOU
              </span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "rgba(0,0,0,0.32)",
                  backdropFilter: "blur(10px)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  cursor: "pointer",
                }}
              >
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5}>
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              </button>
              <button
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "rgba(0,0,0,0.32)",
                  backdropFilter: "blur(10px)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  cursor: "pointer",
                }}
              >
                <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2}>
                  <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                </svg>
              </button>
            </div>
          </div>

          {/* Bottom gradient + identity + action buttons */}
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              background: "linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.6) 45%, transparent 100%)",
              padding: "80px 16px 44px",
            }}
          >
            {/* Name row */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 7,
                marginBottom: 18,
              }}
            >
              <span
                style={{
                  color: "white",
                  fontFamily: SERIF,
                  fontSize: 28,
                  fontWeight: 700,
                  lineHeight: 1,
                  letterSpacing: "-0.5px",
                }}
              >
                {profile.name}
              </span>
              <span
                style={{
                  color: "rgba(255,255,255,0.85)",
                  fontFamily: FONT,
                  fontSize: 22,
                  fontWeight: 300,
                  lineHeight: 1,
                }}
              >
                {profile.age}
              </span>
              <svg width={15} height={15} viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
                <circle cx="12" cy="12" r="10" fill={C.primary} />
                <path d="M9 12l2 2 4-4" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
              </svg>
              {profile.location && (
                <>
                  <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 13 }}>·</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                    <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth={2}>
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                    <span style={{ color: "rgba(255,255,255,0.75)", fontSize: 12, fontFamily: FONT }}>
                      {profile.location}
                    </span>
                  </div>
                </>
              )}
              {profile.denomination && (
                <>
                  <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 13 }}>·</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                    <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 10 }}>✝</span>
                    <span style={{ color: "rgba(255,255,255,0.75)", fontSize: 12, fontFamily: FONT }}>
                      {profile.denomination}
                    </span>
                  </div>
                </>
              )}
            </div>
            {/* Action buttons: Skip · Dove */}
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button
                onClick={advance}
                style={{
                  flex: 1,
                  height: 48,
                  borderRadius: 999,
                  background: "rgba(255,255,255,0.15)",
                  backdropFilter: "blur(12px)",
                  border: "1.5px solid rgba(255,255,255,0.25)",
                  color: "white",
                  fontSize: 18,
                  cursor: "pointer",
                }}
              >
                ✕
              </button>
              <button
                onClick={handleDove}
                style={{
                  flex: 1.4,
                  height: 54,
                  borderRadius: 999,
                  background: dovePhase === "sent" ? "#D4AF37" : C.primary,
                  boxShadow: `0 6px 24px ${C.primary}88`,
                  fontSize: 22,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                🕊️
              </button>
            </div>
          </div>
        </div>

        {/* White sheet */}
        <div
          style={{
            background: C.bg,
            borderRadius: "28px 28px 0 0",
            marginTop: -28,
            position: "relative",
            zIndex: 2,
            padding: "24px 16px 0",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 16, paddingBottom: 24 }}>
            {/* Why they're chosen */}
            {profile.compatibilityReason && (
              <div
                style={{
                  borderRadius: 16,
                  overflow: "hidden",
                  background: C.primarySoft,
                  border: `1.5px solid ${C.primary}44`,
                }}
              >
                <div style={{ display: "flex" }}>
                  <div style={{ width: 4, flexShrink: 0, background: C.primary, borderRadius: "4px 0 0 4px" }} />
                  <div style={{ flex: 1, padding: "14px 14px 12px" }}>
                    <p
                      style={{
                        fontSize: 10,
                        fontWeight: 600,
                        color: C.primary,
                        textTransform: "uppercase",
                        letterSpacing: "0.1em",
                        marginBottom: 8,
                      }}
                    >
                      ✦ Why they were chosen
                    </p>
                    <p style={{ fontSize: 18, fontWeight: 600, lineHeight: 1.3, color: C.text, fontFamily: FONT }}>
                      {profile.compatibilityReason}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Prompts */}
            {prompts.map((p, i) => (
              <div
                key={i}
                style={{
                  borderRadius: 16,
                  overflow: "hidden",
                  background: C.primarySoft,
                  border: "none",
                }}
              >
                <div style={{ display: "flex" }}>
                  <div style={{ width: 4, flexShrink: 0, background: C.primary, borderRadius: "4px 0 0 4px" }} />
                  <div style={{ flex: 1, padding: "14px 14px 12px" }}>
                    <p
                      style={{
                        fontSize: 10,
                        fontWeight: 600,
                        color: C.primary,
                        textTransform: "uppercase",
                        letterSpacing: "0.1em",
                        marginBottom: 8,
                      }}
                    >
                      {p.prompt}
                    </p>
                    <p style={{ fontSize: 18, fontWeight: 600, lineHeight: 1.3, color: C.text, fontFamily: FONT }}>
                      {p.answer}
                    </p>
                  </div>
                </div>
              </div>
            ))}

            {/* Faith + values */}
            <div
              style={{
                borderRadius: 16,
                padding: 14,
                display: "flex",
                alignItems: "center",
                gap: 12,
                background: C.primarySoft,
              }}
            >
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  background: C.primary,
                  color: "white",
                }}
              >
                <AgapeCross size={11} strokeWidth={1.5} />
              </div>
              <div>
                <p style={{ fontSize: 12, fontWeight: 600, color: C.primary }}>
                  {profile.denomination}
                </p>
                <p style={{ fontSize: 12, color: C.sub, marginTop: 2 }}>
                  {profile.location}
                </p>
              </div>
            </div>

            {profile.interests?.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, paddingBottom: 8 }}>
                {profile.interests.map((v) => (
                  <span
                    key={v}
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      padding: "6px 12px",
                      borderRadius: 9999,
                      background: C.surface,
                      color: C.sub,
                      border: `1px solid ${C.border}`,
                    }}
                  >
                    {v}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
