# 🛂 Career Passport

**Your professional identity, translated.**

Career Passport takes a resume written anywhere in the world, in any language, and turns it into a clear, U.S.-style resume — then shows you exactly how well it matches a specific job, and what to fix if it doesn't.

Built for **SASE Hack 2026**.

---

## 🌍 Why we built this

We're international students ourselves, and we've watched friends struggle to translate real, hard-won experience into something a U.S. hiring manager or an applicant-tracking system would even recognize. This problem disproportionately affects Asian immigrants and internationally trained professionals across engineering, healthcare, and business — people whose degrees and titles don't map cleanly onto American norms. A brilliant engineer from Mumbai or a nurse from Manila can get auto-rejected simply because their resume wasn't written in the "right" format or language.

We didn't want another person's qualifications to get lost in translation. So we built a tool that does the translating for them — honestly, and with an explanation attached to every claim it makes.

---

## ✨ What it does

- 📄 **Translates** uploaded resumes (PDF, DOCX, or image) into a structured U.S.-style format
- 🌐 **Translates language**, not just format — a resume in Vietnamese, Hindi, Spanish, or another language comes back in clear English
- 🧭 **Follows a consistent template** — Education, Experience, and Leadership & Activities
- 🎯 **Compares your resume to a specific job posting** you link
- 📊 **Shows a similarity score and an estimated acceptance likelihood**
- 🔑 **Identifies matching and missing keywords** between your resume and the posting
- 💡 **Explains its reasoning** — what's working, what's unclear, and exactly how to improve it
- 🧑‍💼 **Recommends career resources** — credential evaluation services, licensing guidance, job boards, and role-specific courses (Coursera, LinkedIn Learning)
- 🛡️ **Never invents facts.** If something can't be verified from what you gave it, the app says so instead of making it up — and it labels every result as either "extracted from your uploaded resume" or "based on your profile answers only."

---

## 🛠️ How it's built

| Layer | Tech |
|---|---|
| Framework | [Next.js](https://nextjs.org/) (App Router) |
| UI | React + TypeScript |
| Styling | Hand-written CSS (`globals.css`) — no component library |
| AI | Google **Gemini** (`gemini-2.5-flash` / `gemini-2.0-flash`, with automatic fallback between models) |
| Export | [`docx`](https://www.npmjs.com/package/docx) — lets users download their translated resume as a real Word document |

**How a request flows through the app:**

```
User fills out the form + uploads a resume
              │
              ▼
   POST /api/translate-resume  (src/app/api/translate-resume/route.ts)
              │
              ├── 1. Try to fetch the job posting URL (if provided)
              │      → strip it down to plain text, or flag that it failed
              │
              ├── 2. Send the resume (file or pasted text) + profile + job text
              │      to Gemini, asking for a structured JSON resume + match report
              │
              ├── 3. If Gemini succeeds → normalize its JSON (it doesn't always
              │      shape fields exactly how we ask) and return it
              │
              └── 4. If Gemini is unavailable, times out, or returns something
                     we can't parse → fall back to a rule-based draft built
                     only from the profile form, so the app never breaks
              │
              ▼
   Dashboard renders the resume, match score, keyword gaps, and resources
```

Nothing about the fallback path is hidden from the user — every response is labeled so people know whether they're looking at something Gemini extracted from their real resume, or a safety-net draft based on the form alone.

---

## 🚀 Running it locally

**1. Clone and install**
```bash
git clone https://github.com/Kavya2004/Career-Passport.git
cd Career-Passport
npm install
```

**2. Add a Gemini API key** (optional, but needed for real AI translation instead of the offline draft)

Get a free key from [Google AI Studio](https://aistudio.google.com/apikey), then create a file called `.env.local` in the project root:
```bash
GEMINI_API_KEY=your_key_here
```
(This file is already git-ignored — it will never get committed.)

**3. Start the dev server**
```bash
npm run dev
```

**4. Open it in your browser**
```
http://localhost:3000
```

That's it — fill out the profile form, optionally upload a resume, and hit **Generate**.

> **No API key?** The app still works — it just falls back to a simpler resume draft built from your form answers instead of a real AI-read of your document, and tells you so on screen.

---

## 📁 Project structure

```
src/app/
├── page.tsx                        # The entire UI: onboarding form + dashboard tabs
├── layout.tsx                      # Root HTML shell, page metadata
├── globals.css                     # All styling — the "passport" visual theme
└── api/
    └── translate-resume/
        └── route.ts                # The one backend endpoint: talks to Gemini,
                                     # builds the job-match logic, and handles
                                     # every failure case with a graceful fallback
```

Both `page.tsx` and `route.ts` are commented in plain language at the top of every non-obvious function, so you can trace exactly what happens between "user clicks Generate" and "resume appears on screen."

---

## 🧩 Challenges we ran into

- **Inconsistent AI output.** Gemini sometimes returned `education` as an object instead of a string, or wrapped its JSON in a Markdown code fence. We added normalization and resilient parsing to handle both.
- **Staying honest.** We had to make sure the app never invents employers, credentials, achievements, or skills. Our prompts and fallback logic are built to preserve uncertainty and use only what the user actually provided.
- **Scraping job postings.** Some job sites block automated requests or return incomplete pages. Instead of silently comparing against nothing, the app detects the failure and tells the user directly.

---

## 🏆 What we're proud of

Career Passport doesn't just hand you a generated resume and a score — it explains *why* something matches a job, what's missing, why the gap matters, and how to fix it. The goal was never a black box; it was a tool people can actually trust and act on.

---

## 📚 What we learned

AI output is most useful when it's structured, explainable, and grounded in a person's real documents. A polished resume isn't enough on its own — people need to understand the reasoning behind the recommendations. We also learned how much defensive engineering (retries, response validation, fallback drafts, and guarding against invented information) it takes to make an AI feature trustworthy enough for something as high-stakes as a job application.

---

## 🚀 What's next

- Personalized, skill-gap-specific certification and learning-path recommendations
- Multi-resume version history, so users can track how their resume improves over time
- Support for pasting a job description directly, for sites that block automated scraping

---

*Career Passport provides informational career translation. It does not replace official credential evaluations, licensing authorities, employer decisions, or legal advice.*
