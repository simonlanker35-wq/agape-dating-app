import { useState, useRef, useEffect } from "react";
import { useApp } from "../context/AppContext";
import AgapeCross from "../components/AgapeCross";

const C = { bg: "#FFFFFF", card: "#FAFAF8", surface: "#F4F2EE", primary: "#B8912A", primarySoft: "#FBF5E6", text: "#1A1612", sub: "#8C857C", border: "#E8E4DF", sent: "#111111" };
const FONT = "'Outfit', system-ui, sans-serif";

function BackIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function ChatThread({ match, onBack }) {
  const { state, actions } = useApp();
  const [text, setText] = useState("");
  const [reacting, setReacting] = useState(null);
  const [localMessages, setLocalMessages] = useState([]);
  const [viewProfile, setViewProfile] = useState(false);
  const [showReportMenu, setShowReportMenu] = useState(false);
  const [reportDone, setReportDone] = useState(null);
  const bottomRef = useRef(null);

  const currentUserId = state.currentUser?._id || state.currentUser?.id;
  const conversation = state.conversations[match.id];
  const profile = match.profile;

  const REACTIONS = ["🙏", "❤️", "😊", "🔥", "😂", "✨"];

  useEffect(() => {
    actions.loadMessages(match.id).catch(console.error);
  }, [match.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation?.messages?.length, localMessages.length]);

  const send = async () => {
    if (!text.trim()) return;
    const msg = text.trim();
    setText("");
    try {
      await actions.sendMessage(match.id, msg);
    } catch (err) {
      console.error("Send failed:", err);
    }
  };

  const messages = conversation?.messages || [];

  const formatTime = (ts) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", position: "fixed", inset: 0, maxWidth: 430, margin: "0 auto", zIndex: 200, background: C.bg }}>
      {/* Header */}
      <div
        style={{
          flexShrink: 0,
          padding: "40px 16px 12px",
          background: C.card,
          borderBottom: `1px solid ${C.border}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            onClick={onBack}
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: C.surface,
              color: C.text,
              border: "none",
              cursor: "pointer",
            }}
          >
            <BackIcon />
          </button>
          <div style={{ position: "relative", flexShrink: 0, cursor: "pointer" }} onClick={() => setViewProfile(true)}>
            <img
              src={profile.photos[0]}
              alt={profile.name}
              style={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                objectFit: "cover",
                border: `2px solid ${C.primary}`,
              }}
              onError={(e) => {
                e.target.src = `https://ui-avatars.com/api/?name=${profile.name}&size=40&background=random`;
              }}
            />
            <div
              style={{
                position: "absolute",
                bottom: -2,
                right: -2,
                width: 12,
                height: 12,
                borderRadius: "50%",
                background: "#22C55E",
                border: "2px solid white",
              }}
            />
          </div>
          <div style={{ flex: 1, minWidth: 0, cursor: "pointer" }} onClick={() => setViewProfile(true)}>
            <p style={{ fontWeight: 700, fontSize: 16, lineHeight: 1, color: C.text, fontFamily: FONT, margin: 0 }}>
              {profile.name}
            </p>
            <p style={{ fontSize: 12, color: "#22C55E", marginTop: 2 }}>Active now</p>
          </div>
          <button
            onClick={() => setShowReportMenu(true)}
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#FEF2F2",
              border: "none",
              cursor: "pointer",
            }}
          >
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth={2.5}>
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </button>
        </div>
        {/* Match banner */}
        <div
          style={{
            marginTop: 12,
            borderRadius: 12,
            padding: "8px 16px",
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: C.primarySoft,
          }}
        >
          <span style={{ color: C.primary }}>
            <AgapeCross size={11} strokeWidth={1.5} />
          </span>
          <p style={{ fontSize: 12, fontWeight: 600, color: C.primary, margin: 0 }}>
            You matched with {profile.name}{profile.denomination ? ` · ${profile.denomination}` : ""}
          </p>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
        {/* Date divider */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ flex: 1, height: 1, background: C.border }} />
          <span style={{ fontSize: 11, fontWeight: 600, color: C.sub }}>Today</span>
          <div style={{ flex: 1, height: 1, background: C.border }} />
        </div>

        {messages.map((msg) => {
          const isMe = msg.sender === currentUserId;
          return (
            <div
              key={msg.id}
              style={{ display: "flex", flexDirection: "column", alignItems: isMe ? "flex-end" : "flex-start" }}
            >
              <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
                {!isMe && (
                  <img
                    src={profile.photos[0]}
                    alt={profile.name}
                    style={{ width: 24, height: 24, borderRadius: "50%", objectFit: "cover", flexShrink: 0, marginBottom: 4 }}
                    onError={(e) => {
                      e.target.src = `https://ui-avatars.com/api/?name=${profile.name}&size=24&background=random`;
                    }}
                  />
                )}
                <div
                  style={{
                    maxWidth: "75%",
                    padding: "12px 16px",
                    borderRadius: 16,
                    background: isMe ? C.sent : C.card,
                    color: isMe ? "white" : C.text,
                    borderBottomRightRadius: isMe ? 6 : 16,
                    borderBottomLeftRadius: !isMe ? 6 : 16,
                    boxShadow: !isMe ? "0 1px 4px rgba(0,0,0,0.06)" : undefined,
                    cursor: "pointer",
                  }}
                  onDoubleClick={() => setReacting(reacting === msg.id ? null : msg.id)}
                >
                  <p style={{ fontSize: 14, lineHeight: 1.5, fontFamily: FONT, margin: 0 }}>
                    {msg.text}
                  </p>
                </div>
              </div>
              <p style={{ fontSize: 10, marginTop: 6, marginLeft: 32, marginRight: 32, color: C.sub }}>
                {formatTime(msg.timestamp)}
              </p>

              {/* Reaction picker */}
              {reacting === msg.id && (
                <div
                  style={{
                    display: "flex",
                    gap: 6,
                    marginTop: 4,
                    marginLeft: 32,
                    marginRight: 32,
                    borderRadius: 16,
                    padding: "8px 12px",
                    background: C.card,
                    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                  }}
                >
                  {REACTIONS.map((r) => (
                    <button
                      key={r}
                      onClick={() => setReacting(null)}
                      style={{ fontSize: 18, background: "none", border: "none", cursor: "pointer", transition: "all 0.2s" }}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Compose */}
      <div
        style={{
          flexShrink: 0,
          padding: "12px 16px",
          background: C.card,
          borderTop: `1px solid ${C.border}`,
        }}
      >
        {/* Quick replies */}
        <div style={{ display: "flex", gap: 8, marginBottom: 12, overflowX: "auto" }}>
          {["Amen to that 🙏", "Tell me more!", "That's beautiful ✨", "Same here!"].map((q) => (
            <button
              key={q}
              onClick={() => setText(q)}
              style={{
                flexShrink: 0,
                fontSize: 12,
                fontWeight: 600,
                padding: "6px 12px",
                borderRadius: 9999,
                whiteSpace: "nowrap",
                background: C.primarySoft,
                color: C.primary,
                border: "none",
                cursor: "pointer",
              }}
            >
              {q}
            </button>
          ))}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            borderRadius: 16,
            padding: "12px 16px",
            background: C.surface,
          }}
        >
          {/* Mic button */}
          <button
            style={{
              flexShrink: 0,
              color: C.sub,
              background: "none",
              border: "none",
              cursor: "pointer",
            }}
          >
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8" />
            </svg>
          </button>
          <input
            style={{
              flex: 1,
              fontSize: 14,
              background: "transparent",
              outline: "none",
              border: "none",
              color: C.text,
              fontFamily: FONT,
            }}
            placeholder={`Message ${profile.name}...`}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
          />
          <button
            onClick={send}
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: text.trim() ? C.primary : C.border,
              border: "none",
              cursor: "pointer",
            }}
          >
            <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5} strokeLinecap="round">
              <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Report / Block menu */}
      {showReportMenu && (
        <div
          onClick={() => { if (!reportDone) setShowReportMenu(false); }}
          style={{ position: "fixed", inset: 0, maxWidth: 430, margin: "0 auto", zIndex: 400, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", borderRadius: "24px 24px 0 0", background: C.bg, padding: "20px 16px 32px" }}>
            {reportDone ? (
              <div style={{ textAlign: "center", padding: "20px 0" }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>{reportDone === "block" ? "🚫" : reportDone === "report" ? "🚩" : "👋"}</div>
                <p style={{ fontSize: 16, fontWeight: 700, color: C.text, fontFamily: FONT, marginBottom: 4 }}>
                  {reportDone === "block" ? `${profile.name} has been blocked` : reportDone === "report" ? "Report submitted" : "Unmatched"}
                </p>
                <p style={{ fontSize: 13, color: C.sub, marginBottom: 20 }}>
                  {reportDone === "block" ? "They can no longer see your profile or contact you." : reportDone === "report" ? "Our team will review this. Thank you for keeping Agape safe." : `You and ${profile.name} have been unmatched.`}
                </p>
                <button
                  onClick={() => { setShowReportMenu(false); setReportDone(null); if (reportDone === "block" || reportDone === "unmatch") onBack(); }}
                  style={{ padding: "12px 32px", borderRadius: 9999, fontSize: 14, fontWeight: 700, background: C.text, color: "white", border: "none", cursor: "pointer" }}
                >
                  Done
                </button>
              </div>
            ) : (
              <>
                <div style={{ width: 36, height: 4, borderRadius: 2, background: C.border, margin: "0 auto 16px" }} />
                <p style={{ fontSize: 16, fontWeight: 700, color: C.text, fontFamily: FONT, textAlign: "center", marginBottom: 16 }}>{profile.name}</p>
                {[
                  { icon: "🚩", label: "Report", desc: "Flag inappropriate behaviour", color: "#EF4444", action: async () => { setReportDone("report"); } },
                  { icon: "🚫", label: "Block", desc: "They won't be able to see you", color: "#EF4444", action: async () => { try { await actions.unmatch(match.id); } catch (_) {} setReportDone("block"); } },
                  { icon: "👋", label: "Unmatch", desc: "Remove this match", color: C.text, action: async () => { try { await actions.unmatch(match.id); } catch (_) {} setReportDone("unmatch"); } },
                ].map((item) => (
                  <button
                    key={item.label}
                    onClick={item.action}
                    style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "14px 12px", borderRadius: 12, background: "none", border: "none", cursor: "pointer", textAlign: "left", marginBottom: 4 }}
                  >
                    <div style={{ width: 40, height: 40, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", background: C.surface, fontSize: 18 }}>{item.icon}</div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 14, fontWeight: 600, color: item.color, margin: 0 }}>{item.label}</p>
                      <p style={{ fontSize: 12, color: C.sub, marginTop: 2 }}>{item.desc}</p>
                    </div>
                    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={C.sub} strokeWidth={2}><polyline points="9 18 15 12 9 6" /></svg>
                  </button>
                ))}
                <button
                  onClick={() => setShowReportMenu(false)}
                  style={{ width: "100%", padding: "14px 0", borderRadius: 12, fontSize: 14, fontWeight: 600, background: C.surface, color: C.sub, border: "none", cursor: "pointer", marginTop: 8 }}
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {viewProfile && (
        <div
          style={{
            position: "fixed", inset: 0, maxWidth: 430, margin: "0 auto",
            zIndex: 300, background: C.bg, overflowY: "auto",
          }}
        >
          <div style={{ position: "relative" }}>
            <img
              src={profile.photos?.[0]}
              alt={profile.name}
              style={{ width: "100%", maxHeight: "56vh", objectFit: "cover", display: "block" }}
              onError={(e) => { e.target.src = `https://ui-avatars.com/api/?name=${profile.name}&size=600&background=random`; }}
            />
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 50%)", pointerEvents: "none" }} />
            <button
              onClick={() => setViewProfile(false)}
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
                <span style={{ color: "white", fontSize: 28, fontWeight: 700 }}>{profile.name}</span>
                <span style={{ color: "rgba(255,255,255,0.8)", fontSize: 22, fontWeight: 300 }}>{profile.age}</span>
              </div>
              <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, marginTop: 4 }}>
                {profile.denomination}{profile.location ? ` · ${profile.location}` : ""}
              </p>
            </div>
          </div>
          <div style={{ padding: "20px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
            {(profile.prompts || []).filter(p => p.prompt && p.answer).map((p, i) => (
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
            {profile.interests?.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: "8px 0" }}>
                {profile.interests.map((v) => (
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

export default function Matches() {
  const { state, actions } = useApp();
  const [activeChat, setActiveChat] = useState(null);

  const currentUserId = state.currentUser?._id || state.currentUser?.id;

  const activeMatch = activeChat
    ? state.matches.find((m) => m.id === activeChat)
    : null;

  if (activeMatch?.profile) {
    return <ChatThread match={activeMatch} onBack={() => setActiveChat(null)} />;
  }

  const sortedMatches = [...state.matches].sort((a, b) => {
    const aConvo = state.conversations[a.id];
    const bConvo = state.conversations[b.id];
    const aTime = aConvo?.lastActivity || a.timestamp;
    const bTime = bConvo?.lastActivity || b.timestamp;
    return bTime - aTime;
  });

  const formatTime = (ts) => {
    if (!ts) return "";
    const d = new Date(ts);
    const now = new Date();
    const diff = now - d;
    if (diff < 60000) return "Just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
    if (diff < 86400000) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: C.bg }}>
      <div style={{ padding: "40px 20px 16px" }}>
        <h1
          style={{
            color: C.text,
            fontFamily: FONT,
            fontSize: 24,
            fontWeight: 700,
            letterSpacing: "-0.4px",
            margin: 0,
          }}
        >
          Messages
        </h1>
      </div>

      <div style={{ flex: 1, overflowY: "auto", paddingBottom: 24 }}>
        {sortedMatches.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 20px", textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>💬</div>
            <h3 style={{ color: C.text, fontFamily: FONT, fontSize: 18, fontWeight: 700 }}>No messages yet</h3>
            <p style={{ color: C.sub, fontSize: 14, marginTop: 4 }}>When you match with someone, you can chat here.</p>
          </div>
        ) : (
          sortedMatches.map((m) => {
            const profile = m.profile;
            if (!profile) return null;
            const convo = state.conversations[m.id];
            const lastMsg = convo?.messages?.[convo.messages.length - 1];
            const hasUnread = lastMsg && lastMsg.sender !== currentUserId;

            return (
              <button
                key={m.id}
                onClick={() => setActiveChat(m.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  width: "100%",
                  padding: "16px 20px",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  borderBottom: `1px solid ${C.border}`,
                  textAlign: "left",
                }}
              >
                {/* Large round photo */}
                <div style={{ position: "relative", flexShrink: 0 }}>
                  <img
                    src={profile.photos[0]}
                    alt={profile.name}
                    style={{
                      width: 74,
                      height: 74,
                      borderRadius: "50%",
                      objectFit: "cover",
                      display: "block",
                    }}
                    onError={(e) => {
                      e.target.src = `https://ui-avatars.com/api/?name=${profile.name}&size=74&background=random`;
                    }}
                  />
                  {/* Gold ring on unread */}
                  {hasUnread && (
                    <div
                      style={{
                        position: "absolute",
                        inset: -3,
                        borderRadius: "50%",
                        border: `2.5px solid ${C.primary}`,
                        pointerEvents: "none",
                      }}
                    />
                  )}
                  {/* Online indicator */}
                  <div
                    style={{
                      position: "absolute",
                      bottom: 3,
                      right: 3,
                      width: 11,
                      height: 11,
                      borderRadius: "50%",
                      background: "#22C55E",
                      border: `2px solid ${C.bg}`,
                    }}
                  />
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* Name + timestamp */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                    <span style={{ fontWeight: 700, fontSize: 16, color: C.text, fontFamily: FONT }}>
                      {profile.name}
                    </span>
                    <span style={{ fontSize: 10, color: C.sub, fontFamily: FONT, flexShrink: 0 }}>
                      {lastMsg ? formatTime(lastMsg.timestamp) : ""}
                    </span>
                  </div>
                  {/* Denomination */}
                  {profile.denomination && (
                    <p style={{ fontSize: 11, color: C.primary, fontWeight: 600, fontFamily: FONT, marginBottom: 5, margin: "0 0 5px 0" }}>
                      {profile.denomination}
                    </p>
                  )}
                  {/* Message preview */}
                  <p
                    style={{
                      fontSize: 12,
                      color: C.sub,
                      fontFamily: FONT,
                      overflow: "hidden",
                      whiteSpace: "nowrap",
                      textOverflow: "ellipsis",
                      maxWidth: 180,
                      margin: 0,
                    }}
                  >
                    {lastMsg
                      ? (lastMsg.sender === currentUserId ? "You: " : "") + lastMsg.text.slice(0, 30) + (lastMsg.text.length > 30 ? "..." : "")
                      : "Start the conversation ✨"}
                  </p>
                </div>

                {/* Unread dot */}
                {hasUnread && (
                  <div
                    style={{
                      width: 9,
                      height: 9,
                      borderRadius: "50%",
                      background: C.primary,
                      flexShrink: 0,
                    }}
                  />
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
