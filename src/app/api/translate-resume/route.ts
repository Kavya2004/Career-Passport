import { NextResponse } from "next/server";

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
  };
}

function buildMatch(profile: Profile, jobText = "") {
  const source = jobText ? "Compared with the job posting" : "Based on your profile";
  const profileText = `${profile.target} ${profile.field} ${profile.title} ${profile.degree}`.toLowerCase();
  const searchable = jobText.toLowerCase();
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

async function getJobText(link: string) {
  if (!/^https?:\/\//i.test(link)) return "";
  try {
    const response = await fetch(link, { signal: AbortSignal.timeout(5000), headers: { Accept: "text/html,text/plain" } });
    if (!response.ok) return "";
    const html = await response.text();
    return html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 12000);
  } catch {
    return "";
  }
}

function normalizeResume(resume: unknown) {
  if (!resume || typeof resume !== "object") return null;
  const value = resume as Record<string, unknown>;
  const education = value.education;
  const normalizedEducation = typeof education === "string"
    ? education
    : education && typeof education === "object"
      ? Object.values(education as Record<string, unknown>).filter((item) => typeof item === "string").join(" · ")
      : "International education";

  return { ...value, education: normalizedEducation };
}

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
  const jobText = await getJobText(profile.applicationLink || "");
  const match = buildMatch(profile, jobText);

  if (!apiKey) return NextResponse.json({ source: "profile draft", resume: localDraft(profile), match });

  let resumePart = { text: profile.resumeText || "No resume was uploaded; use profile facts only." };
  if (file instanceof File) {
    const bytes = Buffer.from(await file.arrayBuffer()).toString("base64");
    resumePart = { text: `Attached file (${file.name}, ${file.type || "unknown type"}) is available as inline document data.` };
    const prompt = `The submitted resume is in ${sourceLanguage === "auto" ? "an unknown language; detect it first" : sourceLanguage}. Translate all resume content into accurate professional English before structuring it. Preserve names, employers, credentials, dates, responsibilities, and achievements exactly; do not invent or omit facts. Then translate this resume into the target role's U.S.-style resume while following this template structure exactly: contact header, Education, Experience, and Leadership & Activities. Return JSON only with keys sourceLanguage (the detected source language), headline, contact (array of strings), education (string with institution, degree, dates, and details separated by newlines), experience (array of title/company/dates/bullets), leadershipActivities (array of title/organization/dates/bullets), skills (array), note, and match (object with similarityScore 0-100, acceptanceLikelihood 0-100 as a cautious estimate rather than a promise, matchedKeywords array, missingKeywords array, strengths array of title/evidence/reason, missing array of title/evidence/reason/correction, and steps array). Compare the translated resume content to the job posting. In match.strengths and match.missing, cite the actual translated resume section or bullet that supports your reasoning. Omit unknown fields and sections instead of inventing employers, dates, GPA, metrics, credentials, technologies, responsibilities, activities, or achievements. Do not copy decorative colors, photo layouts, sidebars, or template placeholder text. Explain the output is a draft. Profile: ${JSON.stringify(profile)} Job posting text: ${jobText || "No job posting link was provided; use the target role only."}`;
    const response = await requestGemini(apiKey, { contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType: file.type || "application/pdf", data: bytes } }] }], generationConfig: { responseMimeType: "application/json" } });
    if (!response.ok) return NextResponse.json({ source: "profile draft", resume: localDraft(profile), match, warning: `Gemini could not read this resume (${response.status}), so Career Passport created a profile-based draft.` });
    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    try {
      const parsed = parseJsonResponse(text);
      const resume = normalizeResume(parsed);
      if (resume) return NextResponse.json({ source: "Gemini", resume, match: normalizeMatch(parsed.match, match) });
    } catch { /* Fall back to the profile draft below. */ }
    return NextResponse.json({ source: "profile draft", resume: localDraft(profile), match, warning: "The AI response was not valid JSON, so Career Passport created a profile-based draft." });
  }
  const prompt = `The submitted resume is in ${sourceLanguage === "auto" ? "an unknown language; detect it first" : sourceLanguage}. Translate all resume content into accurate professional English before structuring it. Preserve names, employers, credentials, dates, responsibilities, and achievements exactly; do not invent or omit facts. Then translate this resume into the target role's U.S.-style resume while following this template structure exactly: contact header, Education, Experience, and Leadership & Activities. Return JSON only with keys sourceLanguage (the detected source language), headline, contact (array of strings), education (string with institution, degree, dates, and details separated by newlines), experience (array of title/company/dates/bullets), leadershipActivities (array of title/organization/dates/bullets), skills (array), note, and match (object with similarityScore 0-100, acceptanceLikelihood 0-100 as a cautious estimate rather than a promise, matchedKeywords array, missingKeywords array, strengths array of title/evidence/reason, missing array of title/evidence/reason/correction, and steps array). Compare the translated resume content to the job posting. In match.strengths and match.missing, cite the actual translated resume section or bullet that supports your reasoning. Omit unknown fields and sections instead of inventing employers, dates, GPA, metrics, credentials, technologies, responsibilities, activities, or achievements. Do not copy decorative colors, photo layouts, sidebars, or template placeholder text. Explain the output is a draft. Profile: ${JSON.stringify(profile)} Resume text: ${resumePart.text} Job posting text: ${jobText || "No job posting link was provided; use the target role only."}`;
  const response = await requestGemini(apiKey, { contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json" } });

  if (!response.ok) return NextResponse.json({ source: "profile draft", resume: localDraft(profile), match, warning: `Gemini was unavailable (${response.status}), so Career Passport created a profile-based draft.` });
  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  try {
    const parsed = parseJsonResponse(text);
    const resume = normalizeResume(parsed);
    if (resume) return NextResponse.json({ source: "Gemini", resume, match: normalizeMatch(parsed.match, match) });
  } catch { /* Fall back to the profile draft below. */ }
  return NextResponse.json({ source: "profile draft", resume: localDraft(profile), match, warning: "The AI response was not valid JSON, so Career Passport created a profile-based draft." });
}
