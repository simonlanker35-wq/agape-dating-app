import { useState } from "react";
import { useApp } from "../context/AppContext";
import AgapeCross from "../components/AgapeCross";

const C = { bg: "#FFFFFF", card: "#FAFAF8", surface: "#F4F2EE", primary: "#B8912A", primarySoft: "#FBF5E6", text: "#1A1612", sub: "#8C857C", border: "#E8E4DF", sent: "#111111" };
const FONT = "'Outfit', system-ui, sans-serif";
const SERIF = "'Lora', Georgia, serif";

function BackIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function Toggle({ on, onToggle }) {
  return (
    <button
      onClick={onToggle}
      style={{
        position: "relative",
        flexShrink: 0,
        width: 44,
        height: 26,
        borderRadius: 13,
        background: on ? C.primary : C.border,
        border: "none",
        cursor: "pointer",
        transition: "all 0.2s",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 4,
          left: on ? 23 : 3,
          width: 18,
          height: 18,
          borderRadius: "50%",
          background: "white",
          boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
          transition: "all 0.2s",
        }}
      />
    </button>
  );
}

function SettingsRow({ icon, label, sub, onPress, danger, toggle }) {
  const inner = (
    <>
      <span style={{ fontSize: 18, width: 28, textAlign: "center", flexShrink: 0 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 14, fontWeight: 500, color: danger ? "#EF4444" : C.text, margin: 0 }}>{label}</p>
        {sub && <p style={{ fontSize: 12, color: C.sub, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sub}</p>}
      </div>
      {toggle ? (
        <Toggle on={toggle.on} onToggle={toggle.onToggle} />
      ) : (
        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={C.sub} strokeWidth={2}>
          <polyline points="9 18 15 12 9 6" />
        </svg>
      )}
    </>
  );

  if (toggle) {
    return (
      <div style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderBottom: `1px solid ${C.border}` }}>
        {inner}
      </div>
    );
  }

  return (
    <button
      onClick={onPress}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "14px 16px",
        borderBottom: `1px solid ${C.border}`,
        background: "none",
        border: "none",
        borderBottomStyle: "solid",
        borderBottomWidth: 1,
        borderBottomColor: C.border,
        cursor: "pointer",
        textAlign: "left",
      }}
    >
      {inner}
    </button>
  );
}

