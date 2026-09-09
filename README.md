# Personal Job Assistance — One Page, All Jobs, ATS Score

> **Live Demo:** Deploy free to Vercel (`vercel --prod`) or Netlify — no payment needed. Works with or without API keys.

A single-page aggregator that pulls jobs from **multiple free job boards** and validates your resume with **Gemini ATS scoring** next to every **Apply** link.

Built with **Next.js 16.3.4 (latest)**, Tailwind, Supabase (optional), Gemini.

## Why Next.js Latest (16.3.4) ?

You asked — we use **latest stable**, not an older version. Reasons:
- **Turbopack build** (16) ~ 3× faster.
- App Router + `fetch` revalidate + serverless all in one deploy.
- Better edge caching for job APIs, works out-of-the-box on Vercel/Netlify free tier.
- No breaking change for this app — upgrading is just `npm i next@latest`.

## Features

- **One-page feed:** Arbeitnow (unlimited) + Remotive (unlimited) + Adzuna (500/mo free) + JSearch optional — de-duplicated, sorted.
- **Apply redirect:** Button opens official portal in new tab (`target="_blank"`), never proxy.
- **ATS Score per job:** Click `ATS Score` on any card → drawer with 0-100 score, breakdown, matched/missing keywords, tips — via Gemini `gemini-2.0-flash` (or mock if no key).
- **For You ranking:** Re-ranks 20 jobs client-side by resume keyword overlap (no LLM cost).
- **Filters:** `q`, `location`, `remote only` — shareable URL `?q=react&location=remote`.
- **Resume upload:** PDF (pdfjs-dist via CDN worker), DOCX (mammoth), TXT — stored locally or Supabase if configured.
- **Saved jobs:** ♥ in localStorage (or Supabase `saved_jobs` when configured).

## Deploy Free (Vercel Recommended)

1. Push to GitHub: `git push origin main`
2. Vercel → New Project → Import repo → **Add Env Vars**:
   ```
   GEMINI_API_KEY=...        # from https://aistudio.google.com/app/apikey (required for real ATS)
   GEMINI_MODEL=gemini-2.0-flash
   ADZUNA_APP_ID=...         # optional https://developer.adzuna.com
   ADZUNA_APP_KEY=...
   NEXT_PUBLIC_SUPABASE_URL=...  # optional https://supabase.com
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   SUPABASE_SERVICE_ROLE_KEY=...
   ```
3. Deploy → `https://personal-job-assistance.vercel.app`

**No keys?** App still works — uses mock ATS + unlimited free job APIs + localStorage.

**Netlify:** Same env vars, `netlify.toml` already included.

## Local Dev

```bash
npm install
cp .env.example .env.local   # add GEMINI_API_KEY
npm run dev                  # http://localhost:3000
npm run build                # production test
```

## Project Structure

```
app/page.tsx              # Single-page aggregator + resume
app/api/jobs/route.ts     # Aggregator proxy (10 min cache)
app/api/ats-score/route.ts# Gemini ATS (or mock)
app/api/parse-resume/route.ts
lib/job-providers.ts      # Arbeitnow, Remotive, Adzuna normalizers
lib/gemini.ts             # Prompt + mock fallback
lib/types.ts
components/JobCard.tsx    # Apply + ATS button + drawer
components/FilterBar.tsx
components/ResumeUploader.tsx
supabase/schema.sql       # Run in Supabase SQL editor
PLAN.md                   # Full 18-section implementation plan
```

## How ATS Works

- `lib/gemini.ts:25` prompt asks Gemini for strict JSON `{overall_score, verdict, breakdown, matched/missing, tips}`.
- If `GEMINI_API_KEY` missing, `mockATSScore()` does keyword overlap so UI always works.
- Result not stored unless Supabase configured — otherwise shown instantly.

See `PLAN.md:5` for full design, cost ($0), and 10-day roadmap.

## Free Limits

| Service | Free |
|---------|------|
| Vercel Hobby | 100GB bw |
| Supabase | 500MB, 50k MAU |
| Gemini Flash | 60 req/min |
| Arbeitnow/Remotive | unlimited |
| Adzuna | 500/mo |
