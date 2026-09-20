// Updated page.tsx with accessibility enhancements
"use client";

import { useState } from "react";
import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from "docx";

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
};

// Helper functions remain the same
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
  const resources: Resource[] = [
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
  ];
  return resources;
}

// Accessible version of the main component
export default function Home() {
  const [currentTab, setCurrentTab] = useState<string>("Profile");
  const [profile, setProfile] = useState<Profile>({
    name: "",
    country: "",
    degree: "",
    field: "",
    experience: "",
    title: "",
    target: "",
    applicationLink: "",
    sourceLanguage: "English",
    resume: "",
  });

  const [matchReport, setMatchReport] = useState<MatchReport | null>(null);
  const [generatedResume, setGeneratedResume] = useState<GeneratedResume | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [done, setDone] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Form validation
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!profile.country) newErrors.country = "Please select your country";
    if (!profile.degree) newErrors.degree = "Please enter your degree name";
    if (!profile.target) newErrors.target = "Please select your target role";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const updateProfile = (key: keyof Profile, value: string) => {
    setProfile({ ...profile, [key]: value });
    // Clear error when user starts typing
    if (errors[key]) {
      setErrors({ ...errors, [key]: "" });
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        updateProfile("resume", content);
      };
      reader.readAsText(file);
    }
  };

  const generateMatch = async () => {
    if (!validateForm()) {
      return;
    }

    setIsGenerating(true);
    try {
      const response = await fetch("/api/translate-resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      const data = await response.json();
      setMatchReport(data);
    } catch (error) {
      setErrors({ submit: "Error generating career match. Please try again." });
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadResume = async () => {
    if (!generatedResume) return;

    const doc = new Document({
      sections: [
        {
          children: [
            new Paragraph({
              text: generatedResume.headline,
              heading: HeadingLevel.HEADING_1,
            }),
          ],
        },
      ],
    });

    const blob = await Packer.toBlob(doc);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "career-passport-resume.docx";
    a.click();
  };

  const toggle = (step: string) => {
    setDone((prev) =>
      prev.includes(step) ? prev.filter((s) => s !== step) : [...prev, step]
    );
  };

  const currentSteps = getSteps(profile);
  const currentEvidence = getEvidence(profile);
  const currentResources = getResources(profile);

  const tabList = ["Profile", "Career map", "Resume", "Resume improvements", "How it works", "Resources"];

  return (
    <div className="app-shell">
      {/* Skip to main content link for keyboard users */}
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      {/* Sidebar Navigation */}
      <aside className="sidebar" role="navigation" aria-label="Main navigation">
        <div className="brand">
          <div className="brand-mark">🌍</div>
          <span>CAREER PASSPORT</span>
        </div>

        {profile.name && (
          <div className="sidebar-profile" role="region" aria-label="Your profile">
            <div className="large-avatar" aria-hidden="true">
              {profile.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <strong>{profile.name}</strong>
              <span>{profile.country}</span>
            </div>
          </div>
        )}

        <nav className="nav-list" role="tablist">
          {tabList.map((tab) => (
            <button
              key={tab}
              className={`nav-item ${currentTab === tab ? "active" : ""}`}
              onClick={() => setCurrentTab(tab)}
              role="tab"
              aria-selected={currentTab === tab}
              aria-controls={`${tab.toLowerCase()}-panel`}
            >
              <span className="nav-symbol" aria-hidden="true">
                {tab === "Profile" && "📝"}
                {tab === "Career map" && "🗺️"}
                {tab === "Resume" && "📄"}
                {tab === "Resume improvements" && "⬆️"}
                {tab === "How it works" && "ℹ️"}
                {tab === "Resources" && "🔗"}
              </span>
              <span>{tab}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="privacy-note">
            <strong>About</strong>
            <small>Career Passport helps translate your international credentials into U.S. career pathways.</small>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content" id="main-content">
        {/* Top Bar */}
        <header className="topbar" role="banner">
          <div className="breadcrumb" aria-label="Page breadcrumb">
            Career Passport <span aria-hidden="true">›</span> <span>{currentTab}</span>
          </div>
        </header>

        {/* Content Area */}
        <div className="content-wrap">
          {/* Profile Tab */}
          {currentTab === "Profile" && (
            <section className="onboarding" aria-labelledby="profile-title">
              <div className="onboarding-content">
                <h1 id="profile-title">Create Your Career Profile</h1>
                <p className="lede">
                  Tell us about your education and experience. We'll help you understand 
                  how it translates to U.S. opportunities.
                </p>

                <div className="setup-card">
                  <form onSubmit={(e) => { e.preventDefault(); generateMatch(); }} 
                        aria-describedby="form-instructions">
                    <p id="form-instructions" className="sr-only">
                      Fill in your educational background and professional experience.
                      All fields are optional unless marked as required.
                    </p>

                    <div className="form-grid">
                      {/* Country Field */}
                      <div>
                        <label htmlFor="country-select">
                          Country
                          <span className="required" aria-label="required">*</span>
                        </label>
                        <select
                          id="country-select"
                          value={profile.country}
                          onChange={(e) => updateProfile("country", e.target.value)}
                          aria-invalid={!!errors.country}
                          aria-describedby={errors.country ? "country-error" : "country-hint"}
                          required
                        >
                          <option value="">Select a country</option>
                          <option value="India">India</option>
                          <option value="Philippines">Philippines</option>
                          <option value="Nigeria">Nigeria</option>
                          <option value="Ukraine">Ukraine</option>
                        </select>
                        {errors.country ? (
                          <span id="country-error" role="alert" className="error-message">
                            {errors.country}
                          </span>
                        ) : (
                          <small id="country-hint">
                            Where you earned your degree
                          </small>
                        )}
                      </div>

                      {/* Degree Field */}
                      <div>
                        <label htmlFor="degree-input">
                          Degree Name
                          <span className="required" aria-label="required">*</span>
                        </label>
                        <input
                          id="degree-input"
                          type="text"
                          placeholder="e.g., Bachelor of Technology"
                          value={profile.degree}
                          onChange={(e) => updateProfile("degree", e.target.value)}
                          aria-invalid={!!errors.degree}
                          aria-describedby={errors.degree ? "degree-error" : "degree-hint"}
                          required
                        />
                        {errors.degree ? (
                          <span id="degree-error" role="alert" className="error-message">
                            {errors.degree}
                          </span>
                        ) : (
                          <small id="degree-hint">
                            Examples: B.Tech, Bachelor of Science
                          </small>
                        )}
                      </div>

                      {/* Field of Study */}
                      <div>
                        <label htmlFor="field-input">
                          Field of Study
                        </label>
                        <input
                          id="field-input"
                          type="text"
                          placeholder="e.g., Computer Science"
                          value={profile.field}
                          onChange={(e) => updateProfile("field", e.target.value)}
                          aria-describedby="field-hint"
                        />
                        <small id="field-hint">
                          Your degree specialty
                        </small>
                      </div>

                      {/* Experience */}
                      <div>
                        <label htmlFor="experience-input">
                          Years of Experience
                        </label>
                        <input
                          id="experience-input"
                          type="text"
                          placeholder="e.g., 5"
                          value={profile.experience}
                          onChange={(e) => updateProfile("experience", e.target.value)}
                          aria-describedby="experience-hint"
                        />
                        <small id="experience-hint">
                          Professional experience since graduation
                        </small>
                      </div>

                      {/* Job Title */}
                      <div>
                        <label htmlFor="title-input">
                          Current or Most Recent Title
                        </label>
                        <input
                          id="title-input"
                          type="text"
                          placeholder="e.g., Senior Software Engineer"
                          value={profile.title}
                          onChange={(e) => updateProfile("title", e.target.value)}
                          aria-describedby="title-hint"
                        />
                        <small id="title-hint">
                          Your professional title
                        </small>
                      </div>

                      {/* Target Role */}
                      <div>
                        <label htmlFor="target-input">
                          Target U.S. Role
                          <span className="required" aria-label="required">*</span>
                        </label>
                        <input
                          id="target-input"
                          type="text"
                          placeholder="e.g., Software Engineer"
                          value={profile.target}
                          onChange={(e) => updateProfile("target", e.target.value)}
                          aria-invalid={!!errors.target}
                          aria-describedby={errors.target ? "target-error" : "target-hint"}
                          required
                        />
                        {errors.target ? (
                          <span id="target-error" role="alert" className="error-message">
                            {errors.target}
                          </span>
                        ) : (
                          <small id="target-hint">
                            The role you want to pursue
                          </small>
                        )}
                      </div>

                      {/* Resume Upload */}
                      <div className="resume-drop">
                        <label htmlFor="resume-upload">
                          Upload Resume <span aria-label="optional">(optional)</span>
                        </label>
                        <input
                          id="resume-upload"
                          type="file"
                          accept=".pdf,.docx,.txt"
                          onChange={handleFileUpload}
                          aria-describedby="upload-hint"
                        />
                        <strong>Upload resume</strong>
                        <small id="upload-hint">
                          PDF, DOCX, or TXT. Max 5MB
                        </small>
                      </div>
                    </div>

                    {errors.submit && (
                      <div role="alert" className="error-message" style={{ marginTop: "16px" }}>
                        {errors.submit}
                      </div>
                    )}

                    <button 
                      type="submit"
                      className="generate-button"
                      disabled={isGenerating}
                      aria-busy={isGenerating}
                    >
                      {isGenerating ? "Generating..." : "Generate Career Map"}
                      <span>→</span>
                    </button>
                  </form>
                </div>
              </div>
            </section>
          )}

          {/* Career Map Tab */}
          {currentTab === "Career map" && (
            <section id="career-map-panel" aria-labelledby="map-title">
              <h1 id="map-title" style={{ fontSize: "24px", marginBottom: "24px" }}>
                Your U.S. Career Map
              </h1>

              {/* Career pathway visualization */}
              <div className="map-grid" role="img" aria-label="Career pathway diagram">
                <div className="map-node">
                  <span className="node-kicker">YOUR BACKGROUND</span>
                  <strong>{profile.degree || "International degree"}</strong>
                  <span>
                    {profile.field || "Professional experience"} · {profile.country}
                  </span>
                  <div className="node-line" />
                  <strong>{profile.experience || "0"} years experience</strong>
                  <span>{profile.title || "Previous professional role"}</span>
                </div>
                <div className="map-connector">
                  <span>TRANSLATE</span>
                  <i aria-hidden="true" />
                  <i aria-hidden="true" />
                  <i aria-hidden="true" />
                </div>
                <div className="map-node">
                  <span className="node-kicker">YOUR NEXT CHAPTER</span>
                  <strong>{profile.target}</strong>
                  <span>United States</span>
                  <div className="progress-mini">
                    <span style={{ width: `${matchReport?.score || 0}%` }} />
                  </div>
                  <small>
                    {matchReport 
                      ? `${matchReport.score}% resume match` 
                      : "Add your resume for a match review"}
                  </small>
                </div>
              </div>

              {/* Skills evidence section */}
              <section style={{ marginTop: "32px" }} aria-labelledby="evidence-title">
                <h2 id="evidence-title" style={{ fontSize: "18px", marginBottom: "16px" }}>
                  What your profile supports
                </h2>
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

          {/* Resume Tab */}
          {currentTab === "Resume" && (
            <section id="resume-panel" aria-labelledby="resume-title">
              <h1 id="resume-title" style={{ fontSize: "24px", marginBottom: "24px" }}>
                Generated Resume
              </h1>

              {isGenerating && (
                <div role="status" aria-live="polite" className="loading-state">
                  <span aria-hidden="true">⟳</span>
                  <span>Translating your resume...</span>
                </div>
              )}

              {generatedResume && (
                <>
                  <div role="status" aria-live="polite" className="success-message" style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "12px",
                    background: "#e8f5e9",
                    borderLeft: "4px solid #4caf50",
                    marginBottom: "20px",
                    borderRadius: "4px"
                  }}>
                    <span aria-hidden="true">✓</span>
                    Resume translation complete
                  </div>

                  <div className="resume-panel">
                    <div className="resume-document">
                      <div className="resume-header">
                        <h3>{profile.name || "Your Name"}</h3>
                        <p>{profile.target}</p>
                        <span className="sr-only">Contact information available in downloadable version</span>
                      </div>

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

                    <div className="resume-note">
                      <strong>Before you use this:</strong>
                      <p>{generatedResume.note}</p>
                    </div>

                    <button
                      onClick={downloadResume}
                      className="download-button"
                      aria-label="Download resume as Word document"
                    >
                      ⬇️ Download Resume
                    </button>
                  </div>
                </>
              )}
            </section>
          )}

          {/* Resume Improvements Tab */}
          {currentTab === "Resume improvements" && matchReport && (
            <section id="improvements-panel" aria-labelledby="improvements-title">
              <h1 id="improvements-title" style={{ fontSize: "24px", marginBottom: "24px" }}>
                Resume Improvement Roadmap
              </h1>

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
                        matchReport.matchedKeywords.map((keyword) => (
                          <span key={keyword} className="keyword-match">
                            ✓ {keyword}
                          </span>
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
                        matchReport.missingKeywords.map((keyword) => (
                          <span key={keyword} className="keyword-missing">
                            ◆ {keyword}
                          </span>
                        ))
                      ) : (
                        <span className="keyword-match">No missing keywords detected</span>
                      )}
                    </div>
                  </div>
                </div>
              </section>

              <section aria-labelledby="steps-title" style={{ marginTop: "24px" }}>
                <h2 id="steps-title" style={{ fontSize: "16px", marginBottom: "12px" }}>
                  Action Steps
                </h2>
                <div className="full-checklist">
                  {currentSteps.map(([title, description], index) => (
                    <button
                      key={title}
                      className={`full-step ${done.includes(title) ? "done" : ""}`}
                      onClick={() => toggle(title)}
                      aria-pressed={done.includes(title)}
                    >
                      <span className={`step-number ${done.includes(title) ? "complete" : ""}`}>
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
            </section>
          )}

          {/* Resources Tab */}
          {currentTab === "Resources" && (
            <section id="resources-panel" aria-labelledby="resources-title">
              <h1 id="resources-title" style={{ fontSize: "24px", marginBottom: "24px" }}>
                Resources for Your Next Step
              </h1>
              <p style={{ color: "#536962", marginBottom: "20px" }}>
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

          {/* How It Works Tab */}
          {currentTab === "How it works" && (
            <section id="how-it-works-panel" aria-labelledby="how-title">
              <h1 id="how-title" style={{ fontSize: "24px", marginBottom: "24px" }}>
                How Career Passport Works
              </h1>

              <p style={{ color: "#536962", marginBottom: "20px", maxWidth: "600px" }}>
                Career Passport helps translate your international credentials and experience 
                into U.S. career opportunities. It does not make licensing or hiring decisions.
              </p>

              <div className="full-checklist">
                {currentSteps.map(([title, description], index) => (
                  <div key={title} className="full-step">
                    <span className="step-number">0{index + 1}</span>
                    <span>
                      <strong>{title}</strong>
                      <small>{description}</small>
                    </span>
                  </div>
                ))}
              </div>

              <div className="source-box" style={{ marginTop: "32px" }}>
                <strong>Important Disclaimer</strong>
                <p>
                  Career Passport provides informational guidance based on your profile and 
                  job descriptions. It does not replace:
                </p>
                <ul style={{ marginLeft: "20px", marginTop: "8px" }}>
                  <li>Official credential evaluations</li>
                  <li>Professional licensing decisions</li>
                  <li>Immigration legal advice</li>
                  <li>Employer hiring decisions</li>
                </ul>
                <p style={{ marginTop: "12px" }}>
                  Always verify requirements with relevant authorities before making major decisions.
                </p>
              </div>
            </section>
          )}

          {/* Footer */}
          <footer style={{ marginTop: "55px", paddingTop: "17px", borderTop: "1px solid #dce6df" }}>
            <span>Career Passport helps translate and organize your professional background.</span>
            <span>Not an official credential evaluation, licensing decision, or legal advice.</span>
          </footer>
        </div>
      </main>
    </div>
  );
}