function SettingsScreen({ onBack }) {
  const { dispatch } = useApp();
  const [notifs, setNotifs] = useState({ matches: true, likes: true, messages: true, doves: true, prompts: false });
  const [privacy, setPrivacy] = useState({ activeStatus: true, readReceipts: true, showDistance: true, incognito: false });
  const [faithPref, setFaithPref] = useState({ sameOnly: false, openToAll: true });
  const [section, setSection] = useState(null);

  const toggle = (obj, key, setter) => setter((p) => ({ ...p, [key]: !p[key] }));

  if (section) {
    const titles = {
      notifications: "Notifications",
      faith: "Faith Preferences",
      location: "Location",
      privacy: "Privacy",
      safety: "Safety Centre",
      subscription: "Agape+",
      account: "Personal Info",
    };

    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", background: C.bg }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "40px 16px 16px" }}>
          <button
            onClick={() => setSection(null)}
            style={{ width: 36, height: 36, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: C.card, color: C.text, border: "none", cursor: "pointer" }}
          >
            <BackIcon />
          </button>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: C.text, fontFamily: FONT, margin: 0 }}>
            {titles[section]}
          </h1>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "0 16px 32px", display: "flex", flexDirection: "column", gap: 20 }}>
          {section === "notifications" && (
            <>
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: C.sub, padding: "0 4px", marginBottom: 8 }}>Match & Like alerts</p>
                <div style={{ borderRadius: 16, overflow: "hidden", background: C.card }}>
                  <SettingsRow icon="💛" label="New matches" toggle={{ on: notifs.matches, onToggle: () => toggle(notifs, "matches", setNotifs) }} />
                  <SettingsRow icon="❤️" label="New likes" toggle={{ on: notifs.likes, onToggle: () => toggle(notifs, "likes", setNotifs) }} />
                  <SettingsRow icon="🕊️" label="Doves received" toggle={{ on: notifs.doves, onToggle: () => toggle(notifs, "doves", setNotifs) }} />
                </div>
              </div>
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: C.sub, padding: "0 4px", marginBottom: 8 }}>Message alerts</p>
                <div style={{ borderRadius: 16, overflow: "hidden", background: C.card }}>
                  <SettingsRow icon="💬" label="New messages" toggle={{ on: notifs.messages, onToggle: () => toggle(notifs, "messages", setNotifs) }} />
                  <SettingsRow icon="🙏" label="Prompt comments" toggle={{ on: notifs.prompts, onToggle: () => toggle(notifs, "prompts", setNotifs) }} />
                </div>
              </div>
            </>
          )}
          {section === "privacy" && (
            <>
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: C.sub, padding: "0 4px", marginBottom: 8 }}>Visibility</p>
                <div style={{ borderRadius: 16, overflow: "hidden", background: C.card }}>
                  <SettingsRow icon="🟢" label="Show active status" sub="Let matches see when you're online" toggle={{ on: privacy.activeStatus, onToggle: () => toggle(privacy, "activeStatus", setPrivacy) }} />
                  <SettingsRow icon="✓" label="Read receipts" sub="Let matches see when you've read messages" toggle={{ on: privacy.readReceipts, onToggle: () => toggle(privacy, "readReceipts", setPrivacy) }} />
                  <SettingsRow icon="📍" label="Show distance" toggle={{ on: privacy.showDistance, onToggle: () => toggle(privacy, "showDistance", setPrivacy) }} />
                </div>
              </div>
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: C.sub, padding: "0 4px", marginBottom: 8 }}>Browse mode</p>
                <div style={{ borderRadius: 16, overflow: "hidden", background: C.card }}>
                  <SettingsRow icon="🕵️" label="Incognito mode" sub="Only people you like can see you" toggle={{ on: privacy.incognito, onToggle: () => toggle(privacy, "incognito", setPrivacy) }} />
                </div>
              </div>
            </>
          )}
          {section === "faith" && (
            <>
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: C.sub, padding: "0 4px", marginBottom: 8 }}>Who you see</p>
                <div style={{ borderRadius: 16, overflow: "hidden", background: C.card }}>
                  <SettingsRow icon="✝️" label="Show same faith only" sub="Only show Christians" toggle={{ on: faithPref.sameOnly, onToggle: () => toggle(faithPref, "sameOnly", setFaithPref) }} />
                  <SettingsRow icon="🌍" label="Open to all Christians" sub="Any denomination welcome" toggle={{ on: faithPref.openToAll, onToggle: () => toggle(faithPref, "openToAll", setFaithPref) }} />
                </div>
              </div>
            </>
          )}
          {section === "safety" && (
            <>
              <div style={{ borderRadius: 16, padding: 16, display: "flex", gap: 12, background: "#F0FDF4" }}>
                <span style={{ fontSize: 24 }}>🛡️</span>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: "#166534", marginBottom: 4 }}>Your safety matters</p>
                  <p style={{ fontSize: 12, lineHeight: 1.5, color: "#15803D" }}>Agape is a faith-based community built on respect and trust. Use these tools if anything ever feels unsafe.</p>
                </div>
              </div>
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: C.sub, padding: "0 4px", marginBottom: 8 }}>Tools</p>
                <div style={{ borderRadius: 16, overflow: "hidden", background: C.card }}>
                  <SettingsRow icon="🚫" label="Blocked users" sub="Manage blocked profiles" />
                  <SettingsRow icon="🚩" label="Reports submitted" sub="View your reports" />
                  <SettingsRow icon="📵" label="Pause my profile" sub="Temporarily hide your profile" />
                </div>
              </div>
            </>
          )}
          {section === "subscription" && (
            <>
              <div style={{ borderRadius: 16, overflow: "hidden" }}>
                <div style={{ padding: 20, background: C.primary }}>
                  <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.6)", marginBottom: 4 }}>Agape+</p>
                  <p style={{ color: "white", fontWeight: 700, fontSize: 20, lineHeight: 1.3, marginBottom: 4 }}>Unlimited likes, see who likes you</p>
                  <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 14 }}>From $14.99/month</p>
                  <button style={{ marginTop: 16, padding: "12px 24px", borderRadius: 12, fontSize: 14, fontWeight: 700, background: "white", color: C.primary, border: "none", cursor: "pointer" }}>
                    See plans
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: C.bg }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "40px 16px 16px" }}>
        <button
          onClick={onBack}
          style={{ width: 36, height: 36, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: C.card, color: C.text, border: "none", cursor: "pointer" }}
        >
          <BackIcon />
        </button>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: C.text, fontFamily: FONT, margin: 0 }}>Settings</h1>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "0 16px 32px", display: "flex", flexDirection: "column", gap: 20 }}>
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: C.sub, padding: "0 4px", marginBottom: 8 }}>Account</p>
          <div style={{ borderRadius: 16, overflow: "hidden", background: C.card }}>
            <SettingsRow icon="👤" label="Personal info" sub="Name, email, phone" onPress={() => setSection("account")} />
            <SettingsRow icon="🙏" label="Faith preferences" sub="Denomination, values" onPress={() => setSection("faith")} />
            <SettingsRow icon="📍" label="Location" sub="Distance, visibility" onPress={() => setSection("location")} />
          </div>
        </div>
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: C.sub, padding: "0 4px", marginBottom: 8 }}>Notifications</p>
          <div style={{ borderRadius: 16, overflow: "hidden", background: C.card }}>
            <SettingsRow icon="🔔" label="Push notifications" onPress={() => setSection("notifications")} />
          </div>
        </div>
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: C.sub, padding: "0 4px", marginBottom: 8 }}>Privacy</p>
          <div style={{ borderRadius: 16, overflow: "hidden", background: C.card }}>
            <SettingsRow icon="🔒" label="Privacy settings" sub="Active status, read receipts" onPress={() => setSection("privacy")} />
          </div>
        </div>
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: C.sub, padding: "0 4px", marginBottom: 8 }}>Safety</p>
          <div style={{ borderRadius: 16, overflow: "hidden", background: C.card }}>
            <SettingsRow icon="🛡️" label="Safety centre" sub="Block list, reports, tips" onPress={() => setSection("safety")} />
            <SettingsRow icon="📋" label="Community guidelines" />
          </div>
        </div>
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: C.sub, padding: "0 4px", marginBottom: 8 }}>Subscription</p>
          <div style={{ borderRadius: 16, overflow: "hidden", background: C.card }}>
            <SettingsRow icon="✨" label="Agape+" sub="Not subscribed" onPress={() => setSection("subscription")} />
            <SettingsRow icon="💳" label="Billing & payments" />
          </div>
        </div>
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: C.sub, padding: "0 4px", marginBottom: 8 }}>Support</p>
          <div style={{ borderRadius: 16, overflow: "hidden", background: C.card }}>
            <SettingsRow icon="💬" label="Help & feedback" />
            <SettingsRow icon="📄" label="Terms of service" />
            <SettingsRow icon="🔐" label="Privacy policy" />
          </div>
        </div>
        <div style={{ borderRadius: 16, overflow: "hidden", background: C.card }}>
          <SettingsRow icon="🚪" label="Log out" danger onPress={() => dispatch({ type: "LOGOUT" })} />
          <SettingsRow icon="🗑️" label="Delete account" danger />
        </div>
      </div>
    </div>
  );
}

