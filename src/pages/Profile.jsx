import { useState } from "react";
import { useApp } from "../context/AppContext";
import {
  Settings, ChevronRight, Shield, Bell, HelpCircle,
  LogOut, Eye, Sliders, User, Heart, Camera, MapPin,
  Briefcase, GraduationCap, Church,
} from "lucide-react";

export default function Profile() {
  const { state } = useApp();
  const { currentUser } = state;
  const [showSettings, setShowSettings] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  if (!currentUser) return null;

  if (showFilters) {
    return <FiltersView onBack={() => setShowFilters(false)} />;
  }

  return (
    <div className="profile-page">
      <div className="profile-page-header">
        <h2>My Profile</h2>
        <button className="icon-btn" onClick={() => setShowSettings(!showSettings)}>
          <Settings size={20} />
        </button>
      </div>

      {/* Profile Preview */}
      <div className="my-profile-card">
        <div className="my-profile-photos">
          <img
            src={currentUser.photos?.[0]}
            alt={currentUser.name}
            className="my-profile-main-photo"
            onError={(e) => {
              e.target.src = `https://ui-avatars.com/api/?name=${currentUser.name}&size=300&background=random`;
            }}
          />
          <button className="edit-photo-btn">
            <Camera size={16} /> Edit
          </button>
        </div>
        <div className="my-profile-info">
          <h3>{currentUser.name}, {currentUser.age}</h3>
          {currentUser.denomination && (
            <p className="denomination-detail"><Church size={14} /> {currentUser.denomination}</p>
          )}
          {currentUser.job && (
            <p><Briefcase size={14} /> {currentUser.job}</p>
          )}
          {currentUser.school && (
            <p><GraduationCap size={14} /> {currentUser.school}</p>
          )}
          {currentUser.location && (
            <p><MapPin size={14} /> {currentUser.location}</p>
          )}
        </div>
      </div>

      {/* Prompts */}
      <div className="my-profile-section">
        <h4>My Prompts</h4>
        {currentUser.prompts
          ?.filter((p) => p.prompt && p.answer)
          .map((p, i) => (
            <div key={i} className="my-prompt-card">
              <div className="prompt-question">{p.prompt}</div>
              <div className="prompt-answer">{p.answer}</div>
            </div>
          ))}
      </div>

      {/* Interests */}
      {currentUser.interests?.length > 0 && (
        <div className="my-profile-section">
          <h4>Interests</h4>
          <div className="interests-display">
            {currentUser.interests.map((interest) => (
              <span key={interest} className="interest-tag">{interest}</span>
            ))}
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="profile-stats">
        <div className="stat-card">
          <Heart size={20} />
          <span className="stat-number">{state.likes.length}</span>
          <span className="stat-label">Likes Sent</span>
        </div>
        <div className="stat-card">
          <Eye size={20} />
          <span className="stat-number">{state.likesReceived.length}</span>
          <span className="stat-label">Likes Received</span>
        </div>
        <div className="stat-card">
          <User size={20} />
          <span className="stat-number">{state.matches.length}</span>
          <span className="stat-label">Matches</span>
        </div>
      </div>

      {/* Menu Items */}
      <div className="profile-menu">
        <button className="menu-item" onClick={() => setShowFilters(true)}>
          <Sliders size={18} />
          <span>Preferences</span>
          <ChevronRight size={16} />
        </button>
        <button className="menu-item">
          <Shield size={18} />
          <span>Privacy & Safety</span>
          <ChevronRight size={16} />
        </button>
        <button className="menu-item">
          <Bell size={18} />
          <span>Notifications</span>
          <ChevronRight size={16} />
        </button>
        <button className="menu-item">
          <HelpCircle size={18} />
          <span>Help & Support</span>
          <ChevronRight size={16} />
        </button>
        <button className="menu-item logout">
          <LogOut size={18} />
          <span>Log Out</span>
        </button>
      </div>
    </div>
  );
}

function FiltersView({ onBack }) {
  const { state, dispatch } = useApp();
  const [filters, setFilters] = useState(state.filters);

  const handleSave = () => {
    dispatch({ type: "UPDATE_FILTERS", payload: filters });
    onBack();
  };

  return (
    <div className="filters-page">
      <div className="filters-header">
        <button className="text-btn" onClick={onBack}>Cancel</button>
        <h3>Preferences</h3>
        <button className="text-btn primary" onClick={handleSave}>Save</button>
      </div>

      <div className="filters-section">
        <label>Max Age: up to {filters.maxAge}</label>
        <input
          type="range"
          min={18}
          max={50}
          value={filters.maxAge}
          onChange={(e) => setFilters({ ...filters, maxAge: parseInt(e.target.value) })}
        />
      </div>

      <div className="filters-section">
        <label>Max Distance: {filters.maxDistance} km</label>
        <input
          type="range"
          min={1}
          max={200}
          value={filters.maxDistance}
          onChange={(e) => setFilters({ ...filters, maxDistance: parseInt(e.target.value) })}
        />
      </div>
    </div>
  );
}
