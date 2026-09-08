import { useApp } from "../context/AppContext";
import { Compass, Heart, MessageCircle, User } from "lucide-react";
import DoveIcon from "./DoveIcon";

const TABS = [
  { id: "discover", icon: Compass, label: "Seek" },
  { id: "likes", icon: Heart, label: "Liked" },
  { id: "standouts", icon: DoveIcon, label: "Chosen", isDove: true },
  { id: "matches", icon: MessageCircle, label: "Messages" },
  { id: "profile", icon: User, label: "Profile" },
];

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
      {TABS.map(({ id, icon: Icon, label, isDove }) => {
        const count = unreadCount(id);
        const isActive = activeTab === id;
        return (
          <button
            key={id}
            className={`nav-tab ${isActive ? "active" : ""}`}
            onClick={() => dispatch({ type: "SET_TAB", payload: id })}
          >
            <div className={`nav-icon-wrapper ${isActive ? "nav-active-ring" : ""}`}>
              {isDove ? (
                <DoveIcon size={22} color={isActive ? "var(--gold)" : "#bbb"} />
              ) : (
                <Icon size={22} />
              )}
              {count > 0 && <span className="badge">{count}</span>}
            </div>
            <span className="nav-label">{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
