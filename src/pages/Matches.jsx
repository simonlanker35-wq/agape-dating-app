import { useState, useRef, useEffect, useMemo } from "react";
import { useApp } from "../context/AppContext";
import * as api from "../services/api";
import { MessageCircle, Ban, Flag, UserMinus, Calendar, CheckCircle } from "lucide-react";
import AgapeCross from "../components/AgapeCross";
import LocationPicker from "../components/LocationPicker";
import ReliabilityBadge from "../components/ReliabilityBadge";
import NotificationPrompt from "../components/NotificationPrompt";
import { track } from "../services/posthog";
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

const DAY_SLOTS = [
  { id: "morning", label: "Morning", hint: "9 – 12", time: "10:00" },
  { id: "lunch", label: "Lunch", hint: "12 – 14", time: "12:30" },
  { id: "afternoon", label: "Afternoon", hint: "14 – 17", time: "15:00" },
  { id: "evening", label: "Evening", hint: "17 – 22", time: "19:00" },
];
const MAX_SLOTS = 12;

const slotName = (t) => DAY_SLOTS.find((s) => s.id === t.slot)?.label || t.time;
const slotHint = (t) => DAY_SLOTS.find((s) => s.id === t.slot)?.hint || "";

function groupByDay(times) {
  const map = new Map();
  for (const t of times || []) {
    if (!map.has(t.date)) map.set(t.date, { date: t.date, label: t.label, times: [] });
    map.get(t.date).times.push(t);
  }
  const order = (t) => { const i = DAY_SLOTS.findIndex((s) => s.id === t.slot); return i === -1 ? 99 : i; };
  return [...map.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((d) => ({ ...d, times: [...d.times].sort((a, b) => order(a) - order(b) || String(a.time).localeCompare(String(b.time))) }));
}

const timeKey = (t) => `${t.date}|${t.slot || t.time}`;
const longDay = (date) => new Date(date + "T12:00:00").toLocaleDateString("en", { weekday: "long", day: "numeric", month: "short" });
const GREEN = "#22C55E";

function Avatar({ src, name, size = 34 }) {
  return (
    <img
      src={src}
      alt={name || ""}
      style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", border: `2px solid ${C.bg}`, boxShadow: "0 0 0 1.5px " + C.border, display: "block" }}
      onError={(e) => { e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(name || "?")}&size=80&background=F4F2EE&color=B8912A`; }}
    />
  );
}

const buildAllRows = () =>
  getNextDays(14).flatMap((d) => DAY_SLOTS.map((s) => ({ date: d.date, label: `${d.dayName} ${d.dayNum} ${d.month}`, slot: s.id, time: s.time, isWeekend: d.isWeekend })));

function AvailCell({ on, onClick }) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      style={{
        width: 40, height: 40, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", padding: 0,
        cursor: onClick ? "pointer" : "default",
        background: on ? GREEN : "white", border: on ? `2px solid ${GREEN}` : `2px solid ${C.border}`,
      }}
    >
      {on && <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>}
    </button>
  );
}

// Breeze-style availability table: times grouped by day, a column per person. `theirs` is optional — omit it for a single-column view.
function AvailabilityTable({ rows, mine, theirs, onToggle, meAvatar, themAvatar, themName, highlightKey }) {
  const two = !!theirs;
  const cols = two ? "1fr 56px 56px" : "1fr 56px";
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: cols, alignItems: "center", padding: "0 0 10px", borderBottom: `1px solid ${C.border}` }}>
        <div />
        {two && <div style={{ display: "flex", justifyContent: "center" }}><Avatar src={themAvatar} name={themName} /></div>}
        <div style={{ display: "flex", justifyContent: "center" }}><Avatar src={meAvatar} name="Me" /></div>
      </div>
      {groupByDay(rows).map((day) => (
        <div key={day.date}>
          <p style={{ fontSize: 15, fontWeight: 800, color: C.text, fontFamily: FONT, padding: "16px 0 6px", margin: 0 }}>{longDay(day.date)}</p>
          {day.times.map((t) => {
            const k = timeKey(t);
            const hi = highlightKey === k;
            return (
              <div key={k} style={{ display: "grid", gridTemplateColumns: cols, alignItems: "center", padding: "6px 0", borderBottom: `1px solid ${C.border}`, background: hi ? C.primarySoft : "transparent", borderRadius: hi ? 10 : 0 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8, paddingLeft: hi ? 8 : 0 }}>
                  <span style={{ fontSize: 17, fontWeight: 700, color: C.text, fontFamily: FONT }}>{t.time}</span>
                  {t.slot && <span style={{ fontSize: 12, color: C.sub, fontFamily: FONT }}>{slotName(t)}</span>}
                </div>
                {two && <div style={{ display: "flex", justifyContent: "center" }}><AvailCell on={theirs.has(k)} /></div>}
                <div style={{ display: "flex", justifyContent: "center" }}><AvailCell on={mine.has(k)} onClick={onToggle ? () => onToggle(t) : undefined} /></div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function AvailabilitySheet({ title, subtitle, onClose, children, footer }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, maxWidth: 430, margin: "0 auto", zIndex: 600, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "flex-end" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", borderRadius: "24px 24px 0 0", background: C.bg, maxHeight: "88vh", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "14px 16px 0", flexShrink: 0 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: C.border, margin: "0 auto 14px" }} />
          <p style={{ fontSize: 12, fontWeight: 700, color: C.sub, textTransform: "uppercase", letterSpacing: "0.1em", fontFamily: FONT, margin: "0 0 4px", textAlign: "center" }}>Date picker</p>
          <p style={{ fontSize: 18, fontWeight: 700, color: C.text, fontFamily: FONT, margin: "0 0 4px" }}>{title}</p>
          {subtitle && <p style={{ fontSize: 13, color: C.sub, fontFamily: FONT, margin: "0 0 10px" }}>{subtitle}</p>}
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "4px 16px 12px", WebkitOverflowScrolling: "touch" }}>
          {children}
        </div>
        {footer && <div style={{ flexShrink: 0, padding: "12px 16px max(24px, env(safe-area-inset-bottom, 24px))", borderTop: `1px solid ${C.border}`, background: C.bg }}>{footer}</div>}
      </div>
    </div>
  );
}

function getNextDays(count = 14) {
  const days = [];
  const now = new Date();
  for (let i = 1; i <= count; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    const weekday = d.getDay();
    days.push({
      date: d.toISOString().split("T")[0],
      dayName: d.toLocaleDateString("en", { weekday: "short" }),
      dayNum: d.getDate(),
      month: d.toLocaleDateString("en", { month: "short" }),
      isWeekend: weekday === 0 || weekday === 6,
    });
  }
  return days;
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
  const canProceed =
    (step === 1 && dateType) ||
    (step === 2 && location.trim()) ||
    (step === 3 && wardrobe);

  const handleNext = () => {
    if (step < 3) {
      track("date_builder_step", { step, dateType, location, wardrobe });
      setStep(step + 1);
    } else {
      track("date_invitation_sent", { dateType, wardrobe });
      onSend({ dateType, location: location.trim(), wardrobe, proposedTimes: [] });
    }
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, maxWidth: 430, margin: "0 auto", zIndex: 500, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "flex-end" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", borderRadius: "24px 24px 0 0", background: C.bg, padding: "20px 16px 32px", maxHeight: "80vh", overflowY: "auto" }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: C.border, margin: "0 auto 16px" }} />

        <div style={{ display: "flex", gap: 4, marginBottom: 20 }}>
          {[1, 2, 3].map((s) => (
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
                  onClick={() => { track("date_type_selected", { type: dt.id }); setDateType(dt.id); }}
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
                  onClick={() => { track("date_wardrobe_selected", { wardrobe: w.id }); setWardrobe(w.id); }}
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

        <div style={{ display: "flex", gap: 8, marginTop: 24, position: "sticky", bottom: -32, background: C.bg, padding: "10px 0 32px", marginBottom: -32 }}>
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
            {step === 3 ? `Send to ${profileName}` : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}

const DECLINE_REASONS = [
  "Times don't work for me",
  "Not comfortable with the location",
  "Not the right time for me yet",
  "I'd prefer a different kind of date",
  "Not interested anymore",
];

function DateCard({ invitation, isMe, isMale, onRespond, onConfirm, onDecline, onCancel, meAvatar, themAvatar, themName }) {
  const [selectedTimes, setSelectedTimes] = useState([]);
  const [sending, setSending] = useState(false);
  const [showDecline, setShowDecline] = useState(false);
  const [declineReasons, setDeclineReasons] = useState([]);
  const [confirming, setConfirming] = useState(null);
  const [showPicker, setShowPicker] = useState(false);
  const responded = invitation.response_times || [];
  const allRows = useMemo(buildAllRows, []);
  const quickPick = (pick) => {
    const merged = [...selectedTimes];
    for (const r of allRows) {
      if (merged.length >= MAX_SLOTS) break;
      if (pick(r) && !merged.some((s) => timeKey(s) === timeKey(r))) merged.push(r);
    }
    setSelectedTimes(merged);
  };
  const pickerTitle = `When can you go for ${(DATE_TYPES.find((d) => d.id === invitation.date_type)?.label || "a date").toLowerCase()} with ${themName}?`;
  const primaryBtn = { width: "100%", padding: "14px 0", borderRadius: 14, fontSize: 15, fontWeight: 700, fontFamily: FONT, background: C.primary, color: "white", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 };
  const secondaryBtn = { ...primaryBtn, background: C.surface, color: C.text, fontSize: 14 };
  const dt = DATE_TYPES.find((d) => d.id === invitation.date_type);
  const wb = WARDROBE_OPTIONS.find((w) => w.id === invitation.wardrobe);

  const toggleTime = (t) => {
    setSelectedTimes((prev) => {
      const has = prev.some((s) => timeKey(s) === timeKey(t));
      if (has) return prev.filter((s) => timeKey(s) !== timeKey(t));
      return prev.length >= MAX_SLOTS ? prev : [...prev, t];
    });
  };

  const handleRespond = async () => {
    if (selectedTimes.length === 0) return;
    track("date_responded", { timesSelected: selectedTimes.length });
    setSending(true);
    await onRespond(invitation.id, selectedTimes);
    setSending(false);
    setShowPicker(false);
  };

  const handleConfirm = async () => {
    if (!confirming) return;
    track("date_confirmed");
    setSending(true);
    await onConfirm(invitation.id, confirming);
    setSending(false);
    setShowPicker(false);
  };

  const toggleDeclineReason = (r) => {
    setDeclineReasons((prev) =>
      prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]
    );
  };

  const handleDecline = async () => {
    if (declineReasons.length === 0) return;
    track("date_declined", { reasons: declineReasons });
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
            <p style={{ fontSize: 13, color: C.sub, fontFamily: FONT, margin: "0 0 10px", textAlign: "center" }}>
              Tell {themName} when you're free — he'll pick one of your times.
            </p>
            <button onClick={() => { track("date_picker_opened"); setShowPicker(true); }} style={primaryBtn}>
              <Calendar size={16} color="white" />
              {selectedTimes.length ? `When I'm free (${selectedTimes.length} chosen)` : "When I'm free"}
            </button>
            {showPicker && (
              <AvailabilitySheet
                title={pickerTitle}
                subtitle={`Tick the times you're free (up to ${MAX_SLOTS}). ${themName} picks one of them.`}
                onClose={() => setShowPicker(false)}
                footer={
                  <button
                    onClick={handleRespond}
                    disabled={selectedTimes.length === 0 || sending}
                    style={{ ...primaryBtn, background: selectedTimes.length > 0 ? C.primary : C.border, cursor: selectedTimes.length > 0 ? "pointer" : "default" }}
                  >
                    {sending ? "Sending..." : selectedTimes.length > 0 ? `Send ${selectedTimes.length} time${selectedTimes.length === 1 ? "" : "s"}` : "Select at least one time"}
                  </button>
                }
              >
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
                  <button onClick={() => quickPick((r) => r.slot === "evening")} style={{ padding: "7px 12px", borderRadius: 9999, fontSize: 12, fontWeight: 600, fontFamily: FONT, background: C.surface, color: C.text, border: `1px solid ${C.border}`, cursor: "pointer" }}>+ All evenings</button>
                  <button onClick={() => quickPick((r) => r.isWeekend)} style={{ padding: "7px 12px", borderRadius: 9999, fontSize: 12, fontWeight: 600, fontFamily: FONT, background: C.surface, color: C.text, border: `1px solid ${C.border}`, cursor: "pointer" }}>+ Weekends</button>
                  {selectedTimes.length > 0 && (
                    <button onClick={() => setSelectedTimes([])} style={{ padding: "7px 12px", borderRadius: 9999, fontSize: 12, fontWeight: 600, fontFamily: FONT, background: "none", color: C.sub, border: `1px solid ${C.border}`, cursor: "pointer" }}>Clear all</button>
                  )}
                </div>
                <AvailabilityTable
                  rows={allRows}
                  mine={new Set(selectedTimes.map(timeKey))}
                  onToggle={toggleTime}
                  meAvatar={meAvatar}
                />
              </AvailabilitySheet>
            )}

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
            <p style={{ fontSize: 13, color: C.sub, textAlign: "center", fontFamily: FONT, margin: 0 }}>
              Sent to {themName} — waiting for her to say when she's free.
            </p>
            <button
              onClick={async () => { track("date_cancelled"); setSending(true); await onCancel(invitation.id); setSending(false); }}
              disabled={sending}
              style={{ width: "100%", marginTop: 10, padding: "10px 0", borderRadius: 14, fontSize: 13, fontWeight: 600, background: "none", color: C.sub, border: "none", cursor: "pointer", fontFamily: FONT }}
            >
              {sending ? "..." : "Cancel this plan"}
            </button>
          </>
        )}

        {invitation.status === "responded" && isMale && (
          <>
            <p style={{ fontSize: 13, color: C.sub, textAlign: "center", fontFamily: FONT, margin: "0 0 10px" }}>
              {themName} is free at {responded.length} time{responded.length === 1 ? "" : "s"}. Pick the one that suits you.
            </p>
            <button onClick={() => { track("date_confirm_picker_opened"); setShowPicker(true); }} style={primaryBtn}>
              <Calendar size={16} color="white" /> Pick a time
            </button>
            {showPicker && (
              <AvailabilitySheet
                title={pickerTitle}
                subtitle={`These are the times ${themName} is free. Tap one to confirm it.`}
                onClose={() => setShowPicker(false)}
                footer={
                  confirming ? (
                    <button onClick={handleConfirm} disabled={sending} style={{ ...primaryBtn, background: GREEN }}>
                      {sending ? "..." : `Confirm ${longDay(confirming.date)} · ${confirming.time}`}
                    </button>
                  ) : (
                    <p style={{ fontSize: 13, color: C.sub, textAlign: "center", fontFamily: FONT, margin: 0 }}>Tap a time in your column to choose it</p>
                  )
                }
              >
                <AvailabilityTable
                  rows={responded}
                  mine={new Set(confirming ? [timeKey(confirming)] : [])}
                  theirs={new Set(responded.map(timeKey))}
                  onToggle={(t) => {
                    const same = confirming && timeKey(confirming) === timeKey(t);
                    setConfirming(same ? null : t);
                  }}
                  highlightKey={confirming ? timeKey(confirming) : null}
                  meAvatar={meAvatar}
                  themAvatar={themAvatar}
                  themName={themName}
                />
              </AvailabilitySheet>
            )}
          </>
        )}

        {invitation.status === "responded" && !isMale && (
          <>
            <p style={{ fontSize: 13, color: C.sub, textAlign: "center", fontFamily: FONT, margin: "0 0 10px" }}>
              You sent {responded.length} time{responded.length === 1 ? "" : "s"} — waiting for {themName} to pick one.
            </p>
            <button onClick={() => setShowPicker(true)} style={secondaryBtn}>View your times</button>
            {showPicker && (
              <AvailabilitySheet title={pickerTitle} subtitle={`Waiting for ${themName} to pick one`} onClose={() => setShowPicker(false)}>
                <AvailabilityTable rows={responded} mine={new Set(responded.map(timeKey))} meAvatar={meAvatar} />
              </AvailabilitySheet>
            )}
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

  // The chat only opens once a date is confirmed; before that the thread is the date-planning stage
  const confirmedDate = dateInvitations.find((inv) => inv.status === "confirmed") || null;
  const openInvite = [...dateInvitations].reverse().find((inv) => inv.status === "pending" || inv.status === "responded") || null;
  const lastInvite = [...dateInvitations].reverse().find((inv) => !api.isCancelledInvite(inv)) || null;
  const lastDeclined = !confirmedDate && !openInvite && lastInvite?.status === "declined" ? lastInvite : null;
  const chatOpen = !!confirmedDate;

  const dateTimeMs = confirmedDate?.confirmed_time?.date
    ? new Date(`${confirmedDate.confirmed_time.date}T${confirmedDate.confirmed_time.time || "12:00"}:00`).getTime()
    : null;
  const datePassed = dateTimeMs !== null && Date.now() > dateTimeMs;
  const [myRating, setMyRating] = useState(undefined);
  const [rating, setRating] = useState(false);

  useEffect(() => {
    if (!confirmedDate?.id || !datePassed) return;
    api.getMyDateRating(confirmedDate.id).then(setMyRating).catch(() => setMyRating(null));
  }, [confirmedDate?.id, datePassed]);

  const handleRate = async (showedUp) => {
    setRating(true);
    try {
      await api.rateDate(confirmedDate.id, match.id, profile.id, showedUp);
      track("date_rated", { showedUp });
      setMyRating({ showed_up: showedUp });
    } catch (err) {
      console.error("Rating failed:", err);
    }
    setRating(false);
  };

  const send = async () => {
    if (!text.trim() || !chatOpen) return;
    const msg = text.trim();
    setText("");
    try {
      await actions.sendMessage(match.id, msg);
    } catch (err) {
      console.error("Send failed:", err);
    }
  };

  const myName = state.currentUser?.name || "Your match";
  const notifyThem = (title, body, tag) => api.notifyUser(profile.id, { title, body, url: "/?tab=matches", tag: `${tag}-${match.id}` });

  const handleSendDate = async (data) => {
    setShowDateBuilder(false);
    try {
      const inv = await api.createDateInvitation(match.id, data);
      setDateInvitations((prev) => [...prev, inv]);
      notifyThem(`${myName} planned a date`, "Open Agape and say when you're free.", "date");
    } catch (err) {
      console.error("Date invite failed:", err);
    }
  };

  const handleRespondDate = async (invId, selectedTimes) => {
    try {
      const updated = await api.respondToDate(invId, selectedTimes);
      setDateInvitations((prev) => prev.map((inv) => (inv.id === invId ? updated : inv)));
      notifyThem(`${myName} is free`, `Pick one of her ${selectedTimes.length} time${selectedTimes.length === 1 ? "" : "s"} to set the date.`, "date");
    } catch (err) {
      console.error("Respond failed:", err);
    }
  };

  const handleConfirmDate = async (invId, confirmedTime) => {
    try {
      const updated = await api.confirmDate(invId, confirmedTime);
      setDateInvitations((prev) => prev.map((inv) => (inv.id === invId ? updated : inv)));
      notifyThem("Date confirmed", `${myName} picked ${longDay(confirmedTime.date)} · ${confirmedTime.time}. The chat is open.`, "date");
    } catch (err) {
      console.error("Confirm failed:", err);
    }
  };

  const handleDeclineDate = async (invId, reasons) => {
    try {
      const updated = await api.declineDate(invId, reasons);
      setDateInvitations((prev) => prev.map((inv) => (inv.id === invId ? updated : inv)));
      notifyThem(`${myName} passed on the plan`, "Open Agape to propose something else.", "date");
    } catch (err) {
      console.error("Decline failed:", err);
    }
  };

  const handleCancelDate = async (invId) => {
    try {
      const updated = await api.cancelDate(invId);
      setDateInvitations((prev) => prev.map((inv) => (inv.id === invId ? updated : inv)));
    } catch (err) {
      console.error("Cancel failed:", err);
    }
  };

  const formatTime = (ts) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="thread-panel" style={{ background: C.bg }}>
      {blockFlash && (
        <div className="like-flash-overlay block">
          <span className="flash-emoji"><Ban size={120} strokeWidth={1.4} color="#EF4444" /></span>
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
          </div>
          <div style={{ flex: 1, minWidth: 0, cursor: "pointer" }} onClick={() => setViewProfile(true)}>
            <p style={{ fontWeight: 700, fontSize: 16, lineHeight: 1, color: C.text, fontFamily: FONT, margin: 0 }}>{profile.name}</p>
            {profile.reliability?.dates > 0 && <div style={{ marginTop: 5 }}><ReliabilityBadge reliability={profile.reliability} /></div>}
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

        {confirmedDate ? (
          <div style={{ marginTop: 8, borderRadius: 12, padding: "8px 16px", display: "flex", alignItems: "center", gap: 8, background: "#F0FDF4" }}>
            <CheckCircle size={14} color="#16A34A" />
            <p style={{ fontSize: 12, fontWeight: 600, color: "#16A34A", margin: 0 }}>
              Date confirmed{confirmedDate.confirmed_time ? ` · ${confirmedDate.confirmed_time.label} · ${confirmedDate.confirmed_time.time}` : ""}
            </p>
          </div>
        ) : openInvite ? (
          <div style={{ marginTop: 8, borderRadius: 12, padding: "8px 16px", display: "flex", alignItems: "center", gap: 8, background: C.surface }}>
            <Calendar size={14} color={C.primary} />
            <p style={{ fontSize: 12, fontWeight: 600, color: C.sub, margin: 0 }}>
              {openInvite.status === "pending"
                ? (isMale ? "Plan sent — waiting for her to say when she's free" : "He planned a date — tell him when you're free")
                : (isMale ? "She's free — pick one of her times" : "Times sent — waiting for him to pick one")}
            </p>
          </div>
        ) : (
          <div style={{ marginTop: 8, borderRadius: 12, padding: "8px 16px", display: "flex", alignItems: "center", gap: 8, background: C.surface }}>
            <Calendar size={14} color={C.primary} />
            <p style={{ fontSize: 12, fontWeight: 600, color: C.sub, margin: 0 }}>The chat opens once your date is set</p>
          </div>
        )}
      </div>

      {!chatOpen ? (
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", WebkitOverflowScrolling: "touch", padding: "20px 16px calc(110px + env(safe-area-inset-bottom, 0px))", display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ borderRadius: 20, padding: "18px 16px", background: C.primarySoft, border: `1.5px solid ${C.primary}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <Calendar size={18} color={C.primary} />
              <p style={{ fontSize: 15, fontWeight: 700, color: C.text, fontFamily: FONT, margin: 0 }}>
                {isMale ? "Plan your first date" : `${profile.name} is planning your date`}
              </p>
            </div>
            <p style={{ fontSize: 13, color: C.sub, fontFamily: FONT, lineHeight: 1.55, margin: 0 }}>
              {isMale
                ? "No small talk on Agape. You plan the date — what, where and the dress code. She tells you when she's free, you pick one of her times, and the chat opens."
                : "No small talk on Agape. He plans the date — what, where and the dress code. You say when you're free, he picks one of your times, and the chat opens."}
            </p>
          </div>

          {openInvite && (
            <DateCard
              invitation={openInvite}
              isMe={openInvite.from_user === currentUserId}
              isMale={isMale}
              onRespond={handleRespondDate}
              onConfirm={handleConfirmDate}
              onDecline={handleDeclineDate}
              onCancel={handleCancelDate}
              meAvatar={state.currentUser?.photos?.[0]}
              themAvatar={profile.photos?.[0]}
              themName={profile.name}
            />
          )}

          {lastDeclined && (
            <div style={{ borderRadius: 16, padding: "14px 16px", background: "#FEF2F2" }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#EF4444", fontFamily: FONT, margin: "0 0 4px 0" }}>
                {isMale ? "She passed on this plan" : "You passed on this plan"}
              </p>
              <p style={{ fontSize: 12, color: C.sub, fontFamily: FONT, margin: 0 }}>
                {isMale
                  ? (lastDeclined.decline_reasons?.length ? lastDeclined.decline_reasons.join(" · ") : "Try something different.")
                  : "He can propose something new."}
              </p>
            </div>
          )}

          {isMale && !openInvite && (
            <button
              onClick={() => { track("plan_date_tapped"); setShowDateBuilder(true); }}
              style={{ width: "100%", padding: "16px 0", borderRadius: 16, fontSize: 16, fontWeight: 700, fontFamily: FONT, background: C.primary, color: "white", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}
            >
              <Calendar size={18} color="white" />
              {lastDeclined ? "Plan another date" : "Plan a Date"}
            </button>
          )}
          {!isMale && !openInvite && (
            <p style={{ fontSize: 13, color: C.sub, textAlign: "center", fontFamily: FONT, margin: "4px 0 0" }}>
              His plan will show up right here.
            </p>
          )}
        </div>
      ) : (
      <>
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "16px 16px 24px", display: "flex", flexDirection: "column", gap: 12 }}>
        <DateCard
          invitation={confirmedDate}
          isMe={confirmedDate.from_user === currentUserId}
          isMale={isMale}
          onRespond={handleRespondDate}
          onConfirm={handleConfirmDate}
          onDecline={handleDeclineDate}
          meAvatar={state.currentUser?.photos?.[0]}
          themAvatar={profile.photos?.[0]}
          themName={profile.name}
        />

        {datePassed && myRating === null && (
          <div style={{ borderRadius: 20, padding: "16px", background: C.primarySoft, border: `1.5px solid ${C.primary}` }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: C.text, fontFamily: FONT, margin: "0 0 4px" }}>Did {profile.name} show up?</p>
            <p style={{ fontSize: 12, color: C.sub, fontFamily: FONT, margin: "0 0 12px", lineHeight: 1.5 }}>Your answer is shown on {profile.name}'s profile as a reliability score — it keeps Agape honest.</p>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => handleRate(true)} disabled={rating} style={{ flex: 1, padding: "12px 0", borderRadius: 12, fontSize: 14, fontWeight: 700, fontFamily: FONT, background: GREEN, color: "white", border: "none", cursor: "pointer" }}>Yes, we met</button>
              <button onClick={() => handleRate(false)} disabled={rating} style={{ flex: 1, padding: "12px 0", borderRadius: 12, fontSize: 14, fontWeight: 700, fontFamily: FONT, background: "#FEF2F2", color: "#EF4444", border: "1.5px solid #FCA5A5", cursor: "pointer" }}>No-show</button>
            </div>
          </div>
        )}
        {datePassed && myRating && (
          <p style={{ fontSize: 12, color: C.sub, textAlign: "center", fontFamily: FONT, margin: 0 }}>
            {myRating.showed_up ? `You confirmed you met ${profile.name}.` : `You reported ${profile.name} as a no-show.`}
          </p>
        )}

        {messages.map((item) => {
          const isMe = item.sender === currentUserId;
          const isDoveMsg = item.text?.startsWith("🕊️ ");
          const displayText = isDoveMsg ? item.text.slice(3) : item.text;
          return (
            <div key={item.id} style={{ display: "flex", flexDirection: "column", alignItems: isMe ? "flex-end" : "flex-start" }}>
              {isDoveMsg && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, marginLeft: isMe ? 0 : 32, marginRight: isMe ? 0 : 0, padding: "4px 10px", background: C.primarySoft, borderRadius: 10, alignSelf: isMe ? "flex-end" : "flex-start" }}>
                  <span style={{ fontSize: 12 }}>🕊️</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: C.primary, fontFamily: FONT }}>Sent with a Dove</span>
                </div>
              )}
              <div style={{ display: "flex", alignItems: "flex-end", gap: 8, maxWidth: "80%" }}>
                {!isMe && (
                  <img src={profile.photos[0]} alt={profile.name} style={{ width: 24, height: 24, borderRadius: "50%", objectFit: "cover", flexShrink: 0, marginBottom: 4 }} onError={(e) => { e.target.src = `https://ui-avatars.com/api/?name=${profile.name}&size=24&background=random`; }} />
                )}
                <div
                  style={{
                    padding: "12px 16px",
                    borderRadius: 16,
                    background: isMe ? C.sent : isDoveMsg ? C.primarySoft : C.card,
                    color: isMe ? "white" : C.text,
                    borderBottomRightRadius: isMe ? 6 : 16,
                    borderBottomLeftRadius: !isMe ? 6 : 16,
                    boxShadow: !isMe ? "0 1px 4px rgba(0,0,0,0.06)" : undefined,
                    border: isDoveMsg && !isMe ? `1.5px solid ${C.primary}` : undefined,
                    cursor: "pointer",
                  }}
                  onDoubleClick={() => setReacting(reacting === item.id ? null : item.id)}
                >
                  <p style={{ fontSize: 14, lineHeight: 1.5, fontFamily: FONT, margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{displayText}</p>
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
      <div style={{ flexShrink: 0, padding: "12px 16px calc(12px + env(safe-area-inset-bottom, 0px))", background: C.card, borderTop: `1px solid ${C.border}` }}>
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
      </div>
      </>
      )}

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
                <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>{reportDone === "block" ? <Ban size={36} strokeWidth={1.5} color="#EF4444" /> : reportDone === "report" ? <Flag size={36} strokeWidth={1.5} color="#EF4444" /> : <UserMinus size={36} strokeWidth={1.5} color={C.sub} />}</div>
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
                  { icon: <Flag size={18} strokeWidth={1.8} color="#EF4444" />, label: "Report", desc: "Flag inappropriate behaviour", color: "#EF4444", action: async () => { track("profile_reported", { source: "chat" }); dispatch({ type: "ADD_REPORT", payload: { profileId: profile.id, name: profile.name, photo: profile.photos?.[0], reason: "Inappropriate behaviour", timestamp: Date.now() } }); setReportDone("report"); } },
                  { icon: <Ban size={18} strokeWidth={1.8} color="#EF4444" />, label: "Block", desc: "They won't be able to see you", color: "#EF4444", action: async () => { track("profile_blocked", { source: "chat" }); dispatch({ type: "BLOCK_PROFILE", payload: { id: profile.id, name: profile.name, photo: profile.photos?.[0] } }); setShowReportMenu(false); setBlockFlash(true); try { await actions.unmatch(match.id); } catch (_) {} setTimeout(() => { setBlockFlash(false); setShowReportMenu(true); setReportDone("block"); }, 1500); } },
                  { icon: <UserMinus size={18} strokeWidth={1.8} color={C.text} />, label: "Unmatch", desc: "Remove this match", color: C.text, action: async () => { track("unmatch_from_chat"); try { await actions.unmatch(match.id); } catch (_) {} setReportDone("unmatch"); } },
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

      <NotificationPrompt />

      <div style={{ flex: 1, overflowY: "auto", paddingBottom: 24 }}>
        {sortedMatches.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", padding: "60px 20px", textAlign: "center" }}>
            <MessageCircle size={48} strokeWidth={1.4} color={C.primary} style={{ marginBottom: 16 }} />
            <h2 style={{ color: C.text, fontFamily: FONT, fontSize: 20, fontWeight: 700 }}>No messages yet</h2>
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
                onClick={() => { track("chat_opened"); setActiveChat(m.id); }}
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
                    {lastMsg
                      ? (lastMsg.sender === currentUserId ? "You: " : "") + lastMsg.text.slice(0, 35) + (lastMsg.text.length > 35 ? "..." : "")
                      : state.currentUser?.gender === "male" ? "New match · plan your date" : "New match · waiting for his plan"}
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
