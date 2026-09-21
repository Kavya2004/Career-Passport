import { NextResponse } from "next/server";

// This route does three jobs when a user hits "Generate":
// 1. Try to read the job posting URL they gave us (getJobText).
// 2. Ask Gemini to translate their resume and compare it to the role (requestGemini + the prompt below).
// 3. If Gemini is missing, slow, or returns something we can't parse, fall back to a
//    simple draft built only from the profile form (localDraft) so the app never breaks.

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

// Builds a resume using only the words the user typed in the form — no AI involved.
// This is what people see when there's no Gemini API key, or Gemini fails, so the
// app always shows something useful instead of an error screen.
function localDraft(profile: Profile) {
  const experience = profile.experience || "professional";
  const title = profile.title || "International professional";
  return {
    headline: `${profile.target || title} | ${profile.field || "Transferable expertise"}`,
    sourceLanguage: profile.sourceLanguage === "auto" ? "English or detected language" : profile.sourceLanguage,
    summary: `${title} with ${experience} years of experience in ${profile.field || "a professional field"}. Brings international experience from ${profile.country || "a global background"} and is pursuing ${profile.target || "a U.S. role"} opportunities. Adaptable, detail-oriented, and ready to contribute skills in a U.S. workplace.`,
    experience: [{
      title: profile.target || title,
      company: "Professional experience",
      dates: `${experience} years of experience`,
      bullets: [
        `Applied ${profile.field || "professional"} knowledge to deliver reliable work across complex responsibilities.`,
        "Collaborated with cross-functional teams, documented work clearly, and managed priorities in a professional environment.",
        "Translated international experience into skills relevant to U.S. employers and target role requirements.",
      ],
    }],
    education: `${profile.degree || "International degree"} in ${profile.field || "your field"} · ${profile.country || "International institution"}`,
    skills: [profile.field || "Domain expertise", "Cross-functional collaboration", "Documentation", "Problem solving", "Adaptability"],
    leadershipActivities: [],
    note: "This starter draft uses your profile answers. Add or verify resume-specific achievements before applying.",
    confidence: "profile" as const,
  };
}

