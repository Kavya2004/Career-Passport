"use client";

// This is the whole app UI. It has two screens controlled by one piece of state
// (`profile`):
//   - profile === null  -> the onboarding form (collect name, degree, target role, resume file)
//   - profile !== null  -> the dashboard, with tabs for the translated resume,
//                          job match, keyword gaps, career resources, and next steps
// Submitting the form calls our /api/translate-resume endpoint (see that file for
// the AI logic) and stores whatever it returns in state so the dashboard can render it.

import { useState } from "react";
import Image from "next/image";
import {
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from "docx";

// ─── Types ────────────────────────────────────────────────────────────────────

type Profile = {
  name: string;
  country: string;
  degree: string;
  field: string;
  experience: string;
  title: string;
  target: string;
  applicationLink: string;
  sourceLanguage: string;
  resume: string;
  resumeText?: string;
};

type MatchReport = {
  score: number;
  similarityScore: number;
  acceptanceLikelihood: number;
  matchedKeywords: string[];
  missingKeywords: string[];
  strengths: { title: string; evidence: string; reason: string }[];
  missing: { title: string; evidence: string; reason: string; correction: string }[];
  steps: string[];
  source: string;
};

type Resource = {
  title: string;
  description: string;
  href: string;
  reason: string;
};

type GeneratedResume = {
  headline: string;
  sourceLanguage?: string;
  contact?: string[];
  summary: string;
  experience: {
    title: string;
    company: string;
    dates: string;
    bullets: string[];
  }[];
  education: string;
  skills: string[];
  leadershipActivities?: {
    title: string;
    organization: string;
    dates: string;
    bullets: string[];
  }[];
  note: string;
  confidence?: "resume" | "profile";
};

// ─── Helper functions ─────────────────────────────────────────────────────────

function getSteps(profile: Profile) {
  const regulated = /nurse|doctor|teacher|accountant|engineer/i.test(profile.target);
  return regulated
    ? [
      ["Credential evaluation", `Review your ${profile.field || "international"} education with an approved service.`],
      ["Verify role requirements", `Check current requirements for ${profile.target}.`],
      ["Gather supporting documents", "Collect transcripts, experience records, and identification documents."],
      ["Complete required examinations", `Complete any examinations required for ${profile.target}.`],
      ["Apply or prepare for roles", "Submit applications using your translated experience and verified documents."],
    ]
    : [
      ["Translate your credentials", "Organize your education and experience in U.S. employer language."],
      ["Review target role requirements", `Compare your background with ${profile.target || "target role"} postings.`],
      ["Strengthen one skill gap", "Choose one missing or unclear requirement to clarify or develop."],
      ["Prepare your applications", "Use your translated resume and evidence when applying."],
      ["Track your progress", "Save applications, conversations, and next actions in one place."],
    ];
}

function getEvidence(profile: Profile) {
  return [
    profile.field || "Domain expertise",
    profile.title || "Professional experience",
    "Documentation",
    "Cross-functional collaboration",
    "Problem solving",
    "Adaptability",
  ];
}

function getResources(profile: Profile): Resource[] {
  const role = `${profile.target} ${profile.field}`.toLowerCase();
  const query = encodeURIComponent(profile.target || profile.field || "career skills");
  return [
    {
      title: "Credential Evaluation Services",
      description: "World Education Services (WES) or similar",
      href: "https://www.wes.org/",
      reason: "Official credential evaluation for " + role,
    },
    {
      title: "Licensing Resources",
      description: "State-specific professional licensing",
      href: "https://www.upwardlyglobal.org/",
      reason: "Guidance on licensing requirements and pathways",
    },
    {
      title: "Job Boards",
      description: "LinkedIn, Indeed, Glassdoor",
      href: "https://www.linkedin.com/jobs/",
      reason: "Search for open positions matching your profile",
    },
    {
      title: "Certifications & Courses (Coursera)",
      description: `Coursera courses for ${profile.target || "your target role"}`,
      href: `https://www.coursera.org/search?query=${query}`,
      reason: "Close skill gaps with role-specific certifications and short courses",
    },
    {
      title: "Certifications & Courses (LinkedIn Learning)",
      description: `LinkedIn Learning paths for ${profile.target || "your target role"}`,
      href: `https://www.linkedin.com/learning/search?keywords=${query}`,
      reason: "Build credentials that strengthen your resume for U.S. employers",
    },
  ];
}

const EMPTY_DRAFT: Profile = {
  name: "",
  country: "",
  degree: "",
  field: "",
  experience: "",
  title: "",
  target: "",
  applicationLink: "",
  sourceLanguage: "auto",
  resume: "",
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function Home() {
  // Two-phase flow: null = onboarding, Profile = dashboard
  const [profile, setProfile] = useState<Profile | null>(null);
  const [draft, setDraft] = useState<Profile>(EMPTY_DRAFT);

  // Dashboard state
  const [tab, setTab] = useState("Career map");
  const [done, setDone] = useState<string[]>([]);
  const [matchReport, setMatchReport] = useState<MatchReport | null>(null);
  const [generatedResume, setGeneratedResume] = useState<GeneratedResume | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [advisory, setAdvisory] = useState<string | null>(null);
  const [translationNotice, setTranslationNotice] = useState<string | null>(null);

  // ── Draft handlers (onboarding form) ───────────────────────────────────────

  const updateDraft = (key: keyof Profile, value: string) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const chooseResume = async (file: File | null) => {
    if (!file) return;
    setResumeFile(file);
    updateDraft("resume", file.name);
  };

  const validateDraft = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!draft.name.trim()) newErrors.name = "Please enter your full name";
    if (!draft.target.trim()) newErrors.target = "Please enter your target U.S. role";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Sends the profile form (and the resume file, if one was chosen) to our backend
  // API and stores the response. This is the one place that talks to the server —
  // everything the dashboard shows afterward comes from `data` below.
  const translateResume = async (nextProfile: Profile, file: File | null = resumeFile) => {
    setIsTranslating(true);
    try {
      const formData = new FormData();
      formData.append("profile", JSON.stringify(nextProfile));
      formData.append("sourceLanguage", nextProfile.sourceLanguage);
      if (file) formData.append("resume", file);
      const response = await fetch("/api/translate-resume", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      setGeneratedResume(data.resume);
      setMatchReport(data.match || null);
      setAdvisory(data.advisory || null);
      setTranslationNotice(data.warning || null);
    } finally {
      setIsTranslating(false);
    }
  };

  const generate = () => {
    if (!validateDraft()) return;
    const committed = { ...draft };
    setProfile(committed);
    setTab("Resume translator");
    void translateResume(committed, resumeFile);
  };

  // ── Profile handlers (dashboard) ───────────────────────────────────────────

  const updateProfile = (key: keyof Profile, value: string) => {
    setProfile((prev) => prev ? { ...prev, [key]: value } : prev);
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: "" }));
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      updateProfile("resume", content);
    };
    reader.readAsText(file);
  };

  const toggle = (step: string) => {
    setDone((prev) =>
      prev.includes(step) ? prev.filter((s) => s !== step) : [...prev, step]
    );
  };

  const downloadResume = async (resume: GeneratedResume, name: string) => {
    const doc = new Document({
      sections: [
        {
          children: [
            new Paragraph({ text: name, heading: HeadingLevel.HEADING_1 }),
            new Paragraph({ text: resume.headline }),
            ...(resume.summary
              ? [
                new Paragraph({ text: "Professional Summary", heading: HeadingLevel.HEADING_2 }),
                new Paragraph({ text: resume.summary }),
              ]
              : []),
            ...resume.experience.flatMap((exp) => [
              new Paragraph({ text: exp.title, heading: HeadingLevel.HEADING_3 }),
              new Paragraph({ children: [new TextRun({ text: `${exp.company} · ${exp.dates}`, italics: true })] }),
              ...exp.bullets.map((b) => new Paragraph({ text: `• ${b}` })),
            ]),
            new Paragraph({ text: "Skills", heading: HeadingLevel.HEADING_2 }),
            new Paragraph({ text: resume.skills.join(", ") }),
            new Paragraph({ text: resume.note }),
          ],
        },
      ],
    });

    const blob = await Packer.toBlob(doc);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name.replace(/\s+/g, "-").toLowerCase()}-career-passport.docx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // ONBOARDING PHASE (profile === null)
  // ─────────────────────────────────────────────────────────────────────────────

  if (!profile) {
    return (
      <main className="onboarding">
        <div className="onboarding-top">
          <div className="brand onboarding-brand">
            <Image
              className="brand-logo"
              src="/career-passport-mark.svg"
              alt=""
              width={42}
              height={42}
              priority
            />
            <span>CAREER PASSPORT</span>
          </div>
          <span className="passport-motto">FIELD NOTES FOR YOUR NEXT CHAPTER</span>
          <span className="onboarding-note">PRIVATE BY DESIGN · YOUR DATA STAYS YOURS</span>
        </div>

        <div className="mini-graphics" aria-hidden="true">
          <span className="mini-star mini-star-one">✦</span>
          <span className="mini-star mini-star-two">✧</span>
          <span className="mini-stamp">CV</span>
          <span className="mini-pin" />
          <span className="mini-paper"><i /><i /><i /></span>
          <span className="mini-arrow">↗</span>
          <span className="mini-diploma">✧</span>
          <span className="mini-briefcase"><i /></span>
          <span className="mini-doc-card"><i /><i /><b /></span>
          <span className="mini-waypoint" />
        </div>

        <section className="onboarding-content" aria-labelledby="onboarding-title">
          <p className="eyebrow">CAREER + RESUME PASSPORT</p>
          <h1 id="onboarding-title">
            Your professional identity
            <br />
            travels with you.
          </h1>
          <p className="onboarding-lede">
            Career Passport translates your resume into clear English, formats it
            for U.S. roles, and shows how your experience matches the job you want.
          </p>
          <div className="onboarding-illustration">
            <Image
              src="/career-passport-people.svg"
              alt="Professionals from different fields building their next career chapter with a resume"
              width={560}
              height={300}
              priority
            />
          </div>

          <div className="setup-card" aria-labelledby="profile-heading">
            <div className="setup-heading">
              <div>
                <p className="eyebrow">YOUR PROFILE</p>
                <h2 id="profile-heading">Build your career passport</h2>
              </div>
            </div>

            <div className="form-grid">
              <label>
                Full name
                {errors.name && (
                  <span role="alert" className="error-message">{errors.name}</span>
                )}
                <input
                  id="full-name"
                  name="fullName"
                  autoComplete="name"
                  value={draft.name}
                  onChange={(e) => updateDraft("name", e.target.value)}
                  placeholder="e.g. Aisha Khan"
                  aria-invalid={!!errors.name}
                  aria-describedby={errors.name ? undefined : "full-name-hint"}
                />
                {!errors.name && <small id="full-name-hint">Your full professional name</small>}
              </label>

              <label>
                Country where you studied
                <input
                  id="study-country"
                  name="studyCountry"
                  value={draft.country}
                  onChange={(e) => updateDraft("country", e.target.value)}
                  placeholder="e.g. Vietnam"
                />
              </label>

              <label>
                Degree
                <input
                  id="degree"
                  name="degree"
                  value={draft.degree}
                  onChange={(e) => updateDraft("degree", e.target.value)}
                  placeholder="e.g. B.S. in Computer Engineering"
                />
              </label>

              <label>
                Field of study
                <input
                  id="field-of-study"
                  name="fieldOfStudy"
                  value={draft.field}
                  onChange={(e) => updateDraft("field", e.target.value)}
                  placeholder="e.g. Computer Engineering"
                />
              </label>

              <label>
                Years of experience
                <input
                  id="experience"
                  name="experience"
                  inputMode="numeric"
                  value={draft.experience}
                  onChange={(e) => updateDraft("experience", e.target.value)}
                  placeholder="e.g. 5"
                />
              </label>

              <label>
                Previous / current title
                <input
                  id="previous-title"
                  name="previousTitle"
                  value={draft.title}
                  onChange={(e) => updateDraft("title", e.target.value)}
                  placeholder="e.g. Systems Analyst"
                />
              </label>

              <label>
                Target U.S. profession
                {errors.target && (
                  <span role="alert" className="error-message">{errors.target}</span>
                )}
                <input
                  id="target-profession"
                  name="targetProfession"
                  value={draft.target}
                  onChange={(e) => updateDraft("target", e.target.value)}
                  placeholder="e.g. Software Engineer"
                  aria-invalid={!!errors.target}
                />
              </label>

              <label>
                Job application link <span>(optional)</span>
                <input
                  id="application-link"
                  name="applicationLink"
                  type="url"
                  value={draft.applicationLink}
                  onChange={(e) => updateDraft("applicationLink", e.target.value)}
                  placeholder="https://company.com/jobs/role"
                />
              </label>
            </div>

            <label className="resume-drop">
              Your resume <span>PDF, DOCX, or image</span>
              <input
                id="resume-upload"
                name="resume"
                type="file"
                accept=".pdf,.doc,.docx,.avif,image/*"
                onChange={(e) => void chooseResume(e.target.files?.[0] || null)}
                aria-describedby="resume-hint"
              />
              <strong>{draft.resume || "Choose a resume to translate"}</strong>
              <small id="resume-hint">
                Career Passport sends the original document to AI for extraction when configured.
              </small>
            </label>

            <label className="language-field">
              Resume language
              <select
                id="resume-language"
                name="resumeLanguage"
                value={draft.sourceLanguage}
                onChange={(e) => updateDraft("sourceLanguage", e.target.value)}
              >
                <option value="auto">Auto-detect</option>
                <option value="English">English</option>
                <option value="Vietnamese">Vietnamese</option>
                <option value="Spanish">Spanish</option>
                <option value="French">French</option>
                <option value="Arabic">Arabic</option>
                <option value="Chinese">Chinese</option>
                <option value="Hindi">Hindi</option>
                <option value="Portuguese">Portuguese</option>
                <option value="Tagalog">Tagalog</option>
                <option value="Other">Other language</option>
              </select>
              <small>Career Passport translates the resume into English before formatting it.</small>
            </label>

            <button
              className="generate-button"
              disabled={!draft.name || !draft.target || isTranslating}
              onClick={generate}
              aria-label="Generate your Career Passport resume and job match"
              aria-busy={isTranslating}
            >
              {isTranslating ? "Generating…" : "Generate my career passport"}
            </button>
          </div>

          <p className="onboarding-disclaimer">
            Career Passport provides informational career translation. It does not replace
            official credential evaluations, licensing authorities, employer decisions, or legal advice.
          </p>
        </section>
      </main>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // DASHBOARD PHASE (profile !== null)
  // ─────────────────────────────────────────────────────────────────────────────

  const improvementSteps = matchReport?.steps ?? [
    profile.resume
      ? `Review your resume evidence for the ${profile.target} role.`
      : "Upload your resume for a personalized review.",
    profile.applicationLink
      ? `Compare your resume directly with the ${profile.target} job posting.`
      : "Add the job application link to compare your resume with the exact role.",
    `Make sure your ${profile.target} resume shows specific responsibilities, tools, and outcomes.`,
  ];

  const currentEvidence = getEvidence(profile);
  const currentResources = getResources(profile);
  const currentSteps = getSteps(profile);

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>

      {/* Sidebar */}
      <aside className="sidebar">
        <div className="brand">
          <Image
            className="brand-logo"
            src="/career-passport-mark.svg"
            alt=""
            width={34}
            height={34}
            priority
          />
          <span>CAREER PASSPORT</span>
        </div>

        <div className="passport-sidebar-mark" aria-hidden="true">
          <span>✦</span>
          <small>FIELD NOTES</small>
        </div>

        <div className="sidebar-profile">
          <div className="avatar">
            {profile.name
              .split(" ")
              .map((part) => part[0])
              .join("")
              .slice(0, 2)}
          </div>
          <div>
            <strong>{profile.name}</strong>
            <span>{profile.country} → United States</span>
          </div>
          <button className="chevron" type="button" aria-label="Open help" onClick={() => setTab("How it works")}>⌄</button>
        </div>

        <nav className="nav-list">
          {["Career map", "My profile", "Resume translator", "Resume improvements", "Resources"].map((item) => (
            <button
              key={item}
              className={`nav-item ${tab === item ? "active" : ""}`}
              onClick={() => setTab(item)}
            >
              <span className="nav-symbol">
                {item === "Career map" ? "◈" : item === "My profile" ? "◌" : item === "Resume translator" ? "▤" : item === "Resources" ? "⊙" : "⌕"}
              </span>
              {item}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <button className="nav-item" onClick={() => setTab("How it works")}>
            <span className="nav-symbol">?</span>How Career Passport works
          </button>
          <div className="privacy-note">
            ◇{" "}
            <span>
              <strong>Your data stays yours</strong>
              <small>Private and never shared</small>
            </span>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="main-content" id="main-content" tabIndex={-1}>
        <header className="topbar">
          <nav className="breadcrumb" aria-label="Page breadcrumb">
            MY CAREER PASSPORT <span aria-hidden="true">/</span>{" "}
            <span>{tab.toUpperCase()}</span>
          </nav>
          <div className="top-actions">
            <button
              className="help-button"
              type="button"
              onClick={() => setTab("How it works")}
            >
              Need help? <span aria-hidden="true">↗</span>
            </button>
          </div>
        </header>

        <div className="content-wrap">
          {/* Welcome row */}
          <section className="welcome-row" aria-label="Profile overview">
            <div>
              <p className="eyebrow">YOUR CAREER TRANSLATION</p>
              <h1>Your experience has a place here.</h1>
              <p className="lede">
                We translated {profile.name}&apos;s professional journey into a clear path forward in the U.S.
              </p>
            </div>
            <label className="upload-button">
              <span aria-hidden="true">↑</span>
              {profile.resume ? profile.resume : "Upload a new document"}
              <input
                aria-label="Upload a new resume document"
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={handleFileUpload}
              />
            </label>
          </section>

          {/* Profile strip */}
          <section className="profile-strip" aria-label="Career profile summary">
            <div className="profile-intro">
              <div className="large-avatar" aria-hidden="true">
                {profile.name
                  .split(" ")
                  .map((part) => part[0])
                  .join("")
                  .slice(0, 2)}
              </div>
              <div>
                <h2>{profile.name}</h2>
                <p>
                  <span aria-hidden="true">🌍</span> {profile.country}{" "}
                  <span className="divider" aria-hidden="true">•</span>{" "}
                  {profile.experience || "0"} years experience
                </p>
              </div>
            </div>
            <div className="target-block">
              <span className="muted-label">TARGETING</span>
              <strong>{profile.target}</strong>
              <span>United States</span>
            </div>
            <button
              className="edit-button"
              aria-label="Edit profile — return to onboarding"
              onClick={() => {
                setDraft({ ...profile });
                setProfile(null);
              }}
            >
              ✎
            </button>
          </section>

          {/* Tab row (secondary nav for content area) */}
          <nav className="tab-row" aria-label="Career Passport views">
            {["Career map", "Job match", "Resume improvements", "Resources"].map((item) => (
              <button
                key={item}
                onClick={() => setTab(item)}
                className={tab === item ? "tab-active" : ""}
                aria-current={tab === item ? "page" : undefined}
              >
                {item}
              </button>
            ))}
          </nav>

          {/* ── Career map ─────────────────────────────────────────────────── */}
          {tab === "Career map" && (
            <section
              id="career-map-panel"
              aria-labelledby="map-title"
              role="tabpanel"
            >
              <div
                className="map-grid"
                role="img"
                aria-label="Career pathway diagram showing your background on the left and your U.S. target role on the right"
              >
                <div className="map-node">
                  <span className="node-kicker">YOUR BACKGROUND</span>
                  <strong>{profile.degree || "International degree"}</strong>
                  <span>{profile.field || "Professional experience"} · {profile.country}</span>
                  <div className="node-line" />
                  <strong>{profile.experience || "0"} years experience</strong>
                  <span>{profile.title || "Previous professional role"}</span>
                </div>
                <div className="map-connector" aria-hidden="true">
                  <span>TRANSLATE</span>
                  <i /><i /><i />
                </div>
                <div className="map-node">
                  <span className="node-kicker">YOUR NEXT CHAPTER</span>
                  <strong>{profile.target}</strong>
                  <span>United States</span>
                  <div className="progress-mini">
                    <span style={{ width: `${matchReport?.score ?? 0}%` }} />
                  </div>
                  <small>
                    {matchReport
                      ? `${matchReport.score}% resume match`
                      : "Generate to see your resume match"}
                  </small>
                </div>
              </div>

              <section style={{ marginTop: "32px" }} aria-labelledby="evidence-title">
                <div className="section-heading compact">
                  <h2 id="evidence-title">What your profile supports</h2>
                </div>
                <div className="path-list">
                  {currentEvidence.map((item) => (
                    <article key={item} className="path-card">
                      <div className="path-icon" aria-hidden="true">✓</div>
                      <div className="path-copy">
                        <h3>{item}</h3>
                        <p>Available for evidence-based resume review</p>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            </section>
          )}

          {/* ── Job match ──────────────────────────────────────────────────── */}
          {tab === "Job match" && (
            <section
              id="job-match-panel"
              aria-labelledby="job-match-title"
              role="tabpanel"
            >
              {!matchReport && (
                <div className="single-panel">
                  <p className="eyebrow">JOB MATCH</p>
                  <h2 id="job-match-title">No match report yet</h2>
                  <p className="panel-lede">
                    Generate your career passport from the onboarding screen to see how your
                    resume matches your target role.
                  </p>
                </div>
              )}
              {matchReport && (
                <div className="match-panel">
                  <div className="match-summary">
                    <div>
                      <p className="eyebrow">RESUME TO JOB MATCH</p>
                      <h2 id="job-match-title">
                        {matchReport.score}% match for {profile.target}
                      </h2>
                      <p className="panel-lede">
                        {profile.applicationLink
                          ? matchReport.source
                          : "Add an application link for a more exact comparison with a specific job."}
                      </p>
                    </div>
                    <div
                      className="match-score"
                      aria-label={`Match score: ${matchReport.score} percent`}
                    >
                      {matchReport.score}%
                    </div>
                  </div>
                  <div className="match-columns">
                    <div>
                      <h3>Matches the job description</h3>
                      <div className="match-finding-list">
                        {matchReport.strengths.map((item) => (
                          <article className="match-finding" key={item.title}>
                            <strong>{item.title}</strong>
                            <p><b>Evidence:</b> {item.evidence}</p>
                            <p><b>Why it works:</b> {item.reason}</p>
                          </article>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h3>Does not match yet</h3>
                      <div className="match-finding-list">
                        {(matchReport.missing.length
                          ? matchReport.missing
                          : [{
                            title: "No major profile gaps detected",
                            evidence: "The available profile information covers the main comparison fields.",
                            reason: "Keep checking each claim against your source documents.",
                            correction: "Review every entry for accuracy before applying.",
                          }]
                        ).map((item) => (
                          <article className="match-finding missing-finding" key={item.title}>
                            <strong>{item.title}</strong>
                            <p><b>What we found:</b> {item.evidence}</p>
                            <p><b>Why it matters:</b> {item.reason}</p>
                            <p><b>How to correct it:</b> {item.correction}</p>
                          </article>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h3>Steps to improve</h3>
                      <ol>
                        {matchReport.steps.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ol>
                    </div>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* ── Resume translator ──────────────────────────────────────────── */}
          {tab === "Resume translator" && (
            <section
              id="resume-translator-panel"
              className="single-panel resume-panel"
              aria-labelledby="resume-title"
              role="tabpanel"
            >
              <div className="resume-panel-heading">
                <div>
                  <p className="eyebrow">U.S. RESUME TRANSLATOR</p>
                  <h2 id="resume-title">{profile.name}&apos;s translated resume</h2>
                  <p className="panel-lede">
                    Adapted for {profile.target || "your target role"} applications in the
                    United States, using the experience and education you provided.
                  </p>
                </div>
                {generatedResume && !isTranslating && (
                  <button
                    className="download-button"
                    type="button"
                    onClick={() => void downloadResume(generatedResume, profile.name)}
                    aria-label="Download resume as Word document"
                  >
                    ↓ Download resume
                  </button>
                )}
              </div>

              {isTranslating && (
                <div className="loading-state" role="status" aria-live="polite">
                  <span aria-hidden="true">⟳</span>
                  <span>Translating your resume…</span>
                </div>
              )}

              {!isTranslating && translationNotice && (
                <div className="translation-warning" role="status" aria-live="polite">
                  <strong>Heads up:</strong> {translationNotice}
                </div>
              )}

              {!isTranslating && advisory && (
                <div className="honesty-note" role="status" aria-live="polite">
                  <div>
                    <strong>Verify before you apply</strong>
                    <p>{advisory}</p>
                  </div>
                </div>
              )}

              {generatedResume && !isTranslating && (
                <>
                  <div
                    className="success-message"
                    role="status"
                    aria-live="polite"
                  >
                    <span aria-hidden="true">✓</span>
                    Resume translation complete
                    {generatedResume.confidence && (
                      <span
                        className={generatedResume.confidence === "resume" ? "ai-badge" : "translation-warning-badge"}
                        style={{ marginLeft: "auto" }}
                      >
                        {generatedResume.confidence === "resume"
                          ? "✓ Extracted from your uploaded resume"
                          : "⚠ Based on profile answers — verify details"}
                      </span>
                    )}
                  </div>

                  <div className="resume-document">
                    <span className="resume-stamp" aria-hidden="true">CAREER PASSPORT</span>
                    <div className="resume-header">
                      <h3>{profile.name}</h3>
                      <p>{generatedResume.headline}</p>
                      {generatedResume.sourceLanguage &&
                        generatedResume.sourceLanguage !== "English" && (
                          <span className="resume-language-note">
                            Translated from {generatedResume.sourceLanguage} to English
                          </span>
                        )}
                      {generatedResume.contact?.length ? (
                        <span>{generatedResume.contact.join(" · ")}</span>
                      ) : (
                        <span>{profile.country} experience · United States</span>
                      )}
                    </div>

                    {generatedResume.education && (
                      <section className="resume-section">
                        <h4>Education</h4>
                        <p className="resume-template-lines">{generatedResume.education}</p>
                      </section>
                    )}

                    {generatedResume.summary && (
                      <section className="resume-section">
                        <h4>Professional Summary</h4>
                        <p>{generatedResume.summary}</p>
                      </section>
                    )}

                    {generatedResume.experience.length > 0 && (
                      <section className="resume-section">
                        <h4>Professional Experience</h4>
                        {generatedResume.experience.map((exp, idx) => (
                          <div key={idx} className="resume-role">
                            <div>
                              <strong>{exp.title}</strong>
                              <span>{exp.company}</span>
                            </div>
                            <span>{exp.dates}</span>
                            <ul>
                              {exp.bullets.map((bullet, bidx) => (
                                <li key={bidx}>{bullet}</li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </section>
                    )}

                    {generatedResume.leadershipActivities?.length ? (
                      <section className="resume-section">
                        <h4>Leadership &amp; Activities</h4>
                        {generatedResume.leadershipActivities.map((act, idx) => (
                          <div key={idx} className="resume-role">
                            <div>
                              <strong>{act.title}</strong>
                              <span>{act.organization}</span>
                            </div>
                            <span>{act.dates}</span>
                            <ul>
                              {act.bullets.map((b, bidx) => (
                                <li key={bidx}>{b}</li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </section>
                    ) : null}

                    {generatedResume.skills.length > 0 && (
                      <section className="resume-section">
                        <h4>Skills</h4>
                        <div className="resume-skill-list">
                          {generatedResume.skills.map((skill) => (
                            <span key={skill}>{skill}</span>
                          ))}
                        </div>
                      </section>
                    )}
                  </div>

                  {generatedResume.note && (
                    <div className="resume-note">
                      <strong>Before you use this:</strong>
                      <p>{generatedResume.note}</p>
                    </div>
                  )}
                </>
              )}

              {!generatedResume && !isTranslating && (
                <p className="panel-lede" style={{ marginTop: "24px" }}>
                  No translation yet. Return to the onboarding screen and generate your career passport.
                </p>
              )}
            </section>
          )}

          {/* ── Resume improvements ────────────────────────────────────────── */}
          {tab === "Resume improvements" && (
            <section
              id="resume-improvements-panel"
              aria-labelledby="improvements-title"
              role="tabpanel"
            >
              {matchReport && (
                <>
                  <div className="improvement-score-grid">
                    <div>
                      <span>Resume Similarity</span>
                      <strong>{matchReport.similarityScore}%</strong>
                      <small>How closely the resume language matches this role</small>
                    </div>
                    <div>
                      <span>Acceptance Likelihood</span>
                      <strong>{matchReport.acceptanceLikelihood}%</strong>
                      <small>Stronger evidence can improve this estimate</small>
                    </div>
                  </div>

                  <section aria-labelledby="keywords-title" style={{ marginTop: "24px" }}>
                    <h2 id="keywords-title" style={{ fontSize: "16px", marginBottom: "12px" }}>
                      Keyword Analysis
                    </h2>
                    <div className="keyword-comparison">
                      <div>
                        <h3>Keywords that match</h3>
                        <div className="keyword-list">
                          {matchReport.matchedKeywords.length ? (
                            matchReport.matchedKeywords.map((kw) => (
                              <span key={kw} className="keyword-match">✓ {kw}</span>
                            ))
                          ) : (
                            <span className="keyword-missing">No direct matches found yet</span>
                          )}
                        </div>
                      </div>
                      <div>
                        <h3>Keywords missing</h3>
                        <div className="keyword-list">
                          {matchReport.missingKeywords.length ? (
                            matchReport.missingKeywords.map((kw) => (
                              <span key={kw} className="keyword-missing">◆ {kw}</span>
                            ))
                          ) : (
                            <span className="keyword-match">No missing keywords detected</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </section>
                </>
              )}

              <section aria-labelledby="improvements-title" style={{ marginTop: "24px" }}>
                <div className="section-heading">
                  <div>
                    <p className="eyebrow">YOUR IMPROVEMENT PATHWAY</p>
                    <h2 id="improvements-title">Action steps</h2>
                  </div>
                </div>
                <div className="full-checklist">
                  {currentSteps.map(([title, description], index) => (
                    <button
                      key={title}
                      className={`full-step ${done.includes(title) ? "done" : ""}`}
                      onClick={() => toggle(title)}
                      aria-pressed={done.includes(title)}
                    >
                      <span
                        className={`step-number ${done.includes(title) ? "complete" : ""}`}
                      >
                        {done.includes(title) ? "✓" : `0${index + 1}`}
                      </span>
                      <span>
                        <strong>{title}</strong>
                        <small>{description}</small>
                      </span>
                    </button>
                  ))}
                </div>
              </section>

              <section className="below-grid" style={{ marginTop: "32px" }}>
                <div>
                  <div className="section-heading compact">
                    <div>
                      <p className="eyebrow">RESUME EVIDENCE</p>
                      <h2>What your profile supports</h2>
                    </div>
                  </div>
                  <div className="path-list">
                    {currentEvidence.map((item) => (
                      <article className="path-card" key={item}>
                        <div className="path-icon" aria-hidden="true">✓</div>
                        <div className="path-copy">
                          <h3>{item}</h3>
                          <p>Provided in your profile and available for evidence-based resume review.</p>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              </section>
            </section>
          )}

          {/* ── Resources ──────────────────────────────────────────────────── */}
          {tab === "Resources" && (
            <section
              id="resources-panel"
              aria-labelledby="resources-title"
              role="tabpanel"
            >
              <h2 id="resources-title" style={{ fontSize: "22px", marginBottom: "8px" }}>
                Resources for your next step
              </h2>
              <p style={{ color: "var(--muted)", marginBottom: "20px", fontSize: "13px" }}>
                Use these resources to address gaps in your profile and advance your career pathway.
              </p>
              <div className="resource-list">
                {currentResources.map((resource) => (
                  <article key={resource.title} className="resource-card">
                    <div>
                      <p className="eyebrow">{resource.title}</p>
                      <h3>{resource.description}</h3>
                      <p>{resource.reason}</p>
                    </div>
                    <a
                      href={resource.href}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`${resource.description} (opens in new tab)`}
                    >
                      Open resource
                    </a>
                  </article>
                ))}
              </div>
            </section>
          )}

          {/* ── How it works ───────────────────────────────────────────────── */}
          {tab === "How it works" && (
            <section
              id="how-it-works-panel"
              className="single-panel"
              aria-labelledby="how-title"
              role="tabpanel"
            >
              <p className="eyebrow">HOW CAREER PASSPORT WORKS</p>
              <h2 id="how-title">Your resume improvement pathway</h2>
              <p className="panel-lede">
                Use these steps to strengthen your resume and compare it with a specific U.S.
                job application. Career Passport does not make licensing or hiring decisions.
              </p>

              <div className="full-checklist">
                {improvementSteps.map((step, index) => (
                  <button
                    key={step}
                    className="full-step"
                    onClick={() => toggle(step)}
                    aria-pressed={done.includes(step)}
                  >
                    <span
                      className={`step-number ${done.includes(step) ? "complete" : ""}`}
                    >
                      {done.includes(step) ? "✓" : `0${index + 1}`}
                    </span>
                    <span>
                      <strong>Step {index + 1}</strong>
                      <small>{step}</small>
                    </span>
                  </button>
                ))}
              </div>

              <div className="source-box">
                <strong>Source transparency</strong>
                <p>
                  Career Passport summarizes the information you provide and the public job
                  posting when available. Verify requirements with the employer or professional
                  authority.
                </p>
              </div>
            </section>
          )}

          <footer>
            <span>Career Passport helps translate and organize your professional background.</span>
            <span>Not an official credential evaluation, licensing decision, or legal advice.</span>
          </footer>
        </div>
      </main>
    </div>
  );
}
