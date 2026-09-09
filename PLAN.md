# Personal Job Assistance — One-Page Job Aggregator + ATS Resume Checker

**Status:** Planning / Ready to Implement  
**Target Deploy:** Vercel (Primary) / Netlify (Alternative) — 100% Free Tier  
**Owner Constraint:** No paid services. Gemini Pro plan available. All other APIs must be free.

---

## 1. Vision & Core Requirement

> A single-page web app where a logged-in user sees all relevant jobs aggregated from multiple public job boards at one place, can filter/search, clicks to **apply on the official portal** (no middleman apply), and next to **every job link** can instantly check their **resume's ATS score** for that specific job description.

**Tagline:** *One page. All jobs. Know your ATS score before you click Apply.*

### 1.1 What This Is NOT
- Not a job scraper that violates LinkedIn/Indeed ToS — we only use official free APIs + redirect to original source.
- Not an auto-apply bot — user always applies manually on the official site (avoids legal / bot detection issues).
- Not a resume builder — we only score/validate existing resume (PDF/DOCX).

---

## 2. How The Site Will Be Accessed

```
User Device (Mobile/Desktop) -> https://your-app.vercel.app (or .netlify.app)
  -> Static CDN (Edge) -> Serverless Functions (API) -> Free Job APIs + Gemini API
```

| Item | Detail |
|------|--------|
| **URL** | `personal-job-assistance.vercel.app` (Free Vercel subdomain). Custom domain optional later via free `vercel.app` or `netlify.app`. No purchase needed. |
| **Access Control** | Public landing page (no login needed to browse). Login required to enable: personalized matching, saved filters, resume upload & ATS score, saved jobs. |
| **Login Methods** | Google OAuth (1-click) + Email OTP. Implemented via `Supabase Auth` or `Clerk Free` or `NextAuth.js + GitHub/Google`. All free. |
| **Device Support** | Fully responsive (Mobile-first). PWA installable (Add to Home Screen) so it feels like native app without Play Store. |
| **Performance** | Edge-cached static page < 1.5s LCP. Job fetching via ISR + client-side polling. Works on 3G. |
| **Sharing** | User's filtered URL is shareable: `?q=react&loc=remote&exp=2y` — but data is private per user (resume never public). |

**User Journey:**
1. User opens URL -> sees trending jobs (no login) + CTA "Upload Resume to get ATS score & personalized jobs"
2. Logs in with Google -> onboarding: role, skills (comma separated), experience, location pref, remote/hybrid, salary expectation
3. Uploads Resume (PDF/DOCX, < 3MB)
4. Dashboard shows: `For You` tab (matching) + `All Jobs` + `Saved` + `Applied (manual mark)`
5. Each job card: Title | Company | Location | Posted | Source Badge | **Apply button** -> opens official URL in new tab | **ATS Score button** -> `84% Match - View Details` -> drawer with missing keywords, suggestions
6. User filters: search text, location, remote, salary, job type, experience, posted date, source
7. ATS check runs on-demand (to save Gemini quota) or auto for top 10 `For You` jobs

---

## 3. Tech Stack — Zero Cost, Deploy-Free

**Recommendation: Next.js 14+ (App Router) on Vercel.** Reason: Vercel free tier is most generous for Next.js, serverless functions inclusive, better ISR than Netlify for this use-case. Code remains deployable to Netlify with 0 changes.

| Layer | Choice (Free Tier) | Why | Free Limits |
|-------|--------------------|-----|-------------|
| **Framework** | Next.js 14 + TypeScript + Tailwind CSS + shadcn/ui | Best Vercel integration, SSR/ISR, API routes built-in | — |
| **Deployment** | Vercel Hobby (Primary) / Netlify Starter (Backup) | Free SSL, CI from GitHub, 100GB bandwidth | Vercel: 100GB bw, 6k exec hrs. Netlify: 100GB bw |
| **Auth** | **Supabase Auth** (Recommended) or **NextAuth.js (Auth.js) with Supabase Adapter** | Google OAuth free, no CC needed | Supabase: 50k MAU free |
| **Database** | **Supabase Postgres (Free)** | Store users, preferences, resume text, saved jobs, ATS cache | 500MB DB, 1GB storage |
| *Alternative DB* | Firebase Firestore or Neon Postgres Free | If prefer NoSQL | Similar free limits |
| **File Storage** | Supabase Storage (for resume PDF) OR keep only parsed text in DB (no file needed long-term) | Avoids paid S3 | 1GB free |
| **Job APIs** | See §4 | All free-tier, no payment | — |
| **LLM** | **Google Gemini API** (your Pro plan) | ATS scoring + matching + cover letter stretch | Pro: 1M tokens/day generous, ~$0 cost |
| **PDF Parsing** | `pdfjs-dist` or `unpdf` (client+server) + `mammoth` for DOCX | No external API | — |
| **Caching** | Vercel KV (Upstash Redis) Free OR in-memory ISR `revalidate` | Cache job results 30-60 min to save API quota | 256MB, 10k cmd/day |
| **Analytics** | Vercel Analytics + Plausible self? or `umami` | Free | — |

