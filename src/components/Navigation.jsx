import { useApp } from "../context/AppContext";
import { Compass, Heart, MessageCircle, User, Zap } from "lucide-react";
import DoveIcon from "./DoveIcon";
import AgapeCross from "./AgapeCross";

const TABS = [
  { id: "discover", label: "Seek" },
  { id: "standouts", label: "Chosen" },
  { id: "likes", label: "Sparks" },
  { id: "matches", label: "Messages" },
  { id: "profile", label: "Me" },
];

function NavIcon({ id, active }) {
  const color = active ? "white" : "#888";
  const sw = active ? 2.2 : 2;

  switch (id) {
    case "discover":
      return (
        <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={sw}>
          <circle cx="12" cy="12" r="10" />
          <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" fill={active ? "white" : "none"} />
        </svg>
      );
    case "standouts":
      return (
        <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={sw}>
          <path d="M12 2L9 9H2l6 4.5L5.5 21 12 16.5 18.5 21 16 13.5 22 9h-7z" fill={active ? "white" : "none"} />
        </svg>
      );
    case "likes":
      return (
        <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={sw}>
          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" fill={active ? "white" : "none"} />
        </svg>
      );
    case "matches":
      return (
        <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      );
    default:
      return <User size={20} color={color} />;
  }
}

export default function Navigation() {
  const { state, dispatch } = useApp();
  const { activeTab, likesReceived } = state;

  const unreadCount = (tab) => {
    if (tab === "likes") return likesReceived.length;
    if (tab === "matches") {
      return Object.values(state.conversations).filter(
        (c) => c.messages?.length > 0 && c.messages[c.messages.length - 1].sender !== "me"
      ).length;
    }
    return 0;
  };

  return (
    <nav className="bottom-nav">
      <div className="bottom-nav-pill">
        {TABS.map(({ id, label }) => {
          const count = unreadCount(id);
          const isActive = activeTab === id;

          if (id === "profile") {
            return (
              <button
                key={id}
                className={`nav-tab ${isActive ? "active" : ""}`}
                onClick={() => dispatch({ type: "SET_TAB", payload: id })}
              >
                <div className="nav-icon-wrapper">
                  <img
                    src={state.user?.photos?.[0] || `https://ui-avatars.com/api/?name=${state.user?.name || "Me"}&size=48&background=random`}
                    alt="Me"
                    className="nav-me-photo"
                  />
                </div>
                <span className="nav-label">{label}</span>
              </button>
            );
          }

          return (
            <button
              key={id}
              className={`nav-tab ${isActive ? "active" : ""}`}
              onClick={() => dispatch({ type: "SET_TAB", payload: id })}
            >
              <div className="nav-icon-wrapper">
                <NavIcon id={id} active={isActive} />
                {count > 0 && <span className="badge">{count}</span>}
              </div>
              <span className="nav-label">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
