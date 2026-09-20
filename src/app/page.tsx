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
      title: "O*NET OnLine",
      description: "Compare common tasks, skills, tools, and qualifications for your target occupation.",
      href: "https://www.onetonline.org/",
      reason: `Useful for checking the standard U.S. expectations for ${profile.target || "your target role"}.`,
    },
    {
      title: "CareerOneStop",
      description: "Explore occupation profiles, skills, training, and career planning resources.",
      href: "https://www.careeronestop.org/",
      reason: "Helps turn the gaps in your match report into a practical learning plan.",
    },
  ];
  if (/nurse|health|medical|doctor|clinical/.test(role)) {
    resources.push({ title: "U.S. nursing and health licensing resources", description: "Find official state and profession-specific licensing information.", href: "https://www.ncsbn.org/", reason: "Relevant because health professions may require verification, exams, or a license before employment." });
  } else if (/software|developer|engineer|data|technology|it/.test(role)) {
    resources.push({ title: "Skills and technology reference", description: "Review technology occupations, skills, and current role expectations.", href: "https://www.onetonline.org/find/green?t=", reason: "Useful for checking whether your resume names the tools and technical skills the target role expects." });
  } else {
    resources.push({ title: "U.S. Department of Labor resources", description: "Review worker, occupation, and employment guidance from a federal source.", href: "https://www.dol.gov/", reason: "Provides broad employment guidance while you verify role-specific requirements." });
  }
  if (profile.applicationLink) resources.push({ title: "Your job posting", description: "Return to the posting used for your resume match review.", href: profile.applicationLink, reason: "Use it to confirm each missing requirement and tailor only the experience you can support." });
  return resources;
}

