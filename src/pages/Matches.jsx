import { useState, useRef, useEffect, useMemo } from "react";
import { useApp } from "../context/AppContext";
import * as api from "../services/api";
import { MessageCircle, Ban, Flag, UserMinus, Calendar, CheckCircle, Clock, Video, Heart, Lock, Flower2, ChevronLeft, Shield, ArrowUp, Utensils, Footprints, Coffee, Mountain, Shirt, Briefcase, Gem, Dumbbell, MapPin } from "lucide-react";
import AgapeCross from "../components/AgapeCross";
import DoveIcon from "../components/DoveIcon";
import LocationPicker from "../components/LocationPicker";
import ReliabilityBadge from "../components/ReliabilityBadge";
import NotificationPrompt from "../components/NotificationPrompt";
import TutorialOverlay from "../components/TutorialOverlay";
import { track } from "../services/posthog";
import { DETAIL_FIELDS } from "../data/profiles";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const C = { bg: "#FFFFFF", card: "#FAFAF8", surface: "#F4F2EE", primary: "#B8912A", primarySoft: "#FBF5E6", text: "#1A1612", sub: "#8C857C", border: "#E8E4DF", sent: "#111111" };
const FONT = "'Outfit', system-ui, sans-serif";

const DATE_TYPES = [
  { id: "dinner", Icon: Utensils, label: "Dinner" },
  { id: "walk", Icon: Footprints, label: "Walk" },
  { id: "coffee", Icon: Coffee, label: "Coffee" },
  { id: "adventure", Icon: Mountain, label: "Adventure" },
];

const WARDROBE_OPTIONS = [
  { id: "casual", Icon: Shirt, label: "Casual" },
  { id: "smart", Icon: Briefcase, label: "Smart casual" },
  { id: "formal", Icon: Gem, label: "Formal" },
  { id: "sporty", Icon: Dumbbell, label: "Active" },
];

function dayLabel(ts) {
  const d = new Date(ts);
  const today = new Date();
  const yesterday = new Date(); yesterday.setDate(today.getDate() - 1);
  const same = (a, b) => a.toDateString() === b.toDateString();
  if (same(d, today)) return "Today";
  if (same(d, yesterday)) return "Yesterday";
  return d.toLocaleDateString("en", { weekday: "short", day: "numeric", month: "short" });
}

const DAY_SLOTS = [
  { id: "morning", label: "Morning", hint: "9 – 12", time: "10:00" },
  { id: "lunch", label: "Lunch", hint: "12 – 14", time: "12:30" },
  { id: "afternoon", label: "Afternoon", hint: "14 – 17", time: "15:00" },
  { id: "evening", label: "Evening", hint: "17 – 22", time: "19:00" },
];
const MAX_SLOTS = 12;
const TIME_SLOTS = ["12:00", "14:00", "16:00", "18:00", "19:30", "21:00"];

function formatTimeLeft(ms) {
  if (ms <= 0) return "Expired";
  const hours = Math.floor(ms / 3600000);
  const days = Math.floor(hours / 24);
  const h = hours % 24;
  if (days > 0) return `${days}d ${h}h`;
  if (h > 0) return `${h}h`;
  return `${Math.floor(ms / 60000)}m`;
}

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
      style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", objectPosition: "50% 20%", border: `2px solid ${C.bg}`, boxShadow: "0 0 0 1.5px " + C.border, display: "block" }}
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
                  <dt.Icon size={20} strokeWidth={1.7} color={dateType === dt.id ? C.primary : C.sub} />
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
                  <w.Icon size={20} strokeWidth={1.7} color={wardrobe === w.id ? C.primary : C.sub} />
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

