import { useState, useRef, useEffect } from "react";
import { useApp } from "../context/AppContext";
import { Send, ArrowLeft, Phone, Video, MoreHorizontal, Image, Smile, Mic, MicOff, Play, Pause } from "lucide-react";

export default function Matches() {
  const { state, dispatch } = useApp();
  const [activeChat, setActiveChat] = useState(null);
  const [messageText, setMessageText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const recordingInterval = useRef(null);
  const messagesEndRef = useRef(null);

  const activeChatProfile = activeChat
    ? state.profiles.find((p) => p.id === activeChat)
    : null;

  const conversation = activeChat ? state.conversations[activeChat] : null;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation?.messages?.length]);

  const handleSend = () => {
    if (!messageText.trim() || !activeChat) return;
    dispatch({
      type: "SEND_MESSAGE",
      payload: { profileId: activeChat, text: messageText.trim() },
    });
    setMessageText("");
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const startRecording = () => {
    setIsRecording(true);
    setRecordingTime(0);
    recordingInterval.current = setInterval(() => {
      setRecordingTime((t) => t + 1);
    }, 1000);
  };

  const stopRecording = () => {
    setIsRecording(false);
    clearInterval(recordingInterval.current);
    const duration = recordingTime;
    setRecordingTime(0);
    if (duration > 0 && activeChat) {
      dispatch({
        type: "SEND_MESSAGE",
        payload: { profileId: activeChat, text: `🎙️ Voice message (0:${String(duration).padStart(2, "0")})` },
      });
    }
  };

  const cancelRecording = () => {
    setIsRecording(false);
    clearInterval(recordingInterval.current);
    setRecordingTime(0);
  };

  const formatTime = (ts) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  if (activeChat && activeChatProfile) {
    return (
      <div className="chat-view">
        <div className="chat-header">
          <button className="chat-back-btn" onClick={() => setActiveChat(null)}>
            <ArrowLeft size={20} />
          </button>
          <img
            src={activeChatProfile.photos[0]}
            alt={activeChatProfile.name}
            className="chat-header-photo"
            onError={(e) => {
              e.target.src = `https://ui-avatars.com/api/?name=${activeChatProfile.name}&size=40&background=random`;
            }}
          />
          <div className="chat-header-info">
            <h3>{activeChatProfile.name}</h3>
            <span className="chat-status">Active now</span>
          </div>
          <div className="chat-header-actions">
            <button className="icon-btn"><Phone size={18} /></button>
            <button className="icon-btn"><Video size={18} /></button>
          </div>
        </div>

        <div className="chat-messages">
          <div className="chat-match-notice">
            <img
              src={activeChatProfile.photos[0]}
              alt={activeChatProfile.name}
              className="match-notice-photo"
              onError={(e) => {
                e.target.src = `https://ui-avatars.com/api/?name=${activeChatProfile.name}&size=60&background=random`;
              }}
            />
            <p>You matched with {activeChatProfile.name}</p>
            <span className="match-date">
              {new Date(
                state.matches.find((m) => m.profileId === activeChat)?.timestamp || Date.now()
              ).toLocaleDateString()}
            </span>
          </div>

          {conversation?.messages.map((msg) => {
            const isVoice = msg.text.startsWith("🎙️");
            return (
              <div
                key={msg.id}
                className={`chat-message ${msg.sender === "me" ? "sent" : "received"}`}
              >
                {msg.sender !== "me" && (
                  <img
                    src={activeChatProfile.photos[0]}
                    alt=""
                    className="message-avatar"
                    onError={(e) => {
                      e.target.src = `https://ui-avatars.com/api/?name=${activeChatProfile.name}&size=32&background=random`;
                    }}
                  />
                )}
                <div className="message-bubble">
                  {isVoice ? (
                    <div className="voice-message-bubble">
                      <button className="voice-play-btn">
                        <Play size={14} />
                      </button>
                      <div className="voice-waveform">
                        {Array.from({ length: 20 }, (_, i) => (
                          <div
                            key={i}
                            className="voice-waveform-bar"
                            style={{
                              height: `${4 + Math.random() * 20}px`,
                            }}
                          />
                        ))}
                      </div>
                      <span className="voice-duration">
                        {msg.text.match(/\((.+?)\)/)?.[1] || "0:05"}
                      </span>
                    </div>
                  ) : (
                    <p>{msg.text}</p>
                  )}
                  <span className="message-time">{formatTime(msg.timestamp)}</span>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        <div className="chat-input-area">
          {isRecording ? (
            <div className="voice-recording-bar">
              <button className="voice-cancel-btn" onClick={cancelRecording}>
                <MicOff size={18} />
              </button>
              <div className="recording-indicator">
                <span className="recording-dot" />
                <span className="recording-time">
                  0:{String(recordingTime).padStart(2, "0")}
                </span>
              </div>
              <button className="voice-send-btn" onClick={stopRecording}>
                <Send size={18} />
              </button>
            </div>
          ) : (
            <>
              <button className="icon-btn"><Image size={20} /></button>
              <button className="icon-btn"><Smile size={20} /></button>
              <input
                type="text"
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a message..."
                className="chat-input"
              />
              {messageText.trim() ? (
                <button className="send-btn" onClick={handleSend}>
                  <Send size={18} />
                </button>
              ) : (
                <button className="mic-btn" onClick={startRecording}>
                  <Mic size={20} />
                </button>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  const sortedMatches = [...state.matches].sort((a, b) => {
    const aConvo = state.conversations[a.profileId];
    const bConvo = state.conversations[b.profileId];
    const aTime = aConvo?.lastActivity || a.timestamp;
    const bTime = bConvo?.lastActivity || b.timestamp;
    return bTime - aTime;
  });

  const newMatches = sortedMatches.filter(
    (m) => !state.conversations[m.profileId]?.messages?.length
  );
  const activeConversations = sortedMatches.filter(
    (m) => state.conversations[m.profileId]?.messages?.length > 0
  );

  return (
    <div className="matches-page">
      <h2 className="matches-title">Matches</h2>

      {sortedMatches.length === 0 ? (
        <div className="matches-empty">
          <h3>No matches yet</h3>
          <p>When you match with someone, you can chat with them here.</p>
        </div>
      ) : (
        <>
          {newMatches.length > 0 && (
            <div className="matches-section">
              <h3 className="section-label">New Matches</h3>
              <div className="new-matches-row">
                {newMatches.map((match) => (
                  <button
                    key={match.profileId}
                    className="new-match-card"
                    onClick={() => setActiveChat(match.profileId)}
                  >
                    <img
                      src={match.profile.photos[0]}
                      alt={match.profile.name}
                      className="new-match-photo"
                      onError={(e) => {
                        e.target.src = `https://ui-avatars.com/api/?name=${match.profile.name}&size=80&background=random`;
                      }}
                    />
                    <span className="new-match-name">{match.profile.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeConversations.length > 0 && (
            <div className="matches-section">
              <h3 className="section-label">Messages</h3>
              <div className="conversations-list">
                {activeConversations.map((match) => {
                  const convo = state.conversations[match.profileId];
                  const lastMsg = convo?.messages[convo.messages.length - 1];
                  return (
                    <button
                      key={match.profileId}
                      className="conversation-row"
                      onClick={() => setActiveChat(match.profileId)}
                    >
                      <img
                        src={match.profile.photos[0]}
                        alt={match.profile.name}
                        className="convo-photo"
                        onError={(e) => {
                          e.target.src = `https://ui-avatars.com/api/?name=${match.profile.name}&size=56&background=random`;
                        }}
                      />
                      <div className="convo-info">
                        <div className="convo-name-row">
                          <span className="convo-name">{match.profile.name}</span>
                          <span className="convo-time">
                            {lastMsg ? formatTime(lastMsg.timestamp) : ""}
                          </span>
                        </div>
                        <p className="convo-preview">
                          {lastMsg
                            ? `${lastMsg.sender === "me" ? "You: " : ""}${lastMsg.text}`
                            : "Start the conversation!"}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function formatTime(ts) {
  const d = new Date(ts);
  const now = new Date();
  const diff = now - d;
  if (diff < 60000) return "Just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
  if (diff < 86400000) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}
