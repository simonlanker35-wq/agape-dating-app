import { useState, useEffect, useRef } from "react";
import { useApp } from "../context/AppContext";
import { PROMPT_CATEGORIES, INTERESTS_POOL, DENOMINATIONS } from "../data/profiles";
import { ChevronRight, Sparkles, Church, X, Check, LogIn } from "lucide-react";
import AgapeCross from "../components/AgapeCross";

const STEPS = [
  "welcome",
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
  "prompts",
  "interests",
  "preferences",
];

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
    prompts: [
      { prompt: "", answer: "" },
      { prompt: "", answer: "" },
      { prompt: "", answer: "" },
    ],
    interests: [],
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
        prompts: form.prompts,
        interests: form.interests,
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
    setForm({ ...form, denomination: d });
    setTimeout(goNext, 300);
  };

  const canProceed = () => {
    switch (currentStep) {
      case "welcome": return true;
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
      case "prompts": return form.prompts.every((p) => p.prompt && p.answer);
      case "interests": return form.interests.length >= 3;
      case "preferences": return true;
      default: return true;
    }
  };

  const toggleInterest = (interest) => {
    setForm((prev) => ({
      ...prev,
      interests: prev.interests.includes(interest)
        ? prev.interests.filter((i) => i !== interest)
        : prev.interests.length < 8
        ? [...prev.interests, interest]
        : prev.interests,
    }));
  };

  const [promptCategory, setPromptCategory] = useState("Your World");
  const [editingPromptIndex, setEditingPromptIndex] = useState(null);
  const answerRef = useRef(null);

  const updatePrompt = (index, field, value) => {
    setForm((prev) => {
      const newPrompts = [...prev.prompts];
      newPrompts[index] = { ...newPrompts[index], [field]: value };
      return { ...prev, prompts: newPrompts };
    });
  };

  const selectPrompt = (promptText) => {
    const emptyIndex = form.prompts.findIndex((p) => !p.prompt);
    if (emptyIndex === -1) return;
    updatePrompt(emptyIndex, "prompt", promptText);
    setEditingPromptIndex(emptyIndex);
    setTimeout(() => answerRef.current?.focus(), 100);
  };

  const removePrompt = (index) => {
    updatePrompt(index, "prompt", "");
    updatePrompt(index, "answer", "");
    setEditingPromptIndex(null);
  };

  const usedPrompts = form.prompts.map((p) => p.prompt).filter(Boolean);
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
                  className={`denomination-card ${form.denomination === d ? "selected" : ""}`}
                  onClick={() => selectDenomination(d)}
                >
                  <Church size={16} />
                  {d}
                </button>
              ))}
            </div>
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

        {currentStep === "prompts" && (
          <div className="onboarding-step prompts-step" key="prompts">
            <div className="prompts-header">
              <h2>Prompts</h2>
              <p className="step-hint">Answer all 3 prompts to continue</p>
            </div>

            {form.prompts.some((p) => p.prompt) && (
              <div className="selected-prompts">
                {form.prompts.map((p, i) => p.prompt && (
                  <div key={i} className="selected-prompt-card">
                    <div className="selected-prompt-header">
                      <span className="selected-prompt-q">{p.prompt}</span>
                      <button className="remove-prompt-btn" onClick={() => removePrompt(i)}>
                        <X size={16} />
                      </button>
                    </div>
                    {editingPromptIndex === i ? (
                      <textarea
                        ref={answerRef}
                        value={p.answer}
                        onChange={(e) => updatePrompt(i, "answer", e.target.value)}
                        placeholder="Your answer..."
                        maxLength={250}
                        rows={2}
                        className="prompt-answer-input"
                        onBlur={() => setEditingPromptIndex(null)}
                      />
                    ) : (
                      <div
                        className="prompt-answer-display"
                        onClick={() => {
                          setEditingPromptIndex(i);
                          setTimeout(() => answerRef.current?.focus(), 100);
                        }}
                      >
                        {p.answer || "Tap to write your answer..."}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {usedPrompts.length < 3 && (
              <>
                <div className="prompt-category-tabs">
                  {Object.keys(PROMPT_CATEGORIES).map((cat) => (
                    <button
                      key={cat}
                      className={`prompt-cat-tab ${promptCategory === cat ? "active" : ""}`}
                      onClick={() => setPromptCategory(cat)}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                <div className="prompt-list">
                  {PROMPT_CATEGORIES[promptCategory]
                    ?.filter((p) => !usedPrompts.includes(p))
                    .map((prompt) => (
                      <button
                        key={prompt}
                        className="prompt-list-item"
                        onClick={() => selectPrompt(prompt)}
                      >
                        {prompt}
                      </button>
                    ))}
                </div>
              </>
            )}

            {canProceed() && (
              <button className="onboarding-cta" onClick={goNext}>
                Continue <ChevronRight size={18} />
              </button>
            )}
          </div>
        )}

        {currentStep === "interests" && (
          <div className="onboarding-step" key="interests">
            <h2>What are you into?</h2>
            <p className="step-hint">Pick 3-8 interests</p>
            <div className="interests-grid">
              {INTERESTS_POOL.map((interest) => (
                <button
                  key={interest}
                  className={`interest-chip ${form.interests.includes(interest) ? "selected" : ""}`}
                  onClick={() => toggleInterest(interest)}
                >
                  {interest}
                </button>
              ))}
            </div>
            <p className="interest-count">{form.interests.length}/8 selected</p>
            {form.interests.length >= 3 && (
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