**Why NOT pure SPA (Vite) + separate backend?** That would need 2 deploys. Next.js gives frontend + `app/api/*` serverless in one repo, perfect for free tier.

**Folder Structure:**
```
/app
  /(public)/page.tsx              # Landing, no auth
  /(app)/dashboard/page.tsx       # Protected, job feed
  /api/jobs/route.ts              # Aggregator proxy (caches)
  /api/ats-score/route.ts         # Gemini proxy (secure key)
  /api/parse-resume/route.ts      # PDF -> text
  /login/page.tsx
/components
  JobCard.tsx                     # Has Apply + ATS Score button
  ATSDrawer.tsx                   # Score, keywords, suggestion
  FilterBar.tsx
  ResumeUploader.tsx
/lib
  job-providers.ts                # Adzuna, Arbeitnow, etc
  gemini.ts
  ats-prompt.ts
  supabase.ts
```

---

## 4. Job Aggregation Strategy (The Hardest Part) — 100% Free

> You cannot reliably scrape LinkedIn/Indeed without getting blocked + violating ToS. Use official free APIs and aggregate.

### 4.1 Provider Matrix

| Provider | Cost | Auth Needed | Type | Quota Free | Fields: Title, Company, Location, Apply Link, Salary |
|----------|------|-------------|------|------------|------------------------------------------------------|
| **Arbeitnow** | Free, No Key | No | JSON API `https://www.arbeitnow.com/api/job-board-api` | Unlimited | Yes - best for MVP |
| **Remotive** | Free, No Key | No | `https://remotive.com/api/remote-jobs` | Unlimited | Remote only |
| **Adzuna** | Free Tier | App ID + Key (free signup) | REST | ~500 calls/month | Yes, global, official links |
| **USA Jobs** | Free | API Key (free) | REST | 1k/day | US gov jobs |
| **Findwork.dev** | Free Tier | Token (free) | REST | 100/day | Tech jobs |
| **JSearch (RapidAPI)** | Free Tier | RapidAPI Key (free) | REST | 100/month | Aggregates LinkedIn, Indeed, Glassdoor via JSearch proxy (legal) |
| **The Muse** | Free, No Key | No | REST | Unlimited (docs) | Limited fields |
| **Jooble** | Free? | Key per request | REST | Limited | Fallback |
| **RSS Fallback** | Free | No | RSS (e.g., We Work Remotely RSS) | Unlimited | Parse RSS |

**Recommendation for MVP:**
- **Phase 1 (Day 1-2):** Arbeitnow + Remotive + Adzuna (3 providers = covers 80% jobs, zero risk, unlimited free). Add RSS for WeWorkRemotely + RemoteOK.
- **Phase 2:** Add JSearch RapidAPI (free 100/mo) as "premium" enrichment — call only when user does specific search to extend quota. Add USAJobs if targeting US.
- **Phase 3:** Add user-selectable "Bring Your Own API Key" for SerpAPI/Google Jobs for power users (optional).

### 4.2 Aggregation Logic

