import { useApp } from "../context/AppContext";
import AgapeCross from "./AgapeCross";
import VerifiedBadge from "./VerifiedBadge";
import { track } from "../services/posthog";

// Full-screen "It's a Match" celebration. Shown for every new match, on whatever screen the user is on:
// their own like completing a match, liking back in Sparks, or the other person liking back later.
export default function MatchAlert() {
  const { state, dispatch } = useApp();
  const alert = state.matchAlert;
  if (!alert) return null;

  const { match } = alert;
  const them = match.profile || {};
  const name = them.name || "your match";
  const myPhoto = state.currentUser?.photos?.[0];
  const myName = state.currentUser?.name || "You";

  const dismiss = () => { track("match_keep_browsing_tapped"); dispatch({ type: "DISMISS_MATCH" }); };
  const openChat = () => {
    track("match_send_message_tapped");
    dispatch({ type: "DISMISS_MATCH" });
    dispatch({ type: "OPEN_CHAT", payload: match.id });
  };

  const colors = ["#B8912A", "#F5D878", "#E8C44A", "#ffffff", "#111111", "#D4AF37"];

  return (
    <div className="match-celebration-overlay" style={{ zIndex: 10000 }} onClick={dismiss}>
      <div className="match-confetti">
        {Array.from({ length: 28 }, (_, i) => (
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
        ))}
      </div>
      <div className="match-reveal" onClick={(e) => e.stopPropagation()}>
        <div className="match-cross">
          <AgapeCross size={22} strokeWidth={1.5} />
        </div>
        <div className="match-label">It's a Match</div>
        <h2 className="match-title shimmer-gold">You &amp; {name}</h2>
        <div className="match-subtitle">You both liked each other ✦</div>
        {them.isVerified && (
          <div style={{ display: "flex", justifyContent: "center", marginTop: 10 }}>
            <VerifiedBadge size={18} label />
          </div>
        )}
        <div className="match-photos">
          <div className="pulse-ring">
            <img
              src={myPhoto || `https://ui-avatars.com/api/?name=${encodeURIComponent(myName)}&size=200&background=FBF5E6&color=B8912A`}
              alt="You"
              onError={(e) => { e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(myName)}&size=200&background=FBF5E6&color=B8912A`; }}
            />
          </div>
          <span className="match-sparkle">✦</span>
          <div className="pulse-ring">
            <img
              src={them.photos?.[0] || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&size=200&background=FBF5E6&color=B8912A`}
              alt={name}
              onError={(e) => { e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&size=200&background=FBF5E6&color=B8912A`; }}
            />
          </div>
        </div>
        <button className="match-celebration-btn" onClick={openChat}>Send a message</button>
        <button className="match-celebration-dismiss" onClick={dismiss}>Keep browsing</button>
      </div>
    </div>
  );
}