export default function Profile() {
  const { state, dispatch } = useApp();
  const { currentUser } = state;
  const [section, setSection] = useState("profile");
  const [showSettings, setShowSettings] = useState(false);

  if (!currentUser) return null;

  if (showSettings) {
    return <SettingsScreen onBack={() => setShowSettings(false)} />;
  }

  const prompts = (currentUser.prompts || []).filter(p => p.prompt && p.answer);
  const interests = currentUser.interests || [];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: C.surface }}>
      {/* Header — full bleed photo */}
      <div style={{ position: "relative", height: 260, flexShrink: 0 }}>
        <img
          src={currentUser.photos?.[0]}
          alt="Me"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
          onError={(e) => {
            e.target.src = `https://ui-avatars.com/api/?name=${currentUser.name}&size=600&background=random`;
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.1) 60%)",
          }}
        />

        {/* Top bar */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "40px 20px 0" }}>
          <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.3px", color: "white", fontFamily: FONT }}>
            My Profile
          </span>
          <button
            onClick={() => setShowSettings(true)}
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(255,255,255,0.15)",
              backdropFilter: "blur(10px)",
              border: "none",
              cursor: "pointer",
            }}
          >
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2}>
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        </div>

        {/* Identity overlay at bottom */}
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "0 20px 40px", display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
              <span style={{ color: "white", fontFamily: SERIF, fontSize: 26, fontWeight: 700, lineHeight: 1 }}>
                {currentUser.name}
              </span>
              <span style={{ color: "rgba(255,255,255,0.8)", fontFamily: FONT, fontSize: 20, fontWeight: 300 }}>
                {currentUser.age}
              </span>
              <svg width={15} height={15} viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" fill={C.primary} />
                <path d="M9 12l2 2 4-4" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
              </svg>
            </div>
            <p style={{ color: "rgba(255,255,255,0.65)", fontSize: 12, fontFamily: FONT }}>
              {currentUser.denomination}{currentUser.location?.city ? ` · ${currentUser.location.city}` : ""}
            </p>
          </div>
          <button
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 16px",
              borderRadius: 9999,
              fontSize: 12,
              fontWeight: 700,
              background: C.primary,
              color: "white",
              border: "none",
              cursor: "pointer",
            }}
          >
            <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5}>
              <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
            Edit
          </button>
        </div>
      </div>

      {/* Segment toggle */}
      <div
        style={{
          display: "flex",
          padding: "16px 16px 8px",
          gap: 8,
          background: C.surface,
          borderRadius: "28px 28px 0 0",
          marginTop: -28,
          position: "relative",
          zIndex: 2,
        }}
      >
        {["profile", "settings"].map((s) => (
          <button
            key={s}
            onClick={() => s === "settings" ? setShowSettings(true) : setSection(s)}
            style={{
              flex: 1,
              padding: "10px 0",
              borderRadius: 9999,
              fontSize: 12,
              fontWeight: 700,
              background: section === s && s === "profile" ? C.text : C.card,
              color: section === s && s === "profile" ? "white" : C.sub,
              border: "none",
              cursor: "pointer",
              transition: "all 0.2s",
            }}
          >
            {s === "profile" ? "My Profile" : "Settings"}
          </button>
        ))}
      </div>

      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "0 16px 24px",
          background: C.surface,
          position: "relative",
          zIndex: 2,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingTop: 8 }}>
          {/* Agape+ banner */}
          <div
            style={{
              borderRadius: 16,
              padding: 16,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: C.primary,
            }}
          >
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.6)", marginBottom: 2 }}>Agape+</p>
              <p style={{ color: "white", fontWeight: 700, fontSize: 14, lineHeight: 1.3 }}>Be seen 3x faster</p>
            </div>
            <button
              style={{
                padding: "8px 16px",
                borderRadius: 9999,
                fontSize: 12,
                fontWeight: 700,
                background: "white",
                color: C.primary,
                border: "none",
                cursor: "pointer",
              }}
            >
              Upgrade
            </button>
          </div>

          {/* Doves stat */}
          <div
            style={{
              borderRadius: 16,
              padding: "16px 0",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              background: C.card,
            }}
          >
            <span style={{ color: C.primary, fontFamily: SERIF, fontSize: 24, fontWeight: 700 }}>
              {state.doves}
            </span>
            <span style={{ color: C.sub, fontSize: 11, marginTop: 2 }}>
              {state.doves === 1 ? "Dove left" : "Doves left"}
            </span>
          </div>

          {/* Prompts */}
          {prompts.map((p, i) => (
            <div
              key={i}
              style={{
                borderRadius: 16,
                overflow: "hidden",
                background: C.card,
                border: `1px solid ${C.border}`,
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
                  <p style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.3, color: C.text, fontFamily: FONT }}>
                    {p.answer}
                  </p>
                  <button
                    style={{
                      marginTop: 12,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 12,
                      fontWeight: 600,
                      padding: "6px 12px",
                      borderRadius: 9999,
                      background: C.surface,
                      color: C.sub,
                      border: "none",
                      cursor: "pointer",
                    }}
                  >
                    <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                      <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                    </svg>
                    Edit answer
                  </button>
                </div>
              </div>
            </div>
          ))}

          {/* Values */}
          {interests.length > 0 && (
            <div
              style={{
                borderRadius: 16,
                padding: 16,
                background: C.card,
                border: `1px solid ${C.border}`,
              }}
            >
              <p
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: C.primary,
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  marginBottom: 12,
                }}
              >
                Values
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {interests.map((v) => (
                  <span
                    key={v}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 9999,
                      fontSize: 12,
                      fontWeight: 600,
                      background: C.primarySoft,
                      color: C.primary,
                    }}
                  >
                    {v}
                  </span>
                ))}
                <button
                  style={{
                    padding: "6px 12px",
                    borderRadius: 9999,
                    fontSize: 12,
                    fontWeight: 600,
                    background: C.surface,
                    color: C.sub,
                    border: `1.5px dashed ${C.border}`,
                    cursor: "pointer",
                  }}
                >
                  + Add
                </button>
              </div>
            </div>
          )}

          {/* Account settings rows */}
          <div style={{ marginTop: 4 }}>
            <p style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: C.sub, padding: "0 4px", marginBottom: 8 }}>Account</p>
            {[
              { icon: "🔔", label: "Notifications" },
              { icon: "🙏", label: "Faith Preferences" },
              { icon: "📍", label: "Location & Distance" },
              { icon: "💳", label: "Subscription" },
            ].map((item) => (
              <div
                key={item.label}
                style={{
                  borderRadius: 16,
                  overflow: "hidden",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: C.card,
                  marginBottom: 8,
                }}
              >
                <div style={{ width: 4, alignSelf: "stretch", background: C.primary, flexShrink: 0 }} />
                <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, padding: "16px 16px" }}>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 12,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 16,
                      background: C.primarySoft,
                    }}
                  >
                    {item.icon}
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 500, color: C.text }}>{item.label}</span>
                </div>
                <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={C.sub} strokeWidth={2} style={{ marginRight: 16, flexShrink: 0 }}>
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </div>
            ))}
          </div>

          <div>
            <p style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: C.sub, padding: "0 4px", marginBottom: 8 }}>Safety & Privacy</p>
            {[
              { icon: "🛡️", label: "Safety Centre" },
              { icon: "🔒", label: "Privacy" },
              { icon: "🚫", label: "Blocked Profiles" },
            ].map((item) => (
              <div
                key={item.label}
                style={{
                  borderRadius: 16,
                  overflow: "hidden",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: C.card,
                  marginBottom: 8,
                }}
              >
                <div style={{ width: 4, alignSelf: "stretch", background: C.primary, flexShrink: 0 }} />
                <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, padding: "16px 16px" }}>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 12,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 16,
                      background: C.surface,
                    }}
                  >
                    {item.icon}
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 500, color: C.text }}>{item.label}</span>
                </div>
                <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={C.sub} strokeWidth={2} style={{ marginRight: 16, flexShrink: 0 }}>
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </div>
            ))}
          </div>

          <button
            onClick={() => dispatch({ type: "LOGOUT" })}
            style={{
              width: "100%",
              padding: "16px 0",
              borderRadius: 16,
              fontSize: 14,
              fontWeight: 600,
              background: C.card,
              color: "#EF4444",
              border: "none",
              cursor: "pointer",
              marginTop: 4,
            }}
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