```
app/api/jobs/route.ts
  Input: { query, location, remote_only, job_type, page, user_profile? }
  Steps:
    1. Check Vercel KV / memory cache: key = hash(query+location+filters) -> if hit & < 45 min old, return cache
    2. Else Promise.allSettled([
          fetchArbeitnow(query),
          fetchRemotive(query),
          fetchAdzuna(query, location),
          fetchJSearch(query, location) // only if quota left
       ])
    3. Normalize each response to UnifiedJob:
       { id, title, company, location, type, remote, salary, posted_at, description, apply_url, source, source_logo }
    4. De-duplicate by (title+company) fuzzy + apply_url domain
    5. Rank: personalized score = cosine overlap(user_skills, job_description) if logged in, else posted_at desc
    6. Filter in-memory by user filters
    7. Paginate (20 per page)
    8. Cache result for 45 min, return
```

**Normalization** is critical: each provider returns different schema. Central `normalizeJob()` converter.

**Deduplication:** Same job appears on multiple boards. Use hash of `lower(title) + lower(company)` and keep earliest `posted_at` with best `apply_url`.

**Rate-limit handling:** If Adzuna quota exhausted, fallback gracefully to free providers + show banner "Limited results — Adzuna quota reset in X days. Add your own key in Settings."

**Legal/ToS Safe:** We **always** keep `apply_url` as original official link, add `rel="nofollow"` and `target="_blank"`. Never proxy the apply page.

### 4.3 Search & Personalization

- **If NOT logged in:** Search is keyword + filter based. Show `FilterBar` (search, location, remote toggle, job type).
- **If logged in:**
  - **Initial matching:** Use onboarding `skills: string[]` + `preferred_role`. Server does simple TF overlap to rank `For You`. No LLM cost here.
  - **Smart matching (optional, Gemini on-demand):** Button "AI Rank these 20 jobs for me" -> calls Gemini once with resume text + 20 job descriptions summarized -> returns ordered list + reason per job. Cache result per resume hash.

---

## 5. Resume ATS Scoring — Next to Every Job Link

This is USP. Implemented via Gemini Pro (your key) — **never expose key to client, always via `app/api/ats-score` server route.**

### 5.1 Flow

```
[ResumeUploader] -> PDF/DOCX -> /api/parse-resume -> extracted text (stored in Supabase `profiles.resume_text` + `resume_embedding?`)

For each JobCard:
  [ATS Score ▼] button -> onClick -> POST /api/ats-score { jobId, jobDescription, resumeText }
    -> Server checks cache `ats_cache (user_id + job_hash)`: if exists < 7 days, return
    -> Else call Gemini with structured prompt -> JSON response -> store in cache -> return to client
  Drawer shows: Overall Score (0-100), Breakdown, Missing Keywords, Suggestions
```

**Why on-demand?** To save Gemini quota. Pre-scoring 100 jobs would cost 100 calls. On-demand + cache = 1 call per user per job.

**Batch option:** For `For You` top 5, auto-trigger after page load with `batch=true` (1 Gemini call with 5 jobs).

### 5.2 Gemini Prompt (Put in `/lib/ats-prompt.ts:10`)

```text
System: You are an ATS (Applicant Tracking System) expert similar to Greenhouse/Lever.

User Prompt:
Resume Text: """{{RESUME_TEXT}}"""
Job Description: """{{JOB_DESCRIPTION}}"""
Job Title: {{TITLE}}

Task: Score the resume against the job 0-100 and return ONLY valid JSON:
{
  "overall_score": number (0-100),
  "verdict": "Strong Match" | "Moderate Match" | "Weak Match",
  "breakdown": {
    "skills_match": number,
    "experience_match": number,
    "education_match": number,
    "keyword_match": number
  },
  "matched_keywords": ["keyword1", ...],
  "missing_keywords": ["keyword2", ...] // max 10, most critical
  "improvement_tips": ["tip1", ...] // 3-5 actionable, specific
  "summary": "1-2 line recruiter perspective"
}

Rules: Be strict. If resume lacks core skill (e.g., job needs React but resume has no React), cap score at 60.
```

**Model Choice:** `gemini-2.0-flash` or `gemini-1.5-flash` — cheapest, fastest, 1M context, free tier high. Use `gemini-1.5-pro` only for detailed analysis toggle.

**Parsing Resilience:** Wrap Gemini call in `try { JSON.parse(cleanMarkdownFences(response)) } catch { fallback regex }`. Always validate with Zod.

**Cost Estimate (Free):** 1 ATS check ≈ 2k input + 500 output tokens ≈ 2.5k tokens. 1000 checks/day = 2.5M tokens ~ within free Pro limits. Cache reduces 70% repeats.

