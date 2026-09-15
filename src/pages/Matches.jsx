import { useState, useRef, useEffect, useMemo } from "react";
import { useApp } from "../context/AppContext";
import * as api from "../services/api";
import AgapeCross from "../components/AgapeCross";
import LocationPicker from "../components/LocationPicker";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const C = { bg: "#FFFFFF", card: "#FAFAF8", surface: "#F4F2EE", primary: "#B8912A", primarySoft: "#FBF5E6", text: "#1A1612", sub: "#8C857C", border: "#E8E4DF", sent: "#111111" };
const FONT = "'Outfit', system-ui, sans-serif";

const DATE_TYPES = [
  { id: "dinner", emoji: "🍽️", label: "Dinner" },
  { id: "walk", emoji: "🌿", label: "Walk" },
  { id: "coffee", emoji: "☕", label: "Coffee" },
  { id: "adventure", emoji: "🏔️", label: "Adventure" },
];

const WARDROBE_OPTIONS = [
  { id: "casual", emoji: "👕", label: "Casual" },
  { id: "smart", emoji: "👔", label: "Smart Casual" },
  { id: "formal", emoji: "✨", label: "Formal" },
  { id: "sporty", emoji: "🏃", label: "Active" },
];

const TIME_SLOTS = ["12:00", "14:00", "16:00", "18:00", "19:30", "21:00"];

function getNext7Days() {
  const days = [];
  const now = new Date();
  for (let i = 1; i <= 7; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    days.push({
      date: d.toISOString().split("T")[0],
      dayName: d.toLocaleDateString("en", { weekday: "short" }),
      dayNum: d.getDate(),
      month: d.toLocaleDateString("en", { month: "short" }),
    });
  }
  return days;
}

function formatTimeLeft(ms) {
  if (ms <= 0) return "Expired";
  const hours = Math.floor(ms / 3600000);
  const days = Math.floor(hours / 24);
  const h = hours % 24;
  if (days > 0) return `${days}d ${h}h`;
  if (h > 0) return `${h}h`;
  return `${Math.floor(ms / 60000)}m`;
}

function BackIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function MiniMap({ center, onPick }) {
  const mapRef = useRef(null);
  const mapInst = useRef(null);
  const markerRef = useRef(null);

  useEffect(() => {
    if (!mapRef.current || mapInst.current) return;
    const map = L.map(mapRef.current, { zoomControl: false }).setView([center.lat, center.lng], 14);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OSM",
    }).addTo(map);
    L.control.zoom({ position: "bottomright" }).addTo(map);

    const marker = L.circleMarker([center.lat, center.lng], {
      radius: 10, fillColor: "#B8912A", fillOpacity: 1, color: "white", weight: 3,
    }).addTo(map);

    map.on("click", async (e) => {
      const { lat, lng } = e.latlng;
      marker.setLatLng([lat, lng]);
      try {
        const resp = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=18&accept-language=en`);
        const data = await resp.json();
        const a = data.address || {};
        const name = [a.amenity || a.building || a.road || "", a.city || a.town || a.village || ""].filter(Boolean).join(", ") || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        onPick({ lat, lng, name });
      } catch {
        onPick({ lat, lng, name: `${lat.toFixed(4)}, ${lng.toFixed(4)}` });
      }
    });

    mapInst.current = map;
    markerRef.current = marker;
    setTimeout(() => map.invalidateSize(), 100);
    return () => { map.remove(); mapInst.current = null; };
  }, []);

  useEffect(() => {
    if (mapInst.current) {
      mapInst.current.setView([center.lat, center.lng], 14);
      markerRef.current?.setLatLng([center.lat, center.lng]);
    }
  }, [center.lat, center.lng]);

  return <div ref={mapRef} style={{ width: "100%", height: "100%" }} />;
}

function DateBuilder({ profileName, userLocation, onSend, onClose }) {
  const [step, setStep] = useState(1);
  const [dateType, setDateType] = useState(null);
  const [location, setLocation] = useState("");
  const [mapCenter, setMapCenter] = useState(userLocation || { lat: 50.0647, lng: 19.9450 });
  const [wardrobe, setWardrobe] = useState(null);
  const [selections, setSelections] = useState([]);
  const [pickingDay, setPickingDay] = useState(null);
  const days = useMemo(getNext7Days, []);

  const addSelection = (day, time) => {
    if (selections.length >= 3) return;
    if (selections.some((s) => s.date === day.date && s.time === time)) return;
    setSelections([...selections, { date: day.date, label: `${day.dayName} ${day.dayNum} ${day.month}`, time }]);
    setPickingDay(null);
  };

  const removeSelection = (idx) => setSelections(selections.filter((_, i) => i !== idx));

  const canProceed =
    (step === 1 && dateType) ||
    (step === 2 && location.trim()) ||
    (step === 3 && wardrobe) ||
    (step === 4 && selections.length >= 2);

  const handleNext = () => {
    if (step < 4) setStep(step + 1);
    else onSend({ dateType, location: location.trim(), wardrobe, proposedTimes: selections });
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, maxWidth: 430, margin: "0 auto", zIndex: 500, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "flex-end" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", borderRadius: "24px 24px 0 0", background: C.bg, padding: "20px 16px 32px", maxHeight: "80vh", overflowY: "auto" }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: C.border, margin: "0 auto 16px" }} />

        <div style={{ display: "flex", gap: 4, marginBottom: 20 }}>
          {[1, 2, 3, 4].map((s) => (
            <div key={s} style={{ flex: 1, height: 3, borderRadius: 2, background: s <= step ? C.primary : C.border }} />
          ))}
        </div>

        {step === 1 && (
          <>
            <p style={{ fontSize: 18, fontWeight: 700, color: C.text, fontFamily: FONT, marginBottom: 16 }}>What kind of date?</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {DATE_TYPES.map((dt) => (
                <button
                  key={dt.id}
                  onClick={() => setDateType(dt.id)}
                  style={{
                    padding: "16px 14px",
                    borderRadius: 14,
                    border: dateType === dt.id ? `2px solid ${C.primary}` : `1.5px solid ${C.border}`,
                    background: dateType === dt.id ? C.primarySoft : C.card,
                    cursor: "pointer",
                    textAlign: "left",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <span style={{ fontSize: 20 }}>{dt.emoji}</span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: FONT }}>{dt.label}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <p style={{ fontSize: 18, fontWeight: 700, color: C.text, fontFamily: FONT, marginBottom: 4 }}>Where to meet?</p>
            <p style={{ fontSize: 13, color: C.sub, marginBottom: 12 }}>Search for a place or type it in</p>
            <LocationPicker
              value={location}
              onChange={setLocation}
              onSelect={(item) => {
                setLocation(item.display);
                setMapCenter({ lat: item.lat, lng: item.lng });
              }}
              placeholder="e.g. Café Central, Schwyz"
              inputStyle={{
                width: "100%",
                padding: "14px 16px",
                fontSize: 16,
                fontWeight: 600,
                fontFamily: FONT,
                borderRadius: 14,
                border: `1.5px solid ${C.border}`,
                background: C.surface,
                outline: "none",
                color: C.text,
                boxSizing: "border-box",
              }}
            />
            <div style={{ marginTop: 12, borderRadius: 14, overflow: "hidden", border: `1.5px solid ${C.border}`, height: 200 }}>
              <MiniMap
                center={mapCenter}
                onPick={(spot) => {
                  setLocation(spot.name);
                  setMapCenter({ lat: spot.lat, lng: spot.lng });
                }}
              />
            </div>
            <p style={{ fontSize: 11, color: C.sub, marginTop: 6, textAlign: "center" }}>Tap the map to pick a spot</p>
          </>
        )}

        {step === 3 && (
          <>
            <p style={{ fontSize: 18, fontWeight: 700, color: C.text, fontFamily: FONT, marginBottom: 16 }}>Dress code</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {WARDROBE_OPTIONS.map((w) => (
                <button
                  key={w.id}
                  onClick={() => setWardrobe(w.id)}
                  style={{
                    padding: "16px 14px",
                    borderRadius: 14,
                    border: wardrobe === w.id ? `2px solid ${C.primary}` : `1.5px solid ${C.border}`,
                    background: wardrobe === w.id ? C.primarySoft : C.card,
                    cursor: "pointer",
                    textAlign: "left",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <span style={{ fontSize: 20 }}>{w.emoji}</span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: FONT }}>{w.label}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {step === 4 && (
          <>
            <p style={{ fontSize: 18, fontWeight: 700, color: C.text, fontFamily: FONT, marginBottom: 4 }}>When works for you?</p>
            <p style={{ fontSize: 13, color: C.sub, marginBottom: 16 }}>Pick 2–3 times</p>

            {selections.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
                {selections.map((s, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 9999, background: C.primarySoft, fontSize: 13, fontWeight: 600, color: C.primary }}>
                    <span>{s.label} · {s.time}</span>
                    <button onClick={() => removeSelection(i)} style={{ background: "none", border: "none", cursor: "pointer", color: C.primary, fontSize: 14, fontWeight: 700, padding: 0 }}>×</button>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 8, marginBottom: 8 }}>
              {days.map((d) => (
                <button
                  key={d.date}
                  onClick={() => setPickingDay(pickingDay?.date === d.date ? null : d)}
                  style={{
                    flexShrink: 0,
                    padding: "10px 14px",
                    borderRadius: 14,
                    border: pickingDay?.date === d.date ? `2px solid ${C.primary}` : `1.5px solid ${C.border}`,
                    background: pickingDay?.date === d.date ? C.primarySoft : C.card,
                    cursor: "pointer",
                    textAlign: "center",
                    minWidth: 60,
                  }}
                >
                  <span style={{ fontSize: 11, color: C.sub, display: "block", fontWeight: 600 }}>{d.dayName}</span>
                  <span style={{ fontSize: 18, fontWeight: 700, color: C.text, display: "block" }}>{d.dayNum}</span>
                  <span style={{ fontSize: 10, color: C.sub }}>{d.month}</span>
                </button>
              ))}
            </div>

            {pickingDay && selections.length < 3 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: "8px 0" }}>
                {TIME_SLOTS.map((t) => (
                  <button
                    key={t}
                    onClick={() => addSelection(pickingDay, t)}
                    disabled={selections.some((s) => s.date === pickingDay.date && s.time === t)}
                    style={{
                      padding: "8px 16px",
                      borderRadius: 10,
                      border: `1.5px solid ${C.border}`,
                      background: C.card,
                      cursor: "pointer",
                      fontSize: 14,
                      fontWeight: 600,
                      color: C.text,
                      fontFamily: FONT,
                      opacity: selections.some((s) => s.date === pickingDay.date && s.time === t) ? 0.4 : 1,
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        <div style={{ display: "flex", gap: 8, marginTop: 24 }}>
          {step > 1 && (
            <button onClick={() => setStep(step - 1)} style={{ flex: 1, padding: "14px 0", borderRadius: 14, fontSize: 14, fontWeight: 700, background: C.surface, color: C.sub, border: "none", cursor: "pointer" }}>
              Back
            </button>
          )}
          <button
            onClick={handleNext}
            disabled={!canProceed}
            style={{
              flex: 2,
              padding: "14px 0",
              borderRadius: 14,
              fontSize: 14,
              fontWeight: 700,
              background: canProceed ? C.primary : C.border,
              color: "white",
              border: "none",
              cursor: canProceed ? "pointer" : "default",
            }}
          >
            {step === 4 ? "Send Invitation" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}

const DECLINE_REASONS = [
  "Times don't work for me",
  "Not comfortable with the location",
  "Too soon, need more time chatting",
  "I'd like a video call first",
  "Not interested anymore",
];

function DateCard({ invitation, isMe, isMale, onRespond, onConfirm, onDecline }) {
  const [selectedTimes, setSelectedTimes] = useState([]);
  const [sending, setSending] = useState(false);
  const [showDecline, setShowDecline] = useState(false);
  const [declineReasons, setDeclineReasons] = useState([]);
  const dt = DATE_TYPES.find((d) => d.id === invitation.date_type);
  const wb = WARDROBE_OPTIONS.find((w) => w.id === invitation.wardrobe);

  const toggleTime = (t) => {
    setSelectedTimes((prev) =>
      prev.some((s) => s.date === t.date && s.time === t.time)
        ? prev.filter((s) => !(s.date === t.date && s.time === t.time))
        : [...prev, t]
    );
  };

  const handleRespond = async () => {
    if (selectedTimes.length === 0) return;
    setSending(true);
    await onRespond(invitation.id, selectedTimes);
    setSending(false);
  };

  const handleConfirm = async (time) => {
    setSending(true);
    await onConfirm(invitation.id, time);
    setSending(false);
  };

  const toggleDeclineReason = (r) => {
    setDeclineReasons((prev) =>
      prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]
    );
  };

  const handleDecline = async () => {
    if (declineReasons.length === 0) return;
    setSending(true);
    await onDecline(invitation.id, declineReasons);
    setSending(false);
  };

  return (
    <div style={{ margin: "8px 0", borderRadius: 20, overflow: "hidden", border: `1.5px solid ${invitation.status === "confirmed" ? "#22C55E" : C.primary}`, background: C.card }}>
      <div style={{ padding: "12px 16px", background: invitation.status === "confirmed" ? "#F0FDF4" : C.surface, display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: invitation.status === "confirmed" ? "#16A34A" : C.text, fontFamily: FONT, letterSpacing: "-0.2px" }}>
          {invitation.status === "confirmed" ? "Date Confirmed" : "Date Invitation"}
        </span>
      </div>

      <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 16 }}>{dt?.emoji}</span>
          <span style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: FONT }}>{dt?.label}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={C.sub} strokeWidth={2}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
          <span style={{ fontSize: 13, color: C.sub, fontFamily: FONT }}>{invitation.location}</span>
        </div>
        {wb && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 14 }}>{wb.emoji}</span>
            <span style={{ fontSize: 13, color: C.sub, fontFamily: FONT }}>{wb.label}</span>
          </div>
        )}
      </div>

      <div style={{ padding: "0 16px 14px" }}>
        {invitation.status === "confirmed" && invitation.confirmed_time && (
          <div style={{ padding: "10px 14px", borderRadius: 12, background: "#DCFCE7", textAlign: "center" }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#16A34A", fontFamily: FONT }}>
              {invitation.confirmed_time.label} · {invitation.confirmed_time.time}
            </span>
          </div>
        )}

        {invitation.status === "pending" && !isMale && (
          <>
            <p style={{ fontSize: 12, fontWeight: 600, color: C.sub, marginBottom: 8 }}>Select times that work for you:</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {(invitation.proposed_times || []).map((t, i) => {
                const isSelected = selectedTimes.some((s) => s.date === t.date && s.time === t.time);
                return (
                  <button
                    key={i}
                    onClick={() => toggleTime(t)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "10px 14px",
                      borderRadius: 12,
                      border: isSelected ? `2px solid ${C.primary}` : `1.5px solid ${C.border}`,
                      background: isSelected ? C.primarySoft : "white",
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <span style={{ width: 20, height: 20, borderRadius: 6, border: isSelected ? `2px solid ${C.primary}` : `2px solid ${C.border}`, background: isSelected ? C.primary : "white", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {isSelected && <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3}><path d="M20 6L9 17l-5-5" /></svg>}
                    </span>
                    <span style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: FONT }}>{t.label} · {t.time}</span>
                  </button>
                );
              })}
            </div>
            <button
              onClick={handleRespond}
              disabled={selectedTimes.length === 0 || sending}
              style={{
                width: "100%",
                marginTop: 12,
                padding: "12px 0",
                borderRadius: 14,
                fontSize: 14,
                fontWeight: 700,
                background: selectedTimes.length > 0 ? C.primary : C.border,
                color: "white",
                border: "none",
                cursor: selectedTimes.length > 0 ? "pointer" : "default",
              }}
            >
              {sending ? "Sending..." : "Send availability"}
            </button>

            {!showDecline ? (
              <button
                onClick={() => setShowDecline(true)}
                style={{ width: "100%", marginTop: 8, padding: "10px 0", borderRadius: 14, fontSize: 13, fontWeight: 600, background: "none", color: C.sub, border: "none", cursor: "pointer" }}
              >
                Decline
              </button>
            ) : (
              <div style={{ marginTop: 12 }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: "#EF4444", marginBottom: 8 }}>Why are you declining?</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {DECLINE_REASONS.map((r) => {
                    const checked = declineReasons.includes(r);
                    return (
                      <button
                        key={r}
                        onClick={() => toggleDeclineReason(r)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          padding: "10px 14px",
                          borderRadius: 12,
                          border: checked ? "2px solid #EF4444" : `1.5px solid ${C.border}`,
                          background: checked ? "#FEF2F2" : "white",
                          cursor: "pointer",
                          textAlign: "left",
                        }}
                      >
                        <span style={{ width: 18, height: 18, borderRadius: 5, border: checked ? "2px solid #EF4444" : `2px solid ${C.border}`, background: checked ? "#EF4444" : "white", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          {checked && <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3}><path d="M20 6L9 17l-5-5" /></svg>}
                        </span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: C.text, fontFamily: FONT }}>{r}</span>
                      </button>
                    );
                  })}
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  <button
                    onClick={() => { setShowDecline(false); setDeclineReasons([]); }}
                    style={{ flex: 1, padding: "10px 0", borderRadius: 14, fontSize: 13, fontWeight: 600, background: C.surface, color: C.sub, border: "none", cursor: "pointer" }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDecline}
                    disabled={declineReasons.length === 0 || sending}
                    style={{
                      flex: 1,
                      padding: "10px 0",
                      borderRadius: 14,
                      fontSize: 13,
                      fontWeight: 700,
                      background: declineReasons.length > 0 ? "#EF4444" : C.border,
                      color: "white",
                      border: "none",
                      cursor: declineReasons.length > 0 ? "pointer" : "default",
                    }}
                  >
                    {sending ? "..." : "Decline date"}
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {invitation.status === "pending" && isMale && (
          <>
            <p style={{ fontSize: 12, fontWeight: 600, color: C.sub, marginBottom: 8 }}>Proposed times:</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {(invitation.proposed_times || []).map((t, i) => (
                <div key={i} style={{ padding: "10px 14px", borderRadius: 12, background: C.surface }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: FONT }}>{t.label} · {t.time}</span>
                </div>
              ))}
            </div>
            <p style={{ fontSize: 12, color: C.sub, textAlign: "center", marginTop: 8 }}>Waiting for her response...</p>
          </>
        )}

        {invitation.status === "responded" && isMale && (
          <>
            <p style={{ fontSize: 12, fontWeight: 600, color: C.sub, marginBottom: 8 }}>She's available:</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {(invitation.response_times || []).map((t, i) => (
                <button
                  key={i}
                  onClick={() => handleConfirm(t)}
                  disabled={sending}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 14px",
                    borderRadius: 12,
                    border: `1.5px solid ${C.primary}`,
                    background: C.primarySoft,
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <span style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: FONT }}>{t.label} · {t.time}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: C.primary }}>Confirm</span>
                </button>
              ))}
            </div>
          </>
        )}

        {invitation.status === "responded" && !isMale && (
          <>
            <p style={{ fontSize: 12, color: C.sub, textAlign: "center" }}>You responded — waiting for him to confirm</p>
          </>
        )}

        {invitation.status === "declined" && (
          <div style={{ padding: "10px 14px", borderRadius: 12, background: "#FEF2F2", textAlign: "center" }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#EF4444", fontFamily: FONT }}>
              Date declined
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function ChatThread({ match, onBack }) {
  const { state, dispatch, actions } = useApp();
  const [text, setText] = useState("");
  const [reacting, setReacting] = useState(null);
  const [localMessages, setLocalMessages] = useState([]);
  const [viewProfile, setViewProfile] = useState(false);
  const [showReportMenu, setShowReportMenu] = useState(false);
  const [reportDone, setReportDone] = useState(null);
  const [blockFlash, setBlockFlash] = useState(false);
  const [showDateBuilder, setShowDateBuilder] = useState(false);
  const [dateInvitations, setDateInvitations] = useState([]);
  const bottomRef = useRef(null);

  const currentUserId = state.currentUser?._id || state.currentUser?.id;
  const isMale = state.currentUser?.gender === "male";
  const conversation = state.conversations[match.id];
  const profile = match.profile;

  const REACTIONS = ["🙏", "❤️", "😊", "🔥", "😂", "✨"];

  useEffect(() => {
    actions.loadMessages(match.id).catch(console.error);
    api.getDateInvitations(match.id).then(setDateInvitations).catch(console.error);
    const poll = setInterval(() => {
      actions.loadMessages(match.id).catch(console.error);
      api.getDateInvitations(match.id).then(setDateInvitations).catch(console.error);
    }, 5000);
    return () => clearInterval(poll);
  }, [match.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation?.messages?.length, localMessages.length, dateInvitations.length]);

  const messages = conversation?.messages || [];

  const [nudgeSent, setNudgeSent] = useState(!!match.nudgeAt);
  const [nudgeSending, setNudgeSending] = useState(false);

  useEffect(() => {
    if (!nudgeSent && isMale) {
      const checkNudge = setInterval(async () => {
        try {
          const matches = await api.getMatches();
          const m = matches.find((x) => x.id === match.id);
          if (m?.nudgeAt) { setNudgeSent(true); clearInterval(checkNudge); }
        } catch (_) {}
      }, 10000);
      return () => clearInterval(checkNudge);
    }
  }, [nudgeSent, isMale, match.id]);

  const firstMessageTime = messages.length > 0 ? messages[0].timestamp : null;
  const FIVE_DAYS = 5 * 24 * 60 * 60 * 1000;
  const NUDGE_BONUS = 36 * 60 * 60 * 1000;
  const COOLDOWN_48H = 48 * 60 * 60 * 1000;
  const deadlinePaused = match.deadlinePaused;
  const hasVideoCall = !!(match.videoCallAt);
  const hasConfirmedDate = dateInvitations.some((inv) => inv.status === "confirmed");
  const hasPendingDate = dateInvitations.some((inv) => inv.status === "pending" || inv.status === "responded");

  const timerStopped = deadlinePaused || hasVideoCall || hasConfirmedDate || hasPendingDate;

  const lastDeclined = dateInvitations
    .filter((inv) => inv.status === "declined")
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
  const lastDeclinedAt = lastDeclined ? new Date(lastDeclined.created_at).getTime() : null;

  let deadlineMs = null;
  if (!timerStopped && firstMessageTime) {
    if (lastDeclinedAt) {
      deadlineMs = lastDeclinedAt + COOLDOWN_48H + FIVE_DAYS;
    } else {
      deadlineMs = firstMessageTime + FIVE_DAYS;
    }
    if (nudgeSent || match.nudgeAt) deadlineMs += NUDGE_BONUS;
  }

  const timeLeftMs = deadlineMs ? deadlineMs - Date.now() : null;
  const chatLocked = !timerStopped && timeLeftMs !== null && timeLeftMs <= 0;

  const handleNudge = async () => {
    setNudgeSending(true);
    try {
      await api.sendNudge(match.id);
      await actions.sendMessage(match.id, "🌹");
      setNudgeSent(true);
    } catch (err) {
      console.error("Nudge failed:", err);
    }
    setNudgeSending(false);
  };

  const [videoCallStarted, setVideoCallStarted] = useState(false);
  const [showVideoCallScheduler, setShowVideoCallScheduler] = useState(false);
  const [vcDay, setVcDay] = useState(null);
  const [vcTime, setVcTime] = useState(null);
  const vcDays = useMemo(getNext7Days, []);

  const handleVideoCall = async () => {
    if (!vcDay || !vcTime) return;
    setVideoCallStarted(true);
    try {
      await api.startVideoCall(match.id);
      await actions.sendMessage(match.id, `📹 Video call scheduled: ${vcDay.dayName} ${vcDay.dayNum} ${vcDay.month} at ${vcTime}`);
    } catch (err) {
      console.error("Video call failed:", err);
      setVideoCallStarted(false);
    }
    setShowVideoCallScheduler(false);
  };

  const [showNudgeExplainer, setShowNudgeExplainer] = useState(false);

  const timeline = useMemo(() => {
    const items = [];
    messages.forEach((msg) => items.push({ ...msg, _type: "message" }));
    dateInvitations.forEach((inv) => items.push({ ...inv, _type: "date", timestamp: new Date(inv.created_at).getTime() }));
    items.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    return items;
  }, [messages, dateInvitations]);

  const send = async () => {
    if (!text.trim() || chatLocked) return;
    const msg = text.trim();
    setText("");
    try {
      await actions.sendMessage(match.id, msg);
    } catch (err) {
      console.error("Send failed:", err);
    }
  };

  const handleSendDate = async (data) => {
    setShowDateBuilder(false);
    try {
      const inv = await api.createDateInvitation(match.id, data);
      setDateInvitations((prev) => [...prev, inv]);
    } catch (err) {
      console.error("Date invite failed:", err);
    }
  };

  const handleRespondDate = async (invId, selectedTimes) => {
    try {
      const updated = await api.respondToDate(invId, selectedTimes);
      setDateInvitations((prev) => prev.map((inv) => (inv.id === invId ? updated : inv)));
    } catch (err) {
      console.error("Respond failed:", err);
    }
  };

  const handleConfirmDate = async (invId, confirmedTime) => {
    try {
      const updated = await api.confirmDate(invId, confirmedTime);
      setDateInvitations((prev) => prev.map((inv) => (inv.id === invId ? updated : inv)));
    } catch (err) {
      console.error("Confirm failed:", err);
    }
  };

  const handleDeclineDate = async (invId, reasons) => {
    try {
      const updated = await api.declineDate(invId, reasons);
      setDateInvitations((prev) => prev.map((inv) => (inv.id === invId ? updated : inv)));
    } catch (err) {
      console.error("Decline failed:", err);
    }
  };

  const formatTime = (ts) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", position: "fixed", inset: 0, maxWidth: 430, margin: "0 auto", zIndex: 200, background: C.bg }}>
      {blockFlash && (
        <div className="like-flash-overlay block">
          <span className="flash-emoji">🚫</span>
        </div>
      )}
      {/* Header */}
      <div style={{ flexShrink: 0, padding: "40px 16px 12px", background: C.card, borderBottom: `1px solid ${C.border}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={onBack} style={{ width: 36, height: 36, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: C.surface, color: C.text, border: "none", cursor: "pointer" }}>
            <BackIcon />
          </button>
          <div style={{ position: "relative", flexShrink: 0, cursor: "pointer" }} onClick={() => setViewProfile(true)}>
            <img src={profile.photos[0]} alt={profile.name} style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover", border: `2px solid ${C.primary}` }} onError={(e) => { e.target.src = `https://ui-avatars.com/api/?name=${profile.name}&size=40&background=random`; }} />
            <div style={{ position: "absolute", bottom: -2, right: -2, width: 12, height: 12, borderRadius: "50%", background: "#22C55E", border: "2px solid white" }} />
          </div>
          <div style={{ flex: 1, minWidth: 0, cursor: "pointer" }} onClick={() => setViewProfile(true)}>
            <p style={{ fontWeight: 700, fontSize: 16, lineHeight: 1, color: C.text, fontFamily: FONT, margin: 0 }}>{profile.name}</p>
            <p style={{ fontSize: 12, color: "#22C55E", marginTop: 2 }}>Active now</p>
          </div>
          <button onClick={() => setShowReportMenu(true)} style={{ width: 36, height: 36, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: "#FEF2F2", border: "none", cursor: "pointer" }}>
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth={2.5}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
          </button>
        </div>

        {/* Match banner */}
        <div style={{ marginTop: 12, borderRadius: 12, padding: "8px 16px", display: "flex", alignItems: "center", gap: 8, background: C.primarySoft }}>
          <span style={{ color: C.primary }}><AgapeCross size={11} strokeWidth={1.5} /></span>
          <p style={{ fontSize: 12, fontWeight: 600, color: C.primary, margin: 0 }}>You matched with {profile.name}{profile.denomination ? ` · ${profile.denomination}` : ""}</p>
        </div>

        {/* Deadline banner */}
        {firstMessageTime && !timerStopped && !chatLocked && timeLeftMs !== null && (
          <div style={{ marginTop: 8, borderRadius: 12, padding: "8px 16px", display: "flex", alignItems: "center", gap: 8, background: timeLeftMs < 86400000 ? "#FEF2F2" : C.surface }}>
            <span style={{ fontSize: 14 }}>⏰</span>
            <p style={{ fontSize: 12, fontWeight: 600, color: timeLeftMs < 86400000 ? "#EF4444" : C.sub, margin: 0 }}>
              {isMale
                ? `${formatTimeLeft(timeLeftMs)} left to plan a date${nudgeSent || match.nudgeAt ? " — 🌹 she sent a rose! (+36h)" : ""}`
                : `${formatTimeLeft(timeLeftMs)} left${nudgeSent ? " 🌹 (+36h added)" : " — waiting for him to plan a date"}`
              }
            </p>
          </div>
        )}
        {hasPendingDate && !hasConfirmedDate && (
          <div style={{ marginTop: 8, borderRadius: 12, padding: "8px 16px", display: "flex", alignItems: "center", gap: 8, background: C.primarySoft }}>
            <span style={{ fontSize: 14 }}>📅</span>
            <p style={{ fontSize: 12, fontWeight: 600, color: C.primary, margin: 0 }}>Date invite sent — timer paused</p>
          </div>
        )}
        {(deadlinePaused || hasVideoCall) && !hasConfirmedDate && !hasPendingDate && (
          <div style={{ marginTop: 8, borderRadius: 12, padding: "8px 16px", display: "flex", alignItems: "center", gap: 8, background: "#F0FDF4" }}>
            <span style={{ fontSize: 14 }}>{hasVideoCall ? "📹" : "💛"}</span>
            <p style={{ fontSize: 12, fontWeight: 600, color: "#16A34A", margin: 0 }}>
              {hasVideoCall ? "Video call done — take your time, no deadline" : "No time pressure — chat at your own pace"}
            </p>
          </div>
        )}
        {chatLocked && (
          <div style={{ marginTop: 8, borderRadius: 12, padding: "8px 16px", display: "flex", alignItems: "center", gap: 8, background: "#FEF2F2" }}>
            <span style={{ fontSize: 14 }}>🔒</span>
            <p style={{ fontSize: 12, fontWeight: 600, color: "#EF4444", margin: 0 }}>Chat closed — no date was set in time</p>
          </div>
        )}
        {hasConfirmedDate && (
          <div style={{ marginTop: 8, borderRadius: 12, padding: "8px 16px", display: "flex", alignItems: "center", gap: 8, background: "#F0FDF4" }}>
            <span style={{ fontSize: 14 }}>✅</span>
            <p style={{ fontSize: 12, fontWeight: 600, color: "#16A34A", margin: 0 }}>Date confirmed! Have a wonderful time</p>
          </div>
        )}
      </div>

      {/* Messages + Date Cards */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 24px", display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ flex: 1, height: 1, background: C.border }} />
          <span style={{ fontSize: 11, fontWeight: 600, color: C.sub }}>Today</span>
          <div style={{ flex: 1, height: 1, background: C.border }} />
        </div>

        {timeline.map((item) => {
          if (item._type === "date") {
            return (
              <DateCard
                key={`date-${item.id}`}
                invitation={item}
                isMe={item.from_user === currentUserId}
                isMale={isMale}
                onRespond={handleRespondDate}
                onConfirm={handleConfirmDate}
                onDecline={handleDeclineDate}
              />
            );
          }

          const isMe = item.sender === currentUserId;
          return (
            <div key={item.id} style={{ display: "flex", flexDirection: "column", alignItems: isMe ? "flex-end" : "flex-start" }}>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 8, maxWidth: "80%" }}>
                {!isMe && (
                  <img src={profile.photos[0]} alt={profile.name} style={{ width: 24, height: 24, borderRadius: "50%", objectFit: "cover", flexShrink: 0, marginBottom: 4 }} onError={(e) => { e.target.src = `https://ui-avatars.com/api/?name=${profile.name}&size=24&background=random`; }} />
                )}
                <div
                  style={{
                    padding: "12px 16px",
                    borderRadius: 16,
                    background: isMe ? C.sent : C.card,
                    color: isMe ? "white" : C.text,
                    borderBottomRightRadius: isMe ? 6 : 16,
                    borderBottomLeftRadius: !isMe ? 6 : 16,
                    boxShadow: !isMe ? "0 1px 4px rgba(0,0,0,0.06)" : undefined,
                    cursor: "pointer",
                  }}
                  onDoubleClick={() => setReacting(reacting === item.id ? null : item.id)}
                >
                  <p style={{ fontSize: 14, lineHeight: 1.5, fontFamily: FONT, margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{item.text}</p>
                </div>
              </div>
              <p style={{ fontSize: 10, marginTop: 6, marginLeft: 32, marginRight: 32, color: C.sub }}>{formatTime(item.timestamp)}</p>

              {reacting === item.id && (
                <div style={{ display: "flex", gap: 6, marginTop: 4, marginLeft: 32, marginRight: 32, borderRadius: 16, padding: "8px 12px", background: C.card, boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}>
                  {REACTIONS.map((r) => (
                    <button key={r} onClick={() => setReacting(null)} style={{ fontSize: 18, background: "none", border: "none", cursor: "pointer", transition: "all 0.2s" }}>{r}</button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Compose */}
      <div style={{ flexShrink: 0, padding: "12px 16px", background: C.card, borderTop: `1px solid ${C.border}` }}>
        {chatLocked ? (
          <div style={{ textAlign: "center", padding: "12px 0" }}>
            <p style={{ fontSize: 13, color: C.sub, fontFamily: FONT }}>🔒 This chat has expired</p>
          </div>
        ) : (
          <>
            {/* Date invite button — men only, above input */}
            {isMale && !hasConfirmedDate && (
              <button
                onClick={() => setShowDateBuilder(true)}
                style={{
                  width: "100%",
                  padding: "14px 0",
                  marginBottom: 10,
                  borderRadius: 14,
                  fontSize: 15,
                  fontWeight: 700,
                  fontFamily: FONT,
                  background: C.primary,
                  color: "white",
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                <span style={{ fontSize: 18 }}>📅</span>
                Plan a Date
              </button>
            )}
            {/* Rose button — women only, available from start */}
            {!isMale && !hasConfirmedDate && !hasPendingDate && !nudgeSent && (
              <button
                onClick={handleNudge}
                disabled={nudgeSending}
                style={{
                  width: "100%",
                  padding: "12px 0",
                  marginBottom: 10,
                  borderRadius: 14,
                  fontSize: 14,
                  fontWeight: 700,
                  fontFamily: FONT,
                  background: C.primarySoft,
                  color: C.primary,
                  border: `1.5px solid ${C.primary}`,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                <span style={{ fontSize: 16 }}>🌹</span>
                {nudgeSending ? "Sending..." : "Send him a rose"}
              </button>
            )}
            {!isMale && nudgeSent && !hasConfirmedDate && !hasPendingDate && (
              <div style={{ textAlign: "center", padding: "8px 0", marginBottom: 8 }}>
                <p style={{ fontSize: 12, color: C.primary, fontWeight: 600, fontFamily: FONT, margin: 0 }}>
                  🌹 Rose sent — he has extra time to plan a date
                </p>
              </div>
            )}
            {/* Rose explainer — man's side, first time seeing a rose or occasionally */}
            {isMale && (nudgeSent || match.nudgeAt) && !showNudgeExplainer && (messages.length <= 5 || messages.length % 20 === 0) && (
              <div
                onClick={() => setShowNudgeExplainer(true)}
                style={{
                  padding: "10px 14px",
                  marginBottom: 10,
                  borderRadius: 14,
                  background: C.primarySoft,
                  border: `1.5px solid ${C.primary}`,
                  cursor: "pointer",
                  textAlign: "center",
                }}
              >
                <p style={{ fontSize: 13, fontWeight: 700, color: C.primary, fontFamily: FONT, margin: 0 }}>
                  🌹 She sent you a rose! Tap to learn more
                </p>
              </div>
            )}
            {showNudgeExplainer && (
              <div style={{ padding: "14px 16px", marginBottom: 10, borderRadius: 14, background: C.primarySoft, border: `1.5px solid ${C.primary}` }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: C.primary, fontFamily: FONT, margin: "0 0 6px 0" }}>🌹 What does the rose mean?</p>
                <p style={{ fontSize: 12, color: C.text, fontFamily: FONT, lineHeight: 1.5, margin: "0 0 8px 0" }}>
                  She's letting you know she'd love to go on a date with you! You got an extra 36 hours to plan something special.
                </p>
                <button onClick={() => setShowNudgeExplainer(false)} style={{ fontSize: 12, fontWeight: 600, color: C.primary, background: "none", border: "none", cursor: "pointer", padding: 0 }}>Got it</button>
              </div>
            )}
            {/* Schedule Video Call button — shows after first message or rose */}
            {!videoCallStarted && !hasVideoCall && (firstMessageTime || nudgeSent || match.nudgeAt) && (
              <>
                {!showVideoCallScheduler ? (
                  <button
                    onClick={() => setShowVideoCallScheduler(true)}
                    style={{
                      width: "100%",
                      padding: "12px 0",
                      marginBottom: 10,
                      borderRadius: 14,
                      fontSize: 14,
                      fontWeight: 700,
                      fontFamily: FONT,
                      background: "#F0FDF4",
                      color: "#16A34A",
                      border: "1.5px solid #22C55E",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                    }}
                  >
                    <span style={{ fontSize: 16 }}>📹</span>
                    Schedule Video Call
                    <span style={{ fontSize: 11, fontWeight: 500, opacity: 0.8 }}>(stops the timer)</span>
                  </button>
                ) : (
                  <div style={{ padding: "14px 16px", marginBottom: 10, borderRadius: 14, background: "#F0FDF4", border: "1.5px solid #22C55E" }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: "#16A34A", fontFamily: FONT, margin: "0 0 10px 0" }}>📹 Schedule a video call</p>
                    <p style={{ fontSize: 12, color: C.sub, fontFamily: FONT, margin: "0 0 12px 0" }}>Pick a day and time — the deadline timer stops.</p>
                    <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 8, marginBottom: 8 }}>
                      {vcDays.map((d) => (
                        <button
                          key={d.date}
                          onClick={() => setVcDay(vcDay?.date === d.date ? null : d)}
                          style={{
                            flexShrink: 0, padding: "10px 14px", borderRadius: 14, cursor: "pointer", textAlign: "center", minWidth: 60,
                            border: vcDay?.date === d.date ? "2px solid #22C55E" : `1.5px solid ${C.border}`,
                            background: vcDay?.date === d.date ? "#DCFCE7" : "white",
                          }}
                        >
                          <span style={{ fontSize: 11, color: C.sub, display: "block", fontWeight: 600 }}>{d.dayName}</span>
                          <span style={{ fontSize: 18, fontWeight: 700, color: C.text, display: "block" }}>{d.dayNum}</span>
                          <span style={{ fontSize: 10, color: C.sub }}>{d.month}</span>
                        </button>
                      ))}
                    </div>
                    {vcDay && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12, alignItems: "center" }}>
                        {TIME_SLOTS.map((t) => (
                          <button
                            key={t}
                            onClick={() => setVcTime(vcTime === t ? null : t)}
                            style={{
                              padding: "8px 16px", borderRadius: 10, cursor: "pointer",
                              fontSize: 14, fontWeight: 600, color: vcTime === t ? "white" : C.text, fontFamily: FONT,
                              border: vcTime === t ? "2px solid #22C55E" : `1.5px solid ${C.border}`,
                              background: vcTime === t ? "#22C55E" : "white",
                            }}
                          >
                            {t}
                          </button>
                        ))}
                        <input
                          type="time"
                          onChange={(e) => { if (e.target.value) setVcTime(e.target.value); }}
                          style={{
                            padding: "8px 12px", borderRadius: 10, fontSize: 14, fontWeight: 600, fontFamily: FONT,
                            color: vcTime && !TIME_SLOTS.includes(vcTime) ? "white" : C.text,
                            border: vcTime && !TIME_SLOTS.includes(vcTime) ? "2px solid #22C55E" : `1.5px solid ${C.border}`,
                            background: vcTime && !TIME_SLOTS.includes(vcTime) ? "#22C55E" : "white",
                            outline: "none", width: 90,
                          }}
                        />
                      </div>
                    )}
                    {vcDay && vcTime && (
                      <div style={{ padding: "8px 12px", borderRadius: 10, background: "#DCFCE7", marginBottom: 12, textAlign: "center" }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: "#16A34A", fontFamily: FONT }}>
                          📹 {vcDay.dayName} {vcDay.dayNum} {vcDay.month} · {vcTime}
                        </span>
                      </div>
                    )}
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => { setShowVideoCallScheduler(false); setVcDay(null); setVcTime(null); }} style={{ flex: 1, padding: "10px 0", borderRadius: 12, fontSize: 13, fontWeight: 600, background: C.surface, color: C.sub, border: "none", cursor: "pointer" }}>Cancel</button>
                      <button onClick={handleVideoCall} disabled={!vcDay || !vcTime} style={{ flex: 1, padding: "10px 0", borderRadius: 12, fontSize: 13, fontWeight: 700, background: vcDay && vcTime ? "#22C55E" : C.border, color: "white", border: "none", cursor: vcDay && vcTime ? "pointer" : "default" }}>Schedule</button>
                    </div>
                  </div>
                )}
              </>
            )}
            {(videoCallStarted || hasVideoCall) && (
              <div style={{ marginBottom: 10 }}>
                <div style={{ textAlign: "center", padding: "8px 0", marginBottom: 6 }}>
                  <p style={{ fontSize: 12, color: "#16A34A", fontWeight: 600, fontFamily: FONT, margin: 0 }}>
                    📹 Video call scheduled — no deadline, take your time
                  </p>
                </div>
                <button
                  onClick={() => window.open(`https://meet.ffmuc.net/agape-${match.id.slice(0, 8)}`, "_blank")}
                  style={{
                    width: "100%", padding: "12px 0", borderRadius: 14, fontSize: 14, fontWeight: 700, fontFamily: FONT,
                    background: "#22C55E", color: "white", border: "none", cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  }}
                >
                  <span style={{ fontSize: 16 }}>📹</span>
                  Join Video Call
                </button>
              </div>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 12, borderRadius: 16, padding: "12px 16px", background: C.surface }}>
              <input
                style={{ flex: 1, fontSize: 14, background: "transparent", outline: "none", border: "none", color: C.text, fontFamily: FONT }}
                placeholder={`Message ${profile.name}...`}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
              />
              <button
                onClick={send}
                style={{ width: 32, height: 32, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: text.trim() ? C.primary : C.border, border: "none", cursor: "pointer" }}
              >
                <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5} strokeLinecap="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" /></svg>
              </button>
            </div>
          </>
        )}
      </div>

      {/* Date Builder Sheet */}
      {showDateBuilder && (
        <DateBuilder
          profileName={profile.name}
          userLocation={state.currentUser?.location ? { lat: state.currentUser.location.lat, lng: state.currentUser.location.lng } : null}
          onSend={handleSendDate}
          onClose={() => setShowDateBuilder(false)}
        />
      )}

      {/* Report / Block menu */}
      {showReportMenu && (
        <div onClick={() => { if (!reportDone) setShowReportMenu(false); }} style={{ position: "fixed", inset: 0, maxWidth: 430, margin: "0 auto", zIndex: 400, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
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
                <button onClick={() => { setShowReportMenu(false); setReportDone(null); if (reportDone === "block" || reportDone === "unmatch") onBack(); }} style={{ padding: "12px 32px", borderRadius: 9999, fontSize: 14, fontWeight: 700, background: C.text, color: "white", border: "none", cursor: "pointer" }}>Done</button>
              </div>
            ) : (
              <>
                <div style={{ width: 36, height: 4, borderRadius: 2, background: C.border, margin: "0 auto 16px" }} />
                <p style={{ fontSize: 16, fontWeight: 700, color: C.text, fontFamily: FONT, textAlign: "center", marginBottom: 16 }}>{profile.name}</p>
                {[
                  { icon: "🚩", label: "Report", desc: "Flag inappropriate behaviour", color: "#EF4444", action: async () => { dispatch({ type: "ADD_REPORT", payload: { profileId: profile.id, name: profile.name, photo: profile.photos?.[0], reason: "Inappropriate behaviour", timestamp: Date.now() } }); setReportDone("report"); } },
                  { icon: "🚫", label: "Block", desc: "They won't be able to see you", color: "#EF4444", action: async () => { dispatch({ type: "BLOCK_PROFILE", payload: { id: profile.id, name: profile.name, photo: profile.photos?.[0] } }); setShowReportMenu(false); setBlockFlash(true); try { await actions.unmatch(match.id); } catch (_) {} setTimeout(() => { setBlockFlash(false); setShowReportMenu(true); setReportDone("block"); }, 1500); } },
                  { icon: "👋", label: "Unmatch", desc: "Remove this match", color: C.text, action: async () => { try { await actions.unmatch(match.id); } catch (_) {} setReportDone("unmatch"); } },
                ].map((item) => (
                  <button key={item.label} onClick={item.action} style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "14px 12px", borderRadius: 12, background: "none", border: "none", cursor: "pointer", textAlign: "left", marginBottom: 4 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", background: C.surface, fontSize: 18 }}>{item.icon}</div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 14, fontWeight: 600, color: item.color, margin: 0 }}>{item.label}</p>
                      <p style={{ fontSize: 12, color: C.sub, marginTop: 2 }}>{item.desc}</p>
                    </div>
                    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={C.sub} strokeWidth={2}><polyline points="9 18 15 12 9 6" /></svg>
                  </button>
                ))}
                <button onClick={() => setShowReportMenu(false)} style={{ width: "100%", padding: "14px 0", borderRadius: 12, fontSize: 14, fontWeight: 600, background: C.surface, color: C.sub, border: "none", cursor: "pointer", marginTop: 8 }}>Cancel</button>
              </>
            )}
          </div>
        </div>
      )}

      {viewProfile && (
        <div style={{ position: "fixed", inset: 0, maxWidth: 430, margin: "0 auto", zIndex: 300, background: C.bg, overflowY: "auto" }}>
          <div style={{ position: "relative" }}>
            <img src={profile.photos?.[0]} alt={profile.name} style={{ width: "100%", maxHeight: "56vh", objectFit: "cover", display: "block" }} onError={(e) => { e.target.src = `https://ui-avatars.com/api/?name=${profile.name}&size=600&background=random`; }} />
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 50%)", pointerEvents: "none" }} />
            <button onClick={() => setViewProfile(false)} style={{ position: "absolute", top: 44, left: 16, width: 36, height: 36, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.4)", backdropFilter: "blur(10px)", border: "none", cursor: "pointer" }}>
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5}><polyline points="15 18 9 12 15 6" /></svg>
            </button>
            <div style={{ position: "absolute", bottom: 20, left: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ color: "white", fontSize: 28, fontWeight: 700 }}>{profile.name}</span>
                <span style={{ color: "rgba(255,255,255,0.8)", fontSize: 22, fontWeight: 300 }}>{profile.age}</span>
              </div>
              <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, marginTop: 4 }}>{profile.denomination}{profile.location ? ` · ${profile.location}` : ""}</p>
            </div>
          </div>
          <div style={{ padding: "20px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
            {(profile.prompts || []).filter((p) => p.prompt && p.answer).map((p, i) => (
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

  const activeMatch = activeChat ? state.matches.find((m) => m.id === activeChat) : null;

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
        <h1 style={{ color: C.text, fontFamily: FONT, fontSize: 24, fontWeight: 700, letterSpacing: "-0.4px", margin: 0 }}>Messages</h1>
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
            const lastMsg = convo?.messages?.[convo.messages.length - 1] || m.lastMessage;
            const hasUnread = lastMsg && lastMsg.sender !== currentUserId;

            return (
              <button
                key={m.id}
                onClick={() => setActiveChat(m.id)}
                style={{ display: "flex", alignItems: "center", gap: 16, width: "100%", padding: "20px 20px", background: hasUnread ? C.primarySoft : "none", border: "none", cursor: "pointer", borderBottom: `1px solid ${C.border}`, textAlign: "left" }}
              >
                <div style={{ position: "relative", flexShrink: 0 }}>
                  <img src={profile.photos[0]} alt={profile.name} style={{ width: 88, height: 88, borderRadius: "50%", objectFit: "cover", display: "block" }} onError={(e) => { e.target.src = `https://ui-avatars.com/api/?name=${profile.name}&size=88&background=random`; }} />
                  {hasUnread && <div style={{ position: "absolute", inset: -3, borderRadius: "50%", border: `3px solid ${C.primary}`, pointerEvents: "none" }} />}
                  <div style={{ position: "absolute", bottom: 4, right: 4, width: 14, height: 14, borderRadius: "50%", background: "#22C55E", border: `2.5px solid ${hasUnread ? C.primarySoft : C.bg}` }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <span style={{ fontWeight: hasUnread ? 800 : 700, fontSize: 18, color: C.text, fontFamily: FONT }}>{profile.name}</span>
                    <span style={{ fontSize: 11, color: hasUnread ? C.primary : C.sub, fontWeight: hasUnread ? 700 : 400, fontFamily: FONT, flexShrink: 0 }}>{lastMsg ? formatTime(lastMsg.timestamp) : ""}</span>
                  </div>
                  {profile.denomination && <p style={{ fontSize: 12, color: C.primary, fontWeight: 600, fontFamily: FONT, margin: "0 0 6px 0" }}>{profile.denomination}</p>}
                  <p style={{ fontSize: 14, color: hasUnread ? C.text : C.sub, fontWeight: hasUnread ? 700 : 400, fontFamily: FONT, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis", margin: 0 }}>
                    {lastMsg ? (lastMsg.sender === currentUserId ? "You: " : "") + lastMsg.text.slice(0, 35) + (lastMsg.text.length > 35 ? "..." : "") : "New match"}
                  </p>
                </div>
                {hasUnread && <div style={{ width: 12, height: 12, borderRadius: "50%", background: C.primary, flexShrink: 0 }} />}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
