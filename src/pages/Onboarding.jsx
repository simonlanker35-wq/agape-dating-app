import { useState, useEffect, useRef } from "react";
import { useApp } from "../context/AppContext";
import { PROMPT_CATEGORIES, TRAITS_POOL, LOOKING_FOR_POOL, DENOMINATIONS } from "../data/profiles";
import { ChevronRight, Sparkles, Church, X, Check } from "lucide-react";
import AgapeCross from "../components/AgapeCross";
import LocationPicker from "../components/LocationPicker";
import { track } from "../services/posthog";

const STEPS = [
  "welcome",
  "consent",
  "phone",
  "verify",
  "name",
  "age",
  "height",
  "gender",
  "denomination",
  "location",
  "prompt_faith",
  "prompt_future",
  "prompt_aboutme",
  "traits",
  "whoAreYou",
  "lookingFor",
  "preferences",
];

const PROMPT_STEP_MAP = {
  prompt_faith: { category: "Faith", label: "Faith", icon: "✝" },
  prompt_future: { category: "Future", label: "Future", icon: "🌅" },
  prompt_aboutme: { category: "About Me", label: "About Me", icon: "👋" },
};

export default function Onboarding() {
  const { actions } = useApp();
  const [step, setStep] = useState(0);
  const [mode, setMode] = useState("signup");
  const [phone, setPhone] = useState("+48");
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpError, setOtpError] = useState("");
  const [signupError, setSignupError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loginPhone, setLoginPhone] = useState("+48");
  const [loginOtp, setLoginOtp] = useState("");
  const [loginOtpSent, setLoginOtpSent] = useState(false);
  const [loginError, setLoginError] = useState("");
  const inputRef = useRef(null);
  const answerRef = useRef(null);
  const [faithConsent, setFaithConsent] = useState(false);
  const [customDenom, setCustomDenom] = useState("");
  const [promptSelections, setPromptSelections] = useState({
    Faith: { prompt: "", answer: "" },
    Future: { prompt: "", answer: "" },
    "About Me": { prompt: "", answer: "" },
  });
  const [editingAnswer, setEditingAnswer] = useState(false);
  const [form, setForm] = useState({
    name: "",
    age: 25,
    height: 170,
    gender: "",
    denomination: "",
    job: "",
    school: "",
    location: "",
    traits: [],
    whoAreYou: [],
    lookingFor: [],
    maxAge: 35,
    maxDistance: 30,
  });

  const currentStep = STEPS[step];

  useEffect(() => {
    if (inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
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

  const handleSendOtp = async () => {
    setSubmitting(true);
    setOtpError("");
    try {
      await actions.sendOtp(phone);
      setOtpSent(true);
      goNext();
    } catch (err) {
      setOtpError(err.message);
    }
    setSubmitting(false);
  };

  const handleVerifyOtp = async (code) => {
    const codeToVerify = code || otpCode;
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

  useEffect(() => {
    if (currentStep !== "verify" || !("OTPCredential" in window)) return;
    const ac = new AbortController();
    navigator.credentials.get({ otp: { transport: ["sms"] }, signal: ac.signal })
      .then((otp) => { if (otp?.code) { setOtpCode(otp.code); handleVerifyOtp(otp.code); } })
      .catch(() => {});
    return () => ac.abort();
  }, [currentStep]);

  const finishOnboarding = async () => {
    setSubmitting(true);
    setSignupError("");
    try {
      const prompts = Object.values(promptSelections).filter(p => p.prompt && p.answer);

      await actions.register({
        phone,
        name: form.name,
        age: form.age,
        gender: form.gender,
        denomination: form.denomination,
      });

      await actions.updateProfile({
        height: form.height,
        job: form.job || undefined,
        school: form.school || undefined,
        location: form.location
          ? { type: "Point", coordinates: [8.65, 47.02], city: form.location }
          : undefined,
        photos: [],
        prompts,
        interests: form.traits,
        traits: form.traits,
        whoAreYou: form.whoAreYou,
        lookingFor: form.lookingFor,
        filters: {
          maxAge: form.maxAge,
          minAge: 18,
          maxDistance: form.maxDistance,
        },
      });
    } catch (err) {
      setSignupError(err.message);
      setSubmitting(false);
    }
  };

  const handleLoginSendOtp = async () => {
    track("login_attempted");
    setSubmitting(true);
    setLoginError("");
    try {
      await actions.sendOtp(loginPhone);
      setLoginOtpSent(true);
    } catch (err) {
      track("login_failed", { error: err.message });
      setLoginError(err.message);
    }
    setSubmitting(false);
  };

  const handleLoginVerifyOtp = async (code) => {
    const codeToVerify = code || loginOtp;
    if (codeToVerify.length !== 6) return;
    setSubmitting(true);
    setLoginError("");
    try {
      const { isNewUser } = await actions.verifyOtp(loginPhone, codeToVerify);
      if (isNewUser) {
        setLoginError("No account found with this number. Please sign up first.");
        setSubmitting(false);
        return;
      }
    } catch (err) {
      track("login_failed", { error: err.message });
      setLoginError(err.message);
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (!loginOtpSent || mode !== "login" || !("OTPCredential" in window)) return;
    const ac = new AbortController();
    navigator.credentials.get({ otp: { transport: ["sms"] }, signal: ac.signal })
      .then((otp) => { if (otp?.code) { setLoginOtp(otp.code); handleLoginVerifyOtp(otp.code); } })
      .catch(() => {});
    return () => ac.abort();
  }, [loginOtpSent, mode]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && canProceed()) {
      goNext();
    }
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
      case "phone": return phone.length >= 10;
      case "verify": return otpCode.length === 6;
      case "age": return form.age >= 18;
      case "height": return form.height >= 100 && form.height <= 250;
      case "gender": return form.gender !== "";
      case "denomination": return form.denomination !== "";
      case "location": return true;
      case "prompt_faith":
      case "prompt_future":
      case "prompt_aboutme": {
        const sel = promptSelections[promptStepInfo.category];
        return sel.prompt && sel.answer.trim().length > 0;
      }
      case "traits": return form.traits.length >= 3;
      case "whoAreYou": return form.whoAreYou.length >= 3;
      case "lookingFor": return form.lookingFor.length >= 3;
      case "preferences": return true;
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

  if (mode === "login") {
    return (
      <div className="onboarding">
        <div className="onboarding-content">
          {!loginOtpSent ? (
            <div className="onboarding-step single-question" key="login-phone">
              <div className="welcome-icon">
                <AgapeCross size={56} strokeWidth={1.2} />
              </div>
              <h2>Welcome back</h2>
              <p style={{ fontSize: 14, color: "#8C857C", marginBottom: 16 }}>Enter your phone number to sign in</p>
              <input
                type="tel"
                value={loginPhone}
                onChange={(e) => setLoginPhone(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && loginPhone.length >= 10 && handleLoginSendOtp()}
                placeholder="+48 123 456 789"
                className="onboarding-input"
                autoComplete="tel"
                autoFocus
              />
              {loginError && <p className="onboarding-error">{loginError}</p>}
              {loginPhone.length >= 10 && (
                <button
                  className="onboarding-cta"
                  onClick={handleLoginSendOtp}
                  disabled={submitting}
                >
                  {submitting ? "Sending code..." : "Send Code"}
                </button>
              )}
              <button className="skip-btn-text" onClick={() => { track("login_switch_to_signup"); setMode("signup"); setLoginError(""); }} style={{ marginTop: 16 }}>
                Create an account instead
              </button>
            </div>
          ) : (
            <div className="onboarding-step single-question" key="login-verify">
              <div className="welcome-icon">
                <AgapeCross size={56} strokeWidth={1.2} />
              </div>
              <h2>Enter your code</h2>
              <p style={{ fontSize: 14, color: "#8C857C", marginBottom: 16 }}>Sent to {loginPhone}</p>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={loginOtp}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, "");
                  setLoginOtp(val);
                  if (val.length === 6) handleLoginVerifyOtp(val);
                }}
                onKeyDown={(e) => e.key === "Enter" && loginOtp.length === 6 && handleLoginVerifyOtp()}
                placeholder="000000"
                className="onboarding-input"
                style={{ textAlign: "center", fontSize: 28, letterSpacing: 12, fontWeight: 700 }}
                autoFocus
              />
              {loginError && <p className="onboarding-error">{loginError}</p>}
              {loginOtp.length === 6 && (
                <button className="onboarding-cta" onClick={() => handleLoginVerifyOtp()} disabled={submitting}>
                  {submitting ? "Verifying..." : "Verify"}
                </button>
              )}
              <button className="skip-btn-text" onClick={() => { setLoginOtpSent(false); setLoginOtp(""); setLoginError(""); }} style={{ marginTop: 12 }}>
                Change number
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="onboarding">
      {currentStep !== "welcome" && (
        <div style={{ padding: "12px 20px 0", display: "flex", alignItems: "center", gap: 12 }}>
          <div className="onboarding-progress-bar" style={{ flex: 1 }}>
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <span style={{ fontSize: 12, fontWeight: 600, color: "#8C857C", whiteSpace: "nowrap" }}>
            {step} of {STEPS.length - 1}
          </span>
        </div>
      )}

      <div className="onboarding-content">
        {currentStep === "welcome" && (
          <div className="onboarding-step welcome-step" key="welcome">
            <div className="welcome-bg-photo" />
            <div className="welcome-bg-gradient" />
            <div className="welcome-icon">
              <div style={{ width: 80, height: 80, borderRadius: 20, background: "white", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 16px rgba(0,0,0,0.06)" }}>
                <AgapeCross size={36} strokeWidth={1.5} />
              </div>
              <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "#B8912A", marginTop: 8 }}>Faith + Love</p>
              <span className="welcome-logo-text">agape</span>
            </div>
            <div style={{ position: "relative", zIndex: 10, textAlign: "center", padding: "32px 28px 0" }}>
              <p style={{ fontSize: 16, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "#B8912A", lineHeight: 1.4 }}>Created by Christians<br />for Christians</p>
            </div>
            <div className="welcome-bottom">
              <div className="welcome-divider" />
              <button className="onboarding-cta" onClick={goNext}>
                Create account
              </button>
              <button className="welcome-signin-btn" onClick={() => { track("welcome_sign_in_tapped"); setMode("login"); }}>
                Sign in
              </button>
              <p className="welcome-terms">By continuing you agree to our Terms & Privacy Policy</p>
            </div>
          </div>
        )}

        {currentStep === "consent" && (
          <div className="onboarding-step single-question consent-step" key="consent">
            <div className="consent-icon">
              <Church size={32} />
            </div>
            <h2>Faith-Based Matching</h2>
            <p className="consent-desc">
              Agape is a Christian dating app. To connect you with people who share your faith, we collect and process information about your religious beliefs, including your denomination.
            </p>
            <p className="consent-desc">
              This data is used solely for matching purposes and will be visible to other users on your profile.
            </p>
            <label className="consent-checkbox" onClick={() => setFaithConsent(!faithConsent)}>
              <div className={`consent-check-box ${faithConsent ? "checked" : ""}`}>
                {faithConsent && <Check size={14} />}
              </div>
              <span>I consent to the processing of my religious beliefs for matching purposes</span>
            </label>
            {faithConsent && (
              <button className="onboarding-cta" onClick={goNext}>
                Continue <ChevronRight size={18} />
              </button>
            )}
          </div>
        )}

        {currentStep === "name" && (
          <div className="onboarding-step single-question" key="name">
            <h2>What's your first name?</h2>
            <input
              ref={inputRef}
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              onKeyDown={handleKeyDown}
              placeholder="Your first name"
              className="onboarding-input"
              autoFocus
            />
            {form.name.trim() && (
              <button className="onboarding-cta" onClick={goNext}>
                Continue <ChevronRight size={18} />
              </button>
            )}
          </div>
        )}

        {currentStep === "phone" && (
          <div className="onboarding-step single-question" key="phone">
            <h2>Your phone number</h2>
            <p style={{ fontSize: 14, color: "#8C857C", marginBottom: 16 }}>We'll send you a code to verify it's really you</p>
            <input
              ref={inputRef}
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && phone.length >= 10 && handleSendOtp()}
              placeholder="+48 123 456 789"
              className="onboarding-input"
              autoComplete="tel"
              autoFocus
            />
            {otpError && <p className="onboarding-error">{otpError}</p>}
            {phone.length >= 10 && (
              <button className="onboarding-cta" onClick={handleSendOtp} disabled={submitting}>
                {submitting ? "Sending code..." : "Send Code"} {!submitting && <ChevronRight size={18} />}
              </button>
            )}
          </div>
        )}

        {currentStep === "verify" && (
          <div className="onboarding-step single-question" key="verify">
            <h2>Enter your code</h2>
            <p style={{ fontSize: 14, color: "#8C857C", marginBottom: 16 }}>Sent to {phone}</p>
            <input
              ref={inputRef}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={otpCode}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, "");
                setOtpCode(val);
                if (val.length === 6) handleVerifyOtp(val);
              }}
              onKeyDown={(e) => e.key === "Enter" && otpCode.length === 6 && handleVerifyOtp()}
              placeholder="000000"
              className="onboarding-input"
              style={{ textAlign: "center", fontSize: 28, letterSpacing: 12, fontWeight: 700 }}
              autoFocus
            />
            {otpError && <p className="onboarding-error">{otpError}</p>}
            {otpCode.length === 6 && (
              <button className="onboarding-cta" onClick={handleVerifyOtp} disabled={submitting}>
                {submitting ? "Verifying..." : "Verify"} {!submitting && <ChevronRight size={18} />}
              </button>
            )}
            <button className="skip-btn-text" onClick={() => { setStep(step - 1); setOtpCode(""); setOtpError(""); setOtpSent(false); }} style={{ marginTop: 12 }}>
              Change number
            </button>
          </div>
        )}

        {currentStep === "age" && (
          <div className="onboarding-step single-question" key="age">
            <h2>How old are you, {form.name}?</h2>
            <input
              ref={inputRef}
              type="number"
              value={form.age}
              onChange={(e) => setForm({ ...form, age: parseInt(e.target.value) || 18 })}
              onKeyDown={handleKeyDown}
              min={18}
              max={99}
              className="onboarding-input age-input"
            />
            <button className="onboarding-cta" onClick={goNext}>
              Continue <ChevronRight size={18} />
            </button>
          </div>
        )}

        {currentStep === "height" && (
          <div className="onboarding-step single-question" key="height">
            <h2>How tall are you?</h2>
            <div className="height-display">{form.height} cm</div>
            <input
              type="range"
              min={100}
              max={220}
              value={form.height}
              onChange={(e) => setForm({ ...form, height: parseInt(e.target.value) })}
              className="height-slider"
            />
            <button className="onboarding-cta" onClick={goNext}>
              Continue <ChevronRight size={18} />
            </button>
          </div>
        )}

        {currentStep === "gender" && (
          <div className="onboarding-step single-question" key="gender">
            <h2>I am a...</h2>
            <div className="gender-options">
              <button
                className={`gender-card ${form.gender === "male" ? "selected" : ""}`}
                onClick={() => selectGender("male")}
              >
                Man
              </button>
              <button
                className={`gender-card ${form.gender === "female" ? "selected" : ""}`}
                onClick={() => selectGender("female")}
              >
                Woman
              </button>
            </div>
          </div>
        )}

        {currentStep === "denomination" && (
          <div className="onboarding-step single-question" key="denomination">
            <h2>My denomination</h2>
            <div className="denomination-options">
              {DENOMINATIONS.map((d) => (
                <button
                  key={d}
                  className={`denomination-card ${form.denomination === d ? "selected" : ""} ${d === "Different" && !customDenom ? "different-btn" : ""}`}
                  onClick={() => {
                    if (d === "Different") return;
                    selectDenomination(d);
                  }}
                >
                  <Church size={16} />
                  {d === "Different" ? (
                    <input
                      type="text"
                      value={customDenom}
                      onChange={(e) => {
                        e.stopPropagation();
                        setCustomDenom(e.target.value);
                        setForm({ ...form, denomination: e.target.value });
                      }}
                      onKeyDown={(e) => {
                        e.stopPropagation();
                        if (e.key === "Enter" && customDenom.trim()) {
                          setForm({ ...form, denomination: customDenom.trim() });
                          setTimeout(goNext, 300);
                        }
                      }}
                      onClick={(e) => e.stopPropagation()}
                      placeholder="Other denomination..."
                      className="custom-denom-input"
                    />
                  ) : d}
                </button>
              ))}
            </div>
            {customDenom.trim() && (
              <button className="onboarding-cta" onClick={() => { setForm({ ...form, denomination: customDenom.trim() }); setTimeout(goNext, 100); }}>
                Continue <ChevronRight size={18} />
              </button>
            )}
          </div>
        )}

        {currentStep === "location" && (
          <div className="onboarding-step single-question" key="location">
            <h2>Where are you based?</h2>
            <LocationPicker
              value={form.location}
              onChange={(text) => setForm({ ...form, location: text })}
              onSelect={(item) => setForm({ ...form, location: item.display, locationLat: item.lat, locationLng: item.lng })}
              placeholder="Search city..."
              className="onboarding-input"
            />
            <div className="skip-or-continue">
              <button className="skip-btn-text" onClick={goNext}>Skip</button>
              {form.location.trim() && (
                <button className="onboarding-cta small" onClick={goNext}>
                  Continue <ChevronRight size={18} />
                </button>
              )}
            </div>
          </div>
        )}

        {isPromptStep && (
          <div className="onboarding-step prompts-step" key={currentStep}>
            <div className="prompts-header">
              <span className="prompt-step-icon">{promptStepInfo.icon}</span>
              <h2>{promptStepInfo.label}</h2>
              <p className="step-hint">Pick a prompt and write your answer</p>
            </div>

            {currentPromptSelection.prompt ? (
              <div className="selected-prompts">
                <div className="selected-prompt-card">
                  <div className="selected-prompt-header">
                    <span className="selected-prompt-q">{currentPromptSelection.prompt}</span>
                    <button className="remove-prompt-btn" onClick={clearPromptForStep}>
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
                    className="prompt-answer-input"
                    autoFocus={editingAnswer}
                  />
                </div>
              </div>
            ) : (
              <div className="prompt-list">
                {PROMPT_CATEGORIES[promptStepInfo.category]?.map((prompt) => (
                  <button
                    key={prompt}
                    className="prompt-list-item"
                    onClick={() => selectPromptForStep(prompt)}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            )}

            {canProceed() && (
              <button className="onboarding-cta" onClick={goNext}>
                Continue <ChevronRight size={18} />
              </button>
            )}
          </div>
        )}

        {currentStep === "traits" && (
          <div className="onboarding-step" key="traits">
            <h2>What are you into?</h2>
            <p className="step-hint">Pick 3-8 things you enjoy</p>
            <div className="interests-grid">
              {TRAITS_POOL.map((trait) => (
                <button
                  key={trait}
                  className={`interest-chip ${form.traits.includes(trait) ? "selected" : ""}`}
                  onClick={() => toggleTrait(trait, "traits")}
                >
                  {trait}
                </button>
              ))}
            </div>
            <p className="interest-count">{form.traits.length}/8 selected</p>
            {form.traits.length >= 3 && (
              <button className="onboarding-cta" onClick={goNext}>
                Continue <ChevronRight size={18} />
              </button>
            )}
          </div>
        )}

        {currentStep === "whoAreYou" && (
          <div className="onboarding-step" key="whoAreYou">
            <h2>Who are you?</h2>
            <p className="step-hint">Pick 3-8 traits that describe you</p>
            <div className="interests-grid">
              {LOOKING_FOR_POOL.map((trait) => (
                <button
                  key={trait}
                  className={`interest-chip ${form.whoAreYou.includes(trait) ? "selected" : ""}`}
                  onClick={() => toggleTrait(trait, "whoAreYou")}
                >
                  {trait}
                </button>
              ))}
            </div>
            <p className="interest-count">{form.whoAreYou.length}/8 selected</p>
            {form.whoAreYou.length >= 3 && (
              <button className="onboarding-cta" onClick={goNext}>
                Continue <ChevronRight size={18} />
              </button>
            )}
          </div>
        )}

        {currentStep === "lookingFor" && (
          <div className="onboarding-step" key="lookingFor">
            <h2>What are you looking for?</h2>
            <p className="step-hint">Pick 3-8 traits you value in a partner</p>
            <div className="interests-grid">
              {LOOKING_FOR_POOL.map((trait) => (
                <button
                  key={trait}
                  className={`interest-chip ${form.lookingFor.includes(trait) ? "selected" : ""}`}
                  onClick={() => toggleTrait(trait, "lookingFor")}
                >
                  {trait}
                </button>
              ))}
            </div>
            <p className="interest-count">{form.lookingFor.length}/8 selected</p>
            {form.lookingFor.length >= 3 && (
              <button className="onboarding-cta" onClick={goNext}>
                Continue <ChevronRight size={18} />
              </button>
            )}
          </div>
        )}

        {currentStep === "preferences" && (
          <div className="onboarding-step single-question" key="preferences">
            <h2>Almost there</h2>
            <div className="pref-group">
              <label>Show people up to age {form.maxAge}</label>
              <input
                type="range"
                min={18}
                max={50}
                value={form.maxAge}
                onChange={(e) => setForm({ ...form, maxAge: parseInt(e.target.value) })}
              />
            </div>
            <div className="pref-group">
              <label>Within {form.maxDistance} km</label>
              <input
                type="range"
                min={1}
                max={200}
                value={form.maxDistance}
                onChange={(e) => setForm({ ...form, maxDistance: parseInt(e.target.value) })}
              />
            </div>
            {signupError && <p className="onboarding-error">{signupError}</p>}
            <button className="onboarding-cta" onClick={finishOnboarding} disabled={submitting}>
              {submitting ? "Creating account..." : "Start Matching"} {!submitting && <Sparkles size={18} />}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
