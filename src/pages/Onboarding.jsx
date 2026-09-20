import { useState, useEffect, useRef, useCallback } from "react";
import { useApp } from "../context/AppContext";
import { PROMPT_CATEGORIES, TRAITS_POOL, LOOKING_FOR_POOL, DENOMINATIONS } from "../data/profiles";
import { ChevronRight, ChevronLeft, Sparkles, Church, X, Check, Plus, Camera, ZoomIn, ZoomOut } from "lucide-react";
import AgapeCross from "../components/AgapeCross";
import LocationPicker from "../components/LocationPicker";
import { track } from "../services/posthog";

const STEPS = [
  "welcome",
  "phone",
  "verify",
  "password",
  "consent",
  "name",
  "birthday",
  "gender",
  "denomination",
  "email",
  "location",
  "distance",
  "whoAreYou",
  "traits",
  "photos",
  "prompt_faith",
  "prompt_future",
  "prompt_aboutme",
  "lifestyle",
];

const PROMPT_STEP_MAP = {
  prompt_faith: { category: "Faith", label: "Faith" },
  prompt_future: { category: "Future", label: "Future" },
  prompt_aboutme: { category: "About Me", label: "About Me" },
};

const COUNTRY_CODES = [
  { code: "+48", flag: "🇵🇱", name: "Poland" },
  { code: "+41", flag: "🇨🇭", name: "Switzerland" },
  { code: "+49", flag: "🇩🇪", name: "Germany" },
  { code: "+43", flag: "🇦🇹", name: "Austria" },
  { code: "+44", flag: "🇬🇧", name: "UK" },
  { code: "+33", flag: "🇫🇷", name: "France" },
  { code: "+39", flag: "🇮🇹", name: "Italy" },
  { code: "+34", flag: "🇪🇸", name: "Spain" },
  { code: "+1", flag: "🇺🇸", name: "USA" },
  { code: "+31", flag: "🇳🇱", name: "Netherlands" },
  { code: "+46", flag: "🇸🇪", name: "Sweden" },
  { code: "+47", flag: "🇳🇴", name: "Norway" },
  { code: "+45", flag: "🇩🇰", name: "Denmark" },
  { code: "+351", flag: "🇵🇹", name: "Portugal" },
  { code: "+420", flag: "🇨🇿", name: "Czechia" },
  { code: "+36", flag: "🇭🇺", name: "Hungary" },
  { code: "+40", flag: "🇷🇴", name: "Romania" },
  { code: "+359", flag: "🇧🇬", name: "Bulgaria" },
  { code: "+385", flag: "🇭🇷", name: "Croatia" },
  { code: "+421", flag: "🇸🇰", name: "Slovakia" },
  { code: "+386", flag: "🇸🇮", name: "Slovenia" },
  { code: "+370", flag: "🇱🇹", name: "Lithuania" },
  { code: "+371", flag: "🇱🇻", name: "Latvia" },
  { code: "+372", flag: "🇪🇪", name: "Estonia" },
];

const LIFESTYLE_CATEGORIES = [
  {
    label: "Exercise",
    options: ["Daily", "Almost daily", "Sometimes", "Never"],
  },
  {
    label: "Drinking",
    options: ["Not for me", "Sober curious", "On special occasions", "Socially", "Most nights"],
  },
  {
    label: "Smoking",
    options: ["Non-smoker", "Social smoker", "Smoker when drinking", "Smoker"],
  },
  {
    label: "Pets",
    options: ["Dog", "Cat", "Fish", "Bird", "Hamster", "Reptile", "Don't have but love", "Allergic", "Other", "Pet-free"],
  },
];

const DEV_TEST = false;

const S = {
  bg: "#1A1612",
  card: "#252118",
  surface: "#2E281F",
  primary: "#B8912A",
  primarySoft: "rgba(184,145,42,0.15)",
  text: "#F5F0E8",
  sub: "#A39888",
  border: "#3D362B",
  white: "#FFFFFF",
};

const Wrap = ({ children, showBack = true, showProgress = true, step, goBack, progress }) => (
  <div style={{ minHeight: "100vh", background: S.bg, display: "flex", flexDirection: "column", maxWidth: 430, margin: "0 auto" }}>
    <div style={{ padding: "max(12px, env(safe-area-inset-top, 12px)) 20px 0", display: "flex", alignItems: "center", gap: 12 }}>
      {showBack && step > 0 ? (
        <button onClick={goBack} style={{ background: "none", border: "none", color: S.sub, padding: 4, cursor: "pointer" }}>
          <ChevronLeft size={24} />
        </button>
      ) : <div style={{ width: 32 }} />}
      {showProgress && (
        <div style={{ flex: 1, height: 3, background: S.border, borderRadius: 2 }}>
          <div style={{ height: "100%", width: `${progress}%`, background: S.primary, borderRadius: 2, transition: "width 0.4s ease" }} />
        </div>
      )}
      <div style={{ width: 32 }} />
    </div>
    <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "24px 24px 32px" }}>
      {children}
    </div>
  </div>
);

const BigBtn = ({ onClick, disabled, children, style }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    style={{
      width: "100%", padding: "16px", background: S.primary, color: "#000", borderRadius: 999,
      fontSize: 16, fontWeight: 700, border: "none", cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.4 : 1, marginTop: "auto", letterSpacing: 0.2,
      fontFamily: "'Outfit', system-ui, sans-serif", ...style,
    }}
  >
    {children}
  </button>
);

