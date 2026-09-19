import { useState, useRef, useEffect } from "react";
import { useApp } from "../context/AppContext";
import { compressPhoto } from "../services/api";
import { PROMPT_CATEGORIES, TRAITS_POOL, LOOKING_FOR_POOL } from "../data/profiles";
import AgapeCross from "../components/AgapeCross";
import LocationPicker from "../components/LocationPicker";
import { redirectToCheckout, getSubscriptionStatus } from "../services/stripe";
import { getDovesRemaining } from "../services/limits";
import { track } from "../services/posthog";

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

const PLANS = [
  { name: "1 Month", price: "CHF 14.99", period: "/month", priceId: "price_1UF5K3CBLGZ7l0PdrdfmSFjw", popular: false, billing: "monthly" },
  { name: "6 Months", price: "CHF 9.99", period: "/month", priceId: "price_1UF5LtCBLGZ7l0Pday9S7emI", popular: true, billing: "every 6 months" },
  { name: "12 Months", price: "CHF 6.99", period: "/month", priceId: "price_1UF5McCBLGZ7l0PdmGpUGONs", popular: false, billing: "annually" },
];

function SubscriptionPlans({ initialStatus }) {
  const [loading, setLoading] = useState(null);
  const [subStatus, setSubStatus] = useState(initialStatus === "active" ? { status: "active" } : null);
  const [error, setError] = useState(null);

  useEffect(() => {
    getSubscriptionStatus().then((s) => { if (s) setSubStatus(s); }).catch(() => {});
  }, []);

  const handleSubscribe = async (plan) => {
    setLoading(plan.name);
    setError(null);
    try {
      track("subscription_checkout_started", { plan: plan.name, price: plan.price });
      await redirectToCheckout(plan.priceId);
    } catch (err) {
      setError(err.message);
      setLoading(null);
    }
  };

  return (
    <>
      <div style={{ borderRadius: 16, overflow: "hidden" }}>
        <div style={{ padding: 20, background: C.primary }}>
          <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.6)", marginBottom: 4 }}>Agape+</p>
          <p style={{ color: "white", fontWeight: 700, fontSize: 20, lineHeight: 1.3, marginBottom: 4 }}>15 likes/day, 3 doves, see all who like you</p>
          <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 14 }}>From CHF 6.99/month</p>
        </div>
      </div>
      {subStatus?.status === "active" && (
        <div style={{ borderRadius: 16, padding: 16, background: "#E8F5E9", marginTop: 4 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: "#2E7D32" }}>Active subscription</p>
          <p style={{ fontSize: 12, color: "#4CAF50", marginTop: 4 }}>Your plan renews {subStatus.cancelAtPeriodEnd ? "and will cancel" : "automatically"} on {new Date(subStatus.currentPeriodEnd * 1000).toLocaleDateString()}</p>
        </div>
      )}
      {error && (
        <div style={{ borderRadius: 12, padding: 12, background: "#FFF3F0", marginTop: 4 }}>
          <p style={{ fontSize: 13, color: "#D32F2F" }}>{error}</p>
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 4 }}>
        {PLANS.map((plan) => (
          <button
            key={plan.name}
            onClick={() => handleSubscribe(plan)}
            disabled={loading || subStatus?.status === "active"}
            style={{
              borderRadius: 16,
              padding: 16,
              background: C.card,
              border: plan.popular ? `2px solid ${C.primary}` : `1px solid ${C.border}`,
              position: "relative",
              cursor: loading || subStatus?.status === "active" ? "default" : "pointer",
              opacity: loading && loading !== plan.name ? 0.5 : 1,
              textAlign: "left",
            }}
          >
            {plan.popular && (
              <span style={{ position: "absolute", top: -10, right: 16, fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 9999, background: C.primary, color: "white", textTransform: "uppercase", letterSpacing: "0.05em" }}>Most popular</span>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <p style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{plan.name}</p>
                <p style={{ fontSize: 12, color: C.sub, marginTop: 2 }}>Billed {plan.billing}</p>
              </div>
              <div style={{ textAlign: "right" }}>
                {loading === plan.name ? (
                  <span style={{ fontSize: 13, fontWeight: 600, color: C.sub }}>Loading...</span>
                ) : (
                  <>
                    <span style={{ fontSize: 20, fontWeight: 700, color: C.primary }}>{plan.price}</span>
                    <span style={{ fontSize: 12, color: C.sub }}>{plan.period}</span>
                  </>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>
      <div style={{ padding: "8px 0" }}>
        <p style={{ fontSize: 10, fontWeight: 600, color: C.sub, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>What you get</p>
        {["15 likes per day", "See all who like you", "3 Doves per week", "Advanced filters"].map((feat) => (
          <div key={feat} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0" }}>
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={C.primary} strokeWidth={2.5}><path d="M20 6L9 17l-5-5" /></svg>
            <span style={{ fontSize: 13, color: C.text }}>{feat}</span>
          </div>
        ))}
      </div>
    </>
  );
}

function BillingSection({ onViewPlans, initialStatus }) {
  const [subStatus, setSubStatus] = useState(initialStatus === "active" ? { status: "active" } : null);
  useEffect(() => { getSubscriptionStatus().then((s) => { if (s) setSubStatus(s); }).catch(() => {}); }, []);

  if (subStatus?.status === "active") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ borderRadius: 16, padding: 16, background: "#E8F5E9" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 20 }}>✨</span>
            <p style={{ fontSize: 16, fontWeight: 700, color: "#2E7D32" }}>Agape+ Active</p>
          </div>
          <p style={{ fontSize: 13, color: "#4CAF50", lineHeight: 1.5 }}>
            Your subscription renews {subStatus.cancelAtPeriodEnd ? "and will cancel" : "automatically"} on {new Date(subStatus.currentPeriodEnd * 1000).toLocaleDateString()}
          </p>
        </div>
        <div style={{ borderRadius: 16, padding: 16, background: C.card }}>
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: C.sub, marginBottom: 12 }}>Your plan includes</p>
          {["15 likes per day", "See all who like you", "3 Doves per week", "Advanced filters"].map((feat) => (
            <div key={feat} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0" }}>
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={C.primary} strokeWidth={2.5}><path d="M20 6L9 17l-5-5" /></svg>
              <span style={{ fontSize: 13, color: C.text }}>{feat}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ textAlign: "center", padding: "40px 20px" }}>
      <span style={{ fontSize: 48 }}>💳</span>
      <p style={{ fontSize: 16, fontWeight: 700, color: C.text, marginTop: 16 }}>No active subscription</p>
      <p style={{ fontSize: 13, color: C.sub, marginTop: 4 }}>Upgrade to Agape+ to manage billing and payments.</p>
      <button onClick={() => { track("upgrade_tapped", { source: "billing" }); onViewPlans(); }} style={{ marginTop: 16, padding: "12px 24px", borderRadius: 12, fontSize: 14, fontWeight: 700, background: C.primary, color: "white", border: "none", cursor: "pointer" }}>View plans</button>
    </div>
  );
}

function SettingsScreen({ onBack, initialSection = null }) {
  const { state, dispatch, actions } = useApp();
  const { currentUser } = state;
  const [notifs, setNotifs] = useState({ matches: true, likes: true, messages: true, doves: true, prompts: false });
  const [privacy, setPrivacy] = useState({ activeStatus: true, readReceipts: true, showDistance: true, incognito: false });
  const [faithPref, setFaithPref] = useState({ sameOnly: (state.filters?.denominations || []).length > 0, openToAll: (state.filters?.denominations || []).length === 0 });
  const [paused, setPaused] = useState(false);
  const [section, setSection] = useState(initialSection);
  const [editField, setEditField] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editLocationData, setEditLocationData] = useState(null);
  const [distanceVal, setDistanceVal] = useState(currentUser?.filters?.maxDistance || 80);

  const saveField = async () => {
    if (!editField || !editValue.trim()) return;
    track("setting_saved", { field: editField });
    setSaving(true);
    try {
      const updates = {};
      if (editField === "name") updates.name = editValue;
      else if (editField === "age") updates.age = parseInt(editValue, 10);
      else if (editField === "denomination") updates.denomination = editValue;
      await actions.updateProfile(updates);
      setEditField(null);
      setEditValue("");
    } catch (err) { console.error(err); }
    setSaving(false);
  };

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
      blocked: "Blocked Users",
      reports: "Reports",
      guidelines: "Community Guidelines",
      billing: "Billing & Payments",
      help: "Help & Feedback",
      terms: "Terms of Service",
      privacypolicy: "Privacy Policy",
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
                  <SettingsRow icon="💛" label="New matches" toggle={{ on: notifs.matches, onToggle: () => { track("notification_toggled", { type: "matches", enabled: !notifs.matches }); toggle(notifs, "matches", setNotifs); } }} />
                  <SettingsRow icon="❤️" label="New likes" toggle={{ on: notifs.likes, onToggle: () => { track("notification_toggled", { type: "likes", enabled: !notifs.likes }); toggle(notifs, "likes", setNotifs); } }} />
                  <SettingsRow icon="🕊️" label="Doves received" toggle={{ on: notifs.doves, onToggle: () => { track("notification_toggled", { type: "doves", enabled: !notifs.doves }); toggle(notifs, "doves", setNotifs); } }} />
                </div>
              </div>
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: C.sub, padding: "0 4px", marginBottom: 8 }}>Message alerts</p>
                <div style={{ borderRadius: 16, overflow: "hidden", background: C.card }}>
                  <SettingsRow icon="💬" label="New messages" toggle={{ on: notifs.messages, onToggle: () => { track("notification_toggled", { type: "messages", enabled: !notifs.messages }); toggle(notifs, "messages", setNotifs); } }} />
                  <SettingsRow icon="🙏" label="Prompt comments" toggle={{ on: notifs.prompts, onToggle: () => { track("notification_toggled", { type: "prompts", enabled: !notifs.prompts }); toggle(notifs, "prompts", setNotifs); } }} />
                </div>
              </div>
            </>
          )}
          {section === "privacy" && (
            <>
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: C.sub, padding: "0 4px", marginBottom: 8 }}>Visibility</p>
                <div style={{ borderRadius: 16, overflow: "hidden", background: C.card }}>
                  <SettingsRow icon="✓" label="Read receipts" sub="Let matches see when you've read messages" toggle={{ on: privacy.readReceipts, onToggle: () => { track("privacy_toggled", { type: "read_receipts", enabled: !privacy.readReceipts }); toggle(privacy, "readReceipts", setPrivacy); } }} />
                  <SettingsRow icon="📍" label="Show distance" toggle={{ on: privacy.showDistance, onToggle: () => { track("privacy_toggled", { type: "show_distance", enabled: !privacy.showDistance }); toggle(privacy, "showDistance", setPrivacy); } }} />
                </div>
              </div>
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: C.sub, padding: "0 4px", marginBottom: 8 }}>Browse mode</p>
                <div style={{ borderRadius: 16, overflow: "hidden", background: C.card }}>
                  <SettingsRow icon="🕵️" label="Incognito mode" sub="Only people you like can see you" toggle={{ on: privacy.incognito, onToggle: () => { track("privacy_toggled", { type: "incognito", enabled: !privacy.incognito }); toggle(privacy, "incognito", setPrivacy); } }} />
                </div>
              </div>
            </>
          )}
          {section === "faith" && (
            <>
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: C.sub, padding: "0 4px", marginBottom: 8 }}>Who you see</p>
                <div style={{ borderRadius: 16, overflow: "hidden", background: C.card }}>
                  <SettingsRow icon="✝️" label="Show same faith only" sub={`Only show ${currentUser.denomination || "your denomination"}`} toggle={{ on: faithPref.sameOnly, onToggle: () => {
                    const newVal = !faithPref.sameOnly;
                    track("faith_pref_toggled", { type: "same_only", enabled: newVal });
                    setFaithPref({ sameOnly: newVal, openToAll: !newVal });
                    dispatch({ type: "UPDATE_FILTERS", payload: { denominations: newVal ? [currentUser.denomination] : [] } });
                  } }} />
                  <SettingsRow icon="🌍" label="Open to all Christians" sub="Any denomination welcome" toggle={{ on: faithPref.openToAll, onToggle: () => {
                    const newVal = !faithPref.openToAll;
                    track("faith_pref_toggled", { type: "open_to_all", enabled: newVal });
                    setFaithPref({ sameOnly: !newVal, openToAll: newVal });
                    dispatch({ type: "UPDATE_FILTERS", payload: { denominations: newVal ? [] : [currentUser.denomination] } });
                  } }} />
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
                  <SettingsRow icon="🚫" label="Blocked users" sub="Manage blocked profiles" onPress={() => setSection("blocked")} />
                  <SettingsRow icon="🚩" label="Reports submitted" sub="View your reports" onPress={() => setSection("reports")} />
                  <SettingsRow icon="📵" label="Pause my profile" sub={paused ? "Your profile is hidden" : "Temporarily hide your profile"} toggle={{ on: paused, onToggle: () => { track("profile_paused_toggled", { paused: !paused }); setPaused((p) => !p); } }} />
                </div>
              </div>
            </>
          )}
          {section === "blocked" && (
            state.blocked.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 20px" }}>
                <div style={{ width: 64, height: 64, borderRadius: "50%", background: C.surface, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto" }}>
                  <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke={C.sub} strokeWidth={2}>
                    <circle cx="12" cy="12" r="10" />
                    <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                  </svg>
                </div>
                <p style={{ fontSize: 16, fontWeight: 700, color: C.text, marginTop: 16 }}>No blocked users</p>
                <p style={{ fontSize: 13, color: C.sub, marginTop: 4 }}>When you block someone, they'll appear here.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {state.blocked.map((b, i) => {
                  const item = typeof b === "string" ? { id: b } : b;
                  return (
                    <div key={item.id || i} style={{ borderRadius: 16, background: C.card, padding: "12px 14px", display: "flex", alignItems: "center", gap: 12 }}>
                      {item.photo ? (
                        <img src={item.photo} alt="" style={{ width: 44, height: 44, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                      ) : (
                        <div style={{ width: 44, height: 44, borderRadius: "50%", background: C.surface, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={C.sub} strokeWidth={2}>
                            <circle cx="12" cy="12" r="10" />
                            <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                          </svg>
                        </div>
                      )}
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{item.name || "Blocked user"}</p>
                        <p style={{ fontSize: 12, color: C.sub }}>Can no longer see you</p>
                      </div>
                      <button onClick={() => { track("user_unblocked"); dispatch({ type: "UNBLOCK_PROFILE", payload: item.id }); }} style={{ padding: "6px 12px", borderRadius: 9999, fontSize: 12, fontWeight: 600, background: C.surface, color: C.sub, border: "none", cursor: "pointer" }}>Unblock</button>
                    </div>
                  );
                })}
              </div>
            )
          )}
          {section === "reports" && (
            (!state.reports || state.reports.length === 0) ? (
              <div style={{ textAlign: "center", padding: "40px 20px" }}>
                <div style={{ width: 64, height: 64, borderRadius: "50%", background: C.surface, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto" }}>
                  <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke={C.sub} strokeWidth={2}>
                    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                    <line x1="4" y1="22" x2="4" y2="15" />
                  </svg>
                </div>
                <p style={{ fontSize: 16, fontWeight: 700, color: C.text, marginTop: 16 }}>No reports submitted</p>
                <p style={{ fontSize: 13, color: C.sub, marginTop: 4 }}>Reports you submit will appear here for your records.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {state.reports.map((r, i) => (
                  <div key={i} style={{ borderRadius: 16, background: C.card, padding: "12px 14px", display: "flex", alignItems: "center", gap: 12 }}>
                    {r.photo ? (
                      <img src={r.photo} alt="" style={{ width: 44, height: 44, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                    ) : (
                      <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#FEF2F2", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth={2}>
                          <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                          <line x1="4" y1="22" x2="4" y2="15" />
                        </svg>
                      </div>
                    )}
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{r.name || "Reported user"}</p>
                      <p style={{ fontSize: 12, color: C.sub }}>{r.reason || "Report submitted"} · Under review</p>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
          {section === "guidelines" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {[
                { icon: "🤝", title: "Be respectful", text: "Treat everyone with kindness and dignity. Harassment, hate speech, and discrimination are never tolerated." },
                { icon: "✝️", title: "Honour your faith", text: "This is a faith-based community. Be authentic about who you are and what you believe." },
                { icon: "📸", title: "Be genuine", text: "Use recent photos of yourself. No fake profiles, catfishing, or misleading information." },
                { icon: "🔒", title: "Protect your privacy", text: "Don't share personal information like your address, financial details, or passwords with anyone." },
                { icon: "🚫", title: "No inappropriate content", text: "Keep conversations respectful. Explicit, vulgar, or offensive content will result in a ban." },
                { icon: "🛡️", title: "Report concerns", text: "If someone makes you feel uncomfortable or unsafe, use the report feature. We review every report." },
              ].map((item) => (
                <div key={item.title} style={{ borderRadius: 16, padding: 16, background: C.card, display: "flex", gap: 12 }}>
                  <span style={{ fontSize: 24, flexShrink: 0 }}>{item.icon}</span>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 4 }}>{item.title}</p>
                    <p style={{ fontSize: 13, lineHeight: 1.5, color: C.sub }}>{item.text}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
          {section === "billing" && (
            <BillingSection onViewPlans={() => setSection("subscription")} initialStatus={currentUser?.subscriptionStatus} />
          )}
          {section === "help" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ borderRadius: 16, overflow: "hidden", background: C.card }}>
                <SettingsRow icon="📧" label="Email us" sub="agape_dating@outlook.com" onPress={() => { track("help_email_tapped"); window.location.href = "mailto:agape_dating@outlook.com"; }} />
              </div>
              <div style={{ borderRadius: 16, overflow: "hidden", background: C.card }}>
                <SettingsRow icon="🐛" label="Report a bug" sub="Help us improve the app" onPress={() => { track("help_report_bug_tapped"); window.location.href = "mailto:agape_dating@outlook.com?subject=Bug%20Report"; }} />
              </div>
              <div style={{ borderRadius: 16, overflow: "hidden", background: C.card }}>
                <SettingsRow icon="💡" label="Suggest a feature" sub="We'd love to hear your ideas" onPress={() => { track("help_suggest_feature_tapped"); window.location.href = "mailto:agape_dating@outlook.com?subject=Feature%20Suggestion"; }} />
              </div>
              <div style={{ borderRadius: 16, overflow: "hidden", background: C.card }}>
                <SettingsRow icon="⭐" label="Rate Agape" sub="Leave a review on the App Store" onPress={() => { track("help_rate_app_tapped"); }} />
              </div>
            </div>
          )}
          {section === "terms" && (
            <div style={{ borderRadius: 16, padding: 20, background: C.card }}>
              <p style={{ fontSize: 14, lineHeight: 1.7, color: C.text }}>
                By using Agape, you agree to our terms of service. Agape is a faith-based dating platform designed to connect Christians seeking meaningful relationships.
              </p>
              <p style={{ fontSize: 14, lineHeight: 1.7, color: C.text, marginTop: 12 }}>
                Users must be 18 or older. You are responsible for maintaining the confidentiality of your account. We reserve the right to suspend accounts that violate our community guidelines.
              </p>
              <p style={{ fontSize: 14, lineHeight: 1.7, color: C.text, marginTop: 12 }}>
                Content you post remains yours, but you grant Agape a licence to display it within the platform. We do not sell your data to third parties.
              </p>
              <p style={{ fontSize: 12, color: C.sub, marginTop: 16 }}>Last updated: September 2026</p>
            </div>
          )}
          {section === "privacypolicy" && (
            <div style={{ borderRadius: 16, padding: 20, background: C.card }}>
              <p style={{ fontSize: 14, lineHeight: 1.7, color: C.text }}>
                Agape collects only the data necessary to provide our service: your profile information, preferences, and messages with your matches.
              </p>
              <p style={{ fontSize: 14, lineHeight: 1.7, color: C.text, marginTop: 12 }}>
                We use industry-standard encryption to protect your data. Your photos and messages are stored securely and never shared with third parties for advertising.
              </p>
              <p style={{ fontSize: 14, lineHeight: 1.7, color: C.text, marginTop: 12 }}>
                You can request deletion of all your data at any time through the Delete Account option in settings. We will remove your data within 30 days.
              </p>
              <p style={{ fontSize: 12, color: C.sub, marginTop: 16 }}>Last updated: September 2026</p>
            </div>
          )}
          {section === "location" && (
            <>
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: C.sub, padding: "0 4px", marginBottom: 8 }}>Distance</p>
                <div style={{ borderRadius: 16, overflow: "hidden", background: C.card, padding: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                    <span style={{ fontSize: 14, fontWeight: 500, color: C.text }}>Maximum distance</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: C.primary }}>{distanceVal} km</span>
                  </div>
                  <input type="range" min={5} max={200} value={distanceVal} onChange={(e) => setDistanceVal(Number(e.target.value))} onMouseUp={() => actions.updateProfile({ filters: { ...currentUser?.filters, maxDistance: distanceVal } })} onTouchEnd={() => actions.updateProfile({ filters: { ...currentUser?.filters, maxDistance: distanceVal } })} style={{ width: "100%", accentColor: C.primary }} />
                </div>
              </div>
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: C.sub, padding: "0 4px", marginBottom: 8 }}>My location</p>
                <div style={{ borderRadius: 16, overflow: "hidden", background: C.card }}>
                  <SettingsRow icon="📍" label="Current location" sub={currentUser?.location?.city || "Not set"} onPress={() => { setEditField("location"); setEditValue(currentUser?.location?.city || ""); }} />
                </div>
                {editField === "location" && (
                  <div style={{ borderRadius: 16, padding: 16, background: C.card, marginTop: 8 }}>
                    <LocationPicker
                      value={editValue}
                      onChange={(text) => { setEditValue(text); setEditLocationData(null); }}
                      onSelect={(item) => { setEditValue(item.display); setEditLocationData(item); }}
                      placeholder="Search city..."
                      inputStyle={{ width: "100%", padding: "12px 14px", fontSize: 16, fontWeight: 600, fontFamily: FONT, borderRadius: 12, border: `1.5px solid ${C.border}`, background: C.surface, outline: "none", color: C.text }}
                    />
                    <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                      <button onClick={() => { track("location_edit_cancelled"); setEditField(null); setEditValue(""); setEditLocationData(null); }} style={{ flex: 1, padding: "10px 0", borderRadius: 12, fontSize: 14, fontWeight: 600, background: C.surface, color: C.sub, border: "none", cursor: "pointer" }}>Cancel</button>
                      <button onClick={async () => {
                        track("location_saved", { location: editValue });
                        setSaving(true);
                        const locUpdate = { location: editValue };
                        if (editLocationData) {
                          locUpdate.locationLat = editLocationData.lat;
                          locUpdate.locationLng = editLocationData.lng;
                          dispatch({ type: "SET_USER_LOCATION", payload: { lat: editLocationData.lat, lng: editLocationData.lng, city: editValue } });
                        }
                        await actions.updateProfile(locUpdate);
                        actions.refreshDiscover();
                        setEditField(null); setEditValue(""); setEditLocationData(null); setSaving(false);
                      }} disabled={saving} style={{ flex: 1, padding: "10px 0", borderRadius: 12, fontSize: 14, fontWeight: 600, background: C.primary, color: "white", border: "none", cursor: "pointer", opacity: saving ? 0.5 : 1 }}>{saving ? "Saving..." : "Save"}</button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
          {section === "account" && (
            <>
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: C.sub, padding: "0 4px", marginBottom: 8 }}>Personal details</p>
                <div style={{ borderRadius: 16, overflow: "hidden", background: C.card }}>
                  <SettingsRow icon="👤" label="Name" sub={currentUser?.name || "Not set"} onPress={() => { setEditField("name"); setEditValue(currentUser?.name || ""); }} />
                  <SettingsRow icon="📧" label="Email" sub={currentUser?.email || "Not set"} />
                  <SettingsRow icon="🎂" label="Age" sub={currentUser?.age ? `${currentUser.age} years old` : "Not set"} onPress={() => { setEditField("age"); setEditValue(String(currentUser?.age || "")); }} />
                  <SettingsRow icon="✝️" label="Denomination" sub={currentUser?.denomination || "Not set"} onPress={() => { setEditField("denomination"); setEditValue(currentUser?.denomination || ""); }} />
                </div>
              </div>
              {editField && (
                <div style={{ borderRadius: 16, padding: 16, background: C.card }}>
                  <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: C.sub, marginBottom: 8 }}>
                    Edit {editField}
                  </p>
                  <input
                    type={editField === "age" ? "number" : "text"}
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    autoFocus
                    style={{
                      width: "100%",
                      padding: "12px 14px",
                      fontSize: 16,
                      fontWeight: 600,
                      fontFamily: FONT,
                      borderRadius: 12,
                      border: `1.5px solid ${C.border}`,
                      background: C.surface,
                      outline: "none",
                      color: C.text,
                    }}
                  />
                  <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                    <button
                      onClick={() => { track("account_edit_cancelled", { field: editField }); setEditField(null); setEditValue(""); }}
                      style={{ flex: 1, padding: "10px 0", borderRadius: 12, fontSize: 14, fontWeight: 600, background: C.surface, color: C.sub, border: "none", cursor: "pointer" }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={saveField}
                      disabled={saving || !editValue.trim()}
                      style={{ flex: 1, padding: "10px 0", borderRadius: 12, fontSize: 14, fontWeight: 600, background: C.primary, color: "white", border: "none", cursor: "pointer", opacity: saving ? 0.5 : 1 }}
                    >
                      {saving ? "Saving..." : "Save"}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
          {section === "subscription" && (
            <SubscriptionPlans initialStatus={currentUser?.subscriptionStatus} />
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
            <SettingsRow icon="🔒" label="Privacy settings" sub="Read receipts, visibility" onPress={() => setSection("privacy")} />
          </div>
        </div>
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: C.sub, padding: "0 4px", marginBottom: 8 }}>Safety</p>
          <div style={{ borderRadius: 16, overflow: "hidden", background: C.card }}>
            <SettingsRow icon="🛡️" label="Safety centre" sub="Block list, reports, tips" onPress={() => setSection("safety")} />
            <SettingsRow icon="📋" label="Community guidelines" onPress={() => setSection("guidelines")} />
          </div>
        </div>
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: C.sub, padding: "0 4px", marginBottom: 8 }}>Subscription</p>
          <div style={{ borderRadius: 16, overflow: "hidden", background: C.card }}>
            <SettingsRow icon="✨" label="Agape+" sub={state.currentUser?.subscriptionStatus === "active" ? "Active" : "Not subscribed"} onPress={() => setSection("subscription")} />
            <SettingsRow icon="💳" label="Billing & payments" onPress={() => setSection("billing")} />
          </div>
        </div>
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: C.sub, padding: "0 4px", marginBottom: 8 }}>Support</p>
          <div style={{ borderRadius: 16, overflow: "hidden", background: C.card }}>
            <SettingsRow icon="💬" label="Help & feedback" onPress={() => setSection("help")} />
            <SettingsRow icon="📄" label="Terms of service" onPress={() => setSection("terms")} />
            <SettingsRow icon="🔐" label="Privacy policy" onPress={() => setSection("privacypolicy")} />
          </div>
        </div>
        <div style={{ borderRadius: 16, overflow: "hidden", background: C.card }}>
          <SettingsRow icon="🚪" label="Log out" danger onPress={() => { track("logout"); actions.logout(); }} />
          <SettingsRow icon="🗑️" label="Delete account" danger onPress={() => { track("delete_account_tapped"); setShowDeleteConfirm(true); }} />
        </div>
        {showDeleteConfirm && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
            <div style={{ background: C.bg, borderRadius: 20, padding: 24, maxWidth: 320, width: "100%", textAlign: "center" }}>
              <span style={{ fontSize: 40 }}>⚠️</span>
              <p style={{ fontSize: 18, fontWeight: 700, color: C.text, marginTop: 12 }}>Delete your account?</p>
              <p style={{ fontSize: 13, color: C.sub, marginTop: 8, lineHeight: 1.5 }}>This will permanently delete your profile, matches, and messages. This action cannot be undone.</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 20 }}>
                <button onClick={async () => {
                  track("delete_account_confirmed");
                  try {
                    const { supabase } = await import("../services/supabase");
                    const { data: { user: u } } = await supabase.auth.getUser();
                    if (u) {
                      await supabase.from("messages").delete().or(`match_id.in.(select id from matches where user1=eq.${u.id} or user2=eq.${u.id})`);
                      await supabase.from("matches").delete().or(`user1.eq.${u.id},user2.eq.${u.id}`);
                      await supabase.from("likes").delete().or(`from_user.eq.${u.id},to_user.eq.${u.id}`);
                      await supabase.from("skips").delete().or(`from_user.eq.${u.id},to_user.eq.${u.id}`);
                      await supabase.from("profiles").delete().eq("id", u.id);
                    }
                    await actions.logout();
                  } catch (err) {
                    alert("Failed to delete account: " + err.message);
                  }
                }} style={{ padding: "14px 20px", borderRadius: 12, fontSize: 15, fontWeight: 700, background: "#e53e3e", color: "white", border: "none", cursor: "pointer" }}>Delete my account</button>
                <button onClick={() => { track("delete_account_cancelled"); setShowDeleteConfirm(false); }} style={{ padding: "14px 20px", borderRadius: 12, fontSize: 15, fontWeight: 600, background: C.card, color: C.text, border: "none", cursor: "pointer" }}>Cancel</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Profile() {
  const { state, dispatch, actions } = useApp();
  const { currentUser } = state;
  const [section, setSection] = useState("profile");
  const [showSettings, setShowSettings] = useState(false);
  const [settingsSection, setSettingsSection] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [editPrompts, setEditPrompts] = useState([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editPhotos, setEditPhotos] = useState(false);
  const [editingPromptIdx, setEditingPromptIdx] = useState(null);
  const [editingPromptData, setEditingPromptData] = useState(null);
  const [editingChips, setEditingChips] = useState(null);
  const [editingChipsData, setEditingChipsData] = useState([]);
  const [cropSrc, setCropSrc] = useState(null);
  const [cropOffset, setCropOffset] = useState({ x: 0, y: 0 });
  const [cropScale, setCropScale] = useState(1);
  const [cropDragging, setCropDragging] = useState(false);
  const [cropStart, setCropStart] = useState({ x: 0, y: 0 });
  const [cropImgSize, setCropImgSize] = useState({ w: 0, h: 0 });
  const [cropIdx, setCropIdx] = useState(null);
  const fileInputRef = useRef(null);
  const photosRef = useRef(null);
  const answerRef = useRef(null);
  const cropCanvasRef = useRef(null);

  if (!currentUser) return null;

  if (showSettings) {
    return <SettingsScreen onBack={() => { setShowSettings(false); setSettingsSection(null); }} initialSection={settingsSection} />;
  }

  const prompts = (currentUser.prompts || []).filter(p => p.prompt && p.answer);
  const interests = currentUser.interests || [];

  const startEdit = () => {
    track("profile_edit_started");
    setEditPrompts(prompts.map(p => ({ ...p })));
    setEditMode(true);
  };

  const cancelEdit = () => {
    track("profile_edit_cancelled");
    setEditMode(false);
    setEditPrompts([]);
  };

  const saveEdit = async () => {
    track("profile_edit_saved");
    setSaving(true);
    try {
      const allPrompts = (currentUser.prompts || []).map(p => {
        const edited = editPrompts.find(e => e.prompt === p.prompt);
        return edited ? { ...p, answer: edited.answer } : p;
      });
      await actions.updateProfile({ prompts: allPrompts });
      setEditMode(false);
      setEditPrompts([]);
    } catch (err) {
      console.error("Save failed:", err);
    }
    setSaving(false);
  };

  const findCategory = (promptText) => {
    for (const [cat, list] of Object.entries(PROMPT_CATEGORIES)) {
      if (list.includes(promptText)) return cat;
    }
    return null;
  };

  const openPromptEditor = (idx) => {
    track("prompt_editor_opened", { promptIndex: idx });
    const p = prompts[idx];
    const cat = findCategory(p.prompt);
    setEditingPromptIdx(idx);
    setEditingPromptData({ prompt: p.prompt, answer: p.answer, category: cat || "Faith" });
  };

  const selectPromptQuestion = (promptText) => {
    track("prompt_question_selected", { prompt: promptText });
    setEditingPromptData((d) => ({ ...d, prompt: promptText, answer: d.prompt === promptText ? d.answer : "" }));
    setTimeout(() => answerRef.current?.focus(), 100);
  };

  const savePromptEdit = async () => {
    if (!editingPromptData?.prompt || !editingPromptData.answer.trim()) return;
    track("prompt_edit_saved", { prompt: editingPromptData.prompt });
    setSaving(true);
    try {
      const allPrompts = (currentUser.prompts || []).map((p, i) => {
        if (i === editingPromptIdx) return { prompt: editingPromptData.prompt, answer: editingPromptData.answer };
        return p;
      });
      await actions.updateProfile({ prompts: allPrompts });
      setEditingPromptIdx(null);
      setEditingPromptData(null);
    } catch (err) {
      console.error("Save failed:", err);
    }
    setSaving(false);
  };

  const openSettings = (sec) => {
    track("settings_section_opened", { section: sec });
    setSettingsSection(sec);
    setShowSettings(true);
  };

  const photos = currentUser.photos || [];

  const openCropper = (src, idx = null) => {
    setCropSrc(src);
    setCropIdx(idx);
    setCropOffset({ x: 0, y: 0 });
    setCropScale(1);
  };

  const handleAddPhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    track("photo_add_started");
    const reader = new FileReader();
    reader.onload = () => openCropper(reader.result, null);
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const saveCrop = async () => {
    track("photo_crop_saved", { isNew: cropIdx === null });
    const canvas = document.createElement("canvas");
    const size = 800;
    canvas.width = size;
    canvas.height = Math.round(size * (4 / 3));
    const ctx = canvas.getContext("2d");
    const img = new Image();
    img.crossOrigin = "anonymous";
    await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; img.src = cropSrc; });
    const scale = cropScale;
    const drawW = img.width * scale;
    const drawH = img.height * scale;
    const dx = (canvas.width - drawW) / 2 + cropOffset.x * scale;
    const dy = (canvas.height - drawH) / 2 + cropOffset.y * scale;
    ctx.drawImage(img, dx, dy, drawW, drawH);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.75);
    setUploading(true);
    try {
      if (cropIdx !== null) {
        const updated = [...photos];
        updated[cropIdx] = dataUrl;
        await actions.updateProfile({ photos: updated });
      } else {
        const regularPhotos = photos.slice(0, 4);
        if (regularPhotos.length >= 4) return;
        const verifiedPhotos = photos.slice(4);
        await actions.updateProfile({ photos: [...regularPhotos, dataUrl, ...verifiedPhotos] });
      }
    } catch (err) {
      console.error("Save failed:", err);
    }
    setUploading(false);
    setCropSrc(null);
    setCropIdx(null);
  };

  const handleCropPointerDown = (e) => {
    setCropDragging(true);
    setCropStart({ x: e.clientX - cropOffset.x, y: e.clientY - cropOffset.y });
  };
  const handleCropPointerMove = (e) => {
    if (!cropDragging) return;
    setCropOffset({ x: e.clientX - cropStart.x, y: e.clientY - cropStart.y });
  };
  const handleCropPointerUp = () => setCropDragging(false);

  const handleRemovePhoto = async (idx) => {
    if (idx >= 4) return;
    track("photo_removed", { photoIndex: idx });
    const updated = photos.filter((_, i) => i !== idx);
    await actions.updateProfile({ photos: updated });
  };

  const handleMovePhoto = async (idx, dir) => {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= Math.min(photos.length, 4)) return;
    track("photo_moved", { from: idx, to: newIdx });
    const updated = [...photos];
    [updated[idx], updated[newIdx]] = [updated[newIdx], updated[idx]];
    await actions.updateProfile({ photos: updated });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: C.surface }}>
      {/* Header — full bleed photo */}
      <div
        className="profile-hero-photo"
        style={{ position: "relative", height: 380, flexShrink: 0, cursor: "pointer" }}
        onClick={() => { setEditPhotos((v) => { if (!v) setTimeout(() => photosRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 50); return !v; }); }}
      >
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
        <div className="profile-hero-hover">
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 20px", borderRadius: 9999, background: "rgba(255,255,255,0.2)", backdropFilter: "blur(8px)" }}>
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2}>
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
            <span style={{ color: "white", fontSize: 13, fontWeight: 700, fontFamily: FONT }}>Change Photos</span>
          </div>
        </div>

        {/* Top bar */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, display: "flex", alignItems: "center", padding: "40px 20px 0" }}>
          <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.3px", color: "white", fontFamily: FONT }}>
            My Profile
          </span>
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
          {editMode ? (
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={(e) => { e.stopPropagation(); cancelEdit(); }}
                style={{
                  padding: "8px 16px",
                  borderRadius: 9999,
                  fontSize: 12,
                  fontWeight: 700,
                  background: "rgba(255,255,255,0.2)",
                  backdropFilter: "blur(10px)",
                  color: "white",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); saveEdit(); }}
                disabled={saving}
                style={{
                  padding: "8px 16px",
                  borderRadius: 9999,
                  fontSize: 12,
                  fontWeight: 700,
                  background: "white",
                  color: C.primary,
                  border: "none",
                  cursor: "pointer",
                  opacity: saving ? 0.6 : 1,
                }}
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); startEdit(); }}
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
          )}
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
              <p style={{ color: "white", fontWeight: 700, fontSize: 14, lineHeight: 1.3 }}>15 likes/day, 3 doves, see all who like you</p>
            </div>
            <button
              onClick={() => { track("upgrade_tapped", { source: "profile_banner" }); openSettings("subscription"); }}
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
              {getDovesRemaining(state.currentUser?.subscriptionStatus === "active")}
            </span>
            <span style={{ color: C.sub, fontSize: 11, marginTop: 2 }}>
              {getDovesRemaining(state.currentUser?.subscriptionStatus === "active") === 1 ? "Dove left this week" : "Doves left this week"}
            </span>
          </div>

          {/* Photos — only visible after clicking hero photo */}
          {editPhotos && (
          <div ref={photosRef} style={{ borderRadius: 16, padding: 16, background: C.card, border: `1px solid ${C.border}` }}>
            <p style={{ fontSize: 10, fontWeight: 600, color: C.primary, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>My Photos</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
              {photos.slice(0, 4).map((url, i) => (
                <div key={i} style={{ position: "relative", aspectRatio: "3/4", borderRadius: 12, overflow: "hidden", border: i === 0 ? `2px solid ${C.primary}` : `1px solid ${C.border}` }}>
                  <img src={url} alt={`Photo ${i + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={(e) => { e.target.src = `https://ui-avatars.com/api/?name=${currentUser.name}&size=200&background=random`; }} />
                  {i === 0 && (
                    <span style={{ position: "absolute", bottom: 4, left: 4, fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 6, background: C.primary, color: "white", textTransform: "uppercase" }}>Main</span>
                  )}
                  {editPhotos && (
                    <>
                      <button
                        onClick={() => openCropper(url, i)}
                        style={{ position: "absolute", bottom: 4, left: "50%", transform: "translateX(-50%)", padding: "3px 8px", borderRadius: 6, background: "rgba(0,0,0,0.6)", color: "white", border: "none", cursor: "pointer", fontSize: 9, fontWeight: 600 }}
                      >
                        Crop
                      </button>
                      <div style={{ position: "absolute", bottom: 4, left: 4, display: "flex", gap: 2 }}>
                        {i > 0 && (
                          <button onClick={() => handleMovePhoto(i, -1)} style={{ width: 22, height: 22, borderRadius: "50%", background: "rgba(0,0,0,0.6)", color: "white", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3}><path d="M15 18l-6-6 6-6" /></svg>
                          </button>
                        )}
                        {i < Math.min(photos.length, 4) - 1 && (
                          <button onClick={() => handleMovePhoto(i, 1)} style={{ width: 22, height: 22, borderRadius: "50%", background: "rgba(0,0,0,0.6)", color: "white", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3}><path d="M9 18l6-6-6-6" /></svg>
                          </button>
                        )}
                      </div>
                      {photos.length > 1 && (
                        <button
                          onClick={() => handleRemovePhoto(i)}
                          style={{ position: "absolute", top: 4, right: 4, width: 22, height: 22, borderRadius: "50%", background: "rgba(239,68,68,0.9)", color: "white", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                        >
                          <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3}><path d="M18 6L6 18M6 6l12 12" /></svg>
                        </button>
                      )}
                    </>
                  )}
                </div>
              ))}
              {photos.slice(0, 4).length < 4 && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  style={{
                    aspectRatio: "3/4",
                    borderRadius: 12,
                    border: `2px dashed ${C.border}`,
                    background: C.surface,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 4,
                    cursor: uploading ? "wait" : "pointer",
                    opacity: uploading ? 0.5 : 1,
                  }}
                >
                  {uploading ? (
                    <span style={{ fontSize: 11, color: C.sub, fontWeight: 600 }}>Uploading...</span>
                  ) : (
                    <>
                      <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={C.sub} strokeWidth={2}><path d="M12 5v14M5 12h14" /></svg>
                      <span style={{ fontSize: 10, color: C.sub, fontWeight: 600 }}>Add Photo</span>
                    </>
                  )}
                </button>
              )}

              {/* Verified photo slot 5 — Selfie with Church */}
              <div style={{ position: "relative", aspectRatio: "3/4", borderRadius: 12, overflow: "hidden", border: `2px dashed ${C.primary}40`, background: `linear-gradient(145deg, ${C.primarySoft}, ${C.surface})` }}>
                {photos[4] ? (
                  <>
                    <img src={photos[4]} alt="Church selfie" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    <div style={{ position: "absolute", top: 4, left: 4, display: "flex", alignItems: "center", gap: 3, padding: "2px 6px", borderRadius: 6, background: "#22C55E", color: "white" }}>
                      <svg width={8} height={8} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3}><path d="M20 6L9 17l-5-5" /></svg>
                      <span style={{ fontSize: 8, fontWeight: 700, textTransform: "uppercase" }}>Verified</span>
                    </div>
                  </>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 4, padding: 8 }}>
                    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={C.primary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"><path d="M18 2H6a2 2 0 0 0-2 2v16l8-4 8 4V4a2 2 0 0 0-2-2z"/><path d="M12 6v4M10 8h4"/></svg>
                    <span style={{ fontSize: 8, fontWeight: 700, color: C.primary, textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "center", lineHeight: 1.2 }}>Selfie with Church</span>
                    <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke={C.sub} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                  </div>
                )}
              </div>

              {/* Verified photo slot 6 — Selfie with Bible */}
              <div style={{ position: "relative", aspectRatio: "3/4", borderRadius: 12, overflow: "hidden", border: `2px dashed ${C.primary}40`, background: `linear-gradient(145deg, ${C.primarySoft}, ${C.surface})` }}>
                {photos[5] ? (
                  <>
                    <img src={photos[5]} alt="Bible selfie" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    <div style={{ position: "absolute", top: 4, left: 4, display: "flex", alignItems: "center", gap: 3, padding: "2px 6px", borderRadius: 6, background: "#22C55E", color: "white" }}>
                      <svg width={8} height={8} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3}><path d="M20 6L9 17l-5-5" /></svg>
                      <span style={{ fontSize: 8, fontWeight: 700, textTransform: "uppercase" }}>Verified</span>
                    </div>
                  </>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 4, padding: 8 }}>
                    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={C.primary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><path d="M12 6v4M10 8h4"/></svg>
                    <span style={{ fontSize: 8, fontWeight: 700, color: C.primary, textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "center", lineHeight: 1.2 }}>Selfie with Bible</span>
                    <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke={C.sub} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                  </div>
                )}
              </div>
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAddPhoto} style={{ display: "none" }} />
            <button
              onClick={() => setEditPhotos(false)}
              style={{ width: "100%", marginTop: 12, padding: "14px 0", borderRadius: 12, background: C.primary, color: "white", border: "none", cursor: "pointer", fontSize: 15, fontWeight: 700, letterSpacing: "0.02em" }}
            >
              Done
            </button>
          </div>
          )}

          {/* Prompts */}
          {(editMode ? editPrompts : prompts).map((p, i) => (
            <div
              key={i}
              style={{
                borderRadius: 16,
                overflow: "hidden",
                background: C.card,
                border: editMode ? `1.5px solid ${C.border}` : `1px solid ${C.border}`,
              }}
            >
              <div style={{ padding: "14px 14px 12px" }}>
                  <p
                    style={{
                      fontSize: 16,
                      fontWeight: 700,
                      color: C.text,
                      lineHeight: 1.4,
                      marginBottom: 6,
                    }}
                  >
                    {p.prompt}
                  </p>
                  {editMode ? (
                    <textarea
                      value={editPrompts[i]?.answer || ""}
                      onChange={(e) => {
                        const updated = [...editPrompts];
                        updated[i] = { ...updated[i], answer: e.target.value };
                        setEditPrompts(updated);
                      }}
                      style={{
                        width: "100%",
                        minHeight: 60,
                        fontSize: 16,
                        fontWeight: 600,
                        lineHeight: 1.3,
                        color: C.text,
                        fontFamily: FONT,
                        background: "white",
                        border: `1.5px solid ${C.border}`,
                        borderRadius: 12,
                        padding: "10px 12px",
                        resize: "vertical",
                        outline: "none",
                      }}
                    />
                  ) : (
                    <>
                      <p style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.3, color: C.text, fontFamily: FONT }}>
                        {p.answer}
                      </p>
                      <button
                        onClick={() => openPromptEditor(i)}
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
                    </>
                  )}
              </div>
            </div>
          ))}

          {/* Interests */}
          {(() => {
            const chipSection = (label, items, type, pool, fieldKey) => (
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
                  {label}
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {items.map((v) => (
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
                    onClick={() => {
                      track(`${type}_edit_opened`);
                      setEditingChips({ label, type, pool, fieldKey });
                      setEditingChipsData([...items]);
                    }}
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
                    + Edit
                  </button>
                </div>
              </div>
            );
            return (
              <>
                {chipSection("Interests", interests, "interests", TRAITS_POOL, "interests")}
                {chipSection("Values", currentUser.lookingFor || [], "values", LOOKING_FOR_POOL, "lookingFor")}
              </>
            );
          })()}

          {/* Account settings rows */}
          <div style={{ marginTop: 4 }}>
            <p style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: C.sub, padding: "0 4px", marginBottom: 8 }}>Account</p>
            {[
              { icon: "🔔", label: "Notifications", section: "notifications" },
              { icon: "🙏", label: "Faith Preferences", section: "faith" },
              { icon: "📍", label: "Location & Distance", section: "location" },
              { icon: "💳", label: "Subscription", section: "subscription" },
            ].map((item) => (
              <div
                key={item.label}
                onClick={() => openSettings(item.section)}
                style={{
                  borderRadius: 16,
                  overflow: "hidden",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: C.card,
                  marginBottom: 8,
                  cursor: "pointer",
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
              { icon: "🛡️", label: "Safety Centre", section: "safety" },
              { icon: "🔒", label: "Privacy", section: "privacy" },
              { icon: "🚫", label: "Blocked Profiles", section: "safety" },
            ].map((item) => (
              <div
                key={item.label}
                onClick={() => openSettings(item.section)}
                style={{
                  borderRadius: 16,
                  overflow: "hidden",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: C.card,
                  marginBottom: 8,
                  cursor: "pointer",
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
            onClick={() => { track("sign_out_tapped", { source: "profile" }); actions.logout(); }}
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

      {/* Photo crop modal */}
      {cropSrc && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.9)", zIndex: 9999, display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 16px", paddingTop: "max(16px, env(safe-area-inset-top, 48px))" }}>
            <button onClick={() => { track("photo_crop_cancelled"); setCropSrc(null); setCropIdx(null); }} style={{ fontSize: 16, fontWeight: 600, color: "white", background: "none", border: "none", cursor: "pointer", padding: "8px 4px" }}>Cancel</button>
            <p style={{ fontSize: 16, fontWeight: 700, color: "white" }}>Crop Photo</p>
            <button onClick={saveCrop} disabled={uploading} style={{ fontSize: 16, fontWeight: 700, color: uploading ? "#666" : "#4ADE80", background: "none", border: "none", cursor: "pointer", padding: "8px 4px" }}>{uploading ? "Saving..." : "Save"}</button>
          </div>
          <div
            style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", touchAction: "none" }}
            onPointerDown={handleCropPointerDown}
            onPointerMove={handleCropPointerMove}
            onPointerUp={handleCropPointerUp}
            onPointerLeave={handleCropPointerUp}
          >
            <div style={{ position: "relative", width: "80vw", maxWidth: 350, aspectRatio: "3/4", overflow: "hidden", borderRadius: 16, border: "2px solid rgba(255,255,255,0.3)" }}>
              <img
                src={cropSrc}
                alt="Crop"
                draggable={false}
                onLoad={(e) => setCropImgSize({ w: e.target.naturalWidth, h: e.target.naturalHeight })}
                style={{
                  position: "absolute",
                  left: "50%",
                  top: "50%",
                  transform: `translate(calc(-50% + ${cropOffset.x}px), calc(-50% + ${cropOffset.y}px)) scale(${cropScale})`,
                  maxWidth: "none",
                  maxHeight: "none",
                  width: "100%",
                  minHeight: "100%",
                  objectFit: "cover",
                  pointerEvents: "none",
                  userSelect: "none",
                }}
              />
            </div>
          </div>
          <div style={{ padding: "12px 32px 24px", display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>−</span>
            <input
              type="range"
              min={0.5}
              max={3}
              step={0.05}
              value={cropScale}
              onChange={(e) => setCropScale(parseFloat(e.target.value))}
              style={{ flex: 1 }}
            />
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>+</span>
          </div>
          <p style={{ textAlign: "center", fontSize: 12, color: "rgba(255,255,255,0.5)", paddingBottom: 16 }}>Drag to move · Slide to zoom</p>
        </div>
      )}

      {/* Prompt editor bottom sheet */}
      {editingPromptIdx !== null && editingPromptData && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}
          onClick={() => { setEditingPromptIdx(null); setEditingPromptData(null); }}
        >
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)" }} />
          <div
            style={{
              position: "relative",
              background: C.bg,
              borderRadius: "24px 24px 0 0",
              maxHeight: "85vh",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 20px 12px" }}>
              <button
                onClick={() => { setEditingPromptIdx(null); setEditingPromptData(null); }}
                style={{ background: "none", border: "none", cursor: "pointer", color: C.sub, fontSize: 14, fontWeight: 600 }}
              >
                Cancel
              </button>
              <span style={{ fontSize: 16, fontWeight: 700, fontFamily: FONT, color: C.text }}>
                {editingPromptData.category}
              </span>
              <button
                onClick={savePromptEdit}
                disabled={saving || !editingPromptData.answer.trim()}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: editingPromptData.answer.trim() ? C.primary : C.sub,
                  fontSize: 14,
                  fontWeight: 700,
                  opacity: saving ? 0.5 : 1,
                }}
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: C.border, margin: "0 auto 16px" }} />

            <div style={{ overflowY: "auto", padding: "0 20px 20px", flex: 1 }}>
              {editingPromptData.prompt && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                    <p style={{ fontSize: 10, fontWeight: 600, color: C.primary, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                      {editingPromptData.prompt}
                    </p>
                    <button
                      onClick={() => { track("prompt_question_cleared"); setEditingPromptData((d) => ({ ...d, prompt: "", answer: "" })); }}
                      style={{ background: "none", border: "none", cursor: "pointer", color: C.sub, fontSize: 18, lineHeight: 1 }}
                    >
                      ×
                    </button>
                  </div>
                  <textarea
                    ref={answerRef}
                    value={editingPromptData.answer}
                    onChange={(e) => setEditingPromptData((d) => ({ ...d, answer: e.target.value }))}
                    placeholder="Your answer..."
                    maxLength={250}
                    rows={3}
                    style={{
                      width: "100%",
                      fontSize: 16,
                      fontWeight: 600,
                      lineHeight: 1.4,
                      color: C.text,
                      fontFamily: FONT,
                      background: C.surface,
                      border: `1.5px solid ${C.border}`,
                      borderRadius: 12,
                      padding: "12px 14px",
                      resize: "vertical",
                      outline: "none",
                    }}
                    autoFocus
                  />
                  <p style={{ fontSize: 11, color: C.sub, textAlign: "right", marginTop: 4 }}>
                    {editingPromptData.answer.length}/250
                  </p>
                </div>
              )}

              <p style={{ fontSize: 10, fontWeight: 600, color: C.sub, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>
                {editingPromptData.prompt ? "Or pick a different question" : "Pick a question"}
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {(PROMPT_CATEGORIES[editingPromptData.category] || []).map((q) => (
                  <button
                    key={q}
                    onClick={() => selectPromptQuestion(q)}
                    style={{
                      padding: "12px 14px",
                      borderRadius: 12,
                      fontSize: 14,
                      fontWeight: 600,
                      fontFamily: FONT,
                      textAlign: "left",
                      cursor: "pointer",
                      border: q === editingPromptData.prompt ? `2px solid ${C.primary}` : `1px solid ${C.border}`,
                      background: q === editingPromptData.prompt ? C.primarySoft : C.card,
                      color: q === editingPromptData.prompt ? C.primary : C.text,
                    }}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Chip editor overlay */}
      {editingChips && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}
          onClick={() => setEditingChips(null)}
        >
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)" }} />
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "relative",
              background: C.bg,
              borderRadius: "20px 20px 0 0",
              padding: "20px 16px 32px",
              maxHeight: "70vh",
              overflowY: "auto",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <button
                onClick={() => setEditingChips(null)}
                style={{ fontSize: 14, fontWeight: 600, color: C.sub, background: "none", border: "none", cursor: "pointer" }}
              >
                Cancel
              </button>
              <p style={{ fontSize: 16, fontWeight: 700, color: C.text }}>{editingChips.label}</p>
              <button
                onClick={async () => {
                  track(`${editingChips.type}_edit_saved`, { count: editingChipsData.length });
                  setSaving(true);
                  try {
                    await actions.updateProfile({ [editingChips.fieldKey]: editingChipsData });
                  } catch (err) {
                    console.error("Save failed:", err);
                  }
                  setSaving(false);
                  setEditingChips(null);
                }}
                disabled={saving || editingChipsData.length < 3}
                style={{ fontSize: 14, fontWeight: 700, color: saving || editingChipsData.length < 3 ? C.sub : C.primary, background: "none", border: "none", cursor: "pointer" }}
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
            <p style={{ fontSize: 12, color: C.sub, marginBottom: 12 }}>Pick 3-8</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {editingChips.pool.map((item) => {
                const selected = editingChipsData.includes(item);
                return (
                  <button
                    key={item}
                    onClick={() => {
                      if (selected) {
                        setEditingChipsData(editingChipsData.filter((v) => v !== item));
                      } else if (editingChipsData.length < 8) {
                        setEditingChipsData([...editingChipsData, item]);
                      }
                    }}
                    style={{
                      padding: "8px 14px",
                      borderRadius: 9999,
                      fontSize: 13,
                      fontWeight: 600,
                      fontFamily: FONT,
                      background: selected ? C.primarySoft : C.surface,
                      color: selected ? C.primary : C.sub,
                      border: selected ? `2px solid ${C.primary}` : `1.5px solid ${C.border}`,
                      cursor: "pointer",
                      transition: "all 0.15s",
                    }}
                  >
                    {item}
                  </button>
                );
              })}
            </div>
            <p style={{ fontSize: 12, color: C.sub, textAlign: "center", marginTop: 12 }}>{editingChipsData.length}/8 selected</p>
          </div>
        </div>
      )}
    </div>
  );
}
