import { useState, useRef, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { useApp } from "../context/AppContext";
import * as api from "../services/api";
import { MessageCircle, Ban, Flag, UserMinus, Calendar, CheckCircle, Clock, Video, Heart, Lock, Flower2, ChevronLeft, Shield, ArrowUp, Utensils, Footprints, Coffee, Mountain, MapPin, Image as ImageIcon, Mic, X, SmilePlus, Reply, Sunrise, Sun, Sunset, Moon } from "lucide-react";
import AgapeCross from "../components/AgapeCross";
import DoveIcon from "../components/DoveIcon";
import LocationPicker from "../components/LocationPicker";
import ReliabilityBadge from "../components/ReliabilityBadge";
import NotificationPrompt from "../components/NotificationPrompt";
import TutorialOverlay from "../components/TutorialOverlay";
import AudioPlayer from "../components/AudioPlayer";
import VerifiedBadge from "../components/VerifiedBadge";
import CompatibilityRing from "../components/CompatibilityRing";
import VoiceRecorder from "../components/VoiceRecorder";
import { prepareChatImage, extForMime, isRecordingSupported } from "../services/media";
import { track } from "../services/posthog";
import { DETAIL_FIELDS } from "../data/profiles";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const C = { bg: "#FFFFFF", card: "#FAFAF8", surface: "#F4F2EE", primary: "#B8912A", primarySoft: "#FBF5E6", text: "#1A1612", sub: "#8C857C", border: "#E8E4DF", sent: "#111111" };
const FONT = "'Outfit', system-ui, sans-serif";
const SERIF = "'Lora', Georgia, serif";

const DATE_TYPES = [
  { id: "dinner", Icon: Utensils, label: "Dinner", hint: "An evening at a table together" },
  { id: "walk", Icon: Footprints, label: "Walk", hint: "Side by side, outdoors" },
  { id: "coffee", Icon: Coffee, label: "Coffee", hint: "Short, relaxed, easy to say yes to" },
  { id: "adventure", Icon: Mountain, label: "Adventure", hint: "Something active you both remember" },
];

// Dress codes from plans made before the step was removed still show on their cards
const WARDROBE_LABELS = { casual: "Casual", smart: "Smart casual", formal: "Formal", sporty: "Active" };

// A choice row with a round icon badge, used for the date type and the dress code
function ChoiceRow({ Icon, label, hint, selected, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "12px 14px 12px 12px", borderRadius: 16,
        textAlign: "left", cursor: "pointer",
        border: selected ? `1.5px solid ${C.primary}` : `1px solid ${C.border}`,
        background: selected ? C.primarySoft : C.bg,
        boxShadow: selected ? "0 4px 14px rgba(184,145,42,0.18)" : "none",
      }}
    >
      <span style={{ width: 42, height: 42, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: selected ? C.primary : C.surface }}>
        <Icon size={20} strokeWidth={1.7} color={selected ? "white" : C.sub} />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 15, fontWeight: 700, color: C.text, fontFamily: FONT }}>{label}</span>
        {hint && <span style={{ display: "block", fontSize: 12.5, color: C.sub, fontFamily: FONT, marginTop: 1 }}>{hint}</span>}
      </span>
      <span style={{ width: 20, height: 20, borderRadius: "50%", flexShrink: 0, border: selected ? `6px solid ${C.primary}` : `1.5px solid ${C.border}`, background: "white", boxSizing: "border-box" }} />
    </button>
  );
}

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
const MAX_SLOTS = 40;
// Hours offered in the picker, 08:00 to 21:00: two rows of seven per day
const PICK_HOURS = Array.from({ length: 14 }, (_, i) => `${String(8 + i).padStart(2, "0")}:00`);
const hourOf = (t) => parseInt(String(t?.time || "12").slice(0, 2), 10);
// A word for the part of the day an hour falls in
const partOfDay = (t) => { const h = hourOf(t); return h < 12 ? "Morning" : h < 14 ? "Lunch" : h < 17 ? "Afternoon" : "Evening"; };
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
  getNextDays(14).flatMap((d) => PICK_HOURS.map((time) => ({ date: d.date, label: `${d.dayName} ${d.dayNum} ${d.month}`, time, isWeekend: d.isWeekend })));

// One small box per hour; selected boxes fill gold
function HourBox({ t, on, onClick }) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      aria-pressed={on}
      aria-label={`${t.time}${on ? ", selected" : ""}`}
      style={{
        width: 46, height: 44, flexShrink: 0, scrollSnapAlign: "start", borderRadius: 11, padding: 0, cursor: onClick ? "pointer" : "default",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 14, fontWeight: 700, fontFamily: FONT, color: on ? "white" : C.text,
        background: on ? C.primary : C.bg, border: on ? `1.5px solid ${C.primary}` : `1.5px solid ${C.border}`,
        boxShadow: on ? "0 3px 10px rgba(184,145,42,0.28)" : "none", transition: "background 120ms, box-shadow 120ms",
      }}
    >
      {t.time.slice(0, 2)}
    </button>
  );
}

const SLOT_ICONS = { morning: Sunrise, lunch: Sun, afternoon: Sunset, evening: Moon };

