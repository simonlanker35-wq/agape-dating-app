import { useState, useEffect, useRef } from "react";
import { useApp } from "../context/AppContext";
import { PROMPT_CATEGORIES, TRAITS_POOL, DENOMINATIONS } from "../data/profiles";
import { ChevronRight, Sparkles, Church, X, Check } from "lucide-react";
import AgapeCross from "../components/AgapeCross";

const STEPS = [
  "welcome",
  "consent",
  "name",
  "email",
  "password",
  "age",
  "height",
  "gender",
  "denomination",
  "job",
  "school",
  "location",
  "prompt_faith",
  "prompt_future",
  "prompt_aboutme",
  "traits",
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
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [signupError, setSignupError] = useState("");
  const [submitting, setSubmitting] = useState(false);
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
    email: "",
    password: "",
    age: 25,
    height: 170,
    gender: "",
    denomination: "",
    job: "",
    school: "",
    location: "",
    traits: [],
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
      setStep(step + 1);
      setEditingAnswer(false);
    } else {
      finishOnboarding();
    }
  };

  const finishOnboarding = async () => {
    setSubmitting(true);
    setSignupError("");
    try {
      const g = form.gender === "female" ? "women" : "men";
      const demoPhotos = [
        `https://randomuser.me/api/portraits/${g}/75.jpg`,
        `https://randomuser.me/api/portraits/${g}/76.jpg`,
        `https://randomuser.me/api/portraits/${g}/77.jpg`,
      ];

      const prompts = Object.values(promptSelections).filter(p => p.prompt && p.answer);

      await actions.register({
        email: form.email,
        password: form.password,
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
        photos: demoPhotos,
        prompts,
        interests: form.traits,
        traits: form.traits,
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

  const handleLogin = async () => {
    setSubmitting(true);
    setLoginError("");
    try {
      await actions.login(loginEmail, loginPassword);
    } catch (err) {
      setLoginError(err.message);
      setSubmitting(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && canProceed()) {
      goNext();
    }
  };

  const handleLoginKeyDown = (e) => {
    if (e.key === "Enter" && loginEmail && loginPassword) {
      handleLogin();
    }
  };

  const selectGender = (g) => {
    setForm({ ...form, gender: g });
    setTimeout(goNext, 300);
  };

  const selectDenomination = (d) => {
    if (d === "Different") return;
    setForm({ ...form, denomination: d });
    setTimeout(goNext, 300);
  };

  const toggleTrait = (trait, field) => {
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
      case "email": return form.email.includes("@") && form.email.includes(".");
      case "password": return form.password.length >= 6;
      case "age": return form.age >= 18;
      case "height": return form.height >= 100 && form.height <= 250;
      case "gender": return form.gender !== "";
      case "denomination": return form.denomination !== "";
      case "job": return true;
      case "school": return true;
      case "location": return true;
      case "prompt_faith":
      case "prompt_future":
      case "prompt_aboutme": {
        const sel = promptSelections[promptStepInfo.category];
        return sel.prompt && sel.answer.trim().length > 0;
      }
      case "traits": return form.traits.length >= 3;
      case "lookingFor": return form.lookingFor.length >= 3;
      case "preferences": return true;
      default: return true;
    }
  };

  const selectPromptForStep = (promptText) => {
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
          <div className="onboarding-step single-question" key="login">
            <div className="welcome-icon">
              <AgapeCross size={56} strokeWidth={1.2} />
            </div>
            <h2>Welcome back</h2>
            <input
              type="email"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              onKeyDown={handleLoginKeyDown}
              placeholder="Email"
              className="onboarding-input"
              autoFocus
            />
            <input
              type="password"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              onKeyDown={handleLoginKeyDown}
              placeholder="Password"
              className="onboarding-input"
              style={{ marginTop: 12 }}
            />
            {loginError && <p className="onboarding-error">{loginError}</p>}
            <button
              className="onboarding-cta"
              onClick={handleLogin}
              disabled={submitting || !loginEmail || !loginPassword}
            >
              {submitting ? "Signing in..." : "Sign In"}
            </button>
            <button className="skip-btn-text" onClick={() => setMode("signup")} style={{ marginTop: 16 }}>
              Create an account instead
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="onboarding">
      <div className="onboarding-progress-bar">
        <div className="progress-fill" style={{ width: `${progress}%` }} />
      </div>

      <div className="onboarding-content">
        {currentStep === "welcome" && (
          <div className="onboarding-step welcome-step" key="welcome">
            <img
              src="https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=600&h=900&fit=crop&auto=format"
              alt="Welcome"
              className="welcome-bg-photo"
            />
            <div className="welcome-bg-gradient" />
            <div className="welcome-gold-bar" />
            <div className="welcome-icon">
              <AgapeCross size={13} strokeWidth={1.5} />
              <span className="welcome-logo-text">agape</span>
            </div>
            <div className="welcome-bottom">
              <h1>Find love<br />rooted in faith.</h1>
              <p className="welcome-desc">
                Meet Christians who share your values, your church life, and your heart.
              </p>
              <div className="welcome-divider" />
              <button className="onboarding-cta" onClick={goNext}>
                Create account
              </button>
              <button className="welcome-signin-btn" onClick={() => setMode("login")}>
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

        {currentStep === "email" && (
          <div className="onboarding-step single-question" key="email">
            <h2>What's your email?</h2>
            <input
              ref={inputRef}
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              onKeyDown={handleKeyDown}
              placeholder="your@email.com"
              className="onboarding-input"
              autoFocus
            />
            {canProceed() && (
              <button className="onboarding-cta" onClick={goNext}>
                Continue <ChevronRight size={18} />
              </button>
            )}
          </div>
        )}

        {currentStep === "password" && (
          <div className="onboarding-step single-question" key="password">
            <h2>Create a password</h2>
            <input
              ref={inputRef}
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              onKeyDown={handleKeyDown}
              placeholder="At least 6 characters"
              className="onboarding-input"
              autoFocus
            />
            {canProceed() && (
              <button className="onboarding-cta" onClick={goNext}>
                Continue <ChevronRight size={18} />
              </button>
            )}
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

        {currentStep === "job" && (
          <div className="onboarding-step single-question" key="job">
            <h2>What do you do?</h2>
            <input
              ref={inputRef}
              type="text"
              value={form.job}
              onChange={(e) => setForm({ ...form, job: e.target.value })}
              onKeyDown={handleKeyDown}
              placeholder="Job title"
              className="onboarding-input"
            />
            <div className="skip-or-continue">
              <button className="skip-btn-text" onClick={goNext}>Skip</button>
              {form.job.trim() && (
                <button className="onboarding-cta small" onClick={goNext}>
                  Continue <ChevronRight size={18} />
                </button>
              )}
            </div>
          </div>
        )}

        {currentStep === "school" && (
          <div className="onboarding-step single-question" key="school">
            <h2>Where did you study?</h2>
            <input
              ref={inputRef}
              type="text"
              value={form.school}
              onChange={(e) => setForm({ ...form, school: e.target.value })}
              onKeyDown={handleKeyDown}
              placeholder="School or university"
              className="onboarding-input"
            />
            <div className="skip-or-continue">
              <button className="skip-btn-text" onClick={goNext}>Skip</button>
              {form.school.trim() && (
                <button className="onboarding-cta small" onClick={goNext}>
                  Continue <ChevronRight size={18} />
                </button>
              )}
            </div>
          </div>
        )}

        {currentStep === "location" && (
          <div className="onboarding-step single-question" key="location">
            <h2>Where are you based?</h2>
            <input
              ref={inputRef}
              type="text"
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              onKeyDown={handleKeyDown}
              placeholder="City or neighbourhood"
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

        {currentStep === "lookingFor" && (
          <div className="onboarding-step" key="lookingFor">
            <h2>What are you looking for?</h2>
            <p className="step-hint">Pick 3-8 traits you value in a partner</p>
            <div className="interests-grid">
              {TRAITS_POOL.map((trait) => (
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
