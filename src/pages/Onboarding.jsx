import { useState, useEffect, useRef } from "react";
import { useApp } from "../context/AppContext";
import { PROMPT_CATEGORIES, INTERESTS_POOL, DENOMINATIONS } from "../data/profiles";
import { Camera, ChevronRight, Sparkles, Church, X, Check } from "lucide-react";
import AgapeCross from "../components/AgapeCross";

const STEPS = [
  "welcome",
  "name",
  "age",
  "height",
  "gender",
  "denomination",
  "job",
  "school",
  "location",
  "photos",
  "prompts",
  "interests",
  "preferences",
];

export default function Onboarding() {
  const { dispatch } = useApp();
  const [step, setStep] = useState(0);
  const inputRef = useRef(null);
  const [form, setForm] = useState({
    name: "",
    age: 25,
    height: 170,
    gender: "",
    denomination: "",
    job: "",
    school: "",
    location: "",
    photos: [],
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

  const finishOnboarding = () => {
    const g = form.gender === "female" ? "women" : "men";
    const demoPhotos = [
      `https://randomuser.me/api/portraits/${g}/75.jpg`,
      `https://randomuser.me/api/portraits/${g}/76.jpg`,
      `https://randomuser.me/api/portraits/${g}/77.jpg`,
    ];

    dispatch({
      type: "COMPLETE_ONBOARDING",
      payload: {
        ...form,
        photos: form.photos.length > 0 ? form.photos : demoPhotos,
        id: "current_user",
        height: `${form.height} cm`,
      },
    });
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && canProceed()) {
      goNext();
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
      case "age": return form.age >= 18;
      case "height": return form.height >= 100 && form.height <= 250;
      case "gender": return form.gender !== "";
      case "denomination": return form.denomination !== "";
      case "job": return true;
      case "school": return true;
      case "location": return true;
      case "photos": return true;
      case "prompts": return form.prompts.some((p) => p.prompt && p.answer);
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

  return (
    <div className="onboarding">
      <div className="onboarding-progress-bar">
        <div className="progress-fill" style={{ width: `${progress}%` }} />
      </div>

      <div className="onboarding-content">
        {currentStep === "welcome" && (
          <div className="onboarding-step welcome-step" key="welcome">
            <div className="welcome-icon">
              <AgapeCross size={56} strokeWidth={1.2} />
            </div>
            <h1>Agape</h1>
            <p className="welcome-subtitle">Where faith meets love.</p>
            <p className="welcome-desc">
              Find someone who shares your values. Like what catches your eye. When the feeling's mutual, it's a match.
            </p>
            <button className="onboarding-cta" onClick={goNext}>
              Get Started
            </button>
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

        {currentStep === "photos" && (
          <div className="onboarding-step" key="photos">
            <h2>Add your photos</h2>
            <p className="step-hint">Profiles with 3+ photos get more likes</p>
            <div className="photo-grid-upload">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div key={i} className={`photo-upload-slot ${i < 3 ? "required" : ""}`}>
                  <Camera size={24} />
                  <span>{i < 3 ? "Required" : "Optional"}</span>
                </div>
              ))}
            </div>
            <p className="photo-note">Demo mode: placeholder photos will be used</p>
            <button className="onboarding-cta" onClick={goNext}>
              Continue <ChevronRight size={18} />
            </button>
          </div>
        )}

        {currentStep === "prompts" && (
          <div className="onboarding-step prompts-step" key="prompts">
            <div className="prompts-header">
              <h2>Prompts</h2>
              <p className="step-hint">Answer at least one prompt</p>
            </div>

            {/* Selected prompts */}
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

            {/* Category tabs */}
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

                {/* Prompt list */}
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
            <button className="onboarding-cta" onClick={finishOnboarding}>
              Start Matching <Sparkles size={18} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
