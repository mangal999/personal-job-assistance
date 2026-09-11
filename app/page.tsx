"use client";

import { useEffect, useState, useRef } from "react";
import type { ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { UnifiedJob } from "@/lib/types";
import JobCard from "@/components/JobCard";
import FilterBar from "@/components/FilterBar";
import ResumeUploader from "@/components/ResumeUploader";
import AuthButton, { PJA_AUTH_EVENT } from "@/components/AuthButton";
import CustomSources, { encodeCustomParam } from "@/components/CustomSources";
import type { CustomSource } from "@/lib/custom-source-types";
import { getSupabaseBrowser, isSupabaseConfigured } from "@/lib/supabase";

const LS_RESUME = "pja_resume_text";
const LS_SAVED = "pja_saved_jobs";
const LS_CUSTOM = "pja_custom_sources";

function parseLocalCustomSources(): CustomSource[] {
  try {
    const raw = localStorage.getItem(LS_CUSTOM);
    if (!raw) return [];
    const arr = JSON.parse(raw) as CustomSource[];
    return Array.isArray(arr)
      ? arr.filter((s) => s && typeof s.name === "string" && typeof s.url === "string").slice(0, 10)
      : [];
  } catch {
    return [];
  }
}

// Sidebar panel: on mobile it's a collapsed <details> (tap to expand, no JS),
// on desktop (lg+) the summary hides and content is always visible.
function SidePanel({ title, defaultOpen, children }: { title: string; defaultOpen?: boolean; children: ReactNode }) {
  return (
    <details
      open={defaultOpen}
      className="group rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 p-4 text-[15px] font-semibold lg:hidden [&::-webkit-details-marker]:hidden">
        {title}
        <span aria-hidden className="text-xs text-zinc-400 transition-transform group-open:rotate-180">
          ▾
        </span>
      </summary>
      <div className="hidden px-4 pb-4 group-open:block lg:block lg:p-4">
        <h2 className="mb-1 hidden font-semibold lg:block">{title}</h2>
        {children}
      </div>
    </details>
  );
}

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
  // Empty defaults = unfiltered "all jobs". Previous defaults
  // (q="developer", location="India") biased every first load toward
  // developer jobs and made search feel "stuck on developer".
  const [q, setQ] = useState("");
  const [location, setLocation] = useState("");
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [jobs, setJobs] = useState<UnifiedJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resumeText, setResumeText] = useState("");
  const [sources, setSources] = useState<Record<string, string> | null>(null);
  const [servedFromCache, setServedFromCache] = useState(false);
  const [availableSources, setAvailableSources] = useState<string[]>([
    "Arbeitnow",
    "Remotive",
    "Adzuna",
    "RemoteOK",
    "JSearch",
  ]);
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [showSavedOnly, setShowSavedOnly] = useState(false);
  const [savedHashes, setSavedHashes] = useState<Set<string>>(new Set());
  const [personalized, setPersonalized] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [customSources, setCustomSources] = useState<CustomSource[]>([]);
  const userRef = useRef<User | null>(null);
  useEffect(() => {
    userRef.current = user;
  }, [user ]);
  const customSourcesRef = useRef<CustomSource[]>([]);
  useEffect(() => {
    customSourcesRef.current = customSources;
  }, [customSources]);

  // Ensure a profiles row exists (custom_sources/saved_jobs FK references it).
  async function ensureProfile(u: User) {
    const supabase = getSupabaseBrowser()!;
    await supabase.from("profiles").upsert({ id: u.id, email: u.email }, { onConflict: "id" });
  }

  // Track login state (emitted by AuthButton). On login, pull cloud data.
  useEffect(() => {
    const handler = async (e: Event) => {
      const u = (e as CustomEvent<User | null>).detail ?? null;
      setUser(u);
      if (u && isSupabaseConfigured()) {
        const supabase = getSupabaseBrowser()!;
        // Load cloud-saved jobs
        const { data: saved } = await supabase.from("saved_jobs").select("job_data");
        if (saved && saved.length > 0) {
          try {
            const arr = saved.map((r) => (r as { job_data: UnifiedJob }).job_data);
            localStorage.setItem(LS_SAVED, JSON.stringify(arr));
            setSavedHashes(
              new Set(arr.map((j) => `${j.title.toLowerCase()}|${j.company.toLowerCase()}`))
            );
          } catch {}
        }
        // Load cloud resume if local empty
        const { data: profile } = await supabase
          .from("profiles")
          .select("resume_text")
          .eq("id", u.id)
          .single();
        const cloudResume = (profile as { resume_text?: string } | null)?.resume_text;
        if (cloudResume && cloudResume.length > 50) {
          const local = localStorage.getItem(LS_RESUME) || "";
          if (local.length < 50) {
            setResumeText(cloudResume);
          }
        }
        // Load cloud custom sources (cloud wins when non-empty)
        const { data: cloudSources } = await supabase
          .from("custom_sources")
          .select("name,type,url,enabled");
        if (cloudSources && cloudSources.length > 0) {
          const arr: CustomSource[] = (cloudSources as Array<{ name: string; type: CustomSource["type"]; url: string; enabled: boolean }>)
            .filter((r) => r.name && r.url)
            .slice(0, 10)
            .map((r, i) => ({ id: `cloud-${i}`, name: r.name, type: r.type, url: r.url, enabled: r.enabled !== false }));
          localStorage.setItem(LS_CUSTOM, JSON.stringify(arr));
          customSourcesRef.current = arr;
          setCustomSources(arr);
          void fetchJobs({ customs: arr });
        }
      }
    };
    window.addEventListener(PJA_AUTH_EVENT, handler);
    return () => window.removeEventListener(PJA_AUTH_EVENT, handler);
    // fetchJobs intentionally excluded: auth subscription must attach once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync resume to Supabase profile (debounced) when logged in.
  useEffect(() => {
    if (!user || !isSupabaseConfigured() || resumeText.length < 50) return;
    const t = setTimeout(() => {
      const supabase = getSupabaseBrowser()!;
      void supabase.from("profiles").upsert(
        { id: user.id, email: user.email, resume_text: resumeText, resume_updated_at: new Date().toISOString() },
        { onConflict: "id" }
      );
    }, 1500);
    return () => clearTimeout(t);
  }, [resumeText, user]);
  // Ref mirror so source toggles always see latest selection.
  const selectedSourcesRef = useRef<string[]>([]);
  useEffect(() => {
    selectedSourcesRef.current = selectedSources;
  }, [selectedSources]);

  // Explicit-params fetch: never relies on stale closures.
  // Every search sends exactly what the user typed — no hidden defaults.
  // Custom sources ride along via ?custom= so searches include them and the
  // server cache key stays per-query (never cross-contaminated).
  async function fetchJobs(
    args?: {
      q?: string;
      location?: string;
      remoteOnly?: boolean;
      sources?: string[];
      customs?: CustomSource[];
    },
    personalize = false
  ) {
    const qq = (args?.q ?? q).trim();
    const loc = (args?.location ?? location).trim();
    const rem = args?.remoteOnly ?? remoteOnly;
    const srcs = args?.sources ?? selectedSourcesRef.current;
    const customs = args?.customs ?? customSourcesRef.current;
    setLoading(true);
    setError(null);
    try {
      const url = new URL("/api/jobs", window.location.origin);
      if (qq) url.searchParams.set("q", qq);
      if (loc) url.searchParams.set("location", loc);
      if (rem) url.searchParams.set("remote", "true");
      if (srcs.length > 0) url.searchParams.set("sources", srcs.join(","));
      const customParam = encodeCustomParam(customs);
      if (customParam) url.searchParams.set("custom", customParam);

      // update browser URL (shareable filter URL)
      const newParams = new URLSearchParams();
      if (qq) newParams.set("q", qq);
      if (loc) newParams.set("location", loc);
      if (rem) newParams.set("remote", "true");
      if (srcs.length > 0) newParams.set("sources", srcs.join(","));
      const qs = newParams.toString();
      window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);

      // Bypass HTTP cache on explicit user searches so results always
      // reflect the current query, not a cached older one.
      const res = await fetch(url.toString(), { cache: "no-store" });
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
      setServedFromCache(!!data.cached);
      if (Array.isArray(data.availableSources) && data.availableSources.length > 0) {
        setAvailableSources(data.availableSources);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  // Load from localStorage + URL, then fetch ONCE with those exact values.
  // (Previously two separate mount effects raced: the fetch used the stale
  // default q="developer" even when the URL said ?q=designer.)
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
    const urlQ = params.get("q") || "";
    const urlLoc = params.get("location") || "";
    const urlRemote = params.get("remote") === "true";
    const srcParam = params.get("sources") || params.get("source");
    const urlSources = srcParam ? srcParam.split(",").map((x) => x.trim()).filter(Boolean) : [];
    const localCustoms = parseLocalCustomSources();
    setQ(urlQ);
    setLocation(urlLoc);
    setRemoteOnly(urlRemote);
    setSelectedSources(urlSources);
    selectedSourcesRef.current = urlSources;
    setCustomSources(localCustoms);
    customSourcesRef.current = localCustoms;
    void fetchJobs({ q: urlQ, location: urlLoc, remoteOnly: urlRemote, sources: urlSources, customs: localCustoms });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    localStorage.setItem(LS_RESUME, resumeText);
  }, [resumeText]);

  function toggleSource(source: string) {
    setSelectedSources((prev) => {
      // No selection = all sources. Toggling from "all" starts a new
      // single-source selection; toggling the last one off returns to all.
      let next: string[];
      if (prev.length === 0) {
        next = [source];
      } else if (prev.includes(source)) {
        next = prev.filter((s) => s !== source);
      } else {
        next = [...prev, source];
      }
      selectedSourcesRef.current = next;
      void fetchJobs({ q, location, remoteOnly, sources: next });
      return next;
    });
  }

  function clearSources() {
    setSelectedSources([]);
    selectedSourcesRef.current = [];
    void fetchJobs({ q, location, remoteOnly, sources: [] });
  }

  // Custom sources: persist locally always, sync to Supabase when logged in,
  // and re-run the search so the new/removed source takes effect immediately.
  function handleCustomSourcesChange(next: CustomSource[]) {
    setCustomSources(next);
    customSourcesRef.current = next;
    localStorage.setItem(LS_CUSTOM, JSON.stringify(next));
    const u = userRef.current;
    if (u && isSupabaseConfigured()) {
      const supabase = getSupabaseBrowser()!;
      void (async () => {
        await ensureProfile(u);
        await supabase.from("custom_sources").delete().eq("user_id", u.id);
        if (next.length > 0) {
          await supabase.from("custom_sources").insert(
            next.map((s) => ({ user_id: u.id, name: s.name, type: s.type, url: s.url, enabled: s.enabled !== false }))
          );
        }
      })();
    }
    void fetchJobs({ q, location, remoteOnly, customs: next });
  }

  function toggleSave(job: UnifiedJob) {
    const key = `${job.title.toLowerCase()}|${job.company.toLowerCase()}`;
    const jobHash = key.replace(/[^a-z0-9]+/g, "-").slice(0, 120);
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
    // Cloud sync when logged in (Supabase) — localStorage stays the fallback.
    const u = userRef.current;
    if (u && isSupabaseConfigured()) {
      const supabase = getSupabaseBrowser()!;
      if (exists) {
        void supabase.from("saved_jobs").delete().eq("user_id", u.id).eq("job_hash", jobHash);
      } else {
        void supabase
          .from("saved_jobs")
          .upsert({ user_id: u.id, job_hash: jobHash, job_data: job }, { onConflict: "user_id,job_hash" });
      }
    }
  }

  const displayed = (showSavedOnly
    ? jobs.filter((j) => savedHashes.has(`${j.title.toLowerCase()}|${j.company.toLowerCase()}`))
    : jobs
  ).filter((j) => selectedSources.length === 0 || selectedSources.includes(j.source));

  const savedCount = savedHashes.size;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <header className="border-b border-zinc-100 bg-white dark:border-zinc-900 dark:bg-zinc-950">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-3 py-3 sm:px-4 sm:py-4">
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold tracking-tight sm:text-xl">Personal Job Assistance</h1>
            <p className="truncate text-xs text-zinc-500">One page • All jobs • ATS score next to Apply</p>
          </div>
          <div className="hidden sm:block text-right">
            <p className="text-xs text-zinc-500">{resumeText ? `Resume: ${resumeText.length} chars` : "No resume — upload to enable ATS"}</p>
            <p className="text-xs text-zinc-400">
              {user ? `☁️ Synced as ${user.email}` : "Deploy free on Vercel/Netlify • 100% free APIs"}
            </p>
          </div>
          <div className="sm:ml-4">
            <AuthButton />
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
        onSearch={() => fetchJobs()}
        onPersonalized={() => fetchJobs(undefined, true)}
        hasResume={resumeText.length > 50}
        availableSources={availableSources}
        selectedSources={selectedSources}
        onToggleSource={toggleSource}
        onClearSources={clearSources}
      />

      <main className="mx-auto max-w-6xl px-3 py-4 sm:px-4 sm:py-6">
        {/* Mobile-first: jobs feed first, sidebar below. Desktop: sidebar left (sticky), feed right. */}
        <div className="grid gap-4 sm:gap-6 lg:grid-cols-[360px_1fr]">
          {/* Left (desktop) / Below (mobile): Resume + Sources + Info */}
          <div className="order-2 space-y-3 sm:space-y-4 lg:order-1 lg:sticky lg:top-[72px] lg:h-fit">
            <SidePanel title="1. Upload Resume" defaultOpen>
              <p className="mt-1 text-xs text-zinc-500">ATS scoring uses this text. Stored locally unless Supabase configured.</p>
              <div className="mt-3">
                <ResumeUploader onText={setResumeText} initialText={resumeText} />
              </div>
            </SidePanel>

            <SidePanel title="2. My job sources">
              <p className="mt-1 text-xs text-zinc-500">
                Add RSS feeds or Greenhouse/Lever boards. Searches include them automatically.
              </p>
              <div className="mt-3">
                <CustomSources sources={customSources} onChange={handleCustomSourcesChange} isCloud={!!user} />
              </div>
            </SidePanel>

            <SidePanel title="How it works">
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs leading-5 text-zinc-600 dark:text-zinc-400">
                <li>Search jobs — built-in boards + your custom sources (§2).</li>
                <li>Click <span className="rounded bg-black px-1 py-0.5 text-white">Apply ↗</span> → go to official portal.</li>
                <li>Click <span className="rounded bg-zinc-800 px-1 py-0.5 text-white">ATS Score</span> next to any job → real Gemini score (or mock if no key).</li>
                <li>Use <em>For You</em> to re-rank by resume keywords (no LLM cost).</li>
              </ol>
            </SidePanel>

            <SidePanel title="Env Setup (optional)">
              <div className="text-xs">
              <p className="mt-1 text-zinc-500">
                For real AI scoring, set <code>GEMINI_API_KEY</code> in Vercel env. For auth/DB, set
                <code> NEXT_PUBLIC_SUPABASE_URL</code>. App works without both (localStorage + mock scores).
              </p>
              {sources && (
                <div className="mt-2 rounded bg-zinc-50 p-2 dark:bg-zinc-800">
                  <p className="font-medium">Sources</p>
                  <ul className="mt-1">
                    {Object.entries(sources).map(([k, v]) => (
                      <li key={k} className="flex justify-between gap-2">
                        <span className="truncate">{k}</span>
                        <span className={`shrink-0 ${v.startsWith("ok") ? "text-green-600" : "text-red-500"}`}>{v}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              </div>
            </SidePanel>
          </div>

          {/* Right (desktop) / First (mobile): Jobs */}
          <div className="order-1 min-w-0 lg:order-2">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold">
                  {showSavedOnly ? `Saved (${savedCount})` : personalized ? "For You — ranked by resume" : `Jobs (${displayed.length})`}
                </h2>
                <p className="text-xs text-zinc-500">
                  {loading
                    ? `Searching${q.trim() ? ` for "${q.trim()}"` : ""}...`
                    : error
                      ? error
                      : `Showing ${displayed.length} jobs${q.trim() ? ` for "${q.trim()}"` : ""}${servedFromCache ? " • served from 3-min cache" : " • live"}`}
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
              <div className="rounded-xl border border-dashed p-8 text-center text-sm text-zinc-500">
                No jobs found{q.trim() ? ` for "${q.trim()}"` : ""}. Try a different keyword (e.g. &quot;designer&quot;, &quot;accountant&quot;, &quot;nurse&quot;) or uncheck Remote only.
              </div>
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
