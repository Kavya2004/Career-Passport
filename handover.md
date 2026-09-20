# Career Passport Handover

## Project Overview

Career Passport is a Next.js application for internationally trained professionals. It translates a user's resume into an English, U.S.-style resume, compares the resume with a target job posting, explains missing evidence, recommends resources, and exports the final resume as a Word document.

Repository: `https://github.com/Kavya2004/Career-Passport.git`

Current branch: `main`

Latest published commit: `8e6c082 resume translate`

## Technology

- Next.js `16.3.5`
- React `19.2.8`
- TypeScript `^5`
- CSS with Tailwind PostCSS support
- Gemini API for resume translation and job comparison
- `docx` package for `.docx` resume generation

## Run Locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

Available scripts:

```bash
npm run dev
npm run lint
npm run build
npm start
```

## Environment Variables

Create a local `.env` file with:

```env
GEMINI_API_KEY=your_gemini_api_key
```

Optional model override:

```env
GEMINI_MODEL=gemini-2.5-flash
```

Never commit `.env` or expose the API key. The `.gitignore` file already ignores `.env*` files. If the key has been exposed publicly, revoke it and create a replacement key.

## Main Files

- `src/app/page.tsx`
  - Main client application
  - Onboarding form
  - Resume upload flow
  - Language selection
  - Dashboard navigation and views
  - Job match and resume improvement UI
  - Resources UI
  - DOCX download generation
- `src/app/api/translate-resume/route.ts`
  - Gemini API integration
  - Resume translation prompts
  - Multilingual translation instructions
  - Job posting retrieval
  - Match score and keyword fallback logic
  - Gemini response parsing and normalization
  - Profile-based fallback draft
- `src/app/globals.css`
  - Full application styling
  - Onboarding layout
  - Dashboard layout
  - Resume preview
  - Match, keyword, resource, and responsive styles
- `src/app/layout.tsx`
  - Root layout and metadata
- `package.json`
  - Scripts and dependencies

## Completed Features

### Onboarding

- Collects full name, study country, degree, field, experience, previous/current title, target profession, and optional job application link.
- The app is U.S.-wide; the former location/state selector was removed.
- Country example is Vietnam.
- The previous Maria example button and sample data were removed.
- Resume upload supports PDF, DOC, DOCX, AVIF, and images.
- AVIF uploads are converted to PNG in the browser when possible.
- Users can select a resume language or choose auto-detect.

### Multilingual Resume Translation

- Supported language choices include auto-detect, English, Vietnamese, Spanish, French, Arabic, Chinese, Hindi, Portuguese, Tagalog, and Other language.
- The selected language is sent to the API.
- Gemini is instructed to detect the source language when auto-detect is selected.
- Gemini translates the resume into professional English before structuring it.
- Names, employers, dates, credentials, responsibilities, and achievements must be preserved.
- The generated resume shows a source-language translation note when applicable.
- The English version is used for the on-screen resume and DOCX export.

### Resume Template

The generated resume follows the requested template structure:

1. Contact header
2. Education
3. Experience
4. Leadership & Activities, when supported by the source
5. Skills
6. Review-before-applying note

Gemini is instructed not to invent employers, dates, GPA, credentials, technologies, metrics, responsibilities, activities, or achievements.

### Resume Download

- The resume is generated as a real `.docx` file using the `docx` package.
- The download includes the user's generated name, headline, contact details, education, experience bullets, leadership/activities, skills, and review note.
- The previous HTML download implementation was replaced with the DOCX export.

### Job Matching

- Users can provide an optional public job application URL.
- The API attempts to fetch and strip readable text from the job page.
- The job posting text is passed to Gemini when available.
- The app compares resume/profile evidence with job requirements.
- Match results include:
  - Similarity score
  - Estimated acceptance likelihood
  - Matched keywords
  - Missing keywords
  - Evidence-backed strengths
  - Missing or unclear findings
  - Reasons each gap matters
  - Corrections and improvement steps
