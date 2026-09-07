import { AppProvider, useApp } from "./context/AppContext";
import Navigation from "./components/Navigation";
import Onboarding from "./pages/Onboarding";
import Discover from "./pages/Discover";
import LikesYou from "./pages/LikesYou";
import Matches from "./pages/Matches";
import Standouts from "./pages/Standouts";
import Profile from "./pages/Profile";
import AgapeCross from "./components/AgapeCross";
import "./App.css";

function AppContent() {
  const { state } = useApp();

  if (!state.onboardingComplete) {
    return <Onboarding />;
  }

  const renderPage = () => {
    switch (state.activeTab) {
      case "discover":
        return <Discover />;
      case "likes":
        return <LikesYou />;
      case "matches":
        return <Matches />;
      case "standouts":
        return <Standouts />;
      case "profile":
        return <Profile />;
      default:
        return <Discover />;
    }
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="app-logo">
          <AgapeCross size={20} strokeWidth={1.5} />
          <span>Agape</span>
        </div>
      </header>
      <main className="app-main">{renderPage()}</main>
      <Navigation />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