// The times she offered, as a timeline he picks one from: a day label, then one row per time with a "Choose" chip.
function OfferedTimesList({ rows, chosenKey, onPick, themName, onConfirm, sending }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {groupByDay(rows).map((day, di) => {
        const d = new Date(day.date + "T12:00:00");
        return (
          <div key={day.date} style={{ paddingTop: di === 0 ? 2 : 14 }}>
            <p style={{ margin: "0 0 8px 2px", fontSize: 11.5, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: C.sub, fontFamily: FONT }}>
              {d.toLocaleDateString("en", { weekday: "long" })} · {d.toLocaleDateString("en", { day: "numeric", month: "short" })}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {day.times.map((t) => {
                const k = timeKey(t);
                const on = chosenKey === k;
                const Icon = SLOT_ICONS[t.slot] || SLOT_ICONS[partOfDay(t).toLowerCase()] || Clock;
                return (
                  <button
                    key={k}
                    onClick={() => onPick(t)}
                    style={{
                      display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "11px 12px", borderRadius: 16, textAlign: "left", cursor: "pointer",
                      background: on ? C.primarySoft : C.bg, border: on ? `1.5px solid ${C.primary}` : `1px solid ${C.border}`,
                      boxShadow: on ? "0 4px 14px rgba(184,145,42,0.18)" : "none", transition: "background 120ms, box-shadow 120ms",
                    }}
                  >
                    <span style={{ width: 40, height: 40, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: on ? C.primary : C.surface }}>
                      <Icon size={19} strokeWidth={1.7} color={on ? "white" : C.primary} />
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: "block", fontSize: 15, fontWeight: 700, color: C.text, fontFamily: FONT }}>{t.slot ? slotName(t) : t.time}</span>
                      <span style={{ display: "block", fontSize: 12.5, color: C.sub, fontFamily: FONT, marginTop: 1 }}>{t.slot ? slotHint(t) : partOfDay(t)} · {themName || "She"} is free</span>
                    </span>
                    <span style={{ flexShrink: 0, padding: "6px 12px", borderRadius: 9999, fontSize: 12.5, fontWeight: 700, fontFamily: FONT, background: on ? C.primary : "transparent", color: on ? "white" : C.primary, border: `1.5px solid ${C.primary}` }}>
                      {on ? "Chosen" : "Choose"}
                    </span>
                  </button>
                );
              }).flatMap((el, i) => {
                // The confirm button sits right under the chosen row as well as in the footer
                const t = day.times[i];
                if (!onConfirm || chosenKey !== timeKey(t)) return [el];
                return [el, (
                  <button key={timeKey(t) + "-confirm"} onClick={onConfirm} disabled={sending}
                    style={{ width: "100%", padding: "12px 0", borderRadius: 12, fontSize: 14.5, fontWeight: 600, fontFamily: FONT, background: C.primary, color: "white", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                    <CheckCircle size={16} color="white" /> {sending ? "Confirming…" : `Confirm ${slotName(t)}, ${longDay(t.date)}`}
                  </button>
                )];
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Availability, one card per day with the hours in boxes. `theirs` is optional: with it, only their
// offered times are listed and one is picked.
function AvailabilityTable({ rows, mine, theirs, onToggle, themName, highlightKey, onConfirm, sending }) {
  const comparing = !!theirs;
  if (comparing) {
    const chosenKey = highlightKey || [...mine][0] || null;
    return <OfferedTimesList rows={rows.filter((t) => theirs.has(timeKey(t)))} chosenKey={chosenKey} onPick={onToggle} themName={themName} onConfirm={onConfirm} sending={sending} />;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {groupByDay(rows).map((day) => {
        const d = new Date(day.date + "T12:00:00");
        const picked = day.times.filter((t) => mine.has(timeKey(t))).length;
        return (
          <div key={day.date} style={{ borderRadius: 18, border: `1px solid ${C.border}`, background: C.card, padding: 12 }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <span style={{ fontSize: 17, fontWeight: 600, color: C.text, fontFamily: SERIF }}>{d.toLocaleDateString("en", { weekday: "long" })}</span>
                <span style={{ fontSize: 13, color: C.sub, fontFamily: FONT }}>{d.toLocaleDateString("en", { day: "numeric", month: "short" })}</span>
              </div>
              {picked > 0 && <span style={{ fontSize: 12, color: C.primary, fontWeight: 600, fontFamily: FONT }}>{picked} picked</span>}
            </div>
            <div style={{ position: "relative", margin: "0 -12px" }}>
              <div style={{ display: "flex", gap: 6, overflowX: "auto", scrollbarWidth: "none", WebkitOverflowScrolling: "touch", padding: "2px 24px 4px 12px", scrollSnapType: "x proximity" }}>
                {day.times.map((t) => {
                  const k = timeKey(t);
                  return <HourBox key={k} t={t} on={mine.has(k)} onClick={onToggle ? () => onToggle(t) : undefined} />;
                })}
              </div>
              {/* A soft fade on the right edge hints that the row scrolls */}
              <div style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: 28, pointerEvents: "none", background: `linear-gradient(to right, rgba(250,250,248,0), ${C.card})`, borderRadius: "0 18px 18px 0" }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AvailabilitySheet({ title, subtitle, onClose, children, footer }) {
  // Rendered on the body and sized with the dynamic viewport, so the footer stays above Safari's toolbar
  return createPortal(
    <div onClick={onClose} style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, height: "100dvh", maxWidth: 430, margin: "0 auto", zIndex: 600, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "flex-end" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", borderRadius: "24px 24px 0 0", background: C.bg, maxHeight: "88dvh", display: "flex", flexDirection: "column" }}>
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
    </div>,
    document.body
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
  const canProceed =
    (step === 1 && dateType) ||
    (step === 2 && location.trim());

  const handleNext = () => {
    if (step < 2) {
      track("date_builder_step", { step, dateType, location });
      setStep(step + 1);
    } else {
      track("date_invitation_sent", { dateType });
      onSend({ dateType, location: location.trim(), wardrobe: null, proposedTimes: [] });
    }
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, maxWidth: 430, margin: "0 auto", zIndex: 500, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "flex-end" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", borderRadius: "24px 24px 0 0", background: C.bg, padding: "20px 16px 32px", maxHeight: "80vh", overflowY: "auto" }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: C.border, margin: "0 auto 16px" }} />

        <div style={{ display: "flex", gap: 4, marginBottom: 20 }}>
          {[1, 2].map((s) => (
            <div key={s} style={{ flex: 1, height: 3, borderRadius: 2, background: s <= step ? C.primary : C.border }} />
          ))}
        </div>

        {step === 1 && (
          <>
            <p style={{ fontSize: 18, fontWeight: 700, color: C.text, fontFamily: FONT, marginBottom: 16 }}>What kind of date?</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {DATE_TYPES.map((dt) => (
                <ChoiceRow key={dt.id} Icon={dt.Icon} label={dt.label} hint={dt.hint} selected={dateType === dt.id}
                  onClick={() => { track("date_type_selected", { type: dt.id }); setDateType(dt.id); }} />
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
              placeholder="e.g. Café Camelot, Kraków"
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
            {step === 2 ? `Send to ${profileName}` : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}

const DECLINE_REASONS = [
  "The place doesn't work for me",
  "Not comfortable with the location",
  "Not the right time for me yet",
  "I'd prefer a different kind of date",
  "Not interested anymore",
];

function DateCard({ invitation, isMe, isMale, onRespond, onConfirm, onDecline, onCancel, onReschedule, onAskReschedule, meAvatar, themAvatar, themName, pickerOpen, onPickerOpenChange }) {
  const [selectedTimes, setSelectedTimes] = useState([]);
  const [sending, setSending] = useState(false);
  const [confirmError, setConfirmError] = useState("");
  const [showDecline, setShowDecline] = useState(false);
  const [declineReasons, setDeclineReasons] = useState([]);
  const [confirming, setConfirming] = useState(null);
  const [cancelAsk, setCancelAsk] = useState(false);
  const [internalPickerOpen, setInternalPickerOpen] = useState(false);

  // "Cancel" with a confirmation step, used by both sides at every stage
  // When the confirmed date starts, as a timestamp; the slot's start hour stands in when no time was stored
  const confirmedAtMs = invitation.confirmed_time?.date
    ? new Date(`${invitation.confirmed_time.date}T${invitation.confirmed_time.time || "12:00"}:00`).getTime()
    : 0;
  const cancelled = api.isCancelledInvite(invitation);

  const cancelRow = (label, question) => !onCancel ? null : cancelAsk ? (
    <div style={{ marginTop: 10, padding: "10px 12px", borderRadius: 12, background: "#FEF2F2", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <span style={{ flex: 1, minWidth: 140, fontSize: 13, color: "#7F1D1D", fontFamily: FONT }}>{question}</span>
      <button onClick={() => setCancelAsk(false)} style={{ padding: "8px 12px", borderRadius: 10, border: "none", background: "#fff", color: C.text, fontSize: 13, fontWeight: 600, fontFamily: FONT, cursor: "pointer" }}>Keep it</button>
      <button
        onClick={async () => { track("date_cancelled"); setSending(true); await onCancel(invitation.id); setSending(false); setCancelAsk(false); }}
        disabled={sending}
        style={{ padding: "8px 12px", borderRadius: 10, border: "none", background: "#B91C1C", color: "#fff", fontSize: 13, fontWeight: 700, fontFamily: FONT, cursor: "pointer", opacity: sending ? 0.6 : 1 }}
      >
        {sending ? "..." : "Yes, cancel"}
      </button>
    </div>
  ) : (
    <button onClick={() => setCancelAsk(true)} style={{ marginTop: 8, width: "100%", padding: "9px", borderRadius: 10, border: "none", background: "none", color: C.sub, fontSize: 13, fontWeight: 600, fontFamily: FONT, cursor: "pointer" }}>
      {label}
    </button>
  );
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
  const pickerTitle = `When can you ${{ dinner: "have dinner", walk: "go for a walk", coffee: "get a coffee", adventure: "go on an adventure" }[invitation.date_type] || "go on a date"} with ${themName}?`;
  const primaryBtn = { width: "100%", padding: "13px 0", borderRadius: 12, fontSize: 14.5, fontWeight: 600, fontFamily: FONT, background: C.text, color: "white", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 };
  const secondaryBtn = { ...primaryBtn, background: C.bg, color: C.text, border: `1px solid ${C.border}` };
  const dt = DATE_TYPES.find((d) => d.id === invitation.date_type);
  const wb = invitation.wardrobe ? { label: WARDROBE_LABELS[invitation.wardrobe] || invitation.wardrobe } : null;

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
    setConfirmError("");
    try {
      await onConfirm(invitation.id, confirming);
      setShowPicker(false);
    } catch (err) {
      setConfirmError(err?.message ? `Could not save: ${err.message}` : "Could not save your choice. Please try again.");
    } finally {
      setSending(false);
    }
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
          {invitation.status === "confirmed" ? "Confirmed" : cancelled ? "Cancelled" : invitation.status === "declined" ? "Declined" : "Pending"}
        </span>
      </div>

      <div style={{ padding: "12px 16px 14px" }}>
        {invitation.status === "confirmed" && invitation.confirmed_time && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Clock size={16} strokeWidth={1.7} color={C.sub} />
              <span style={{ fontSize: 15, fontWeight: 600, color: C.text, fontFamily: FONT, letterSpacing: "-0.2px" }}>
                {longDay(invitation.confirmed_time.date)} · {invitation.confirmed_time.time}
              </span>
            </div>
            {confirmedAtMs - 24 * 3600e3 > Date.now()
              ? cancelRow("Cancel this date", `Cancel the date with ${themName}? They will be told right away.`)
              : confirmedAtMs > Date.now() && (
                <p style={{ margin: "10px 0 0", fontSize: 12.5, color: C.sub, fontFamily: FONT, textAlign: "center" }}>Less than 24 hours to go, so the date can no longer be cancelled here. Let {themName} know in the chat if something comes up.</p>
              )}
          </>
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
                subtitle={`Tap the hours you're free. ${themName} picks one of them.`}
                onClose={() => setShowPicker(false)}
                footer={
                  <button
                    onClick={handleRespond}
                    disabled={selectedTimes.length === 0 || sending}
                    style={{ ...primaryBtn, background: selectedTimes.length > 0 ? C.primary : C.border, cursor: selectedTimes.length > 0 ? "pointer" : "default" }}
                  >
                    {sending ? "Sending…" : selectedTimes.length > 0 ? `Send ${selectedTimes.length} time${selectedTimes.length === 1 ? "" : "s"}` : "Select at least one time"}
                  </button>
                }
              >
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
                  <button onClick={() => quickPick((r) => hourOf(r) >= 18)} style={{ padding: "7px 12px", borderRadius: 9999, fontSize: 12, fontWeight: 600, fontFamily: FONT, background: C.surface, color: C.text, border: `1px solid ${C.border}`, cursor: "pointer" }}>+ All evenings</button>
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
            {cancelRow("Cancel this plan", `Withdraw this plan? ${themName} will be told right away.`)}
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
            {cancelRow("Cancel this plan", `Withdraw this plan? ${themName} will be told right away.`)}
            {showPicker && (
              <AvailabilitySheet
                title={pickerTitle}
                subtitle={`These are the times ${themName} is free. Tap one, then confirm.`}
                onClose={() => setShowPicker(false)}
                footer={
                  confirmError
                    ? <p style={{ fontSize: 12.5, color: "#EF4444", textAlign: "center", fontFamily: FONT, margin: 0 }}>{confirmError}</p>
                    : <p style={{ fontSize: 13, color: C.sub, textAlign: "center", fontFamily: FONT, margin: 0 }}>{confirming ? "Press Confirm under the time you chose" : "Tap a time to choose it"}</p>
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
                  onConfirm={handleConfirm}
                  sending={sending}
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
            {cancelRow("I can't make it after all", `Withdraw your times? ${themName} will be told right away.`)}
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
                    {sending ? "Saving…" : selectedTimes.length > 0 ? `Update — ${selectedTimes.length} time${selectedTimes.length === 1 ? "" : "s"}` : "Select at least one time"}
                  </button>
                }
              >
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
                  <button onClick={() => quickPick((r) => hourOf(r) >= 18)} style={{ padding: "7px 12px", borderRadius: 9999, fontSize: 12, fontWeight: 600, fontFamily: FONT, background: C.surface, color: C.text, border: `1px solid ${C.border}`, cursor: "pointer" }}>+ All evenings</button>
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

        {invitation.status === "declined" && !cancelled && (
          <div style={{ padding: "10px 14px", borderRadius: 12, background: "#FEF2F2", textAlign: "center" }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#EF4444", fontFamily: FONT }}>
              Date declined
            </span>
          </div>
        )}

        {cancelled && (
          <>
            <div style={{ padding: "10px 14px", borderRadius: 12, background: "#FEF2F2", textAlign: "center", marginBottom: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#EF4444", fontFamily: FONT }}>
                {invitation.confirmed_time ? "Date cancelled" : "Plan withdrawn"}
              </span>
            </div>
            {isMale && onReschedule && (
              <button onClick={() => { track("date_reschedule_tapped"); onReschedule(); }} style={{ width: "100%", padding: "12px 0", borderRadius: 12, fontSize: 14, fontWeight: 600, fontFamily: FONT, background: C.text, color: "white", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <Calendar size={15} color="white" /> Reschedule
              </button>
            )}
            {!isMale && onAskReschedule && (
              <button onClick={async () => { track("date_reschedule_asked"); setSending(true); await onAskReschedule(); setSending(false); }} disabled={sending} style={{ width: "100%", padding: "12px 0", borderRadius: 12, fontSize: 14, fontWeight: 600, fontFamily: FONT, background: C.text, color: "white", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: sending ? 0.6 : 1 }}>
                <Calendar size={15} color="white" /> {sending ? "Sending…" : `Ask ${themName} to reschedule`}
              </button>
            )}
          </>
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
  // Opened from the rose popup: go straight into planning
  useEffect(() => {
    if (!state.openDateBuilder) return;
    dispatch({ type: "CLEAR_OPEN_DATE_BUILDER" });
    if (state.currentUser?.gender === "male") setShowDateBuilder(true);
  }, [state.openDateBuilder]);
  const [dateInvitations, setDateInvitations] = useState([]);
  const bottomRef = useRef(null);

  const currentUserId = state.currentUser?._id || state.currentUser?.id;
  const isMale = state.currentUser?.gender === "male";
  const conversation = state.conversations[match.id];
  const profile = match.profile;


  useEffect(() => {
    const refresh = () => {
      actions.loadMessages(match.id).catch(console.error);
      api.getDateInvitations(match.id).then(setDateInvitations).catch(console.error);
    };
    refresh();
    // New messages, reactions and date changes arrive live. Polling stays as a safety net and
    // slows down once a live event has proven that realtime is switched on.
    let live = false;
    let tick = 0;
    let debounce = 0;
    const poll = setInterval(() => {
      tick += 1;
      if (live && tick % 6 !== 0) return;
      refresh();
    }, 5000);
    const stopLive = api.subscribeLive(`chat-${match.id}`, [
      { table: "messages", filter: `match_id=eq.${match.id}` },
      { table: "date_invitations", filter: `match_id=eq.${match.id}` },
    ], () => { live = true; clearTimeout(debounce); debounce = setTimeout(refresh, 120); });
    return () => { clearInterval(poll); clearTimeout(debounce); stopLive(); };
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

  // The clock starts with the first real message, not with a like comment sent before the match
  const firstMessageTime = messages.find((msg) => !msg.isComment)?.timestamp ?? null;
  const FIVE_DAYS = 5 * 24 * 60 * 60 * 1000;
  const NUDGE_BONUS = 36 * 60 * 60 * 1000;
  const COOLDOWN_48H = 48 * 60 * 60 * 1000;
  const CALL_GRACE = 2 * 60 * 60 * 1000;
  const deadlinePaused = match.deadlinePaused;
  // A scheduled video call pauses the clock until two hours after the call; then five fresh days start
  const callAt = match.videoCallAt || null;
  const hasVideoCall = videoCallStarted || (!!callAt && Date.now() < callAt + CALL_GRACE);
  const timerStopped = deadlinePaused || hasVideoCall || !!confirmedDate || !!openInvite;

  // The most recent closed plan restarts the clock. A decline adds a 48h cooling-off period;
  // a cancellation gives five fresh days, so cancelling can never lock the chat on the spot.
  const lastClosed = dateInvitations
    .filter((inv) => inv.status === "declined")
    .sort((x, y) => new Date(y.created_at) - new Date(x.created_at))[0] || null;
  const lastClosedAt = lastClosed ? new Date(lastClosed.created_at).getTime() : null;
  const lastClosedCooldown = lastClosed && !api.isCancelledInvite(lastClosed) ? COOLDOWN_48H : 0;

  let deadlineMs = null;
  if (!timerStopped && firstMessageTime) {
    deadlineMs = firstMessageTime + FIVE_DAYS;
    if (lastClosedAt) deadlineMs = Math.max(deadlineMs, lastClosedAt + lastClosedCooldown + FIVE_DAYS);
    if (callAt && !hasVideoCall) deadlineMs = Math.max(deadlineMs, callAt + CALL_GRACE + FIVE_DAYS);
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
    const replyId = replyTo?.id || null;
    setText("");
    setReplyTo(null);
    try {
      await actions.sendMessage(match.id, msg, null, replyId);
    } catch (err) {
      console.error("Send failed:", err);
    }
  };

  // ── Photos and voice notes ──
  const [recording, setRecording] = useState(false);
  const [uploading, setUploading] = useState(null); // "image" | "audio" | null
  const [mediaError, setMediaError] = useState("");
  const [lightbox, setLightbox] = useState(null);
  const imageInputRef = useRef(null);

  const failMedia = (msg) => { setMediaError(msg); setTimeout(() => setMediaError(""), 4000); };

  // ── Replying to one specific message, photo or voice note ──
  const [replyTo, setReplyTo] = useState(null);   // the message being answered
  const [flashId, setFlashId] = useState(null);   // briefly highlights the original after tapping a quote
  const inputRef = useRef(null);
  const msgRefs = useRef({});
  // Like comments shown at the top of a chat are not real messages and cannot be quoted
  const canReply = (m) => !!m?.id && !String(m.id).startsWith("like-") && !String(m.id).startsWith("temp");
  const previewOf = (m) => (m.media?.type === "image" ? "Photo" : m.media?.type === "audio" ? "Voice note" : (m.text || "").replace(/^🕊️ /, ""));
  const startReply = (m) => {
    if (!canReply(m) || chatLocked) return;
    track("chat_reply_started", { media: m.media?.type || "text" });
    setReactFor(null);
    setReplyTo(m);
    setTimeout(() => inputRef.current?.focus(), 50);
  };
  const jumpTo = (id) => {
    msgRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "center" });
    setFlashId(id);
    setTimeout(() => setFlashId((cur) => (cur === id ? null : cur)), 1400);
  };
  const renderQuote = (item, onDark) => {
    if (!item.replyTo) return null;
    const orig = (conversation?.messages || []).find((m) => m.id === item.replyTo);
    const who = orig ? (orig.sender === currentUserId ? "You" : profile.name) : "Message";
    return (
      <button
        onClick={(e) => { e.stopPropagation(); if (orig) jumpTo(orig.id); }}
        style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left", padding: "6px 8px", marginBottom: 6, borderRadius: 10, border: "none", borderLeft: `3px solid ${onDark ? "#F5D878" : C.primary}`, background: onDark ? "rgba(255,255,255,0.14)" : C.surface, cursor: orig ? "pointer" : "default", fontFamily: FONT }}
      >
        {orig?.media?.type === "image" && <img src={orig.media.url} alt="" style={{ width: 34, height: 34, borderRadius: 6, objectFit: "cover", flexShrink: 0 }} />}
        <span style={{ minWidth: 0, flex: 1 }}>
          <span style={{ display: "block", fontSize: 11.5, fontWeight: 700, color: onDark ? "#F5D878" : C.primary }}>{who}</span>
          <span style={{ display: "block", fontSize: 13, color: onDark ? "rgba(255,255,255,0.85)" : C.sub, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{orig ? previewOf(orig) : "Original message not available"}</span>
        </span>
      </button>
    );
  };

  // ── Reactions on photos and voice notes ──
  const REACTIONS = ["❤️", "😂", "😮", "🙏", "👍"];
  const [reactFor, setReactFor] = useState(null); // id of the message whose picker is open
  const pressTimer = useRef(null);
  const pressHandlers = (id) => ({
    onContextMenu: (e) => { e.preventDefault(); setReactFor(id); },
    onTouchStart: () => { clearTimeout(pressTimer.current); pressTimer.current = setTimeout(() => setReactFor(id), 450); },
    onTouchEnd: () => clearTimeout(pressTimer.current),
    onTouchMove: () => clearTimeout(pressTimer.current),
  });
  const react = async (message, emoji) => {
    setReactFor(null);
    const mine = (message.reactions || {})[currentUserId];
    try {
      await actions.reactToMessage(match.id, message, mine === emoji ? "" : emoji);
    } catch (err) {
      console.error("Reaction failed:", err);
      failMedia(/react_to_message|function|schema cache|reactions/i.test(err.message || "") ? "Reactions isn't available right now. Please try again later." : "Couldn't save the reaction. Try again.");
    }
  };

  const sendImage = async (file) => {
    if (!file || chatLocked) return;
    setUploading("image");
    try {
      const blob = await prepareChatImage(file);
      const url = await api.uploadMedia(blob, "chat", "jpg", "image/jpeg");
      await actions.sendMessage(match.id, "📷 Photo", { type: "image", url }, replyTo?.id || null);
      setReplyTo(null);
      track("chat_photo_sent");
    } catch (err) {
      console.error("Photo send failed:", err);
      failMedia(/bucket|not found|storage/i.test(err.message || "") ? "Photos isn't available right now. Please try again later." : "Couldn't send the photo. Try again.");
    }
    setUploading(null);
  };

  const sendVoice = async ({ blob, mime, duration }) => {
    setUploading("audio");
    try {
      const url = await api.uploadMedia(blob, "voice", extForMime(mime), mime.split(";")[0]);
      await actions.sendMessage(match.id, "🎤 Voice note", { type: "audio", url, duration }, replyTo?.id || null);
      setReplyTo(null);
      track("chat_voice_sent", { duration });
      setRecording(false);
    } catch (err) {
      console.error("Voice send failed:", err);
      failMedia(/bucket|not found|storage/i.test(err.message || "") ? "Voice notes isn't available right now. Please try again later." : "Couldn't send the voice note. Try again.");
    }
    setUploading(null);
  };

  const handleNudge = async () => {
    track("rose_sent");
    setNudgeSending(true);
    try {
      await api.sendNudge(match.id);
      await actions.sendMessage(match.id, "🌹");
      setNudgeSent(true);
      notifyThem(`${myName} sent you a rose`, "She'd love to go on a date — you have 36 extra hours to plan one.", "rose");
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
      throw err;
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
      const inv = dateInvitations.find((x) => x.id === invId);
      const updated = await api.cancelDate(invId);
      setDateInvitations((prev) => prev.map((x) => (x.id === invId ? updated : x)));
      const wasConfirmed = inv?.status === "confirmed";
      const myName = state.currentUser?.name || "Your match";
      await actions.sendMessage(match.id, wasConfirmed ? "🗓️ Date cancelled" : "🗓️ Plan withdrawn");
      notifyThem(wasConfirmed ? `${myName} cancelled the date` : `${myName} withdrew the plan`, "Open the chat to talk about it.", "date-cancel");
      track(wasConfirmed ? "date_cancelled_confirmed" : "date_plan_withdrawn");
    } catch (err) {
      console.error("Cancel failed:", err);
    }
  };

  const formatTime = (ts) => new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  // Messages and date cards interleaved by time
  // After a cancellation the cancelled plan is shown as a card (with a way to reschedule) until a new plan exists
  const newestInvite = dateInvitations.length ? dateInvitations.reduce((a, b) => (new Date(b.created_at) > new Date(a.created_at) ? b : a)) : null;
  const lastCancelled = !confirmedDate && !openInvite && newestInvite && api.isCancelledInvite(newestInvite) ? newestInvite : null;

  const timeline = useMemo(() => {
    const items = messages.map((m) => ({ ...m, _type: "message" }));
    for (const inv of [confirmedDate, openInvite]) {
      if (inv) items.push({ ...inv, _type: "date", timestamp: new Date(inv.created_at).getTime() });
    }
    if (lastCancelled) {
      // Place it right after the "cancelled" line in the chat, or at its creation time if that line is missing
      const note = [...messages].reverse().find((m) => typeof m.text === "string" && m.text.startsWith("🗓️"));
      const ts = Math.max(new Date(lastCancelled.created_at).getTime(), note ? (note.timestamp || 0) + 1 : 0);
      items.push({ ...lastCancelled, _type: "date", timestamp: ts });
    }
    return items.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
  }, [messages, confirmedDate, openInvite, lastCancelled]);

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
    onReschedule: () => setShowDateBuilder(true),
    onAskReschedule: async () => {
      try {
        await actions.sendMessage(match.id, "🗓️ Can we find a new time?");
        notifyThem(`${state.currentUser?.name || "Your match"} would like to reschedule`, "Open the chat to plan a new date.", "date");
      } catch (err) {
        console.error("Ask to reschedule failed:", err);
      }
    },
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
        if (chatLocked) { status = "Chat closed · no date was planned in time"; statusColor = "#B91C1C"; }
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
              <p style={{ fontWeight: 600, fontSize: 17, lineHeight: 1.15, color: C.text, fontFamily: SERIF, margin: 0, display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{profile.name}</span>
                {profile.isVerified && <VerifiedBadge size={18} />}
              </p>
              <p style={{ fontSize: 12, color: statusColor, fontFamily: FONT, margin: "2px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{status}</p>
            </div>
            <CompatibilityRing profile={profile} size={36} style={{ marginRight: 4 }} />
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
          const isDateNote = item.text?.startsWith("🗓️");
          if (isRose || isVideoNote || isDateNote) {
            const label = isRose
              ? `${isMe ? "You" : profile.name} sent a rose`
              : isDateNote
                ? `${isMe ? "You" : profile.name} ${item.text.includes("cancelled") ? "cancelled the date" : "withdrew the plan"}`
                : item.text.replace(/^📹\s*/, "").replace("Video call scheduled:", "Video call ·");
            return (
              <div key={item.id}>
                {divider}
                <div style={{ display: "flex", justifyContent: "center", margin: "6px 0 12px" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 9999, background: C.card, border: `1px solid ${C.border}`, fontSize: 12, fontWeight: 500, color: C.sub, fontFamily: FONT }}>
                    {isRose ? <Flower2 size={13} color={C.primary} strokeWidth={1.8} /> : isDateNote ? <Calendar size={13} color={C.sub} strokeWidth={1.8} /> : <Video size={13} color={C.sub} strokeWidth={1.8} />}
                    {label}
                  </span>
                </div>
              </div>
            );
          }

          return (
            <div key={item.id} ref={(el) => { msgRefs.current[item.id] = el; }} style={{ borderRadius: 14, background: flashId === item.id ? C.primarySoft : "transparent", transition: "background 0.4s" }}>
              {divider}
              <div style={{ display: "flex", flexDirection: "column", alignItems: isMe ? "flex-end" : "flex-start", marginBottom: endOfRun ? 10 : 2 }}>
                {isDoveMsg && (
                  <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 4 }}>
                    <DoveIcon size={12} color={C.primary} strokeWidth={2.2} />
                    <span style={{ fontSize: 11, fontWeight: 600, color: C.primary, fontFamily: FONT, letterSpacing: "0.02em" }}>Sent with a Dove</span>
                  </div>
                )}
                {item.media?.type === "image" || item.media?.type === "audio" ? (() => {
                  const reactions = item.reactions || {};
                  const mine = reactions[currentUserId];
                  const shown = Object.values(reactions);
                  const counts = shown.reduce((acc, e) => { acc[e] = (acc[e] || 0) + 1; return acc; }, {});
                  const open = reactFor === item.id;
                  const isImage = item.media.type === "image";
                  return (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexDirection: isMe ? "row-reverse" : "row", width: "100%", marginBottom: shown.length ? 14 : 0 }}>
                      <div style={{ position: "relative", ...(isImage ? { maxWidth: "70%" } : { width: "min(78%, 300px)" }) }} {...pressHandlers(item.id)}>
                        {renderQuote(item, false)}
                        {isImage ? (
                          <button onClick={() => setLightbox(item.media.url)} aria-label="Open photo" style={{ width: "100%", padding: 0, border: `1px solid ${C.border}`, borderRadius: 18, borderBottomRightRadius: isMe ? 5 : 18, borderBottomLeftRadius: isMe ? 18 : 5, overflow: "hidden", background: C.surface, cursor: "pointer", display: "block", WebkitTouchCallout: "none", userSelect: "none" }}>
                            <img src={item.media.url} alt="Photo" loading="lazy" draggable={false} style={{ display: "block", width: "100%", maxHeight: 320, objectFit: "cover" }} />
                          </button>
                        ) : (
                          <div style={{ padding: "8px 12px", borderRadius: 18, borderBottomRightRadius: isMe ? 5 : 18, borderBottomLeftRadius: isMe ? 18 : 5, background: isMe ? C.text : C.bg, border: isMe ? "1px solid " + C.text : `1px solid ${C.border}` }}>
                            <AudioPlayer src={item.media.url} duration={item.media.duration} dark={isMe} compact />
                          </div>
                        )}

                        {shown.length > 0 && (
                          <button
                            onClick={() => setReactFor(open ? null : item.id)}
                            aria-label="Reactions"
                            style={{ position: "absolute", bottom: -13, [isMe ? "left" : "right"]: 10, display: "flex", alignItems: "center", gap: 4, padding: "2px 7px", borderRadius: 999, background: C.bg, border: `1px solid ${mine ? C.primary : C.border}`, boxShadow: "0 1px 4px rgba(0,0,0,0.08)", cursor: "pointer", fontSize: 14, lineHeight: 1.3, fontFamily: FONT }}
                          >
                            {Object.entries(counts).map(([e, n]) => (
                              <span key={e}>{e}{n > 1 && <span style={{ fontSize: 11, fontWeight: 600, color: C.sub, marginLeft: 2 }}>{n}</span>}</span>
                            ))}
                          </button>
                        )}

                        {open && (
                          <>
                            <div onClick={() => setReactFor(null)} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
                            <div role="menu" aria-label="Pick a reaction" style={{ position: "absolute", bottom: "calc(100% + 6px)", [isMe ? "right" : "left"]: 0, zIndex: 41, display: "flex", gap: 2, padding: "5px 6px", borderRadius: 999, background: C.bg, border: `1px solid ${C.border}`, boxShadow: "0 8px 24px rgba(0,0,0,0.16)" }}>
                              {REACTIONS.map((e) => (
                                <button key={e} onClick={() => react(item, e)} aria-label={`React ${e}`} style={{ width: 38, height: 38, borderRadius: 19, border: "none", background: mine === e ? C.primarySoft : "transparent", fontSize: 21, lineHeight: 1, cursor: "pointer", padding: 0 }}>{e}</button>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
                        <button onClick={() => setReactFor(open ? null : item.id)} aria-label="Add a reaction" style={{ width: 30, height: 30, borderRadius: 15, border: "none", background: C.surface, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                          <SmilePlus size={15} color={C.sub} strokeWidth={1.8} />
                        </button>
                        {canReply(item) && (
                          <button onClick={() => startReply(item)} aria-label="Reply" style={{ width: 30, height: 30, borderRadius: 15, border: "none", background: C.surface, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                            <Reply size={15} color={C.sub} strokeWidth={1.8} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })() : (
                <div
                  onClick={() => startReply(item)}
                  title={canReply(item) ? "Tap to reply" : undefined}
                  style={{
                    maxWidth: "78%",
                    padding: "10px 14px",
                    borderRadius: 18,
                    borderBottomRightRadius: isMe ? 5 : 18,
                    borderBottomLeftRadius: isMe ? 18 : 5,
                    background: isMe ? C.text : C.bg,
                    color: isMe ? "#fff" : C.text,
                    border: isMe ? "1px solid " + C.text : `1px solid ${isDoveMsg ? C.primary : C.border}`,
                    cursor: canReply(item) && !chatLocked ? "pointer" : "default",
                    outline: replyTo?.id === item.id ? `2px solid ${C.primary}` : "none",
                    outlineOffset: 2,
                  }}
                >
                  {renderQuote(item, isMe)}
                  <p style={{ fontSize: 15, lineHeight: 1.45, fontFamily: FONT, margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{displayText}</p>
                </div>
                )}
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
              {myRating.showed_up ? "Counted towards their reliability score. Keep chatting — the next date can follow." : "It now shows on their profile. You can unmatch below."}
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              {myRating.showed_up && isMale && !openInvite && (
                <button onClick={() => { track("plan_date_tapped", { again: true }); setShowDateBuilder(true); }} style={{ flex: 1, padding: "11px 0", borderRadius: 12, fontSize: 13.5, fontWeight: 600, fontFamily: FONT, background: C.text, color: "#fff", border: "none", cursor: "pointer" }}>
                  Plan another date
                </button>
              )}
              <button onClick={() => setShowReportMenu(true)} style={{ flex: 1, padding: "11px 0", borderRadius: 12, fontSize: 13.5, fontWeight: 600, fontFamily: FONT, background: C.bg, color: C.sub, border: `1px solid ${C.border}`, cursor: "pointer" }}>
                {"Unmatch, report or block"}
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
            <p style={{ fontSize: 13, color: C.sub, fontFamily: FONT, margin: 0 }}>This chat has closed · no date was planned in time</p>
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
                <p style={{ fontSize: 12, color: C.sub, fontFamily: FONT, margin: "0 0 12px" }}>Pick a day and time. The planning clock pauses until after the call.</p>
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
                  <Calendar size={14} color="#fff" strokeWidth={1.8} /> {lastCancelled ? "Reschedule" : lastDeclined ? "Plan another date" : "Plan a date"}
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
                <button onClick={() => { track("video_call_joined"); window.open(`https://meet.ffmuc.net/agape-${match.id}`, "_blank"); }} style={chip()}>
                  <Video size={14} color="#15803D" strokeWidth={1.8} /> Join video call
                </button>
              )}
            </div>

            {mediaError && <p style={{ fontSize: 12, color: "#EF4444", fontFamily: FONT, margin: "0 0 6px 4px" }}>{mediaError}</p>}
            {replyTo && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", marginBottom: 8, borderRadius: 12, background: C.surface, borderLeft: `3px solid ${C.primary}` }}>
                {replyTo.media?.type === "image" && <img src={replyTo.media.url} alt="" style={{ width: 36, height: 36, borderRadius: 6, objectFit: "cover", flexShrink: 0 }} />}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: C.primary, fontFamily: FONT, margin: 0 }}>Replying to {replyTo.sender === currentUserId ? "your message" : profile.name}</p>
                  <p style={{ fontSize: 13, color: C.sub, fontFamily: FONT, margin: "1px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{previewOf(replyTo)}</p>
                </div>
                <button onClick={() => setReplyTo(null)} aria-label="Cancel reply" style={{ width: 28, height: 28, borderRadius: 14, border: "none", background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
                  <X size={16} color={C.sub} />
                </button>
              </div>
            )}
            {recording ? (
              <VoiceRecorder autoStart maxSeconds={60} confirmLabel="Send" busy={uploading === "audio"} onDone={sendVoice} onCancel={() => setRecording(false)} />
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input ref={imageInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; sendImage(f); }} />
                <button
                  onClick={() => imageInputRef.current?.click()}
                  disabled={!!uploading}
                  aria-label="Send a photo"
                  style={{ width: 40, height: 40, borderRadius: 20, display: "flex", alignItems: "center", justifyContent: "center", background: "transparent", border: "none", cursor: "pointer", flexShrink: 0, opacity: uploading === "image" ? 0.5 : 1 }}
                >
                  <ImageIcon size={21} color={C.sub} strokeWidth={1.8} />
                </button>
                <input
                  ref={inputRef}
                  style={{ flex: 1, fontSize: 15, padding: "11px 16px", borderRadius: 22, background: C.bg, border: `1px solid ${C.border}`, outline: "none", color: C.text, fontFamily: FONT, minWidth: 0 }}
                  placeholder={uploading === "image" ? "Sending photo…" : replyTo ? "Write a reply" : "Message"}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && send()}
                />
                {text.trim() ? (
                  <button
                    onClick={send}
                    aria-label="Send"
                    style={{ width: 40, height: 40, borderRadius: 20, display: "flex", alignItems: "center", justifyContent: "center", background: C.text, border: "none", cursor: "pointer", flexShrink: 0 }}
                  >
                    <ArrowUp size={18} color="#fff" strokeWidth={2} />
                  </button>
                ) : (
                  <button
                    onClick={() => { if (!isRecordingSupported()) { failMedia("Voice notes aren't supported in this browser."); return; } setRecording(true); }}
                    disabled={!!uploading}
                    aria-label="Record a voice note"
                    style={{ width: 40, height: 40, borderRadius: 20, display: "flex", alignItems: "center", justifyContent: "center", background: C.surface, border: "none", cursor: "pointer", flexShrink: 0 }}
                  >
                    <Mic size={19} color={C.text} strokeWidth={1.8} />
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <TutorialOverlay screen="chat" />

      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{ position: "fixed", inset: 0, zIndex: 10001, background: "rgba(0,0,0,0.94)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <button onClick={() => setLightbox(null)} aria-label="Close" style={{ position: "absolute", top: "calc(env(safe-area-inset-top, 0px) + 14px)", right: 14, width: 40, height: 40, borderRadius: 20, background: "rgba(255,255,255,0.15)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <X size={20} color="#fff" />
          </button>
          <img src={lightbox} alt="Photo" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
        </div>
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
                <p style={{ fontSize: 17, fontWeight: 600, color: C.text, fontFamily: SERIF, textAlign: "center", marginBottom: 16 }}>{profile.name}</p>
                {[
                  { icon: <Flag size={18} strokeWidth={1.8} color="#EF4444" />, label: "Report", desc: "Flag inappropriate behaviour", color: "#EF4444", action: async () => { track("profile_reported", { source: "chat" }); try { await actions.reportProfile(profile, "Inappropriate behaviour", "chat"); setReportDone("report"); } catch (err) { setMediaError(err.message); setShowReportMenu(false); } } },
                  { icon: <Ban size={18} strokeWidth={1.8} color="#EF4444" />, label: "Block", desc: "They won't be able to see you", color: "#EF4444", action: async () => { track("profile_blocked", { source: "chat" }); setShowReportMenu(false); setBlockFlash(true); try { await actions.blockProfile(profile); await actions.unmatch(match.id); } catch (err) { console.error("Block failed:", err); } setTimeout(() => { setBlockFlash(false); setShowReportMenu(true); setReportDone("block"); }, 1500); } },
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
                <span style={{ color: "white", fontSize: 28, fontWeight: 600, fontFamily: SERIF }}>{profile.name}</span>
                <span style={{ color: "rgba(255,255,255,0.8)", fontSize: 22, fontWeight: 300 }}>{profile.age}</span>
                {profile.isVerified && <VerifiedBadge size={20} label />}
                <CompatibilityRing profile={profile} size={44} light style={{ marginLeft: "auto" }} />
              </div>
              <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, marginTop: 4 }}>{profile.denomination}{profile.location ? ` · ${profile.location}` : ""}</p>
              {profile.reliability?.dates > 0 && <div style={{ marginTop: 8 }}><ReliabilityBadge reliability={profile.reliability} light /></div>}
            </div>
          </div>
          <div style={{ padding: "20px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
            {(profile.prompts || []).filter((p) => p.prompt && (p.answer || p.voice?.url)).map((p, i) => (
              <div key={i} style={{ borderRadius: 16, overflow: "hidden", background: C.primarySoft }}>
                <div style={{ display: "flex" }}>
                  <div style={{ width: 4, flexShrink: 0, background: C.primary }} />
                  <div style={{ flex: 1, padding: "14px" }}>
                    <p style={{ fontSize: 10, fontWeight: 600, color: C.primary, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>{p.prompt}</p>
                    {p.answer && <p style={{ fontSize: 16, fontWeight: 600, color: C.text, marginBottom: p.voice?.url ? 10 : 0 }}>{p.answer}</p>}
                    {p.voice?.url && <AudioPlayer src={p.voice.url} duration={p.voice.duration} compact />}
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
  const { state, actions, dispatch } = useApp();
  const [activeChat, setActiveChat] = useState(null);

  // Opened from a rose pop-up or a notification
  useEffect(() => {
    if (state.openChatId) {
      setActiveChat(state.openChatId);
      dispatch({ type: "CLEAR_OPEN_CHAT" });
    }
  }, [state.openChatId, dispatch]);

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
                  {api.isOnline(profile.lastActive) && <div title="Online now" style={{ position: "absolute", bottom: 4, right: 4, width: 14, height: 14, borderRadius: "50%", background: "#22C55E", border: `2.5px solid ${hasUnread ? C.primarySoft : C.bg}` }} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <span style={{ display: "flex", alignItems: "baseline", gap: 8, minWidth: 0, overflow: "hidden" }}>
                      <span style={{ fontWeight: hasUnread ? 700 : 600, fontSize: 19, color: C.text, fontFamily: SERIF, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flexShrink: 0, maxWidth: "62%" }}>{profile.name}</span>
                      {profile.isVerified && <VerifiedBadge size={19} style={{ marginLeft: -3 }} />}
                      {profile.denomination && <span style={{ fontSize: 12, color: C.primary, fontWeight: 600, fontFamily: FONT, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0, flexShrink: 1 }}>· {profile.denomination}</span>}
                    </span>
                    <span style={{ fontSize: 11, color: hasUnread ? C.primary : C.sub, fontWeight: hasUnread ? 700 : 400, fontFamily: FONT, flexShrink: 0, marginLeft: 8 }}>{lastMsg ? formatTime(lastMsg.timestamp) : ""}</span>
                  </div>
                  <p style={{ fontSize: 14, color: hasUnread ? C.text : C.sub, fontWeight: hasUnread ? 700 : 400, fontFamily: FONT, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis", margin: 0 }}>
                    {lastMsg?.isComment
                      ? (lastMsg.sender === currentUserId
                          ? `You commented on their ${lastMsg.targetType === "photo" ? "photo" : lastMsg.targetType === "prompt" ? "prompt" : "profile"}`
                          : `${profile.name} commented on your ${lastMsg.targetType === "photo" ? "photo" : lastMsg.targetType === "prompt" ? "prompt" : "profile"} · unlocks after your date`)
                      : lastMsg
                      ? (() => {
                          const who = lastMsg.sender === currentUserId ? "You" : profile.name;
                          const t = lastMsg.text || "";
                          if (t.trim() === "🌹") return `${who} sent a rose`;
                          if (t.startsWith("📹")) return t.replace(/^📹\s*/, "").replace("Video call scheduled:", "Video call ·");
                          if (t.startsWith("🗓️")) return `${who} ${t.includes("cancelled") ? "cancelled the date" : t.includes("new time") ? "asked to reschedule" : "withdrew the plan"}`;
                          return (lastMsg.sender === currentUserId ? "You: " : "") + t.slice(0, 35) + (t.length > 35 ? "…" : "");
                        })()
                      : "New match · say hello"}
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






