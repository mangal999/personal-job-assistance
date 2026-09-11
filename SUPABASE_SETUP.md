# Supabase Setup (Free via Vercel) — Personal Job Assistance

The app works **without** Supabase (localStorage + mock ATS). Add Supabase when you want
**login (Google / email code), cloud-saved jobs, resume sync and ATS history**.

Vercel offers Supabase as a free Marketplace integration (free tier: 500MB DB, 1GB storage,
50k MAU — more than enough here). Two ways to set it up:

---

## Option A — Vercel Marketplace (recommended, ~5 min, free)

1. **Push this repo to GitHub**, then import it in Vercel (`Add New → Project → Import`).
2. In your Vercel project go to **Storage → Marketplace → Browse → Supabase → Add**.
   - Choose the **Free** plan, select your project, region closest to you (e.g. `ap-south-1` Mumbai for India).
   - Vercel auto-creates a Supabase project **and** injects these env vars into your Vercel project:
     `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
     (plus `POSTGRES_*` vars you can ignore).
3. **Create the tables:** open the linked Supabase project → **SQL Editor → New query** →
   paste the full contents of `supabase/schema.sql` in this repo → **Run**.
   You should get `Success. No rows returned` and 5 tables: `profiles`, `saved_jobs`, `ats_cache`, `applied_jobs`, `custom_sources`.
   > Already ran the schema before custom sources existed? Just re-run the file — every
   > `create table` is `if not exists`, and the `custom_sources` policy is wrapped in an
   > idempotent block (old-table policy lines may report "already exists", which is harmless).
4. **Enable login providers** in Supabase dashboard → **Authentication → Providers**:
   - **Google**: ON. Create OAuth credentials in [Google Cloud Console](https://console.cloud.google.com/)
     (APIs & Services → Credentials → OAuth client ID → Web app), then paste Client ID/Secret into Supabase.
   - **Email**: ON (magic OTP is on by default — the app's Login box uses it, no config needed).
5. **Redirect URLs** in Supabase → **Authentication → URL Configuration**:
   - Site URL: `https://YOUR-APP.vercel.app`
   - Additional redirect URLs: `https://YOUR-APP.vercel.app/login`, `http://localhost:3000/login`
     (second one for local dev).
6. **Redeploy** in Vercel (Deployments → Redeploy) so the new env vars take effect.
7. Open `https://YOUR-APP.vercel.app` → header **Login** button should now open Google/email login
   instead of “needs Supabase”. Saved ♥ jobs and resume text now sync to Supabase when logged in.

## Option B — Manual supabase.com project (also free)

1. Go to [supabase.com](https://supabase.com) → New project (Free plan) → note the **Project URL** and **anon key**
   (Settings → API), plus **service_role key** (server-only).
2. Run `supabase/schema.sql` in **SQL Editor** (same as step 3 above).
3. Enable Google + Email providers and redirect URLs (steps 4–5 above).
4. Local dev: copy `.env.example` → `.env.local` and fill:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xyzcompany.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
   SUPABASE_SERVICE_ROLE_KEY=eyJ...   # server only, never NEXT_PUBLIC_
   ```
5. Vercel: same three vars in **Project → Settings → Environment Variables** → Redeploy.

## Verify it works

- [ ] Header shows **Login** (not “needs Supabase”).
- [ ] `/login` page → Continue with Google → redirects back logged in, header shows your email + `☁️ Synced`.
- [ ] Supabase → **Table Editor → profiles**: a row appears after you upload a resume while logged in.
- [ ] Save a ♥ job while logged in → row appears in `saved_jobs`.
- [ ] Log out → saved jobs remain in localStorage; log back in → cloud jobs reload.

## Notes / limits

- RLS is ON (see `schema.sql`): users can only read/write their own rows (`auth.uid() = user_id`).
- Quota: free tier 500MB — resume *text* is tiny (~5KB/user); ATS cache rows are JSON, also tiny.
- No keys at all? App still fully browses jobs (Arbeitnow/Remotive/RemoteOK are keyless) with localStorage saves.
- Adzuna (`ADZUNA_APP_ID/KEY`, 500 calls/mo) and JSearch (`RAPIDAPI_KEY`) are optional keyed sources —
  add them in Vercel env when you want India-specific listings; the UI marks them with `*`.
