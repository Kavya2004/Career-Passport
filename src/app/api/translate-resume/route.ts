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
  resume: string;
  resumeText?: string;
};

function localDraft(profile: Profile) {
  const experience = profile.experience || "professional";
  const title = profile.title || "International professional";
  return {
    headline: `${profile.target || title} | ${profile.field || "Transferable expertise"}`,
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
    "Check the Education section against the template: degree, institution, dates, and relevant details should be easy to scan.",
    "Check the Experience section: each role should show title, employer, dates, and concise evidence-based bullets.",
    "Add Leadership & Activities only when you can support the entry with a real organization, responsibility, or result.",
    ...(jobText ? ["Compare the final resume with the job posting again and add only supported requirements that are still missing."] : ["Add an application link to compare your resume against a specific job posting."]),
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
  return {
    ...fallback,
    ...value,
    score: similarityScore,
    similarityScore,
    acceptanceLikelihood: typeof value.acceptanceLikelihood === "number" ? value.acceptanceLikelihood : fallback.acceptanceLikelihood,
    matchedKeywords: Array.isArray(value.matchedKeywords) ? value.matchedKeywords.filter((item): item is string => typeof item === "string") : fallback.matchedKeywords,
    missingKeywords: Array.isArray(value.missingKeywords) ? value.missingKeywords.filter((item): item is string => typeof item === "string") : fallback.missingKeywords,
    strengths: Array.isArray(value.strengths) ? value.strengths : fallback.strengths,
    missing: Array.isArray(value.missing) ? value.missing : fallback.missing,
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
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (response.status !== 503 || attempt === 2) return response;
    await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
  }
  throw new Error("Gemini request failed after retries");
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const profile = JSON.parse(String(formData.get("profile") || "{}")) as Profile;
  const file = formData.get("resume");
  const apiKey = process.env.GEMINI_API_KEY;
  const jobText = await getJobText(profile.applicationLink || "");
  const match = buildMatch(profile, jobText);

  if (!apiKey) return NextResponse.json({ source: "profile draft", resume: localDraft(profile), match });

  let resumePart = { text: profile.resumeText || "No resume was uploaded; use profile facts only." };
  if (file instanceof File) {
    const bytes = Buffer.from(await file.arrayBuffer()).toString("base64");
    resumePart = { text: `Attached file (${file.name}, ${file.type || "unknown type"}) is available as inline document data.` };
    const prompt = `Translate this resume into the target role's U.S.-style resume while following this template structure exactly: contact header, Education, Experience, and Leadership & Activities. Return JSON only with keys headline, contact (array of strings), education (string with institution, degree, dates, and details separated by newlines), experience (array of title/company/dates/bullets), leadershipActivities (array of title/organization/dates/bullets), skills (array), note, and match (object with similarityScore 0-100, acceptanceLikelihood 0-100 as a cautious estimate rather than a promise, matchedKeywords array, missingKeywords array, strengths array of title/evidence/reason, missing array of title/evidence/reason/correction, and steps array). Compare the actual resume to the job posting. In match.strengths and match.missing, cite the actual resume section or bullet that supports your reasoning. Omit unknown fields and sections instead of inventing employers, dates, GPA, metrics, credentials, technologies, responsibilities, activities, or achievements. Keep the writing concise and use bullet points for accomplishments. Do not copy decorative colors, photo layouts, sidebars, or template placeholder text. Explain the output is a draft. Profile: ${JSON.stringify(profile)} Job posting text: ${jobText || "No job posting link was provided; use the target role only."}`;
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
  const prompt = `Translate this resume into the target role's U.S.-style resume while following this template structure exactly: contact header, Education, Experience, and Leadership & Activities. Return JSON only with keys headline, contact (array of strings), education (string with institution, degree, dates, and details separated by newlines), experience (array of title/company/dates/bullets), leadershipActivities (array of title/organization/dates/bullets), skills (array), note, and match (object with similarityScore 0-100, acceptanceLikelihood 0-100 as a cautious estimate rather than a promise, matchedKeywords array, missingKeywords array, strengths array of title/evidence/reason, missing array of title/evidence/reason/correction, and steps array). Compare the actual resume to the job posting. In match.strengths and match.missing, cite the actual resume section or bullet that supports your reasoning. Omit unknown fields and sections instead of inventing employers, dates, GPA, metrics, credentials, technologies, responsibilities, activities, or achievements. Keep the writing concise and use bullet points for accomplishments. Do not copy decorative colors, photo layouts, sidebars, or template placeholder text. Explain the output is a draft. Profile: ${JSON.stringify(profile)} Resume text: ${resumePart.text} Job posting text: ${jobText || "No job posting link was provided; use the target role only."}`;
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
