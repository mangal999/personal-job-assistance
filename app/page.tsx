"use client";

import { useEffect, useState, useCallback } from "react";
import { UnifiedJob } from "@/lib/types";
import JobCard from "@/components/JobCard";
import FilterBar from "@/components/FilterBar";
import ResumeUploader from "@/components/ResumeUploader";

const LS_RESUME = "pja_resume_text";
const LS_SAVED = "pja_saved_jobs";

function rankByResume(jobs: UnifiedJob[], resume: string): UnifiedJob[] {
  if (!resume || resume.length < 50) return jobs;
  const resumeTokens = new Set(
    resume
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3)
  );
  const scored = jobs.map((j) => {
    const jd = `${j.title} ${j.description} ${j.tags?.join(" ")}`.toLowerCase();
    const tokens = jd.replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((w) => w.length > 3);
    let matches = 0;
    tokens.forEach((t) => {
      if (resumeTokens.has(t)) matches++;
    });
    const score = matches / Math.max(tokens.length, 1);
    return { job: j, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.map((s) => s.job);
}

export default function Home() {
  const [q, setQ] = useState("developer");
  const [location, setLocation] = useState("");
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [jobs, setJobs] = useState<UnifiedJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resumeText, setResumeText] = useState("");
  const [sources, setSources] = useState<Record<string, string> | null>(null);
  const [showSavedOnly, setShowSavedOnly] = useState(false);
  const [savedHashes, setSavedHashes] = useState<Set<string>>(new Set());
  const [personalized, setPersonalized] = useState(false);

  // Load from localStorage
  useEffect(() => {
    const r = localStorage.getItem(LS_RESUME);
    if (r) setResumeText(r);
    const s = localStorage.getItem(LS_SAVED);
    if (s) {
      try {
        const arr: UnifiedJob[] = JSON.parse(s);
        setSavedHashes(new Set(arr.map((j) => `${j.title.toLowerCase()}|${j.company.toLowerCase()}`)));
      } catch {}
    }
    // Load query from URL
    const params = new URLSearchParams(window.location.search);
    if (params.get("q")) setQ(params.get("q")!);
    if (params.get("location")) setLocation(params.get("location")!);
    if (params.get("remote") === "true") setRemoteOnly(true);
  }, []);

  useEffect(() => {
    localStorage.setItem(LS_RESUME, resumeText);
  }, [resumeText]);

  const fetchJobs = useCallback(async (personalize = false) => {
    setLoading(true);
    setError(null);
    try {
      const url = new URL("/api/jobs", window.location.origin);
      if (q) url.searchParams.set("q", q);
      if (location) url.searchParams.set("location", location);
      if (remoteOnly) url.searchParams.set("remote", "true");

      // update browser URL
      const newParams = new URLSearchParams();
      if (q) newParams.set("q", q);
      if (location) newParams.set("location", location);
      if (remoteOnly) newParams.set("remote", "true");
      window.history.replaceState(null, "", `?${newParams.toString()}`);

      const res = await fetch(url.toString());
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch jobs");
      let fetched: UnifiedJob[] = data.jobs;
      if (personalize && resumeText) {
        fetched = rankByResume(fetched, resumeText);
        setPersonalized(true);
      } else {
        setPersonalized(false);
      }
      setJobs(fetched);
      setSources(data.sources);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [q, location, remoteOnly, resumeText]);

  // Initial fetch
  useEffect(() => {
    fetchJobs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleSave(job: UnifiedJob) {
    const key = `${job.title.toLowerCase()}|${job.company.toLowerCase()}`;
    const raw = localStorage.getItem(LS_SAVED);
    let arr: UnifiedJob[] = [];
    try {
      arr = raw ? JSON.parse(raw) : [];
    } catch {}
    const exists = arr.find((j) => `${j.title.toLowerCase()}|${j.company.toLowerCase()}` === key);
    if (exists) {
      arr = arr.filter((j) => `${j.title.toLowerCase()}|${j.company.toLowerCase()}` !== key);
    } else {
      arr.push(job);
    }
    localStorage.setItem(LS_SAVED, JSON.stringify(arr));
    setSavedHashes(new Set(arr.map((j) => `${j.title.toLowerCase()}|${j.company.toLowerCase()}`)));
  }

  const displayed = showSavedOnly
    ? jobs.filter((j) => savedHashes.has(`${j.title.toLowerCase()}|${j.company.toLowerCase()}`))
    : jobs;

  const savedCount = savedHashes.size;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <header className="border-b border-zinc-100 bg-white dark:border-zinc-900 dark:bg-zinc-950">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Personal Job Assistance</h1>
            <p className="text-xs text-zinc-500">One page • All jobs • ATS score next to every Apply</p>
          </div>
          <div className="hidden sm:block text-right">
            <p className="text-xs text-zinc-500">{resumeText ? `Resume: ${resumeText.length} chars` : "No resume — upload to enable ATS"}</p>
            <p className="text-xs text-zinc-400">Deploy free on Vercel/Netlify • 100% free APIs</p>
          </div>
        </div>
      </header>

      <FilterBar
        q={q}
        setQ={setQ}
        location={location}
        setLocation={setLocation}
        remoteOnly={remoteOnly}
        setRemoteOnly={setRemoteOnly}
        onSearch={() => fetchJobs(false)}
        onPersonalized={() => fetchJobs(true)}
        hasResume={resumeText.length > 50}
      />

      <main className="mx-auto max-w-6xl px-4 py-6">
        <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
          {/* Left: Resume + Info */}
          <div className="space-y-4 lg:sticky lg:top-[72px] lg:h-fit">
            <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="font-semibold">1. Upload Resume</h2>
              <p className="mt-1 text-xs text-zinc-500">ATS scoring uses this text. Stored locally unless Supabase configured.</p>
              <div className="mt-3">
                <ResumeUploader onText={setResumeText} initialText={resumeText} />
              </div>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <h3 className="text-sm font-semibold">How it works</h3>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs leading-5 text-zinc-600 dark:text-zinc-400">
                <li>Search jobs — we aggregate Arbeitnow + Remotive + Adzuna (free).</li>
                <li>Click <span className="rounded bg-black px-1 py-0.5 text-white">Apply ↗</span> → go to official portal.</li>
                <li>Click <span className="rounded bg-zinc-800 px-1 py-0.5 text-white">ATS Score</span> next to any job → real Gemini score (or mock if no key).</li>
                <li>Use <em>For You</em> to re-rank by resume keywords (no LLM cost).</li>
              </ol>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-white p-4 text-xs dark:border-zinc-800 dark:bg-zinc-900">
              <p className="font-semibold">Env Setup (optional)</p>
              <p className="mt-1 text-zinc-500">
                For real AI scoring, set <code>GEMINI_API_KEY</code> in Vercel env. For auth/DB, set
                <code> NEXT_PUBLIC_SUPABASE_URL</code>. App works without both (localStorage + mock scores).
              </p>
              {sources && (
                <div className="mt-2 rounded bg-zinc-50 p-2 dark:bg-zinc-800">
                  <p className="font-medium">Sources</p>
                  <ul className="mt-1">
                    {Object.entries(sources).map(([k, v]) => (
                      <li key={k} className="flex justify-between">
                        <span>{k}</span>
                        <span className={v.startsWith("ok") ? "text-green-600" : "text-red-500"}>{v}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

          {/* Right: Jobs */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">
                  {showSavedOnly ? `Saved (${savedCount})` : personalized ? "For You — ranked by resume" : `Jobs (${displayed.length})`}
                </h2>
                <p className="text-xs text-zinc-500">
                  {loading ? "Loading..." : error ? error : `Showing ${displayed.length} jobs from multiple boards • Cached 10 min`}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowSavedOnly(false)}
                  className={`rounded-full px-3 py-1 text-xs ${!showSavedOnly ? "bg-black text-white dark:bg-white dark:text-black" : "border dark:border-zinc-800"}`}
                >
                  All
                </button>
                <button
                  onClick={() => setShowSavedOnly(true)}
                  className={`rounded-full px-3 py-1 text-xs ${showSavedOnly ? "bg-black text-white dark:bg-white dark:text-black" : "border dark:border-zinc-800"}`}
                >
                  Saved {savedCount > 0 && `(${savedCount})`}
                </button>
              </div>
            </div>

            {loading && (
              <div className="grid gap-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-32 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-900" />
                ))}
              </div>
            )}

            {error && !loading && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
                {error} — try changing search or check API limits.
              </div>
            )}

            {!loading && !error && displayed.length === 0 && (
              <div className="rounded-xl border border-dashed p-8 text-center text-sm text-zinc-500">No jobs found. Try &quot;developer&quot; or uncheck Remote only.</div>
            )}

            <div className="grid gap-3">
              {displayed.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  resumeText={resumeText}
                  onSave={toggleSave}
                  saved={savedHashes.has(`${job.title.toLowerCase()}|${job.company.toLowerCase()}`)}
                />
              ))}
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-zinc-100 bg-white py-6 text-center text-xs text-zinc-500 dark:border-zinc-900 dark:bg-zinc-950">
        Built with Next.js 16 • Deploy to Vercel/Netlify free • Arbeitnow + Remotive free APIs • Gemini ATS • <a href="/PLAN.md" className="underline">Plan</a>
      </footer>
    </div>
  );
}