// A plain-text, rule-based version of the job match (no AI). It's used as a safety
// net when Gemini is unavailable, and as the starting point Gemini's own answer gets
// merged into (see normalizeMatch below), so there's always a sensible result.
//
// The logic in plain terms: pull the ~12 most meaningful words out of the job
// posting, then check which of those words already appear somewhere in the user's
// profile. Words that appear = "matched keywords", words that don't = "missing
// keywords" and become the basis for the "gaps to fix" list.
function buildMatch(profile: Profile, jobText = "", jobFetchFailed = false) {
  const source = jobText
    ? "Compared with the job posting"
    : jobFetchFailed
      ? "We couldn't read that job posting automatically (the site may block automated requests), so this comparison is based on your profile only. Try pasting the job description directly, or verify the match manually."
      : "Based on your profile";
  const profileText = `${profile.target} ${profile.field} ${profile.title} ${profile.degree}`.toLowerCase();
  const searchable = jobText.toLowerCase();
  // Grab words that look meaningful (4+ letters) and drop common filler words
  // (like "about", "team", "role") so we're left with real skill/requirement terms.
  const jobKeywords = [...new Set((jobText.match(/[a-z][a-z+#.-]{3,}/gi) || []).map((word) => word.toLowerCase()))]
    .filter((word) => !/^(about|after|also|and|from|have|into|that|their|this|with|your|years|will|work|role|team|job|looking|company)$/.test(word))
    .slice(0, 12);
  const matchedKeywords = jobKeywords.filter((keyword) => profileText.includes(keyword));
  const missingKeywords = jobKeywords.filter((keyword) => !profileText.includes(keyword)).slice(0, 4);
  const strengths = [
    profile.title && (!jobText || searchable.includes(profile.title.toLowerCase())) && {
      title: "Your target role is clearly identified",
      evidence: `You provided “${profile.title}” as your current or previous title, which gives employers a concrete starting point for evaluating fit.`,
      reason: "A specific title is easier to compare with a job posting than a broad description of your background.",
    },
    profile.field && {
      title: "Your domain background is visible",
      evidence: `Your profile names ${profile.field} as your field of study or work${profile.experience ? ` and includes ${profile.experience} years of experience` : ""}.`,
      reason: "This connects your previous experience to the target role and gives the resume relevant context.",
    },
    jobText && matchedKeywords.length && {
      title: "Some job-posting language is supported",
      evidence: `The posting terms ${matchedKeywords.slice(0, 3).join(", ")} also appear in your profile information.`,
      reason: "Using accurate language from the posting helps recruiters and applicant-tracking systems recognize relevant experience.",
    },
  ].filter(Boolean);
  const missing = [
    !profile.resume && {
      title: "A source resume is missing",
      evidence: "No resume file was uploaded, so the review can only use your short profile answers.",
      reason: "Without the source document, specific employers, dates, accomplishments, tools, and evidence cannot be verified.",
      correction: "Upload the most complete resume you have so Career Passport can extract and organize those details.",
    },
    !profile.degree && {
      title: "Education details are unclear",
      evidence: "No degree was entered in the profile.",
      reason: "The template expects an Education section with a degree, institution, and dates where available.",
      correction: "Add the degree, institution, country, graduation date, and relevant coursework or honors if supported.",
    },
    !profile.experience && {
      title: "Experience length is unclear",
      evidence: "No years of experience were entered.",
      reason: "Employers need context for the level and scope of your previous work.",
      correction: "Add total years and make each role's dates and progression explicit in the Experience section.",
    },
    ...missingKeywords.map((keyword) => ({
      title: `Evidence for “${keyword}” is unclear`,
      evidence: `The job posting emphasizes “${keyword}”, but it was not found in the profile information available for comparison.`,
      reason: "A keyword alone is not enough; the resume should show where you used it and what result you achieved.",
      correction: `Add a truthful bullet naming ${keyword}, the responsibility or tool involved, and the outcome if your experience supports it.`,
    })),
  ].filter(Boolean);
  const steps = [
    !profile.resume ? "Upload your source resume for a document-level review." : "Rewrite the strongest experience bullets around action, scope, tools, and measurable results.",
    ...missingKeywords.slice(0, 3).map((keyword) => `Add truthful evidence for “${keyword}” from your experience, then place it in the most relevant resume section.`),
    `Check the Experience section for ${profile.target || "your target role"}: each role should show responsibilities, tools, and outcomes supported by your resume.`,
    ...(jobText ? [`Compare the final resume with the ${profile.target || "target role"} posting again and address only requirements still missing.`, "Review the Education and Leadership & Activities sections for accurate, role-relevant supporting details."] : ["Add an application link to compare your resume against a specific job posting."]),
  ];
  // Simple, explainable scoring — not a black box. Start from a baseline, add
  // points for things that support the match (matched keywords, clear strengths),
  // subtract points for each gap found, then clamp the result to a sane range.
  const score = jobText
    ? Math.max(25, Math.min(95, 40 + matchedKeywords.length * 8 - missing.length * 4))
    : Math.max(35, Math.min(92, 45 + strengths.length * 10 - missing.length * 5));
  const acceptanceLikelihood = Math.max(10, Math.min(90, score - missing.length * 3 + (profile.resume ? 8 : -12)));
  return {
    score,
    similarityScore: score,
    acceptanceLikelihood,
    matchedKeywords,
    missingKeywords,
    strengths,
    missing,
    steps,
    source,
  };
}

// Gemini's answer for the job-match section arrives as loosely-typed JSON, and
// sometimes it's missing fields or shaped slightly differently than we asked for
// (e.g. a plain string instead of a {title, evidence, reason} object). This function
// fills in any gaps using the rule-based `fallback` from buildMatch, so the UI never
// has to deal with missing data.
function normalizeMatch(candidate: unknown, fallback: ReturnType<typeof buildMatch>) {
  if (!candidate || typeof candidate !== "object") return fallback;
  const value = candidate as Record<string, unknown>;
  const similarityScore = typeof value.similarityScore === "number"
    ? value.similarityScore
    : typeof value.score === "number" ? value.score : fallback.similarityScore;
  const normalizeFinding = (item: unknown, missing: boolean) => {
    if (typeof item === "string") {
      return {
        title: item,
        evidence: missing ? `The resume does not clearly show evidence for ${item}.` : `The resume includes information related to ${item}.`,
        reason: missing ? "The employer may not be able to verify this requirement from the current resume." : "This gives the application relevant evidence for the role.",
        correction: missing ? `Add a truthful resume bullet showing how you used ${item}, if your experience supports it.` : "Keep this evidence specific and connected to an outcome.",
      };
    }
    if (!item || typeof item !== "object") return null;
    const finding = item as Record<string, unknown>;
    const title = typeof finding.title === "string" ? finding.title : typeof finding.keyword === "string" ? finding.keyword : "Resume finding";
    return {
      title,
      evidence: typeof finding.evidence === "string" ? finding.evidence : `The resume information related to ${title} needs review.`,
      reason: typeof finding.reason === "string" ? finding.reason : missing ? "This requirement is not clearly supported by the current resume." : "This information may support relevance to the role.",
      correction: typeof finding.correction === "string" ? finding.correction : missing ? `Add accurate evidence for ${title} if it is part of your experience.` : "Keep the supporting evidence clear and specific.",
    };
  };
  const normalizedStrengths = Array.isArray(value.strengths) ? value.strengths.map((item) => normalizeFinding(item, false)).filter(Boolean) : fallback.strengths;
  const normalizedMissing = Array.isArray(value.missing) ? value.missing.map((item) => normalizeFinding(item, true)).filter(Boolean) : fallback.missing;
  return {
    ...fallback,
    ...value,
    score: similarityScore,
    similarityScore,
    acceptanceLikelihood: typeof value.acceptanceLikelihood === "number" ? value.acceptanceLikelihood : fallback.acceptanceLikelihood,
    matchedKeywords: Array.isArray(value.matchedKeywords) ? value.matchedKeywords.filter((item): item is string => typeof item === "string") : fallback.matchedKeywords,
    missingKeywords: Array.isArray(value.missingKeywords) ? value.missingKeywords.filter((item): item is string => typeof item === "string") : fallback.missingKeywords,
    strengths: normalizedStrengths,
    missing: normalizedMissing,
    steps: Array.isArray(value.steps) ? value.steps.filter((item): item is string => typeof item === "string") : fallback.steps,
  };
}

// Tries to download the job posting page and strip it down to plain text.
// Some job sites block automated requests or return a near-empty page, so we
// report `failed: true` in those cases instead of pretending nothing was provided —
// that lets the UI explain what happened rather than silently ignoring the link.
async function getJobText(link: string): Promise<{ text: string; failed: boolean }> {
  if (!/^https?:\/\//i.test(link)) return { text: "", failed: false };
  try {
    const response = await fetch(link, { signal: AbortSignal.timeout(5000), headers: { Accept: "text/html,text/plain" } });
    if (!response.ok) return { text: "", failed: true };
    const html = await response.text();
    // Strip scripts, styles, and HTML tags, leaving just the readable words.
    const text = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 12000);
    return { text, failed: text.trim().length < 50 };
  } catch {
    return { text: "", failed: true };
  }
}

// Gemini sometimes returns `education` as a plain string, and sometimes as an
// object with separate fields (like { degree, institution, year }). This makes
// sure our UI always receives a single readable string either way.
// `confidence` records whether this resume came from a real uploaded document
// ("resume") or was inferred from the short profile form alone ("profile") —
// the frontend uses this to show a trust badge to the user.
function normalizeResume(resume: unknown, confidence: "resume" | "profile") {
  if (!resume || typeof resume !== "object") return null;
  const value = resume as Record<string, unknown>;
  const education = value.education;
  const normalizedEducation = typeof education === "string"
    ? education
    : education && typeof education === "object"
      ? Object.values(education as Record<string, unknown>).filter((item) => typeof item === "string").join(" · ")
      : "International education";

  return { ...value, education: normalizedEducation, confidence };
}

// We ask Gemini to reply with pure JSON, but it sometimes wraps the answer in a
// Markdown code fence (```json ... ```) anyway. This strips that fence first, and
// if the JSON still won't parse, it looks for the first `{` and last `}` and tries
// again — a small safety net for otherwise-valid JSON with stray text around it.
function parseJsonResponse(text: unknown) {
  if (typeof text !== "string") return null;
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start === -1 || end <= start) return null;
    try {
      return JSON.parse(cleaned.slice(start, end + 1));
    } catch {
      return null;
    }
  }
}

// Calls the Gemini API, and if a model is overloaded or temporarily unavailable
// (429/500/503, etc.), retries a couple of times, then moves on to try the next
// model name in the list. This makes the app resilient to short outages instead
// of failing on the first hiccup.
async function requestGemini(apiKey: string, body: object) {
  const configuredModel = process.env.GEMINI_MODEL;
  const models = [...new Set([configuredModel, "gemini-2.5-flash", "gemini-2.0-flash", "gemini-3.6-flash"].filter(Boolean))] as string[];
  let lastResponse: Response | null = null;
  for (const model of models) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      lastResponse = response;
      if (![404, 429, 500, 502, 503, 504].includes(response.status)) return response;
      if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
    }
  }
  if (!lastResponse) throw new Error("No Gemini models were configured");
  return lastResponse;
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const profile = JSON.parse(String(formData.get("profile") || "{}")) as Profile;
  const file = formData.get("resume");
  const sourceLanguage = String(formData.get("sourceLanguage") || profile.sourceLanguage || "auto");
  const apiKey = process.env.GEMINI_API_KEY;

  // "Do we actually have a real document to work from?" If not, we still generate
  // something useful, but we tell the user honestly (via `advisory`/`confidence`)
  // that the result is a best guess from the form, not verified against a resume.
  const hasSourceDocument = file instanceof File || !!profile.resumeText;
  const confidence: "resume" | "profile" = hasSourceDocument ? "resume" : "profile";
  const advisory = hasSourceDocument
    ? undefined
    : "No resume file was uploaded, so this translation and match are based only on your profile answers. Upload a resume for a more accurate, evidence-based result.";
  const { text: jobText, failed: jobFetchFailed } = await getJobText(profile.applicationLink || "");
  const match = buildMatch(profile, jobText, jobFetchFailed);

  // No Gemini key configured at all (e.g. local dev without .env.local) —
  // skip straight to the offline draft instead of trying to call the API.
  if (!apiKey) return NextResponse.json({ source: "profile draft", resume: localDraft(profile), match, advisory });

  let resumePart = { text: profile.resumeText || "No resume was uploaded; use profile facts only." };
  if (file instanceof File) {
    // Path A: the user uploaded an actual file (PDF/DOCX/image). We send the raw
    // file bytes to Gemini so it can read the real document, instead of just text.
    const bytes = Buffer.from(await file.arrayBuffer()).toString("base64");
    resumePart = { text: `Attached file (${file.name}, ${file.type || "unknown type"}) is available as inline document data.` };
    const prompt = `The submitted resume is in ${sourceLanguage === "auto" ? "an unknown language; detect it first" : sourceLanguage}. Translate all resume content into accurate professional English before structuring it. Preserve names, employers, credentials, dates, responsibilities, and achievements exactly; do not invent or omit facts. Then translate this resume into the target role's U.S.-style resume while following this template structure exactly: contact header, Education, Experience, and Leadership & Activities. Return JSON only with keys sourceLanguage (the detected source language), headline, contact (array of strings), education (string with institution, degree, dates, and details separated by newlines), experience (array of title/company/dates/bullets), leadershipActivities (array of title/organization/dates/bullets), skills (array), note, and match (object with similarityScore 0-100, acceptanceLikelihood 0-100 as a cautious estimate rather than a promise, matchedKeywords array, missingKeywords array, strengths array of title/evidence/reason, missing array of title/evidence/reason/correction, and steps array). Compare the translated resume content to the job posting. In match.strengths and match.missing, cite the actual translated resume section or bullet that supports your reasoning. Omit unknown fields and sections instead of inventing employers, dates, GPA, metrics, credentials, technologies, responsibilities, activities, or achievements. Do not copy decorative colors, photo layouts, sidebars, or template placeholder text. Explain the output is a draft. Profile: ${JSON.stringify(profile)} Job posting text: ${jobText || "No job posting link was provided; use the target role only."}`;
    const response = await requestGemini(apiKey, { contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType: file.type || "application/pdf", data: bytes } }] }], generationConfig: { responseMimeType: "application/json" } });
    if (!response.ok) return NextResponse.json({ source: "profile draft", resume: localDraft(profile), match, warning: `Gemini could not read this resume (${response.status}), so Career Passport created a profile-based draft.` });
    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    try {
      const parsed = parseJsonResponse(text);
      const resume = normalizeResume(parsed, confidence);
      if (resume) return NextResponse.json({ source: "Gemini", resume, match: normalizeMatch(parsed.match, match), advisory });
    } catch { /* Fall back to the profile draft below. */ }
    return NextResponse.json({ source: "profile draft", resume: localDraft(profile), match, warning: "The AI response was not valid JSON, so Career Passport created a profile-based draft." });
  }

  // Path B: no file, but the user may have pasted resume text directly
  // (resumePart falls back to that, or to a note saying nothing was provided).
  const prompt = `The submitted resume is in ${sourceLanguage === "auto" ? "an unknown language; detect it first" : sourceLanguage}. Translate all resume content into accurate professional English before structuring it. Preserve names, employers, credentials, dates, responsibilities, and achievements exactly; do not invent or omit facts. Then translate this resume into the target role's U.S.-style resume while following this template structure exactly: contact header, Education, Experience, and Leadership & Activities. Return JSON only with keys sourceLanguage (the detected source language), headline, contact (array of strings), education (string with institution, degree, dates, and details separated by newlines), experience (array of title/company/dates/bullets), leadershipActivities (array of title/organization/dates/bullets), skills (array), note, and match (object with similarityScore 0-100, acceptanceLikelihood 0-100 as a cautious estimate rather than a promise, matchedKeywords array, missingKeywords array, strengths array of title/evidence/reason, missing array of title/evidence/reason/correction, and steps array). Compare the translated resume content to the job posting. In match.strengths and match.missing, cite the actual translated resume section or bullet that supports your reasoning. Omit unknown fields and sections instead of inventing employers, dates, GPA, metrics, credentials, technologies, responsibilities, activities, or achievements. Do not copy decorative colors, photo layouts, sidebars, or template placeholder text. Explain the output is a draft. Profile: ${JSON.stringify(profile)} Resume text: ${resumePart.text} Job posting text: ${jobText || "No job posting link was provided; use the target role only."}`;
  const response = await requestGemini(apiKey, { contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json" } });

  if (!response.ok) return NextResponse.json({ source: "profile draft", resume: localDraft(profile), match, warning: `Gemini was unavailable (${response.status}), so Career Passport created a profile-based draft.` });
  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  try {
    const parsed = parseJsonResponse(text);
    const resume = normalizeResume(parsed, confidence);
    if (resume) return NextResponse.json({ source: "Gemini", resume, match: normalizeMatch(parsed.match, match), advisory });
  } catch { /* Fall back to the profile draft below. */ }
  return NextResponse.json({ source: "profile draft", resume: localDraft(profile), match, warning: "The AI response was not valid JSON, so Career Passport created a profile-based draft." });
}