### 5.3 Resume Parsing

- Client uploads PDF -> `pdfjs-dist` extracts text client-side for preview (instant).
- Also send file to `/api/parse-resume` for server-side canonical text (handles scanned? not needed). Store text in DB.
- Max size 3MB, only text stored, file deleted after parse if using Supabase Storage (privacy).
- Show extracted skills preview: user can edit before saving.

### 5.4 UI Placement (Critical Requirement)

```
+--------------------------------------------------+
| Frontend Engineer @ Acme — Remote — 2d ago [Adzuna] |
| Acme Inc — Build React apps... [truncated 2 lines] |
| [📍 Remote] [💰 $90k] [Apply on Adzuna ↗] [ATS: 84% ✓] |
+--------------------------------------------------+
          ^                              ^
     official link (new tab)       score button -> drawer
```

Score badge color: 80-100 Green, 60-79 Yellow, 0-59 Red.

Drawer content (example at `/components/ATSDrawer.tsx:40`):
- Big circular score
- Verdict: "Strong Match — You cover 8/10 key skills"
- Tabs: Matched vs Missing keywords (chips)
- Tips bullet list
- CTA: "Copy Missing Keywords → paste into resume"

---

## 6. Authentication & User Data Model

**Supabase Schema (Free):**

```sql
-- profiles (extends auth.users)
create table profiles (
  id uuid primary key references auth.users,
  email text,
  full_name text,
  role text, -- e.g., "Frontend Developer"
  skills text[], -- ["React","Node"]
  experience_years int,
  location_pref text,
  remote_pref text, -- remote, hybrid, onsite
  resume_text text,
  resume_updated_at timestamp,
  created_at timestamp default now()
);

create table saved_jobs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id),
  job_hash text, -- hash(title+company+apply_url)
  job_data jsonb, -- full UnifiedJob snapshot
  created_at timestamp default now(),
  unique(user_id, job_hash)
);

create table ats_cache (
  user_id uuid references profiles(id),
  job_hash text,
  job_description_hash text, -- to invalidate if JD changed
  resume_hash text, -- to invalidate if resume updated
  score jsonb, -- full Gemini JSON
  created_at timestamp default now(),
  primary key (user_id, job_hash)
);

-- Optional: applied tracker (manual)
create table applied_jobs (
  user_id uuid, job_hash text, applied_at timestamp, primary key(user_id, job_hash)
);
```

**Privacy:** Resume text is `private` RLS: `auth.uid() = user_id`. Never exposed to other users. Provide "Delete my data" button (GDPR free).

---

## 7. Detailed Feature List & Priority

| P | Feature | Details |
|---|---------|---------|
| **P0 MVP** | Aggregator + Filters | Search, location, remote, type filters; 20/page, infinite scroll |
| P0 | Apply Redirect | Button `Apply ↗` → official URL, track count locally |
| P0 | Login (Google) | Supabase Auth, onboarding |
| P0 | Resume Upload + Parse | PDF/DOCX → text |
| P0 | ATS Score per Job | Gemini prompt, on-demand, cache |
| P0 | Deploy to Vercel | CI from GitHub, env vars |
| **P1** | For You (Personalized Ranking) | Skill overlap ranking, no LLM |
| P1 | Saved Jobs | Heart icon, persisted in Supabase |
| P1 | Shareable Filter URL | `?q=&loc=` sync |
| P1 | PWA + Dark Mode | `next-pwa`, Tailwind dark |
| **P2** | AI Rank (5 jobs at once) | Single Gemini call to reorder |
| P2 | Email Digest (optional) | Supabase Cron + Resend free (100/day) — weekly matching jobs |
| P2 | Cover Letter Generator | Second Gemini call per job |
| P3 | Job Alert Push | Web Push via VAPID (free) |
| P3 | Analytics: Applied Conversion | Manual "Mark as Applied" |

---

## 8. Deployment Guide — Vercel (Preferred) & Netlify

### 8.1 Vercel (Recommended)

1. Push repo to GitHub `mangal999/personal-job-assistance`
2. Vercel → `Add New Project` → Import GitHub repo
3. Framework: Next.js (auto-detected)
4. Env Vars (in Vercel Dashboard → Settings → Environment Variables):
   ```
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   SUPABASE_SERVICE_ROLE_KEY=... (server only)
   GEMINI_API_KEY=... (server only, from aistudio.google.com)
   ADZUNA_APP_ID=... (optional)
   ADZUNA_APP_KEY=... (optional)
   RAPIDAPI_KEY=... (optional, for JSearch)
   ```