async function downloadResume(resume: GeneratedResume, name: string) {
  const children = [
    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: name, bold: true, size: 30 })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: resume.headline, color: "1D6B65", size: 22 })] }),
    ...(resume.contact || []).map((line) => new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: line, size: 18 })] })),
    new Paragraph({ text: "Education", heading: HeadingLevel.HEADING_1 }),
    ...resume.education.split(/\n| · /).map((line) => new Paragraph(line)),
    new Paragraph({ text: "Experience", heading: HeadingLevel.HEADING_1 }),
    ...resume.experience.flatMap((role) => [
      new Paragraph({ children: [new TextRun({ text: role.title, bold: true }), new TextRun({ text: `  |  ${role.company}  |  ${role.dates}` })] }),
      ...role.bullets.map((bullet) => new Paragraph({ text: bullet, bullet: { level: 0 } })),
    ]),
    ...(resume.leadershipActivities?.length ? [
      new Paragraph({ text: "Leadership & Activities", heading: HeadingLevel.HEADING_1 }),
      ...resume.leadershipActivities.flatMap((activity) => [
        new Paragraph({ children: [new TextRun({ text: activity.title, bold: true }), new TextRun({ text: `  |  ${activity.organization}  |  ${activity.dates}` })] }),
        ...activity.bullets.map((bullet) => new Paragraph({ text: bullet, bullet: { level: 0 } })),
      ]),
    ] : []),
    ...(resume.skills.length ? [
      new Paragraph({ text: "Skills", heading: HeadingLevel.HEADING_1 }),
      new Paragraph(resume.skills.join("  ·  ")),
    ] : []),
    new Paragraph({ text: "Review before applying", heading: HeadingLevel.HEADING_2 }),
    new Paragraph(resume.note),
  ];
  const doc = new Document({ sections: [{ children }] });
  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${name.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "resume"}-resume.docx`;
  link.click();
  URL.revokeObjectURL(url);
}

export default function Home() {
  const [tab, setTab] = useState("Career map");
  const [done, setDone] = useState(["Credential evaluation"]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [draft, setDraft] = useState<Profile>({
    name: "",
    country: "",
    degree: "",
    field: "",
    experience: "",
    title: "",
    target: "",
    applicationLink: "",
    resume: "",
  });
  const [generatedResume, setGeneratedResume] =
    useState<GeneratedResume | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [matchReport, setMatchReport] = useState<MatchReport | null>(null);
  const toggle = (name: string) =>
    setDone((current) =>
      current.includes(name)
        ? current.filter((item) => item !== name)
        : [...current, name],
    );
  const updateDraft = (key: keyof Profile, value: string) =>
    setDraft((current) => ({ ...current, [key]: value }));
  const translateResume = async (
    nextProfile: Profile,
    file: File | null = resumeFile,
  ) => {
    setIsTranslating(true);
    try {
      const formData = new FormData();
      formData.append("profile", JSON.stringify(nextProfile));
      if (file) formData.append("resume", file);
      const response = await fetch("/api/translate-resume", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      setGeneratedResume(data.resume);
      setMatchReport(data.match || null);
      if (data.warning) window.alert(data.warning);
    } finally {
      setIsTranslating(false);
    }
  };
  const generate = () => {
    setProfile(draft);
    setTab("Resume translator");
    void translateResume(draft, resumeFile);
  };
  const chooseResume = async (file: File | null) => {
    if (!file) return;
    if (
      file.type === "image/avif" ||
      file.name.toLowerCase().endsWith(".avif")
    ) {
      try {
        const bitmap = await createImageBitmap(file);
        const canvas = document.createElement("canvas");
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        canvas.getContext("2d")?.drawImage(bitmap, 0, 0);
        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, "image/png"),
        );
        if (blob)
          file = new File([blob], file.name.replace(/\.avif$/i, ".png"), {
            type: "image/png",
          });
      } catch {
        /* Keep the original file if the browser cannot decode AVIF. */
      }
    }
    setResumeFile(file);
    updateDraft("resume", file.name);
  };

  if (!profile) {
    return (
      <main className="onboarding">
        <div className="onboarding-top">
          <div className="brand onboarding-brand">
            <span className="brand-mark">B</span>
            <span>CAREER PASSPORT</span>
          </div>
          <span className="onboarding-note">
            PRIVATE BY DESIGN · YOUR DATA STAYS YOURS
          </span>
        </div>
        <section className="onboarding-content">
          <p className="eyebrow">START YOUR TRANSLATION</p>
          <h1>
            Your experience didn&apos;t disappear
            <br />
            when you moved.
          </h1>
          <p className="onboarding-lede">
            Tell us about your professional journey. Career Passport will translate it
            into U.S. career language, opportunities, and next steps.
          </p>
          <div className="setup-card">
            <div className="setup-heading">
              <div>
                <p className="eyebrow">YOUR PROFILE</p>
                <h2>Let&apos;s start with the basics</h2>
              </div>
            </div>
            <div className="form-grid">
              <label>
                Full name
                <input
                  value={draft.name}
                  onChange={(event) => updateDraft("name", event.target.value)}
                  placeholder="e.g. Aisha Khan"
                />
              </label>
              <label>
                Country where you studied
                <input
                  value={draft.country}
                  onChange={(event) =>
                    updateDraft("country", event.target.value)
                  }
                  placeholder="e.g. Vietnam"
                />
              </label>
              <label>
                Degree
                <input
                  value={draft.degree}
                  onChange={(event) =>
                    updateDraft("degree", event.target.value)
                  }
                  placeholder="e.g. B.S. in Computer Engineering"
                />
              </label>
              <label>
                Field of study
                <input
                  value={draft.field}
                  onChange={(event) => updateDraft("field", event.target.value)}
                  placeholder="e.g. Computer Engineering"
                />
              </label>
              <label>
                Years of experience
                <input
                  value={draft.experience}
                  onChange={(event) =>
                    updateDraft("experience", event.target.value)
                  }
                  placeholder="e.g. 5"
                />
              </label>
              <label>
                Previous / current title
                <input
                  value={draft.title}
                  onChange={(event) => updateDraft("title", event.target.value)}
                  placeholder="e.g. Systems Analyst"
                />
              </label>
              <label>
                Target U.S. profession
                <input
                  value={draft.target}
                  onChange={(event) =>
                    updateDraft("target", event.target.value)
                  }
                  placeholder="e.g. Software Engineer"
                />
              </label>
              <label>
                Job application link <span>(optional)</span>
                <input
                  type="url"
                  value={draft.applicationLink}
                  onChange={(event) =>
                    updateDraft("applicationLink", event.target.value)
                  }
                  placeholder="https://company.com/jobs/role"
                />
              </label>
            </div>
            <label className="resume-drop">
              Resume <span>PDF, DOCX, or image</span>
              <input
                type="file"
                accept=".pdf,.doc,.docx,.avif,image/*"
                onChange={(event) =>
                  void chooseResume(event.target.files?.[0] || null)
                }
              />
              <strong>{draft.resume || "Choose a resume to translate"}</strong>
              <small>
                Career Passport sends the original document to AI for extraction when
                configured.
              </small>
            </label>
            <button
              className="generate-button"
              disabled={!draft.name || !draft.target}
              onClick={generate}
            >
              Generate my career passport
            </button>
          </div>
          <p className="onboarding-disclaimer">
            Career Passport provides informational career translation. It does not
            replace official credential evaluations, licensing authorities,
            employer decisions, or legal advice.
          </p>
        </section>
      </main>
    );
  }
  const currentSteps = getSteps(profile);
  const currentEvidence = getEvidence(profile);
  const currentResources = getResources(profile);
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">B</span>
          <span>CAREER PASSPORT</span>
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
            <span>
              {profile.country} → United States
            </span>
          </div>
          <button className="chevron" type="button" aria-label="Open help" onClick={() => setTab("How it works")}>⌄</button>
        </div>
        <nav className="nav-list">
          {["Career map", "My profile", "Resume translator", "Resume improvements", "Resources"].map(
            (item) => (
              <button
                key={item}
                className={`nav-item ${tab === item ? "active" : ""}`}
                onClick={() => setTab(item)}
              >
                <span className="nav-symbol">
                  {item === "Career map"
                    ? "◈"
                    : item === "My profile"
                      ? "◌"
                      : item === "Resume translator"
                        ? "▤"
                        : item === "Resources"
                          ? "⊙"
                          : "⌕"}
                </span>
                {item}
              </button>
            ),
          )}
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
      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumb">
            MY CAREER PASSPORT <span>/</span> {tab.toUpperCase()}
          </div>
          <div className="top-actions">
            <button className="icon-button" aria-label="Notifications">
              ♧
            </button>
            <button className="help-button" onClick={() => setTab("How it works")}>
              Need help? <span>↗</span>
            </button>
          </div>
        </header>
        <div className="content-wrap">
          <section className="welcome-row">
            <div>
              <p className="eyebrow">YOUR CAREER TRANSLATION</p>
              <h1>Your experience has a place here.</h1>
              <p className="lede">
                We translated {profile.name}&apos;s professional journey into a
                clear path forward in the U.S.
              </p>
            </div>
            <label className="upload-button">
              <span>↑</span>
              {profile.resume || "Upload a new document"}
              <input
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={(event) =>
                  setProfile({
                    ...profile,
                    resume: event.target.files?.[0]?.name || profile.resume,
                  })
                }
              />
            </label>
          </section>
          <section className="profile-strip">
            <div className="profile-intro">
              <div className="large-avatar">
                {profile.name
                  .split(" ")
                  .map((part) => part[0])
                  .join("")
                  .slice(0, 2)}
              </div>
              <div>
                <h2>{profile.name}</h2>
                <p>
                  <span>🌍</span> {profile.country}{" "}
                  <span className="divider">•</span> {profile.experience || "0"}{" "}
                  years experience
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
              aria-label="Edit profile"
              onClick={() => setProfile(null)}
            >
              ✎
            </button>
          </section>
          <div className="tab-row">
            {["Career map", "Job match", "Resume improvements", "Resources"].map((item) => (
              <button
                key={item}
                onClick={() => setTab(item)}
                className={tab === item ? "tab-active" : ""}
              >
                {item}
              </button>
            ))}
          </div>
          {tab === "Job match" && matchReport && (
            <section className="match-panel">
              <div className="match-summary">
                <div>
                  <p className="eyebrow">RESUME TO JOB MATCH</p>
                  <h2>{matchReport.score}% match for {profile.target}</h2>
                  <p className="panel-lede">
                    {profile.applicationLink
                      ? matchReport.source
                      : "Add an application link for a more exact comparison with a specific job."}
                  </p>
                </div>
                <div className="match-score">{matchReport.score}%</div>
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
                    {(matchReport.missing.length ? matchReport.missing : [{ title: "No major profile gaps detected", evidence: "The available profile information covers the main comparison fields.", reason: "Keep checking each claim against your source documents.", correction: "Review every entry for accuracy before applying." }]).map((item) => (
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
                  <ol>{matchReport.steps.map((item) => <li key={item}>{item}</li>)}</ol>
                </div>
              </div>
            </section>
          )}
          {tab === "Resume translator" && (
            <section className="single-panel resume-panel">
              <div className="resume-panel-heading">
                <div>
                  <p className="eyebrow">U.S. RESUME TRANSLATOR</p>
                  <h2>{profile.name}&apos;s translated resume</h2>
                  <p className="panel-lede">
                    Adapted for {profile.target || "your target role"}{" "}
                    applications in the United States, using the experience and
                    education you provided.
                  </p>
                </div>
                {generatedResume && !isTranslating && (
                  <button
                    className="download-button"
                    type="button"
                    onClick={() => void downloadResume(generatedResume, profile.name)}
                  >
                    ↓ Download resume
                  </button>
                )}
              </div>
              {isTranslating && (
                <div className="translation-loading">
                  Translating your experience into U.S. employer language…
                </div>
              )}
              {generatedResume && !isTranslating && (
                <div className="resume-document">
                  <div className="resume-header">
                    <h3>{profile.name}</h3>
                    <p>{generatedResume.headline}</p>
                    {generatedResume.contact?.length ? (
                      <span className="resume-contact">
                        {generatedResume.contact.join(" · ")}
                      </span>
                    ) : (
                      <span>
                        {profile.country} experience · United States
                      </span>
                    )}
                  </div>
                  <div className="resume-section">
                    <h4>Education</h4>
                    <p className="resume-template-lines">
                      {generatedResume.education}
                    </p>
                  </div>
                  <div className="resume-section">
                    <h4>Experience</h4>
                    {generatedResume.experience.map((role) => (
                      <div
                        className="resume-role"
                        key={`${role.title}-${role.company}`}
                      >
                        <div>
                          <strong>{role.title}</strong>
                          <span>
                            {role.company} · {role.dates}
                          </span>
                        </div>
                        <ul>
                          {role.bullets.map((bullet) => (
                            <li key={bullet}>{bullet}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                  {!!generatedResume.leadershipActivities?.length && (
                    <div className="resume-section">
                      <h4>Leadership &amp; Activities</h4>
                      {generatedResume.leadershipActivities.map((activity) => (
                        <div
                          className="resume-role"
                          key={`${activity.title}-${activity.organization}`}
                        >
                          <div>
                            <strong>{activity.title}</strong>
                            <span>
                              {activity.organization} · {activity.dates}
                            </span>
                          </div>
                          <ul>
                            {activity.bullets.map((bullet) => (
                              <li key={bullet}>{bullet}</li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}
                  {!!generatedResume.skills.length && (
                    <div className="resume-section">
                      <h4>Skills</h4>
                      <div className="resume-skill-list">
                        {generatedResume.skills.map((skill) => (
                          <span key={skill}>{skill}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="resume-note">
                    <strong>Review before applying</strong>
                    <p>{generatedResume.note}</p>
                  </div>
                </div>
              )}
              <p className="resume-trust">
                Career Passport translates wording and organizes your information. It
                does not add achievements, metrics, credentials, or experience
                that you did not provide.
              </p>
            </section>
          )}
          {tab === "Resume improvements" && (
            <section className="single-panel">
              <p className="eyebrow">RESUME IMPROVEMENTS</p>
              <h2>Make your resume stronger for {profile.target}</h2>
              <p className="panel-lede">
                These actions are based on the resume template sections and the
                job comparison. Complete them in order, then review Job match again.
              </p>
              {matchReport && (
                <>
                  <div className="improvement-score-grid">
                    <div><span>Resume similarity</span><strong>{matchReport.similarityScore}%</strong><small>How closely the resume language and evidence fit this role.</small></div>
                    <div><span>Acceptance likelihood</span><strong>{matchReport.acceptanceLikelihood}%</strong><small>A cautious estimate, not a hiring promise. Stronger evidence can improve it.</small></div>
                  </div>
                  <div className="keyword-comparison">
                    <div>
                      <h3>Keywords that match</h3>
                      <div className="keyword-list">{(matchReport.matchedKeywords.length ? matchReport.matchedKeywords : ["No direct keyword overlap found yet"]).map((keyword) => <span className="keyword-match" key={keyword}>{keyword}</span>)}</div>
                    </div>
                    <div>
                      <h3>Keywords missing from the resume</h3>
                      <div className="keyword-list">{(matchReport.missingKeywords.length ? matchReport.missingKeywords : ["No missing keywords detected"]).map((keyword) => <span className="keyword-missing" key={keyword}>{keyword}</span>)}</div>
                    </div>
                  </div>
                </>
              )}
              <div className="full-checklist">
                {currentSteps.map(([title, description], index) => (
                  <button className="full-step" key={title} onClick={() => toggle(title)}>
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
          )}
          {tab === "Career map" && (
            <>
              <section className="map-section">
                <div className="section-heading">
                  <div>
                    <p className="eyebrow">THE BIG PICTURE</p>
                    <h2>Your U.S. career map</h2>
                  </div>
                  <span className="source-pill">
                    ● Built from your evidence
                  </span>
                </div>
                <div className="map-grid">
                  <div className="map-node">
                    <span className="node-kicker">YOUR BACKGROUND</span>
                    <strong>{profile.degree || "International degree"}</strong>
                    <span>
                      {profile.field || "Professional experience"} ·{" "}
                      {profile.country}
                    </span>
                    <div className="node-line" />
                    <strong>
                      {profile.experience || "0"} years experience
                    </strong>
                    <span>{profile.title || "Previous professional role"}</span>
                  </div>
                  <div className="map-connector">
                    <span>TRANSLATE</span>
                    <i />
                    <i />
                    <i />
                  </div>
                  <div className="map-node">
                    <span className="node-kicker">YOUR NEXT CHAPTER</span>
                    <strong>{profile.target}</strong>
                    <span>United States</span>
                    <div className="progress-mini">
                      <span />
                    </div>
                    <small>{matchReport ? `${matchReport.score}% resume match` : "Add your resume for a match review"}</small>
                  </div>
                </div>
              </section>
              <section className="below-grid">
                <div className="opportunities">
                  <div className="section-heading compact">
                    <div>
                      <p className="eyebrow">RESUME EVIDENCE</p>
                      <h2>What your profile supports</h2>
                    </div>
                  </div>
                  <div className="path-list">
                    {currentEvidence.map((item) => (
                      <article className="path-card" key={item}>
                        <div className="path-icon">✓</div>
                        <div className="path-copy">
                          <h3>{item}</h3>
                          <p>Provided in your profile and available for evidence-based resume review.</p>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              </section>
            </>
          )}
          {tab === "How it works" && (
            <section className="single-panel">
              <p className="eyebrow">
                HOW CAREER PASSPORT WORKS
              </p>
              <h2>Your resume improvement pathway</h2>
              <p className="panel-lede">
                Use these steps to strengthen the resume and compare it with a
                specific U.S. job application. Career Passport does not make
                licensing or hiring decisions.
              </p>
              <div className="full-checklist">
                {currentSteps.map(([title, description], index) => (
                  <button
                    className="full-step"
                    key={title}
                    onClick={() => toggle(title)}
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
              <div className="source-box">
                <strong>Source transparency</strong>
                <p>
                  Career Passport summarizes the information you provide and
                  the public job posting when available. Verify requirements
                  with the employer or professional authority.
                </p>
              </div>
            </section>
          )}
          {tab === "Resources" && (
            <section className="single-panel">
              <p className="eyebrow">RESOURCES FOR YOUR NEXT STEP</p>
              <h2>Resources for {profile.target}</h2>
              <p className="panel-lede">
                These resources are selected from your profile, target role, and
                application link. Use them to address the gaps in your match report.
              </p>
              <div className="resource-list">
                {currentResources.map((resource) => (
                  <article className="resource-card" key={resource.title}>
                    <div>
                      <p className="eyebrow">{resource.title}</p>
                      <h3>{resource.description}</h3>
                      <p>{resource.reason}</p>
                    </div>
                    <a href={resource.href} target="_blank" rel="noreferrer">
                      Open resource
                    </a>
                  </article>
                ))}
              </div>
            </section>
          )}
          <footer>
            <span>
              Career Passport helps translate and organize your professional background.
            </span>
            <span>
              Not an official credential evaluation, licensing decision, or
              legal advice.
            </span>
          </footer>
        </div>
      </main>
    </div>
  );
}