- Acceptance likelihood is only an estimate and is not a hiring prediction.

### Dashboard Views

- `Career map`
  - Shows the user's background, target role, U.S. destination, and actual resume match score.
  - Hardcoded career-path cards were removed.
  - Profile evidence is shown instead of invented pathways.
- `Job match`
  - Shows what matches the job description and what does not match yet.
  - Displays evidence and reasoning.
- `Resume improvements`
  - Shows similarity score and acceptance likelihood.
  - Shows matched and missing keywords.
  - Provides ordered improvement actions based on the resume template and job comparison.
- `Resources`
  - Recommends resources based on target role and field.
  - Includes O\*NET, CareerOneStop, licensing resources for health roles, technology resources for technology roles, and Department of Labor resources for other roles.
  - Includes the submitted job posting link when provided.
- `How Career Passport works`
  - Contains the ordered improvement/pathway checklist.
  - Opened from the profile down-arrow and the top Help button.
- `Resume translator`
  - Shows the generated resume and DOCX download.
  - Does not show a Gemini provider badge.

## API Behavior

Endpoint:

```text
POST /api/translate-resume
```

Request format: `multipart/form-data`

Fields:

- `profile`: JSON string containing the profile values
- `sourceLanguage`: selected language or `auto`
- `resume`: optional uploaded file

Response shape includes:

```json
{
  "source": "Gemini",
  "resume": {},
  "match": {}
}
```

When Gemini is unavailable or no API key is configured, the API returns a profile-based draft and match fallback data.

## Gemini Reliability Handling

The API includes:

- Retries for transient failures
- Model failover using `GEMINI_MODEL`, then `gemini-2.5-flash`, `gemini-2.0-flash`, and `gemini-3.6-flash`
- Handling for 404, 429, 500, 502, 503, and 504 responses
- JSON parsing for plain JSON, Markdown-fenced JSON, and JSON surrounded by explanatory text
- Resume normalization when Gemini returns an education object instead of a string
- Match normalization when Gemini returns plain strings or incomplete finding objects

A `429` usually indicates Gemini quota/rate limiting. A `503` usually indicates temporary upstream model unavailability. If all models fail, the app intentionally uses the local profile draft.

## Validation Completed

The following commands pass:

```bash
npm run lint
npm run build
```

The production build successfully compiles the page, API route, TypeScript, and static output.

## Known Limitations

- Job pages may block server-side fetching, require JavaScript rendering, or return incomplete text.
- Gemini quota limits can prevent multilingual translation or resume extraction.
- Acceptance likelihood is an estimate and cannot predict an employer's decision.
- The local fallback draft uses profile fields and cannot extract detailed facts from an uploaded resume without Gemini.
- DOCX export is implemented; PDF export is not currently implemented.
- Profile data is held in client state and is not persisted to a database.
- There is no authentication or user account system yet.
- Resources are curated by role keyword rather than fetched dynamically.

## Recommended Next Steps

1. Add a dedicated document extraction provider or local parser for fallback resume extraction.
2. Add a job-description paste field for postings that block URL fetching.
3. Add rate-limit messaging and retry timing in the UI instead of only showing an alert.
4. Add PDF export.
5. Add user accounts and encrypted document storage.
6. Add automated tests for API normalization, language handling, match scoring, and DOCX generation.
7. Add accessibility testing for keyboard navigation and screen readers.
8. Add more multilingual UI labels if the interface itself should be translated.

## Handover Checklist

- [x] Career Passport app implemented
- [x] Git repository initialized inside the project directory
- [x] Remote set to `Kavya2004/Career-Passport`
- [x] Main branch pushed to GitHub
- [x] Multilingual resume translation flow added
- [x] English resume formatting added
- [x] DOCX resume download added
- [x] Job matching and keyword feedback added
- [x] Resume improvements view added
- [x] Resources view added
- [x] Help/pathway view added
- [x] Gemini response fallbacks added
- [x] Lint passes
- [x] Production build passes