5. Deploy → get `https://personal-job-assistance.vercel.app`
6. Supabase: enable Google OAuth (add Vercel URL to redirect allowlist)
7. Add `vercel.json` for ISR caching:
   ```json
   { "crons": [{ "path": "/api/cron/refresh-jobs", "schedule": "0 */6 * * *" }] }
   ```

**Free Tier Checks:** Hobby allows 6000 execution hours/month, 100GB bandwidth — more than enough for personal + 100 users. No CC needed.

### 8.2 Netlify (Alternative, Same Code)

- `netlify.toml` with `[[plugins]] package = "@netlify/plugin-nextjs"`
- Build command `npm run build`, publish `.next`
- Env vars same as above
- Netlify Functions auto-wrap `app/api/*` (but Vercel edge is faster).

**Recommendation:** Deploy to **both** for redundancy: primary Vercel, mirror Netlify via GitHub auto-deploy.

---

## 9. Security & Compliance

- **Gemini Key:** Never `NEXT_PUBLIC_`. Only in server routes + Vercel env. Rate-limit `/api/ats-score` per user (e.g., 20/hour) via Upstash Redis or simple in-memory.
- **Resume Privacy:** RLS enabled, text encrypted at rest (Supabase default). Provide delete.
- **Job APIs:** Respect `robots.txt`, use official APIs, no scraping behind paywall.
- **CORS:** API routes only allow same-origin.
- **PDF Safety:** Validate MIME, 3MB limit, reject `.exe`.

---

## 10. Cost Breakdown — $0

| Service | Paid? | Free Limit | Your Usage |
|---------|-------|------------|------------|
| Vercel | No | 100GB, unlimited hobby projects | ~1GB |
| Supabase | No | 500MB DB, 50k users | <50MB |
| Gemini | No (you have Pro) | 60 req/min, 1500/day (Flash) | ~50/day |
| Adzuna | No | 500 calls/mo | ~200/mo (cached) |
| Arbeitnow, Remotive | No | Unlimited | Free |
| RapidAPI JSearch | No | 100/mo free | 50/mo |
| Domain | No (vercel.app) | — | $0 |

Total: **$0/month**. Optional later: $6/year domain via Cloudflare.

---

## 11. Implementation Roadmap — 10 Days to MVP

**Phase 0 - Setup (Day 1):**
- [ ] `npx create-next-app@latest personal-job-assistance --typescript --tailwind --app`
- [ ] Add `shadcn/ui`, `supabase-js`, `@google/generative-ai`, `pdfjs-dist`, `mammoth`
- [ ] Create Supabase project, run SQL above at `supabase/schema.sql:1`
- [ ] Get Gemini API key from `aistudio.google.com/app/apikey`

**Phase 1 - Core Aggregation (Day 2-3):**
- [ ] Implement `lib/job-providers.ts` (Arbeitnow, Remotive, Adzuna)
- [ ] Implement `app/api/jobs/route.ts` + `lib/normalize.ts` + cache
- [ ] Build `components/JobCard.tsx` + `FilterBar.tsx` + infinite scroll
- [ ] Landing page + dashboard layout

**Phase 2 - Auth + Resume (Day 4-5):**
- [ ] Supabase Auth (Google OAuth), `middleware.ts` for protected routes
- [ ] Onboarding form (role, skills, location)
- [ ] Resume uploader + `app/api/parse-resume/route.ts` + preview

**Phase 3 - ATS Score (Day 6-7): *Core USP***
- [ ] `lib/ats-prompt.ts` + `app/api/ats-score/route.ts` (Gemini)
- [ ] Cache layer `ats_cache` table
- [ ] `components/ATSDrawer.tsx` + score badge on JobCard
- [ ] Batch score for top 5 For You

**Phase 4 - Polish + Deploy (Day 8-9):**
- [ ] Saved jobs (heart), PWA, dark mode, responsive QA
- [ ] Error handling, empty states, quota banner, loading skeletons
- [ ] `vercel.json`, `README.md` with deploy button
- [ ] Deploy to Vercel, test OAuth redirect, env vars

