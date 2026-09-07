import { useApp } from "../context/AppContext";
import { Search, Heart, MessageCircle, Star, User } from "lucide-react";

const TABS = [
  { id: "discover", icon: Search, label: "Discover" },
  { id: "likes", icon: Heart, label: "Likes" },
  { id: "matches", icon: MessageCircle, label: "Matches" },
  { id: "standouts", icon: Star, label: "Standouts" },
  { id: "profile", icon: User, label: "Profile" },
];

export default function Navigation() {
  const { state, dispatch } = useApp();
  const { activeTab, likesReceived, matches } = state;

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
      {TABS.map(({ id, icon: Icon, label }) => {
        const count = unreadCount(id);
        return (
          <button
            key={id}
            className={`nav-tab ${activeTab === id ? "active" : ""}`}
            onClick={() => dispatch({ type: "SET_TAB", payload: id })}
          >
            <div className="nav-icon-wrapper">
              <Icon size={22} fill={activeTab === id ? "var(--gold)" : "none"} />
              {count > 0 && <span className="badge">{count}</span>}
            </div>
            <span className="nav-label">{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