function DateCard({ invitation, isMe, isMale, onRespond, onConfirm, onDecline, onCancel, meAvatar, themAvatar, themName, pickerOpen, onPickerOpenChange }) {
  const [selectedTimes, setSelectedTimes] = useState([]);
  const [sending, setSending] = useState(false);
  const [showDecline, setShowDecline] = useState(false);
  const [declineReasons, setDeclineReasons] = useState([]);
  const [confirming, setConfirming] = useState(null);
  const [internalPickerOpen, setInternalPickerOpen] = useState(false);
  // The thread owns the picker state so its footer button can open it
  const showPicker = pickerOpen ?? internalPickerOpen;
  const setShowPicker = onPickerOpenChange || setInternalPickerOpen;

  // Editing already-sent availability starts from what was sent
  useEffect(() => {
    if (showPicker && invitation.status === "responded" && !isMale) setSelectedTimes(invitation.response_times || []);
  }, [showPicker]);
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
  const primaryBtn = { width: "100%", padding: "13px 0", borderRadius: 12, fontSize: 14.5, fontWeight: 600, fontFamily: FONT, background: C.text, color: "white", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 };
  const secondaryBtn = { ...primaryBtn, background: C.bg, color: C.text, border: `1px solid ${C.border}` };
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
    <div style={{ margin: "6px 0 10px", borderRadius: 16, overflow: "hidden", border: `1px solid ${C.border}`, background: C.bg }}>
      <div style={{ padding: "14px 16px 12px", display: "flex", alignItems: "center", gap: 12, borderBottom: `1px solid ${C.border}` }}>
        <span style={{ width: 40, height: 40, borderRadius: 12, background: C.surface, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          {dt?.Icon ? <dt.Icon size={19} strokeWidth={1.7} color={C.text} /> : <Calendar size={19} strokeWidth={1.7} color={C.text} />}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 15, fontWeight: 600, color: C.text, fontFamily: FONT, margin: 0, letterSpacing: "-0.2px" }}>{dt?.label || "Date"}</p>
          <p style={{ fontSize: 12.5, color: C.sub, fontFamily: FONT, margin: "2px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {invitation.location}{wb ? ` · ${wb.label}` : ""}
          </p>
        </div>
        <span style={{ fontSize: 11, fontWeight: 600, fontFamily: FONT, letterSpacing: "0.04em", textTransform: "uppercase", padding: "4px 9px", borderRadius: 9999, background: invitation.status === "confirmed" ? "#F0FDF4" : C.surface, color: invitation.status === "confirmed" ? "#15803D" : C.sub, flexShrink: 0 }}>
          {invitation.status === "confirmed" ? "Confirmed" : invitation.status === "declined" ? "Declined" : "Pending"}
        </span>
      </div>

      <div style={{ padding: "12px 16px 14px" }}>
        {invitation.status === "confirmed" && invitation.confirmed_time && (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Clock size={16} strokeWidth={1.7} color={C.sub} />
            <span style={{ fontSize: 15, fontWeight: 600, color: C.text, fontFamily: FONT, letterSpacing: "-0.2px" }}>
              {longDay(invitation.confirmed_time.date)} · {invitation.confirmed_time.time}
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
            <button onClick={() => { track("date_times_edit_opened"); setShowPicker(true); }} style={secondaryBtn}>
              <Calendar size={16} color={C.primary} /> Change my times
            </button>
            {showPicker && (
              <AvailabilitySheet
                title={pickerTitle}
                subtitle={`Change your times until ${themName} picks one`}
                onClose={() => setShowPicker(false)}
                footer={
                  <button
                    onClick={handleRespond}
                    disabled={selectedTimes.length === 0 || sending}
                    style={{ ...primaryBtn, background: selectedTimes.length > 0 ? C.primary : C.border, cursor: selectedTimes.length > 0 ? "pointer" : "default" }}
                  >
                    {sending ? "Saving..." : selectedTimes.length > 0 ? `Update — ${selectedTimes.length} time${selectedTimes.length === 1 ? "" : "s"}` : "Select at least one time"}
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
                <AvailabilityTable rows={allRows} mine={new Set(selectedTimes.map(timeKey))} onToggle={toggleTime} meAvatar={meAvatar} />
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

  const confirmedDate = [...dateInvitations].reverse().find((inv) => inv.status === "confirmed") || null;
  const openInvite = [...dateInvitations].reverse().find((inv) => inv.status === "pending" || inv.status === "responded") || null;
  const lastInvite = [...dateInvitations].reverse().find((inv) => !api.isCancelledInvite(inv)) || null;
  const lastDeclined = !confirmedDate && !openInvite && lastInvite?.status === "declined" ? lastInvite : null;

  // ── Deadline: after the first message he has 5 days to plan a date; a rose adds 36h; a plan, a video call or a set date stops the clock ──
  const [nudgeSent, setNudgeSent] = useState(!!match.nudgeAt);
  const [nudgeSending, setNudgeSending] = useState(false);
  const [showNudgeExplainer, setShowNudgeExplainer] = useState(false);
  const [videoCallStarted, setVideoCallStarted] = useState(false);
  const [showVideoCallScheduler, setShowVideoCallScheduler] = useState(false);
  const [vcDay, setVcDay] = useState(null);
  const [vcTime, setVcTime] = useState(null);
  const vcDays = useMemo(() => getNextDays(7), []);

  useEffect(() => {
    if (nudgeSent || !isMale) return;
    const check = setInterval(async () => {
      try {
        const matches = await api.getMatches();
        const m = matches.find((x) => x.id === match.id);
        if (m?.nudgeAt) { setNudgeSent(true); clearInterval(check); }
      } catch (_) {}
    }, 10000);
    return () => clearInterval(check);
  }, [nudgeSent, isMale, match.id]);

  const firstMessageTime = messages.length > 0 ? messages[0].timestamp : null;
  const FIVE_DAYS = 5 * 24 * 60 * 60 * 1000;
  const NUDGE_BONUS = 36 * 60 * 60 * 1000;
  const COOLDOWN_48H = 48 * 60 * 60 * 1000;
  const deadlinePaused = match.deadlinePaused;
  const hasVideoCall = !!match.videoCallAt || videoCallStarted;
  const timerStopped = deadlinePaused || hasVideoCall || !!confirmedDate || !!openInvite;

  const lastDeclinedAt = (() => {
    const d = dateInvitations.filter((inv) => inv.status === "declined" && !api.isCancelledInvite(inv)).sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
    return d ? new Date(d.created_at).getTime() : null;
  })();

  let deadlineMs = null;
  if (!timerStopped && firstMessageTime) {
    deadlineMs = lastDeclinedAt ? lastDeclinedAt + COOLDOWN_48H + FIVE_DAYS : firstMessageTime + FIVE_DAYS;
    if (nudgeSent || match.nudgeAt) deadlineMs += NUDGE_BONUS;
  }
  const timeLeftMs = deadlineMs ? deadlineMs - Date.now() : null;
  const chatLocked = !timerStopped && timeLeftMs !== null && timeLeftMs <= 0;

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

  const myName = state.currentUser?.name || "Your match";
  const notifyThem = (title, body, tag) => api.notifyUser(profile.id, { title, body, url: "/?tab=matches", tag: `${tag}-${match.id}` });

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
    if (!text.trim() || chatLocked) return;
    const msg = text.trim();
    setText("");
    try {
      await actions.sendMessage(match.id, msg);
    } catch (err) {
      console.error("Send failed:", err);
    }
  };

  const handleNudge = async () => {
    track("rose_sent");
    setNudgeSending(true);
    try {
      await api.sendNudge(match.id);
      await actions.sendMessage(match.id, "🌹");
      setNudgeSent(true);
      notifyThem(`${myName} sent you a rose`, "She'd love to go on a date — you have extra time to plan one.", "rose");
    } catch (err) {
      console.error("Nudge failed:", err);
    }
    setNudgeSending(false);
  };

  const handleVideoCall = async () => {
    if (!vcDay || !vcTime) return;
    track("video_call_scheduled");
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
      const wasUpdate = dateInvitations.find((inv) => inv.id === invId)?.status === "responded";
      const updated = await api.respondToDate(invId, selectedTimes);
      setDateInvitations((prev) => prev.map((inv) => (inv.id === invId ? updated : inv)));
      notifyThem(
        wasUpdate ? `${myName} changed her times` : `${myName} is free`,
        `Pick one of her ${selectedTimes.length} time${selectedTimes.length === 1 ? "" : "s"} to set the date.`,
        "date"
      );
    } catch (err) {
      console.error("Respond failed:", err);
    }
  };

  const handleConfirmDate = async (invId, confirmedTime) => {
    try {
      const updated = await api.confirmDate(invId, confirmedTime);
      setDateInvitations((prev) => prev.map((inv) => (inv.id === invId ? updated : inv)));
      notifyThem("Date confirmed", `${myName} picked ${longDay(confirmedTime.date)} · ${confirmedTime.time}.`, "date");
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

  const formatTime = (ts) => new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  // Messages and date cards interleaved by time
  const timeline = useMemo(() => {
    const items = messages.map((m) => ({ ...m, _type: "message" }));
    for (const inv of [confirmedDate, openInvite]) {
      if (inv) items.push({ ...inv, _type: "date", timestamp: new Date(inv.created_at).getTime() });
    }
    return items.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
  }, [messages, confirmedDate, openInvite]);

  const chip = (extra = {}) => ({
    display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 13px", borderRadius: 9999, fontSize: 13, fontWeight: 600, fontFamily: FONT,
    background: C.bg, color: C.text, border: `1px solid ${C.border}`, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0, ...extra,
  });

  const dateCardProps = {
    isMale,
    onRespond: handleRespondDate,
    onConfirm: handleConfirmDate,
    onDecline: handleDeclineDate,
    onCancel: handleCancelDate,
    meAvatar: state.currentUser?.photos?.[0],
    themAvatar: profile.photos?.[0],
    themName: profile.name,
  };

  return (
    <div className="thread-panel" style={{ background: C.bg }}>
      {blockFlash && (
        <div className="like-flash-overlay block">
          <span className="flash-emoji"><Ban size={120} strokeWidth={1.4} color="#EF4444" /></span>
        </div>
      )}
      {/* Header */}
      {(() => {
        let status = profile.denomination || "";
        let statusColor = C.sub;
        if (chatLocked) { status = "Chat closed · no date was set in time"; statusColor = "#B91C1C"; }
        else if (confirmedDate && !datePassed) { status = `Date set · ${longDay(confirmedDate.confirmed_time?.date)} · ${confirmedDate.confirmed_time?.time || ""}`; statusColor = "#15803D"; }
        else if (openInvite) {
          status = openInvite.status === "pending"
            ? (isMale ? "Plan sent · waiting for her times" : "He planned a date · tell him when you're free")
            : (isMale ? "She's free · pick one of her times" : "Times sent · waiting for him to pick one");
        }
        else if (hasVideoCall) status = "Video call scheduled";
        else if (firstMessageTime && !timerStopped && timeLeftMs !== null) status = isMale ? `${formatTimeLeft(timeLeftMs)} to plan a date` : `${formatTimeLeft(timeLeftMs)} for him to plan a date`;
        return (
          <div style={{ flexShrink: 0, padding: "max(44px, env(safe-area-inset-top, 44px)) 12px 10px", background: C.bg, borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 10 }}>
            <button onClick={onBack} aria-label="Back" style={{ width: 36, height: 36, borderRadius: 18, background: "none", border: "none", cursor: "pointer", color: C.text, display: "flex", alignItems: "center", justifyContent: "center", marginLeft: -6 }}>
              <ChevronLeft size={22} strokeWidth={1.8} />
            </button>
            <img src={profile.photos[0]} alt={profile.name} onClick={() => setViewProfile(true)} style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover", objectPosition: "50% 20%", cursor: "pointer", flexShrink: 0 }} onError={(e) => { e.target.src = `https://ui-avatars.com/api/?name=${profile.name}&size=72&background=F4F2EE&color=B8912A`; }} />
            <div style={{ flex: 1, minWidth: 0, cursor: "pointer" }} onClick={() => setViewProfile(true)}>
              <p style={{ fontWeight: 600, fontSize: 16, lineHeight: 1.15, color: C.text, fontFamily: FONT, margin: 0, letterSpacing: "-0.2px" }}>{profile.name}</p>
              <p style={{ fontSize: 12, color: statusColor, fontFamily: FONT, margin: "2px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{status}</p>
            </div>
            <button onClick={() => setShowReportMenu(true)} aria-label="Safety options" style={{ width: 36, height: 36, borderRadius: 18, background: "none", border: "none", cursor: "pointer", color: C.sub, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Shield size={19} strokeWidth={1.7} />
            </button>
          </div>
        );
      })()}

      {/* Timeline */}
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", WebkitOverflowScrolling: "touch", padding: "18px 16px 20px", display: "flex", flexDirection: "column", gap: 6 }}>
        {timeline.length === 0 && !lastDeclined && (
          <div style={{ borderRadius: 16, padding: "16px", background: C.card, border: `1px solid ${C.border}`, marginBottom: 8 }}>
            <p style={{ fontSize: 15, fontWeight: 600, color: C.text, fontFamily: FONT, margin: "0 0 6px", letterSpacing: "-0.2px" }}>You matched with {profile.name}</p>
            <p style={{ fontSize: 13, color: C.sub, fontFamily: FONT, lineHeight: 1.55, margin: 0 }}>
              {isMale
                ? "Say hello. Once the conversation starts you have five days to plan a date — she'll tell you when she's free and you pick one of her times."
                : "Say hello. Once the conversation starts he has five days to plan a date. A rose lets him know you'd love to go, and gives him extra time."}
            </p>
          </div>
        )}

        {lastDeclined && (
          <div style={{ borderRadius: 14, padding: "12px 14px", background: C.card, border: `1px solid ${C.border}`, marginBottom: 8 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: C.text, fontFamily: FONT, margin: "0 0 2px" }}>
              {isMale ? "She passed on this plan" : "You passed on this plan"}
            </p>
            <p style={{ fontSize: 12, color: C.sub, fontFamily: FONT, margin: 0 }}>
              {isMale
                ? (lastDeclined.decline_reasons?.length ? lastDeclined.decline_reasons.join(" · ") : "Try something different.")
                : "He can propose something new."}
            </p>
          </div>
        )}

        {timeline.map((item, i) => {
          const prev = timeline[i - 1];
          const next = timeline[i + 1];
          const showDay = !prev || dayLabel(prev.timestamp) !== dayLabel(item.timestamp);
          const divider = showDay ? (
            <div key={`day-${item.timestamp}`} style={{ textAlign: "center", padding: "10px 0 8px" }}>
              <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: C.sub, fontFamily: FONT }}>{dayLabel(item.timestamp)}</span>
            </div>
          ) : null;

          if (item._type === "date") {
            return (
              <div key={`date-${item.id}`}>
                {divider}
                <DateCard invitation={item} isMe={item.from_user === currentUserId} {...dateCardProps} />
              </div>
            );
          }

          const isMe = item.sender === currentUserId;
          const isDoveMsg = item.text?.startsWith("🕊️ ");
          const displayText = isDoveMsg ? item.text.slice(3) : item.text;
          const endOfRun = !next || next._type !== "message" || next.sender !== item.sender || (next.timestamp - item.timestamp) > 5 * 60 * 1000;

          // System-style events (rose, video call) render as quiet centered lines instead of bubbles
          const isRose = item.text?.trim() === "🌹";
          const isVideoNote = item.text?.startsWith("📹");
          if (isRose || isVideoNote) {
            const label = isRose ? `${isMe ? "You" : profile.name} sent a rose` : item.text.replace(/^📹\s*/, "").replace("Video call scheduled:", "Video call ·");
            return (
              <div key={item.id}>
                {divider}
                <div style={{ display: "flex", justifyContent: "center", margin: "6px 0 12px" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 9999, background: C.card, border: `1px solid ${C.border}`, fontSize: 12, fontWeight: 500, color: C.sub, fontFamily: FONT }}>
                    {isRose ? <Flower2 size={13} color={C.primary} strokeWidth={1.8} /> : <Video size={13} color={C.sub} strokeWidth={1.8} />}
                    {label}
                  </span>
                </div>
              </div>
            );
          }

          return (
            <div key={item.id}>
              {divider}
              <div style={{ display: "flex", flexDirection: "column", alignItems: isMe ? "flex-end" : "flex-start", marginBottom: endOfRun ? 10 : 2 }}>
                {isDoveMsg && (
                  <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 4 }}>
                    <DoveIcon size={12} color={C.primary} strokeWidth={2.2} />
                    <span style={{ fontSize: 11, fontWeight: 600, color: C.primary, fontFamily: FONT, letterSpacing: "0.02em" }}>Sent with a Dove</span>
                  </div>
                )}
                <div
                  style={{
                    maxWidth: "78%",
                    padding: "10px 14px",
                    borderRadius: 18,
                    borderBottomRightRadius: isMe ? 5 : 18,
                    borderBottomLeftRadius: isMe ? 18 : 5,
                    background: isMe ? C.text : C.bg,
                    color: isMe ? "#fff" : C.text,
                    border: isMe ? "1px solid " + C.text : `1px solid ${isDoveMsg ? C.primary : C.border}`,
                  }}
                >
                  <p style={{ fontSize: 15, lineHeight: 1.45, fontFamily: FONT, margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{displayText}</p>
                </div>
                {endOfRun && <p style={{ fontSize: 10.5, marginTop: 4, color: C.sub, fontFamily: FONT }}>{formatTime(item.timestamp)}</p>}
              </div>
            </div>
          );
        })}

        {datePassed && myRating === null && !openInvite && (
          <div style={{ borderRadius: 16, padding: "16px", background: C.card, border: `1px solid ${C.border}`, marginTop: 8 }}>
            <p style={{ fontSize: 15, fontWeight: 600, color: C.text, fontFamily: FONT, margin: "0 0 4px", letterSpacing: "-0.2px" }}>Did {profile.name} show up?</p>
            <p style={{ fontSize: 12.5, color: C.sub, fontFamily: FONT, margin: "0 0 12px", lineHeight: 1.5 }}>Your answer becomes part of {profile.name}'s reliability score.</p>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => handleRate(true)} disabled={rating} style={{ flex: 1, padding: "11px 0", borderRadius: 12, fontSize: 14, fontWeight: 600, fontFamily: FONT, background: C.text, color: "#fff", border: "none", cursor: "pointer" }}>Yes, we met</button>
              <button onClick={() => handleRate(false)} disabled={rating} style={{ flex: 1, padding: "11px 0", borderRadius: 12, fontSize: 14, fontWeight: 600, fontFamily: FONT, background: C.bg, color: "#B91C1C", border: `1px solid ${C.border}`, cursor: "pointer" }}>No-show</button>
            </div>
          </div>
        )}
        {datePassed && myRating && (
          <div style={{ borderRadius: 16, padding: "16px", background: C.card, border: `1px solid ${C.border}`, marginTop: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              {myRating.showed_up ? <CheckCircle size={16} color="#15803D" strokeWidth={1.8} /> : <Ban size={16} color="#B91C1C" strokeWidth={1.8} />}
              <p style={{ fontSize: 15, fontWeight: 600, color: C.text, fontFamily: FONT, margin: 0, letterSpacing: "-0.2px" }}>
                {myRating.showed_up ? `You met ${profile.name}` : `${profile.name} didn't show up`}
              </p>
            </div>
            <p style={{ fontSize: 12.5, color: C.sub, fontFamily: FONT, margin: "0 0 12px", lineHeight: 1.5 }}>
              {myRating.showed_up ? "Counted towards their reliability score. Keep chatting, or plan the next one." : "It now shows on their profile. You can unmatch below."}
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              {myRating.showed_up && isMale && !openInvite && (
                <button onClick={() => { track("plan_date_tapped", { again: true }); setShowDateBuilder(true); }} style={{ flex: 1, padding: "11px 0", borderRadius: 12, fontSize: 13.5, fontWeight: 600, fontFamily: FONT, background: C.text, color: "#fff", border: "none", cursor: "pointer" }}>
                  Plan another date
                </button>
              )}
              <button onClick={() => setShowReportMenu(true)} style={{ flex: 1, padding: "11px 0", borderRadius: 12, fontSize: 13.5, fontWeight: 600, fontFamily: FONT, background: C.bg, color: C.sub, border: `1px solid ${C.border}`, cursor: "pointer" }}>
                {myRating.showed_up ? "Unmatch or report" : "Unmatch"}
              </button>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Compose */}
      <div style={{ flexShrink: 0, padding: "8px 12px calc(10px + env(safe-area-inset-bottom, 0px))", background: C.bg, borderTop: `1px solid ${C.border}` }}>
        {chatLocked ? (
          <div style={{ textAlign: "center", padding: "12px 0", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <Lock size={14} color={C.sub} strokeWidth={1.8} />
            <p style={{ fontSize: 13, color: C.sub, fontFamily: FONT, margin: 0 }}>This conversation has closed</p>
          </div>
        ) : (
          <>
            {isMale && (nudgeSent || match.nudgeAt) && !showNudgeExplainer && messages.length <= 5 && (
              <button onClick={() => setShowNudgeExplainer(true)} style={{ width: "100%", padding: "10px 14px", marginBottom: 8, borderRadius: 12, background: C.card, border: `1px solid ${C.border}`, cursor: "pointer", textAlign: "left", fontSize: 13, color: C.text, fontFamily: FONT, display: "flex", alignItems: "center", gap: 8 }}>
                <Flower2 size={14} color={C.primary} /> She sent you a rose — what it means
              </button>
            )}
            {showNudgeExplainer && (
              <div style={{ padding: "12px 14px", marginBottom: 8, borderRadius: 12, background: C.card, border: `1px solid ${C.border}` }}>
                <p style={{ fontSize: 13, color: C.text, fontFamily: FONT, lineHeight: 1.5, margin: "0 0 6px" }}>
                  She'd love to go on a date with you — and you've got an extra 36 hours to plan something.
                </p>
                <button onClick={() => setShowNudgeExplainer(false)} style={{ fontSize: 12, fontWeight: 600, color: C.sub, background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: FONT }}>Got it</button>
              </div>
            )}

            {showVideoCallScheduler && (
              <div style={{ padding: "14px", marginBottom: 8, borderRadius: 14, background: C.card, border: `1px solid ${C.border}` }}>
                <p style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: FONT, margin: "0 0 2px" }}>Schedule a video call</p>
                <p style={{ fontSize: 12, color: C.sub, fontFamily: FONT, margin: "0 0 12px" }}>Pick a day and time. The deadline pauses.</p>
                <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 8, marginBottom: 6, scrollbarWidth: "none" }}>
                  {vcDays.map((d) => (
                    <button
                      key={d.date}
                      onClick={() => setVcDay(vcDay?.date === d.date ? null : d)}
                      style={{ flexShrink: 0, padding: "9px 12px", borderRadius: 12, cursor: "pointer", textAlign: "center", minWidth: 58, border: `1px solid ${vcDay?.date === d.date ? C.text : C.border}`, background: vcDay?.date === d.date ? C.text : C.bg, color: vcDay?.date === d.date ? "#fff" : C.text }}
                    >
                      <span style={{ fontSize: 10.5, display: "block", fontWeight: 600, opacity: 0.7, fontFamily: FONT }}>{d.dayName}</span>
                      <span style={{ fontSize: 17, fontWeight: 600, display: "block", fontFamily: FONT }}>{d.dayNum}</span>
                    </button>
                  ))}
                </div>
                {vcDay && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12, alignItems: "center" }}>
                    {TIME_SLOTS.map((t) => (
                      <button key={t} onClick={() => setVcTime(vcTime === t ? null : t)} style={{ padding: "8px 14px", borderRadius: 10, cursor: "pointer", fontSize: 13.5, fontWeight: 600, fontFamily: FONT, color: vcTime === t ? "#fff" : C.text, border: `1px solid ${vcTime === t ? C.text : C.border}`, background: vcTime === t ? C.text : C.bg }}>
                        {t}
                      </button>
                    ))}
                    <input type="time" onChange={(e) => { if (e.target.value) setVcTime(e.target.value); }} style={{ padding: "8px 10px", borderRadius: 10, fontSize: 13.5, fontWeight: 600, fontFamily: FONT, color: C.text, border: `1px solid ${C.border}`, background: C.bg, outline: "none", width: 96 }} />
                  </div>
                )}
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => { setShowVideoCallScheduler(false); setVcDay(null); setVcTime(null); }} style={{ flex: 1, padding: "10px 0", borderRadius: 12, fontSize: 13.5, fontWeight: 600, background: C.bg, color: C.sub, border: `1px solid ${C.border}`, cursor: "pointer", fontFamily: FONT }}>Cancel</button>
                  <button onClick={handleVideoCall} disabled={!vcDay || !vcTime} style={{ flex: 1, padding: "10px 0", borderRadius: 12, fontSize: 13.5, fontWeight: 600, background: vcDay && vcTime ? C.text : C.border, color: "#fff", border: "none", cursor: vcDay && vcTime ? "pointer" : "default", fontFamily: FONT }}>Schedule</button>
                </div>
              </div>
            )}

            {/* Action chips */}
            <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 8, scrollbarWidth: "none" }}>
              {isMale && !openInvite && !confirmedDate && (
                <button aria-label="Plan a date" onClick={() => { track("plan_date_tapped"); setShowDateBuilder(true); }} style={chip({ background: C.text, color: "#fff", border: `1px solid ${C.text}` })}>
                  <Calendar size={14} color="#fff" strokeWidth={1.8} /> {lastDeclined ? "Plan another date" : "Plan a date"}
                </button>
              )}
              {!isMale && !nudgeSent && !openInvite && !confirmedDate && (
                <button aria-label="Send a rose" onClick={handleNudge} disabled={nudgeSending} style={chip()}>
                  <Flower2 size={14} color={C.primary} strokeWidth={1.8} /> {nudgeSending ? "Sending…" : "Send a rose"}
                </button>
              )}
              {!isMale && nudgeSent && !openInvite && !confirmedDate && (
                <span style={chip({ color: C.sub, cursor: "default" })}>
                  <Flower2 size={14} color={C.primary} strokeWidth={1.8} /> Rose sent
                </span>
              )}
              {!hasVideoCall && !showVideoCallScheduler && (
                <button aria-label="Video call" onClick={() => { track("video_call_scheduler_opened"); setShowVideoCallScheduler(true); }} style={chip()}>
                  <Video size={14} color={C.sub} strokeWidth={1.8} /> Video call
                </button>
              )}
              {hasVideoCall && (
                <button onClick={() => { track("video_call_joined"); window.open(`https://meet.ffmuc.net/agape-${match.id.slice(0, 8)}`, "_blank"); }} style={chip()}>
                  <Video size={14} color="#15803D" strokeWidth={1.8} /> Join video call
                </button>
              )}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                style={{ flex: 1, fontSize: 15, padding: "11px 16px", borderRadius: 22, background: C.bg, border: `1px solid ${C.border}`, outline: "none", color: C.text, fontFamily: FONT, minWidth: 0 }}
                placeholder="Message"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
              />
              <button
                onClick={send}
                aria-label="Send"
                style={{ width: 40, height: 40, borderRadius: 20, display: "flex", alignItems: "center", justifyContent: "center", background: text.trim() ? C.text : C.surface, border: "none", cursor: "pointer", flexShrink: 0, transition: "background 0.15s" }}
              >
                <ArrowUp size={18} color={text.trim() ? "#fff" : C.sub} strokeWidth={2} />
              </button>
            </div>
          </>
        )}
      </div>

      <TutorialOverlay screen="chat" />

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
              {profile.reliability?.dates > 0 && <div style={{ marginTop: 8 }}><ReliabilityBadge reliability={profile.reliability} light /></div>}
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
            {DETAIL_FIELDS.some((f) => profile.details?.[f.key]) && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: "4px 0" }}>
                {DETAIL_FIELDS.filter((f) => profile.details?.[f.key]).map((f) => (
                  <span key={f.key} style={{ fontSize: 12, fontWeight: 600, padding: "6px 12px", borderRadius: 9999, background: C.bg, border: `1px solid ${C.border}`, color: C.text }}><span style={{ color: C.sub, fontWeight: 500 }}>{f.label} · </span>{profile.details[f.key]}</span>
                ))}
              </div>
            )}
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
                  <img src={profile.photos[0]} alt={profile.name} style={{ width: 88, height: 88, borderRadius: "50%", objectFit: "cover", objectPosition: "50% 20%", display: "block" }} onError={(e) => { e.target.src = `https://ui-avatars.com/api/?name=${profile.name}&size=88&background=random`; }} />
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
                    {lastMsg?.isComment
                      ? (lastMsg.sender === currentUserId
                          ? `You commented on their ${lastMsg.targetType === "photo" ? "photo" : lastMsg.targetType === "prompt" ? "prompt" : "profile"}`
                          : `${profile.name} commented on your ${lastMsg.targetType === "photo" ? "photo" : lastMsg.targetType === "prompt" ? "prompt" : "profile"} · unlocks after your date`)
                      : lastMsg
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