**Phase 5 - Stretch (Day 10+):**
- [ ] JSearch integration, personalized ranking, email digest

**MVP Demo Checklist:**
- [ ] Can search "React remote" → see 20 jobs from 3 sources, each with Apply link to official site
- [ ] Can log in, upload PDF, see ATS score 78% next to a job, with missing keywords

---

## 12. API Design (Internal)

```
GET  /api/jobs?q=react&location=remote&page=1
  -> { jobs: UnifiedJob[], total, page, cached, sources: ["arbeitnow","remotive"] }

POST /api/parse-resume  (multipart/form-data, file)
  -> { text: "...", skills_extracted: ["React",...], resume_hash }

POST /api/ats-score  { job_description, job_title, resume_text? (optional, else fetch from DB) }
  -> { overall_score: 84, verdict: "Strong Match", breakdown: {...}, missing_keywords: [...], cached: bool }

GET  /api/me  -> { profile }
POST /api/save-job { job_hash, job_data }
```

All APIs protected with Supabase JWT except `/api/jobs` (public, but rate-limited 30/min per IP via Vercel).

---

## 13. Risks & Mitigations

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Adzuna free quota exhausted | Medium | Cache 1h + fallback to unlimited providers + show quota UI + allow BYO key |
| Gemini rate limit 429 | Low (Pro) | Cache ATS per (user,job), batch, exponential backoff, show "try in 30s" |
| Job API downtime | Medium | `Promise.allSettled` -> if one fails, others still return; show source health badge |
| PDF parse fail (scanned image) | Low | Fallback: ask user to paste text manually; future: Gemini vision to OCR (costly, so manual) |
| Vercel cold start | Low | Use edge runtime, keep functions light (<1MB) |
| ToS violation fear | Avoided | Only official APIs + RSS, direct apply link, no scraping |

---

## 14. Alternatives Considered (Why Not Chosen)

- **Firebase only:** Vendor lock-in, Firestore query limits; Supabase Postgres more flexible for filtering.
- **Scraping LinkedIn:** Illegal/ToS, needs proxy $$$, easy to block. Not free.
- **OpenAI API:** Requires paid credits; Gemini Pro you already have is perfect substitute.
- **Self-hosted LLM:** Needs GPU, cost, not free.
- **WordPress + plugin:** Not customizable for ATS per-job scoring.

---

## 15. Future Enhancements (Post-MVP, Still Free)

- **Cover letter tailoring:** Gemini generates per-job cover letter using resume + JD — one more API route.
- **Interview prep:** Gemini generates Q&A per job.
- **Tracker board:** Kanban `Saved → Applied → Interview → Offer` (local DB).
- **Community:** Share anonymized ATS scores per job to help others.

---

## 16. References & Free API Docs

- Arbeitnow API: https://www.arbeitnow.com/api/job-board-api
- Remotive API: https://github.com/remotive-com/remote-jobs-api
- Adzuna API: https://developer.adzuna.com/ (free signup, 500/mo)
- JSearch (RapidAPI): https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch
- Gemini API: https://ai.google.dev/gemini-api/docs
- Supabase Auth: https://supabase.com/docs/guides/auth
- Vercel Deploy: https://vercel.com/docs/frameworks/nextjs
- PDF.js: https://mozilla.github.io/pdf.js/

---

## 17. What You Need To Provide

1. **Gemini API Key** — from https://aistudio.google.com/app/apikey → paste in `.env.local` as `GEMINI_API_KEY=...`
2. **Supabase Project** — free, 2-min setup at https://supabase.com → get URL/anon key
3. **(Optional)** Adzuna App ID/Key — https://developer.adzuna.com/ → free
4. **(Optional)** RapidAPI Key — https://rapidapi.com → free tier for JSearch
5. Nothing else to purchase — domain/bandwidth/auth all free tiers.

---

## 18. Immediate Next Step

If you approve this plan, I can scaffolding in one go:

```bash
npx create-next-app@latest . --typescript --tailwind --app --eslint --use-npm
# install deps, create schema.sql, job providers, ATS route, and Vercel config
```

Want me to start implementation, or adjust any section (e.g., prefer Netlify over Vercel, or Firebase over Supabase)?