export default function Onboarding() {
  const { actions } = useApp();
  const [step, setStep] = useState(0);
  const [mode, setMode] = useState("signup");
  const [countryCode, setCountryCode] = useState("+48");
  const [phoneNum, setPhoneNum] = useState("");
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [otpDigits, setOtpDigits] = useState(["", "", "", "", "", ""]);
  const [otpError, setOtpError] = useState("");
  const [signupError, setSignupError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [loginPhone, setLoginPhone] = useState("+48");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [faithConsent, setFaithConsent] = useState(false);
  const [customDenom, setCustomDenom] = useState("");
  const [showNameConfirm, setShowNameConfirm] = useState(false);
  const [promptSelections, setPromptSelections] = useState({
    Faith: { prompt: "", answer: "" },
    Future: { prompt: "", answer: "" },
    "About Me": { prompt: "", answer: "" },
  });
  const [editingAnswer, setEditingAnswer] = useState(false);
  const [form, setForm] = useState({
    name: "",
    birthDay: "",
    birthMonth: "",
    birthYear: "",
    gender: "",
    denomination: "",
    email: "",
    job: "",
    school: "",
    location: "",
    locationLat: null,
    locationLng: null,
    traits: [],
    whoAreYou: [],
    maxDistance: 30,
    photos: [null, null, null, null, null, null],
    lifestyle: {},
  });

  const inputRef = useRef(null);
  const answerRef = useRef(null);
  const otpRefs = useRef([]);
  const photoInputRef = useRef(null);
  const [photoSlotIndex, setPhotoSlotIndex] = useState(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState("");
  const [cropImage, setCropImage] = useState(null);
  const [cropScale, setCropScale] = useState(1);
  const [cropOffset, setCropOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const cropCanvasRef = useRef(null);

  const currentStep = STEPS[step];
  const phone = countryCode + phoneNum;

  const calcAge = () => {
    const { birthDay, birthMonth, birthYear } = form;
    if (!birthDay || !birthMonth || !birthYear || birthYear.length < 4) return null;
    const d = parseInt(birthDay), m = parseInt(birthMonth), y = parseInt(birthYear);
    const today = new Date();
    let age = today.getFullYear() - y;
    if (today.getMonth() + 1 < m || (today.getMonth() + 1 === m && today.getDate() < d)) age--;
    return age;
  };

  useEffect(() => {
    setTimeout(() => {
      if (inputRef.current) { inputRef.current.focus(); return; }
      document.getElementById("ob-pw1")?.focus();
    }, 150);
  }, [step]);

  const goNext = () => {
    if (step < STEPS.length - 1) {
      track("onboarding_step_completed", { step: STEPS[step], stepNumber: step });
      setStep(step + 1);
      setEditingAnswer(false);
    } else {
      finishOnboarding();
    }
  };

  const goBack = () => {
    if (step > 0) setStep(step - 1);
  };

  const handleSendOtp = async () => {
    setSubmitting(true);
    setOtpError("");
    try {
      await actions.sendOtp(phone);
      goNext();
    } catch (err) {
      setOtpError(err.message);
    }
    setSubmitting(false);
  };

  const handleVerifyOtp = async (code) => {
    const codeToVerify = code || otpDigits.join("");
    if (codeToVerify.length !== 6) return;
    setSubmitting(true);
    setOtpError("");
    try {
      const { isNewUser } = await actions.verifyOtp(phone, codeToVerify);
      if (!isNewUser) return;
      goNext();
    } catch (err) {
      setOtpError(err.message);
    }
    setSubmitting(false);
  };

  const handleOtpDigitChange = (index, value) => {
    if (value.length > 1) value = value.slice(-1);
    if (value && !/\d/.test(value)) return;
    const next = [...otpDigits];
    next[index] = value;
    setOtpDigits(next);
    if (value && index < 5) {
      setTimeout(() => otpRefs.current[index + 1]?.focus(), 0);
    }
    if (next.every(d => d !== "")) handleVerifyOtp(next.join(""));
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === "Backspace" && !otpDigits[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleSetPassword = async () => {
    if (password.length < 6) { setPasswordError("Password must be at least 6 characters"); return; }
    if (password !== passwordConfirm) { setPasswordError("Passwords don't match"); return; }
    setSubmitting(true);
    setPasswordError("");
    try {
      await actions.setPassword(password);
      track("password_set");
      goNext();
    } catch (err) {
      track("password_set_failed", { error: err.message });
      setPasswordError(err.message);
    }
    setSubmitting(false);
  };

  useEffect(() => {
    if (currentStep !== "verify" || !("OTPCredential" in window)) return;
    const ac = new AbortController();
    navigator.credentials.get({ otp: { transport: ["sms"] }, signal: ac.signal })
      .then((otp) => {
        if (otp?.code) {
          const digits = otp.code.split("");
          setOtpDigits(digits);
          handleVerifyOtp(otp.code);
        }
      })
      .catch(() => {});
    return () => ac.abort();
  }, [currentStep]);

  const handlePhotoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file || photoSlotIndex === null) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setCropImage(ev.target.result);
      setCropScale(1);
      setCropOffset({ x: 0, y: 0 });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const openCropForExisting = (index) => {
    setPhotoSlotIndex(index);
    setCropImage(form.photos[index]);
    setCropScale(1);
    setCropOffset({ x: 0, y: 0 });
  };

  const confirmCrop = () => {
    const canvas = document.createElement("canvas");
    const size = 600;
    canvas.width = size;
    canvas.height = size * (4 / 3);
    const ctx = canvas.getContext("2d");
    const img = new Image();
    img.onload = () => {
      const aspect = img.width / img.height;
      const targetAspect = 3 / 4;
      let drawW, drawH;
      if (aspect > targetAspect) {
        drawH = canvas.height * cropScale;
        drawW = drawH * aspect;
      } else {
        drawW = canvas.width * cropScale;
        drawH = drawW / aspect;
      }
      const dx = (canvas.width - drawW) / 2 + cropOffset.x * (drawW / canvas.width);
      const dy = (canvas.height - drawH) / 2 + cropOffset.y * (drawH / canvas.height);
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, dx, dy, drawW, drawH);
      const next = [...form.photos];
      next[photoSlotIndex] = canvas.toDataURL("image/jpeg", 0.85);
      setForm({ ...form, photos: next });
      setCropImage(null);
    };
    img.src = cropImage;
  };

  const finishOnboarding = async () => {
    setSubmitting(true);
    setSignupError("");
    if (DEV_TEST) { console.log("DEV_TEST: would register", form); setSubmitting(false); alert("Onboarding complete! (dev test mode — no API call)"); return; }
    try {
      const prompts = Object.values(promptSelections).filter(p => p.prompt && p.answer);
      const age = calcAge() || 25;

      await actions.register({
        phone,
        name: form.name,
        age,
        gender: form.gender,
        denomination: form.denomination,
        email: form.email || null,
      });

      await actions.updateProfile({
        job: form.job || undefined,
        school: form.school || undefined,
        location: form.locationLat
          ? { type: "Point", coordinates: [form.locationLng, form.locationLat], city: form.location }
          : form.location
          ? { type: "Point", coordinates: [8.65, 47.02], city: form.location }
          : undefined,
        photos: form.photos.filter(Boolean),
        prompts,
        interests: form.traits,
        traits: form.traits,
        whoAreYou: form.whoAreYou,
        lookingFor: [],
        filters: {
          maxAge: 35,
          minAge: 18,
          maxDistance: form.maxDistance,
        },
        lifestyle: form.lifestyle,
      });
    } catch (err) {
      setSignupError(err.message);
      setSubmitting(false);
    }
  };

  const handleLoginSubmit = async () => {
    if (loginPhone.length < 10 || loginPassword.length < 6) return;
    track("login_attempted");
    setSubmitting(true);
    setLoginError("");
    try {
      await actions.loginWithPhone(loginPhone, loginPassword);
      track("login_success", { method: "phone" });
    } catch (err) {
      track("login_failed", { error: err.message });
      setLoginError(err.message);
    }
    setSubmitting(false);
  };

  const selectGender = (g) => {
    track("onboarding_gender_selected", { gender: g });
    setForm({ ...form, gender: g });
    setTimeout(goNext, 300);
  };

  const selectDenomination = (d) => {
    if (d === "Different") return;
    track("onboarding_denomination_selected", { denomination: d });
    setForm({ ...form, denomination: d });
    setTimeout(goNext, 300);
  };

  const toggleTrait = (trait, field) => {
    const adding = !form[field].includes(trait);
    if (adding) track("onboarding_trait_selected", { trait, field });
    setForm((prev) => ({
      ...prev,
      [field]: prev[field].includes(trait)
        ? prev[field].filter((t) => t !== trait)
        : prev[field].length < 8
        ? [...prev[field], trait]
        : prev[field],
    }));
  };

  const isPromptStep = currentStep?.startsWith("prompt_");
  const promptStepInfo = isPromptStep ? PROMPT_STEP_MAP[currentStep] : null;
  const currentPromptSelection = promptStepInfo ? promptSelections[promptStepInfo.category] : null;

  const canProceed = () => {
    switch (currentStep) {
      case "welcome": return true;
      case "consent": return faithConsent;

      case "name": return form.name.trim().length > 0;
      case "phone": return phoneNum.length >= 7;
      case "verify": return otpDigits.every(d => d !== "");
      case "password": return password.length >= 6 && password === passwordConfirm;
      case "birthday": {
        const age = calcAge();
        return age !== null && age >= 18 && age < 120;
      }
      case "gender": return form.gender !== "";
      case "denomination": return form.denomination !== "";
      case "email": return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email);
      case "location": return form.location.trim().length > 0;
      case "distance": return true;
      case "prompt_faith":
      case "prompt_future":
      case "prompt_aboutme": {
        const sel = promptSelections[promptStepInfo.category];
        return sel.prompt && sel.answer.trim().length > 0;
      }
      case "traits": return form.traits.length >= 3;
      case "whoAreYou": return form.whoAreYou.length >= 3;
      case "photos": return form.photos.filter(Boolean).length >= 1;
      case "lifestyle": return true;
      default: return true;
    }
  };

  const selectPromptForStep = (promptText) => {
    track("onboarding_prompt_selected", { category: promptStepInfo.category, prompt: promptText });
    const cat = promptStepInfo.category;
    setPromptSelections((prev) => ({
      ...prev,
      [cat]: { prompt: promptText, answer: prev[cat].answer },
    }));
    setEditingAnswer(true);
    setTimeout(() => answerRef.current?.focus(), 100);
  };

  const updatePromptAnswer = (value) => {
    const cat = promptStepInfo.category;
    setPromptSelections((prev) => ({
      ...prev,
      [cat]: { ...prev[cat], answer: value },
    }));
  };

  const clearPromptForStep = () => {
    const cat = promptStepInfo.category;
    setPromptSelections((prev) => ({
      ...prev,
      [cat]: { prompt: "", answer: "" },
    }));
    setEditingAnswer(false);
  };

  const progress = ((step) / (STEPS.length - 1)) * 100;

  const selectedCountry = COUNTRY_CODES.find(c => c.code === countryCode) || COUNTRY_CODES[0];

  const wrapProps = { step, goBack, progress };

  // ---- LOGIN ----
  if (mode === "login") {
    return (
      <div style={{ minHeight: "100vh", background: S.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px 28px", maxWidth: 430, margin: "0 auto" }}>
        <AgapeCross size={48} strokeWidth={1.2} style={{ color: S.primary }} />
        <h2 style={{ color: S.text, fontSize: 28, fontWeight: 800, marginTop: 20, marginBottom: 4, fontFamily: "'Outfit', system-ui, sans-serif" }}>Welcome back</h2>
        <p style={{ color: S.sub, fontSize: 14, marginBottom: 28 }}>Sign in with your phone and password</p>
        <input
          type="tel" value={loginPhone} onChange={(e) => setLoginPhone(e.target.value)}
          placeholder="+48 123 456 789"
          style={{ width: "100%", padding: "16px", background: S.surface, border: `1.5px solid ${S.border}`, borderRadius: 12, fontSize: 18, color: S.text, outline: "none", fontFamily: "'Outfit', system-ui, sans-serif", marginBottom: 10 }}
          autoComplete="tel" autoFocus
        />
        <input
          type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleLoginSubmit()}
          placeholder="Password"
          style={{ width: "100%", padding: "16px", background: S.surface, border: `1.5px solid ${S.border}`, borderRadius: 12, fontSize: 18, color: S.text, outline: "none", fontFamily: "'Outfit', system-ui, sans-serif" }}
          autoComplete="current-password"
        />
        {loginError && <p style={{ color: "#e53e3e", fontSize: 14, marginTop: 8 }}>{loginError}</p>}
        <BigBtn onClick={handleLoginSubmit} disabled={submitting || loginPhone.length < 10 || loginPassword.length < 6} style={{ marginTop: 24 }}>
          {submitting ? "Signing in..." : "Sign in"}
        </BigBtn>
        <button onClick={() => { track("login_switch_to_signup"); setMode("signup"); setLoginError(""); }} style={{ background: "none", border: "none", color: S.sub, fontSize: 15, fontWeight: 600, marginTop: 16, cursor: "pointer" }}>
          Create an account instead
        </button>
      </div>
    );
  }

  // ---- WELCOME ----
  if (currentStep === "welcome") {
    return (
      <div style={{ minHeight: "100vh", background: "#F5F0E8", display: "flex", flexDirection: "column", alignItems: "center", color: "#1A1612", maxWidth: 430, margin: "0 auto" }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: "80px 28px 0" }}>
          <div style={{ width: 80, height: 80, borderRadius: 20, background: "white", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 16px rgba(0,0,0,0.06)" }}>
            <AgapeCross size={36} strokeWidth={1.5} />
          </div>
          <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "#B8912A", marginTop: 8 }}>Faith + Love</p>
          <span style={{ fontSize: 48, fontWeight: 800, letterSpacing: -1, color: "#1A1612", fontFamily: "'Outfit', system-ui, sans-serif" }}>agape</span>
          <p style={{ fontSize: 16, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "#B8912A", lineHeight: 1.4, textAlign: "center", marginTop: 8 }}>Created by Christians<br />for Christians</p>
        </div>
        <div style={{ padding: "0 28px 56px", width: "100%" }}>
          <div style={{ height: 1, background: "linear-gradient(to right, transparent, #B8912A, transparent)", marginBottom: 32 }} />
          <button onClick={goNext} style={{ width: "100%", padding: 16, background: "#B8912A", color: "#fff", borderRadius: 999, fontSize: 16, fontWeight: 700, border: "none", cursor: "pointer", fontFamily: "'Outfit', system-ui, sans-serif" }}>
            Create account
          </button>
          <button onClick={() => { track("welcome_sign_in_tapped"); setMode("login"); }} style={{ width: "100%", marginTop: 12, padding: 16, background: "transparent", color: "#1A1612", border: "1.5px solid #D4C9B8", borderRadius: 999, fontSize: 16, fontWeight: 700, cursor: "pointer", fontFamily: "'Outfit', system-ui, sans-serif" }}>
            Sign in
          </button>
          <p style={{ fontSize: 11, color: "#8C857C", marginTop: 24, textAlign: "center" }}>By continuing you agree to our Terms & Privacy Policy</p>
        </div>
      </div>
    );
  }

  // ---- PHONE ----
  if (currentStep === "phone") {
    return (
      <Wrap {...wrapProps}>
        <h2 style={{ color: S.text, fontSize: 30, fontWeight: 800, marginBottom: 8, fontFamily: "'Outfit', system-ui, sans-serif" }}>My number is</h2>
        <p style={{ color: S.sub, fontSize: 14, marginBottom: 24, lineHeight: 1.5 }}>
          We'll text you a verification code. Message and data rates may apply.
        </p>

        <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
          <button
            onClick={() => setShowCountryPicker(!showCountryPicker)}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "14px 12px", background: S.surface, border: `1.5px solid ${S.border}`, borderRadius: 12, fontSize: 16, color: S.text, cursor: "pointer", whiteSpace: "nowrap", fontFamily: "'Outfit', system-ui, sans-serif" }}
          >
            {selectedCountry.flag} {selectedCountry.code} <ChevronRight size={14} style={{ transform: showCountryPicker ? "rotate(90deg)" : "none", transition: "transform 0.2s" }} />
          </button>
          <input
            ref={inputRef}
            type="tel"
            value={phoneNum}
            onChange={(e) => setPhoneNum(e.target.value.replace(/[^\d\s]/g, ""))}
            onKeyDown={(e) => e.key === "Enter" && phoneNum.length >= 7 && handleSendOtp()}
            placeholder="Phone number"
            style={{ flex: 1, padding: "14px 16px", background: S.surface, border: `1.5px solid ${S.border}`, borderRadius: 12, fontSize: 18, color: S.text, outline: "none", fontFamily: "'Outfit', system-ui, sans-serif" }}
            autoComplete="tel"
            autoFocus
          />
        </div>

        {showCountryPicker && (
          <div style={{ background: S.surface, borderRadius: 12, border: `1px solid ${S.border}`, maxHeight: 200, overflowY: "auto", marginBottom: 16 }}>
            {COUNTRY_CODES.map((c) => (
              <button
                key={c.code}
                onClick={() => { setCountryCode(c.code); setShowCountryPicker(false); }}
                style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", background: countryCode === c.code ? S.primarySoft : "transparent", border: "none", borderBottom: `1px solid ${S.border}`, color: S.text, fontSize: 15, cursor: "pointer", textAlign: "left", fontFamily: "'Outfit', system-ui, sans-serif" }}
              >
                <span style={{ fontSize: 20 }}>{c.flag}</span>
                <span style={{ flex: 1 }}>{c.name}</span>
                <span style={{ color: S.sub }}>{c.code}</span>
              </button>
            ))}
          </div>
        )}

        {otpError && <p style={{ color: "#e53e3e", fontSize: 14, marginTop: 8 }}>{otpError}</p>}

        <div style={{ marginTop: "auto" }}>
          <BigBtn onClick={handleSendOtp} disabled={submitting || phoneNum.length < 7}>
            {submitting ? "Sending..." : "Continue"}
          </BigBtn>
          {DEV_TEST && <button onClick={goNext} style={{ background: "none", border: "none", color: "#e53e3e", fontSize: 12, marginTop: 8, cursor: "pointer", textAlign: "center", width: "100%" }}>Skip (dev test)</button>}
        </div>
      </Wrap>
    );
  }

  // ---- VERIFY OTP ----
  if (currentStep === "verify") {
    return (
      <Wrap {...wrapProps}>
        <h2 style={{ color: S.text, fontSize: 30, fontWeight: 800, marginBottom: 8, fontFamily: "'Outfit', system-ui, sans-serif" }}>Enter your code</h2>
        <p style={{ color: S.sub, fontSize: 14, marginBottom: 32 }}>Sent to {phone}</p>

        <div style={{ display: "flex", gap: 10, justifyContent: "center", marginBottom: 24 }}>
          {otpDigits.map((digit, i) => (
            <input
              key={i}
              ref={(el) => (otpRefs.current[i] = el)}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleOtpDigitChange(i, e.target.value)}
              onKeyDown={(e) => handleOtpKeyDown(i, e)}
              onPaste={(e) => {
                e.preventDefault();
                const paste = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
                if (paste.length === 6) {
                  const digits = paste.split("");
                  setOtpDigits(digits);
                  handleVerifyOtp(paste);
                }
              }}
              autoFocus={i === 0}
              style={{
                width: 48, height: 56, textAlign: "center", fontSize: 24, fontWeight: 700,
                background: S.surface, border: `2px solid ${digit ? S.primary : S.border}`, borderRadius: 12,
                color: S.text, outline: "none", fontFamily: "'Outfit', system-ui, sans-serif",
              }}
            />
          ))}
        </div>

        {otpError && <p style={{ color: "#e53e3e", fontSize: 14, textAlign: "center" }}>{otpError}</p>}

        <button onClick={() => { handleSendOtp(); }} style={{ background: "none", border: "none", color: S.primary, fontSize: 15, fontWeight: 600, cursor: "pointer", textAlign: "center", marginBottom: 8 }}>
          Resend
        </button>
        <button onClick={() => { setStep(step - 1); setOtpDigits(["", "", "", "", "", ""]); setOtpError(""); }} style={{ background: "none", border: "none", color: S.sub, fontSize: 14, cursor: "pointer", textAlign: "center" }}>
          Change number
        </button>

        <BigBtn onClick={() => handleVerifyOtp()} disabled={submitting || otpDigits.some(d => d === "")}>
          {submitting ? "Verifying..." : "Verify"}
        </BigBtn>
        {DEV_TEST && <button onClick={goNext} style={{ background: "none", border: "none", color: "#e53e3e", fontSize: 12, marginTop: 8, cursor: "pointer", textAlign: "center", width: "100%" }}>Skip (dev test)</button>}
      </Wrap>
    );
  }

  // ---- PASSWORD ----
  if (currentStep === "password") {
    return (
      <Wrap {...wrapProps}>
        <h2 style={{ color: S.text, fontSize: 30, fontWeight: 800, marginBottom: 8, fontFamily: "'Outfit', system-ui, sans-serif" }}>Create a password</h2>
        <p style={{ color: S.sub, fontSize: 14, marginBottom: 24 }}>You'll use this to sign in next time</p>
        <input
          id="ob-pw1"
          type="password" value={password}
          onChange={(e) => { setPassword(e.target.value); setPasswordError(""); }}
          placeholder="Password (min. 6 characters)"
          style={{ width: "100%", padding: "16px", background: S.surface, border: `1.5px solid ${S.border}`, borderRadius: 12, fontSize: 18, color: S.text, outline: "none", fontFamily: "'Outfit', system-ui, sans-serif", marginBottom: 10 }}
          autoComplete="new-password"
        />
        <input
          type="password" value={passwordConfirm}
          onChange={(e) => { setPasswordConfirm(e.target.value); setPasswordError(""); }}
          onKeyDown={(e) => e.key === "Enter" && canProceed() && handleSetPassword()}
          placeholder="Confirm password"
          style={{ width: "100%", padding: "16px", background: S.surface, border: `1.5px solid ${S.border}`, borderRadius: 12, fontSize: 18, color: S.text, outline: "none", fontFamily: "'Outfit', system-ui, sans-serif" }}
          autoComplete="new-password"
        />
        {passwordError && <p style={{ color: "#e53e3e", fontSize: 14, marginTop: 8 }}>{passwordError}</p>}
        <BigBtn onClick={handleSetPassword} disabled={submitting || !canProceed()}>
          {submitting ? "Setting password..." : "Continue"}
        </BigBtn>
        {DEV_TEST && <button onClick={goNext} style={{ background: "none", border: "none", color: "#e53e3e", fontSize: 12, marginTop: 8, cursor: "pointer", textAlign: "center", width: "100%" }}>Skip (dev test)</button>}
      </Wrap>
    );
  }

  // ---- FAITH CONSENT ----
  if (currentStep === "consent") {
    return (
      <Wrap {...wrapProps}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", flex: 1 }}>
          <Church size={40} style={{ color: S.primary, marginBottom: 16 }} />
          <h2 style={{ color: S.text, fontSize: 26, fontWeight: 800, marginBottom: 12, fontFamily: "'Outfit', system-ui, sans-serif" }}>Faith-Based Matching</h2>
          <p style={{ color: S.sub, fontSize: 14, lineHeight: 1.6, marginBottom: 12, maxWidth: 340 }}>
            Agape is a Christian dating app. To connect you with people who share your faith, we collect and process information about your religious beliefs, including your denomination.
          </p>
          <p style={{ color: S.sub, fontSize: 14, lineHeight: 1.6, marginBottom: 24, maxWidth: 340 }}>
            This data is used solely for matching purposes and will be visible to other users on your profile.
          </p>
          <button
            onClick={() => setFaithConsent(!faithConsent)}
            style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: 16, background: S.surface, borderRadius: 12, cursor: "pointer", border: `1.5px solid ${faithConsent ? S.primary : S.border}`, textAlign: "left", width: "100%", maxWidth: 360 }}
          >
            <div style={{ width: 22, height: 22, minWidth: 22, borderRadius: 6, border: `2px solid ${faithConsent ? S.primary : S.border}`, background: faithConsent ? S.primary : "transparent", display: "flex", alignItems: "center", justifyContent: "center", marginTop: 1 }}>
              {faithConsent && <Check size={14} color="#000" />}
            </div>
            <span style={{ fontSize: 14, lineHeight: 1.5, color: S.text }}>I consent to the processing of my religious beliefs for matching purposes</span>
          </button>
        </div>
        <BigBtn onClick={goNext} disabled={!faithConsent}>Continue</BigBtn>
      </Wrap>
    );
  }

  // ---- NAME ----
  if (currentStep === "name") {
    return (
      <Wrap {...wrapProps}>
        <h2 style={{ color: S.text, fontSize: 30, fontWeight: 800, marginBottom: 8, fontFamily: "'Outfit', system-ui, sans-serif" }}>What's your first name?</h2>
        <p style={{ color: S.sub, fontSize: 14, marginBottom: 24 }}>This is how it'll appear on your profile and you won't be able to change it</p>
        <input
          ref={inputRef}
          type="text" value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          onKeyDown={(e) => { if (e.key === "Enter" && form.name.trim()) setShowNameConfirm(true); }}
          placeholder="First name"
          style={{ width: "100%", padding: "16px", background: S.surface, border: `1.5px solid ${S.border}`, borderRadius: 12, fontSize: 22, color: S.text, outline: "none", fontFamily: "'Outfit', system-ui, sans-serif" }}
          autoFocus
        />
        <BigBtn onClick={() => setShowNameConfirm(true)} disabled={!form.name.trim()}>Continue</BigBtn>

        {showNameConfirm && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 999, padding: 16 }}>
            <div style={{ background: S.card, borderRadius: 20, padding: 24, width: "100%", maxWidth: 400 }}>
              <h3 style={{ color: S.text, fontSize: 20, fontWeight: 700, textAlign: "center", marginBottom: 8 }}>Is {form.name} your name?</h3>
              <p style={{ color: S.sub, fontSize: 14, textAlign: "center", marginBottom: 20 }}>You won't be able to change it later</p>
              <button onClick={() => { setShowNameConfirm(false); goNext(); }} style={{ width: "100%", padding: 14, background: S.primary, color: "#000", borderRadius: 999, fontSize: 16, fontWeight: 700, border: "none", cursor: "pointer", marginBottom: 10, fontFamily: "'Outfit', system-ui, sans-serif" }}>
                Yes, that's my name
              </button>
              <button onClick={() => setShowNameConfirm(false)} style={{ width: "100%", padding: 14, background: "transparent", color: S.sub, borderRadius: 999, fontSize: 16, fontWeight: 600, border: `1.5px solid ${S.border}`, cursor: "pointer", fontFamily: "'Outfit', system-ui, sans-serif" }}>
                Edit name
              </button>
            </div>
          </div>
        )}
      </Wrap>
    );
  }

  // ---- BIRTHDAY ----
  if (currentStep === "birthday") {
    const age = calcAge();
    const tooYoung = age !== null && age < 18;
    return (
      <Wrap {...wrapProps}>
        <h2 style={{ color: S.text, fontSize: 30, fontWeight: 800, marginBottom: 8, fontFamily: "'Outfit', system-ui, sans-serif" }}>Your birthday</h2>
        <p style={{ color: S.sub, fontSize: 14, marginBottom: 28 }}>Your profile shows your age, not your birthday</p>
        <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: S.sub, textAlign: "center", textTransform: "uppercase", letterSpacing: "0.05em" }}>Day</label>
            <input
              ref={inputRef}
              type="text" inputMode="numeric" maxLength={2} placeholder="DD" value={form.birthDay}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, "").slice(0, 2);
                setForm({ ...form, birthDay: v });
                if (v.length === 2) document.getElementById("ob-month")?.focus();
              }}
              style={{ width: "100%", padding: "14px 8px", textAlign: "center", background: S.surface, border: `1.5px solid ${S.border}`, borderRadius: 12, fontSize: 24, fontWeight: 600, color: S.text, outline: "none", fontFamily: "'Outfit', system-ui, sans-serif", boxSizing: "border-box" }}
              autoFocus
            />
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: S.sub, textAlign: "center", textTransform: "uppercase", letterSpacing: "0.05em" }}>Month</label>
            <input
              id="ob-month"
              type="text" inputMode="numeric" maxLength={2} placeholder="MM" value={form.birthMonth}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, "").slice(0, 2);
                setForm({ ...form, birthMonth: v });
                if (v.length === 2) document.getElementById("ob-year")?.focus();
              }}
              style={{ width: "100%", padding: "14px 8px", textAlign: "center", background: S.surface, border: `1.5px solid ${S.border}`, borderRadius: 12, fontSize: 24, fontWeight: 600, color: S.text, outline: "none", fontFamily: "'Outfit', system-ui, sans-serif", boxSizing: "border-box" }}
            />
          </div>
          <div style={{ flex: 1.3, display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: S.sub, textAlign: "center", textTransform: "uppercase", letterSpacing: "0.05em" }}>Year</label>
            <input
              id="ob-year"
              type="text" inputMode="numeric" maxLength={4} placeholder="YYYY" value={form.birthYear}
              onChange={(e) => setForm({ ...form, birthYear: e.target.value.replace(/\D/g, "").slice(0, 4) })}
              style={{ width: "100%", padding: "14px 8px", textAlign: "center", background: S.surface, border: `1.5px solid ${S.border}`, borderRadius: 12, fontSize: 24, fontWeight: 600, color: S.text, outline: "none", fontFamily: "'Outfit', system-ui, sans-serif", boxSizing: "border-box" }}
            />
          </div>
        </div>
        {age !== null && !tooYoung && <p style={{ color: S.sub, fontSize: 14, marginBottom: 8 }}>Age: {age}</p>}
        {tooYoung && <p style={{ color: "#e53e3e", fontSize: 14 }}>You must be at least 18 years old</p>}
        <BigBtn onClick={goNext} disabled={!canProceed()}>Continue</BigBtn>
      </Wrap>
    );
  }

  // ---- GENDER ----
  if (currentStep === "gender") {
    return (
      <Wrap {...wrapProps}>
        <h2 style={{ color: S.text, fontSize: 30, fontWeight: 800, marginBottom: 24, fontFamily: "'Outfit', system-ui, sans-serif" }}>I am a...</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[{ value: "male", label: "Man" }, { value: "female", label: "Woman" }].map((g) => (
            <button
              key={g.value}
              onClick={() => selectGender(g.value)}
              style={{
                padding: "20px 24px", background: form.gender === g.value ? S.primarySoft : S.surface,
                border: `2px solid ${form.gender === g.value ? S.primary : S.border}`, borderRadius: 14,
                fontSize: 18, fontWeight: 600, color: S.text, cursor: "pointer", textAlign: "left",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                fontFamily: "'Outfit', system-ui, sans-serif",
              }}
            >
              {g.label}
              {form.gender === g.value && <Check size={20} style={{ color: S.primary }} />}
            </button>
          ))}
        </div>
      </Wrap>
    );
  }

  // ---- DENOMINATION ----
  if (currentStep === "denomination") {
    return (
      <Wrap {...wrapProps}>
        <h2 style={{ color: S.text, fontSize: 30, fontWeight: 800, marginBottom: 8, fontFamily: "'Outfit', system-ui, sans-serif" }}>My denomination</h2>
        <p style={{ color: S.sub, fontSize: 14, marginBottom: 20 }}>This will show on your profile</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1, overflowY: "auto" }}>
          {DENOMINATIONS.map((d) => (
            <button
              key={d}
              onClick={() => {
                if (d === "Different") return;
                selectDenomination(d);
              }}
              style={{
                padding: "16px 20px", background: form.denomination === d ? S.primarySoft : S.surface,
                border: `2px solid ${form.denomination === d ? S.primary : S.border}`, borderRadius: 12,
                fontSize: 16, fontWeight: 500, color: S.text, cursor: "pointer", textAlign: "left",
                display: "flex", alignItems: "center", gap: 12,
                fontFamily: "'Outfit', system-ui, sans-serif",
                borderStyle: d === "Different" && !customDenom ? "dashed" : "solid",
              }}
            >
              <Church size={16} style={{ color: form.denomination === d ? S.primary : S.sub, flexShrink: 0 }} />
              {d === "Different" ? (
                <input
                  type="text" value={customDenom}
                  onChange={(e) => { e.stopPropagation(); setCustomDenom(e.target.value); setForm({ ...form, denomination: e.target.value }); }}
                  onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Enter" && customDenom.trim()) { setForm({ ...form, denomination: customDenom.trim() }); setTimeout(goNext, 300); } }}
                  onClick={(e) => e.stopPropagation()}
                  placeholder="Other denomination..."
                  style={{ background: "transparent", border: "none", outline: "none", fontSize: 16, color: S.text, flex: 1, fontFamily: "'Outfit', system-ui, sans-serif" }}
                />
              ) : (
                <span style={{ flex: 1 }}>{d}</span>
              )}
              {form.denomination === d && d !== "Different" && <Check size={18} style={{ color: S.primary }} />}
            </button>
          ))}
        </div>
        {customDenom.trim() && (
          <BigBtn onClick={() => { setForm({ ...form, denomination: customDenom.trim() }); setTimeout(goNext, 100); }}>
            Continue
          </BigBtn>
        )}
      </Wrap>
    );
  }

  // ---- EMAIL ----
  if (currentStep === "email") {
    return (
      <Wrap {...wrapProps}>
        <h2 style={{ color: S.text, fontSize: 30, fontWeight: 800, marginBottom: 8, fontFamily: "'Outfit', system-ui, sans-serif" }}>Your email?</h2>
        <p style={{ color: S.sub, fontSize: 14, marginBottom: 24 }}>Don't lose access to your account</p>
        <input
          ref={inputRef}
          type="email" value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          onKeyDown={(e) => e.key === "Enter" && canProceed() && goNext()}
          placeholder="Email address"
          style={{ width: "100%", padding: "16px", background: S.surface, border: `1.5px solid ${S.border}`, borderRadius: 12, fontSize: 18, color: S.text, outline: "none", fontFamily: "'Outfit', system-ui, sans-serif" }}
          autoComplete="email" autoFocus
        />
        <BigBtn onClick={goNext} disabled={!canProceed()}>Continue</BigBtn>
      </Wrap>
    );
  }

  // ---- LOCATION ----
  if (currentStep === "location") {
    const requestGps = () => {
      setGpsLoading(true);
      setGpsError("");
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&format=json`);
            const data = await res.json();
            const city = data.address?.city || data.address?.town || data.address?.village || data.address?.municipality || "Unknown";
            setForm({ ...form, location: city, locationLat: pos.coords.latitude, locationLng: pos.coords.longitude });
            setGpsLoading(false);
          } catch {
            setForm({ ...form, location: "My location", locationLat: pos.coords.latitude, locationLng: pos.coords.longitude });
            setGpsLoading(false);
          }
        },
        () => {
          setGpsError("denied");
          setGpsLoading(false);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    };

    return (
      <Wrap {...wrapProps}>
        <h2 style={{ color: S.text, fontSize: 30, fontWeight: 800, marginBottom: 8, fontFamily: "'Outfit', system-ui, sans-serif" }}>Where are you?</h2>
        <p style={{ color: S.sub, fontSize: 14, marginBottom: 24 }}>This helps us find people near you</p>

        {!gpsError && (
          <button
            onClick={requestGps}
            disabled={gpsLoading}
            style={{ width: "100%", padding: "18px", background: S.primarySoft, border: `2px solid ${S.primary}`, borderRadius: 14, fontSize: 16, fontWeight: 600, color: S.text, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, fontFamily: "'Outfit', system-ui, sans-serif", marginBottom: 16 }}
          >
            {gpsLoading ? "Getting location..." : "Use my current location"}
          </button>
        )}
        {gpsError && <p style={{ color: S.sub, fontSize: 13, marginBottom: 12 }}>Location permission denied. Search your city below.</p>}
        {form.location && (
          <p style={{ color: S.primary, fontSize: 15, fontWeight: 600, textAlign: "center", marginBottom: 12 }}>{form.location}</p>
        )}

        <p style={{ color: S.sub, fontSize: 13, textAlign: "center", marginBottom: 8 }}>or search your city</p>
        <div style={{ background: S.surface, borderRadius: 12, border: `1.5px solid ${S.border}`, padding: "4px 0", marginBottom: 16 }}>
          <LocationPicker
            value={form.location}
            onChange={(text) => setForm({ ...form, location: text, locationLat: null, locationLng: null })}
            onSelect={(item) => setForm({ ...form, location: item.display, locationLat: item.lat, locationLng: item.lng })}
            placeholder="Search city..."
            className="onboarding-input"
            inputStyle={{ width: "100%", padding: "14px 16px", background: "transparent", color: S.text, border: "none", fontSize: 16, outline: "none", fontFamily: "'Outfit', system-ui, sans-serif" }}
            dropdownStyle={{ background: S.surface, border: `1px solid ${S.border}` }}
            itemStyle={{ color: S.text, borderBottomColor: S.border }}
          />
        </div>

        <BigBtn onClick={goNext} disabled={!form.location.trim()}>Continue</BigBtn>
      </Wrap>
    );
  }

  // ---- DISTANCE PREFERENCE ----
  if (currentStep === "distance") {
    return (
      <Wrap {...wrapProps}>
        <h2 style={{ color: S.text, fontSize: 30, fontWeight: 800, marginBottom: 8, fontFamily: "'Outfit', system-ui, sans-serif" }}>Distance preference</h2>
        <p style={{ color: S.sub, fontSize: 14, marginBottom: 40 }}>How far away are you willing to search?</p>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <span style={{ fontSize: 56, fontWeight: 800, color: S.text, fontFamily: "'Outfit', system-ui, sans-serif" }}>{form.maxDistance}</span>
          <span style={{ fontSize: 20, fontWeight: 600, color: S.sub, marginLeft: 4 }}>km</span>
        </div>
        <div style={{ padding: "0 4px", marginBottom: 32 }}>
          <input
            type="range" min={1} max={200} step={1} value={form.maxDistance}
            onChange={(e) => setForm({ ...form, maxDistance: parseInt(e.target.value) })}
            className="distance-slider-onboarding"
          />
        </div>
        <BigBtn onClick={goNext}>Continue</BigBtn>
      </Wrap>
    );
  }

  // ---- WHO ARE YOU (personality traits) ----
  if (currentStep === "whoAreYou") {
    return (
      <Wrap {...wrapProps}>
        <h2 style={{ color: S.text, fontSize: 28, fontWeight: 800, marginBottom: 4, fontFamily: "'Outfit', system-ui, sans-serif" }}>Who are you?</h2>
        <p style={{ color: S.sub, fontSize: 14, marginBottom: 20 }}>Pick 3-8 traits that describe you</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16, flex: 1, alignContent: "flex-start", overflowY: "auto" }}>
          {LOOKING_FOR_POOL.map((trait) => (
            <button
              key={trait}
              onClick={() => toggleTrait(trait, "whoAreYou")}
              style={{
                padding: "8px 16px", borderRadius: 999, fontSize: 14, fontWeight: 500,
                border: `1.5px solid ${form.whoAreYou.includes(trait) ? S.primary : S.border}`,
                background: form.whoAreYou.includes(trait) ? S.primary : "transparent",
                color: form.whoAreYou.includes(trait) ? "#000" : S.text,
                cursor: "pointer", fontFamily: "'Outfit', system-ui, sans-serif",
              }}
            >
              {trait}
            </button>
          ))}
        </div>
        <p style={{ color: S.sub, fontSize: 13, textAlign: "center", marginBottom: 8 }}>{form.whoAreYou.length}/8 selected</p>
        <BigBtn onClick={goNext} disabled={form.whoAreYou.length < 3}>Continue</BigBtn>
      </Wrap>
    );
  }

  // ---- INTERESTS ----
  if (currentStep === "traits") {
    return (
      <Wrap {...wrapProps}>
        <h2 style={{ color: S.text, fontSize: 28, fontWeight: 800, marginBottom: 4, fontFamily: "'Outfit', system-ui, sans-serif" }}>What are you into?</h2>
        <p style={{ color: S.sub, fontSize: 14, marginBottom: 20 }}>Pick 3-8 interests</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16, flex: 1, alignContent: "flex-start", overflowY: "auto" }}>
          {TRAITS_POOL.map((trait) => (
            <button
              key={trait}
              onClick={() => toggleTrait(trait, "traits")}
              style={{
                padding: "8px 16px", borderRadius: 999, fontSize: 14, fontWeight: 500,
                border: `1.5px solid ${form.traits.includes(trait) ? S.primary : S.border}`,
                background: form.traits.includes(trait) ? S.primary : "transparent",
                color: form.traits.includes(trait) ? "#000" : S.text,
                cursor: "pointer", fontFamily: "'Outfit', system-ui, sans-serif",
              }}
            >
              {trait}
            </button>
          ))}
        </div>
        <p style={{ color: S.sub, fontSize: 13, textAlign: "center", marginBottom: 8 }}>{form.traits.length}/8 selected</p>
        <BigBtn onClick={goNext} disabled={form.traits.length < 3}>Continue</BigBtn>
      </Wrap>
    );
  }

  // ---- PHOTOS ----
  if (currentStep === "photos") {
    return (
      <Wrap {...wrapProps}>
        <h2 style={{ color: S.text, fontSize: 28, fontWeight: 800, marginBottom: 4, fontFamily: "'Outfit', system-ui, sans-serif" }}>Add photos</h2>
        <p style={{ color: S.sub, fontSize: 14, marginBottom: 20 }}>Add at least 1 photo to continue</p>
        <input type="file" accept="image/*" ref={photoInputRef} style={{ display: "none" }} onChange={handlePhotoUpload} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
          {form.photos.map((photo, i) => (
            <div key={i} style={{ position: "relative" }}>
              <button
                onClick={() => {
                  if (photo) {
                    openCropForExisting(i);
                  } else {
                    setPhotoSlotIndex(i);
                    photoInputRef.current?.click();
                  }
                }}
                style={{
                  width: "100%", aspectRatio: "3/4", borderRadius: 12, border: `2px dashed ${photo ? "transparent" : i === 0 ? S.primary : S.border}`,
                  background: photo ? `url(${photo}) center/cover` : S.surface,
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                  gap: 4, cursor: "pointer", overflow: "hidden",
                }}
              >
                {!photo && (
                  <>
                    <Plus size={24} style={{ color: i === 0 ? S.primary : S.sub }} />
                    {i === 0 && <span style={{ fontSize: 10, color: S.primary, fontWeight: 600 }}>Required</span>}
                  </>
                )}
              </button>
              {photo && (
                <button
                  onClick={(e) => { e.stopPropagation(); const next = [...form.photos]; next[i] = null; setForm({ ...form, photos: next }); }}
                  style={{ position: "absolute", top: 6, right: 6, width: 26, height: 26, borderRadius: 999, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", border: "none", cursor: "pointer", padding: 0 }}
                >
                  <X size={14} color="#fff" />
                </button>
              )}
            </div>
          ))}
        </div>
        <p style={{ color: S.sub, fontSize: 12, textAlign: "center", fontStyle: "italic", marginBottom: 16 }}>Tap a photo to crop & scale it</p>
        <BigBtn onClick={goNext} disabled={!form.photos.filter(Boolean).length}>Continue</BigBtn>

        {cropImage && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.92)", zIndex: 1000, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <div style={{ width: "min(85vw, 380px)", aspectRatio: "3/4", borderRadius: 16, overflow: "hidden", position: "relative", touchAction: "none", background: "#000" }}
              onPointerDown={(e) => { setDragging(true); setDragStart({ x: e.clientX - cropOffset.x, y: e.clientY - cropOffset.y }); e.currentTarget.setPointerCapture(e.pointerId); }}
              onPointerMove={(e) => { if (!dragging) return; setCropOffset({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y }); }}
              onPointerUp={() => setDragging(false)}
            >
              <img
                src={cropImage}
                alt=""
                draggable={false}
                style={{
                  position: "absolute", top: "50%", left: "50%",
                  transform: `translate(calc(-50% + ${cropOffset.x}px), calc(-50% + ${cropOffset.y}px)) scale(${cropScale})`,
                  minWidth: "100%", minHeight: "100%", objectFit: "cover", userSelect: "none", pointerEvents: "none",
                }}
              />
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 20 }}>
              <button onClick={() => setCropScale(Math.max(0.5, cropScale - 0.1))} style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 999, width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                <ZoomOut size={22} color="#fff" />
              </button>
              <input type="range" min={50} max={300} value={Math.round(cropScale * 100)} onChange={(e) => setCropScale(parseInt(e.target.value) / 100)}
                style={{ width: 140, accentColor: S.primary }}
              />
              <button onClick={() => setCropScale(Math.min(3, cropScale + 0.1))} style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 999, width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                <ZoomIn size={22} color="#fff" />
              </button>
            </div>

            <div style={{ display: "flex", gap: 16, marginTop: 24 }}>
              <button onClick={() => setCropImage(null)} style={{ padding: "14px 32px", borderRadius: 999, background: "rgba(255,255,255,0.15)", border: "none", color: "#fff", fontSize: 16, fontWeight: 600, cursor: "pointer", fontFamily: "'Outfit', system-ui, sans-serif" }}>
                Cancel
              </button>
              <button onClick={confirmCrop} style={{ padding: "14px 32px", borderRadius: 999, background: S.primary, border: "none", color: "#000", fontSize: 16, fontWeight: 700, cursor: "pointer", fontFamily: "'Outfit', system-ui, sans-serif" }}>
                Save
              </button>
            </div>
          </div>
        )}
      </Wrap>
    );
  }

  // ---- PROMPTS ----
  if (isPromptStep) {
    return (
      <Wrap {...wrapProps}>
        <h2 style={{ color: S.text, fontSize: 28, fontWeight: 800, marginBottom: 4, fontFamily: "'Outfit', system-ui, sans-serif" }}>{promptStepInfo.label}</h2>
        <p style={{ color: S.sub, fontSize: 14, marginBottom: 20 }}>Pick a prompt and write your answer</p>

        {currentPromptSelection.prompt ? (
          <div style={{ background: S.surface, borderRadius: 14, padding: 16, marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.3, color: S.sub }}>{currentPromptSelection.prompt}</span>
              <button onClick={clearPromptForStep} style={{ background: "none", border: "none", color: S.sub, padding: 2, cursor: "pointer" }}>
                <X size={16} />
              </button>
            </div>
            <textarea
              ref={answerRef}
              value={currentPromptSelection.answer}
              onChange={(e) => updatePromptAnswer(e.target.value)}
              placeholder="Your answer..."
              maxLength={250}
              rows={3}
              style={{ width: "100%", background: "transparent", border: "none", outline: "none", fontSize: 16, lineHeight: 1.5, color: S.text, resize: "none", fontFamily: "'Outfit', system-ui, sans-serif" }}
              autoFocus={editingAnswer}
            />
          </div>
        ) : (
          <div style={{ flex: 1, overflowY: "auto", maxHeight: "55vh" }}>
            {PROMPT_CATEGORIES[promptStepInfo.category]?.map((prompt) => (
              <button
                key={prompt}
                onClick={() => selectPromptForStep(prompt)}
                style={{
                  display: "block", width: "100%", textAlign: "left", padding: "16px 0",
                  fontSize: 17, fontWeight: 500, color: S.text, borderBottom: `1px solid ${S.border}`,
                  background: "none", border: "none", borderBottom: `1px solid ${S.border}`, cursor: "pointer",
                  fontFamily: "'Outfit', system-ui, sans-serif",
                }}
              >
                {prompt}
              </button>
            ))}
          </div>
        )}

        <div style={{ marginTop: 16, flexShrink: 0 }}>
          <BigBtn onClick={goNext} disabled={!canProceed()}>Continue</BigBtn>
        </div>
      </Wrap>
    );
  }

  // ---- LIFESTYLE ----
  if (currentStep === "lifestyle") {
    return (
      <Wrap {...wrapProps}>
        <h2 style={{ color: S.text, fontSize: 28, fontWeight: 800, marginBottom: 4, fontFamily: "'Outfit', system-ui, sans-serif" }}>Lifestyle</h2>
        <p style={{ color: S.sub, fontSize: 14, marginBottom: 24 }}>Help others get to know you better</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 24, flex: 1, overflowY: "auto" }}>
          {LIFESTYLE_CATEGORIES.map((cat) => (
            <div key={cat.label}>
              <p style={{ color: S.sub, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>{cat.label}</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {cat.options.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => setForm({ ...form, lifestyle: { ...form.lifestyle, [cat.label]: form.lifestyle[cat.label] === opt ? undefined : opt } })}
                    style={{
                      padding: "8px 14px", borderRadius: 999, fontSize: 13, fontWeight: 500,
                      border: `1.5px solid ${form.lifestyle[cat.label] === opt ? S.primary : S.border}`,
                      background: form.lifestyle[cat.label] === opt ? S.primary : "transparent",
                      color: form.lifestyle[cat.label] === opt ? "#000" : S.text,
                      cursor: "pointer", fontFamily: "'Outfit', system-ui, sans-serif",
                    }}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        {signupError && <p style={{ color: "#e53e3e", fontSize: 14, marginTop: 8, textAlign: "center" }}>{signupError}</p>}
        <BigBtn onClick={finishOnboarding} disabled={submitting}>
          {submitting ? "Creating account..." : "Start matching"}
        </BigBtn>
      </Wrap>
    );
  }

  return null;
}
