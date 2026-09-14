"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { ATSScore, UnifiedJob } from "@/lib/types";
import {
  ResumeData,
  emptyResume,
  jobHashFor,
  extractJobKeywords,
} from "@/lib/resume-types";
import { resumeToPlainText, resumeFileBase } from "@/lib/resume-render";
import { sanitizeResumeData } from "@/lib/gemini";
import ResumeUploader from "@/components/ResumeUploader";
import ResumeForm from "@/components/builder/ResumeForm";
import ResumePreview from "@/components/builder/ResumePreview";
import SkillsAssist from "@/components/builder/SkillsAssist";
import ExportButtons from "@/components/builder/ExportButtons";
import { getSupabaseBrowser, isSupabaseConfigured } from "@/lib/supabase";

const LS_RESUME = "pja_resume_text";
const BUILDER_JOB_KEY = "pja_builder_job";

type BuilderJob = Pick<UnifiedJob, "title" | "company" | "location" | "description" | "apply_url" | "tags">;

function loadJob(): BuilderJob | null {
  try {
    const raw = sessionStorage.getItem(BUILDER_JOB_KEY);
    if (raw) return JSON.parse(raw) as BuilderJob;
  } catch {}
  return null;
}

export default function BuilderPage() {
  const [job, setJob] = useState<BuilderJob | null>(null);
  const [manualJd, setManualJd] = useState("");
  const [manualTitle, setManualTitle] = useState("");
  const [resumeText, setResumeText] = useState("");
  const [resume, setResume] = useState<ResumeData>(emptyResume());
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [jobKeywords, setJobKeywords] = useState<string[]>([]);
  const [missing, setMissing] = useState<string[]>([]);
  const [atsBefore, setAtsBefore] = useState<ATSScore | null>(null);
  const [atsAfter, setAtsAfter] = useState<ATSScore | null>(null);
  const [tailorNotes, setTailorNotes] = useState<string[]>([]);
  const [busy, setBusy] = useState<"parse" | "tailor" | "ats" | "save" | null>(null);
  const [mocked, setMocked] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);

  const effectiveTitle = job?.title || manualTitle || "Target role";
  const effectiveDesc = job?.description || manualJd || "";
  const effectiveCompany = job?.company || "";
  const jobHash = jobHashFor(effectiveTitle, effectiveCompany, job?.apply_url);
  const draftKey = `pja_builder_draft_${jobHash}`;
  const fileBase = resumeFileBase(resume, effectiveCompany);

  function showToast(msg: string) {
    setToast(msg);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 4000);
  }

  // Init: job + resume text + draft (client-only, no useSearchParams → no Suspense needed)
  useEffect(() => {
    const fromStore = loadJob();
    if (fromStore) {
      setJob(fromStore);
    } else {
      const params = new URLSearchParams(window.location.search);
      const t = params.get("title") || "";
      const c = params.get("company") || "";
      if (t) setJob({ title: t, company: c, location: "", description: "", apply_url: "", tags: [] });
    }
    try {
      const r = localStorage.getItem(LS_RESUME) || "";
      if (r) setResumeText(r);
      const draftRaw = localStorage.getItem(`pja_builder_draft_${jobHashFor(
        fromStore?.title || new URLSearchParams(window.location.search).get("title") || "Target role",
        fromStore?.company || new URLSearchParams(window.location.search).get("company") || "",
        fromStore?.apply_url
      )}`);
      if (draftRaw) {
        const parsed = JSON.parse(draftRaw) as { resume?: ResumeData; dismissed?: string[] };
        if (parsed.resume) setResume(sanitizeResumeData(parsed.resume));
        if (Array.isArray(parsed.dismissed)) setDismissed(parsed.dismissed);
      }
    } catch {}
  }, []);

  // JD keywords refresh
  useEffect(() => {
    if (effectiveDesc.length > 50) {
      setJobKeywords(extractJobKeywords(effectiveDesc, effectiveTitle, job?.tags));
    } else {
      setJobKeywords([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveDesc, effectiveTitle]);

  // Draft autosave
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        localStorage.setItem(draftKey, JSON.stringify({ resume, dismissed }));
      } catch {}
    }, 800);
    return () => clearTimeout(t);
  }, [resume, dismissed, draftKey]);

  async function handleParse() {
    if (resumeText.trim().length < 50) {
      showToast("Upload your resume or paste text first (50+ chars).");
      return;
    }
    setBusy("parse");
    try {
      const res = await fetch("/api/resume/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeText: resumeText.slice(0, 15000) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Parse failed");
      setResume(sanitizeResumeData(data.resume));
      setMocked(!!data.mocked);
      showToast(data.mocked ? "Prefilled with offline parser (no Gemini key)." : "Resume parsed — review every field before export.");
    } catch (e) {
      showToast(`Parse failed: ${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  }

  async function handleTailor() {
    if (!effectiveDesc || effectiveDesc.length < 50) {
      showToast("Job description is missing — paste it below first.");
      return;
    }
    setBusy("tailor");
    try {
      const res = await fetch("/api/resume/tailor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resume,
          jobTitle: effectiveTitle,
          jobDescription: effectiveDesc.slice(0, 8000),
          missingKeywords: missing.slice(0, 15),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Tailor failed");
      setResume(sanitizeResumeData(data.tailored));
      setTailorNotes(Array.isArray(data.notes) ? data.notes : []);
      setMocked(!!data.mocked);
      showToast(data.mocked ? "Skills reordered (offline). Set GEMINI_API_KEY for AI summary tweaks." : "Tailored conservatively — review changes, nothing was invented.");
    } catch (e) {
      showToast(`Tailor failed: ${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  }

  async function handleAts(which: "before" | "after") {
    const text = which === "before" ? resumeText : resumeToPlainText(resume);
    if (text.trim().length < 50) {
      showToast(which === "before" ? "Upload resume first." : "Fill in resume fields first.");
      return;
    }
    if (!effectiveDesc || effectiveDesc.length < 20) {
      showToast("Job description missing.");
      return;
    }
    setBusy("ats");
    try {
      const res = await fetch("/api/ats-score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeText: text.slice(0, 15000), jobTitle: effectiveTitle, jobDescription: effectiveDesc.slice(0, 8000) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "ATS check failed");
      if (which === "before") setAtsBefore(data);
      else {
        setAtsAfter(data);
        if (Array.isArray(data.missing_keywords)) setMissing(data.missing_keywords);
      }
      if (data.mocked) setMocked(true);
    } catch (e) {
      showToast(`ATS check failed: ${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  }

  async function handleSave() {
    setBusy("save");
    try {
      const text = resumeToPlainText(resume);
      const payload = {
        job_hash: jobHash,
        job_data: job ?? { title: effectiveTitle, company: effectiveCompany, description: effectiveDesc },
        resume_data: resume,
        resume_text: text,
        ats_score: atsAfter?.overall_score ?? atsBefore?.overall_score ?? null,
      };
      localStorage.setItem(`pja_tailored_${jobHash}`, JSON.stringify({ ...payload, savedAt: new Date().toISOString() }));
      if (isSupabaseConfigured()) {
        const supabase = getSupabaseBrowser()!;
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { error } = await supabase.from("tailored_resumes").upsert(
            {
              user_id: user.id,
              job_hash: jobHash,
              job_snapshot: payload.job_data,
              resume_data: resume,
              resume_text: text,
              ats_score: payload.ats_score,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id,job_hash" }
          );
          if (error) throw error;
          showToast("Saved to cloud + this device.");
        } else {
          showToast("Saved on this device (log in for cloud sync).");
        }
      } else {
        showToast("Saved on this device (Supabase not configured).");
      }
    } catch (e) {
      showToast(`Save failed: ${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  }

  function addSkill(s: string) {
    const v = s.trim();
    if (!v) return;
    if (!resume.skills.some((x) => x.toLowerCase() === v.toLowerCase())) {
      setResume({ ...resume, skills: [...resume.skills, v] });
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <header className="builder-no-print border-b border-zinc-100 bg-white dark:border-zinc-900 dark:bg-zinc-950">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-3 py-3 sm:px-4">
          <div className="min-w-0">
            <Link href="/" className="text-xs text-zinc-500 underline">← Back to jobs</Link>
            <h1 className="truncate text-lg font-bold tracking-tight">Build Resume for this job</h1>
            <p className="truncate text-xs text-zinc-500">
              {effectiveTitle}{effectiveCompany ? ` @ ${effectiveCompany}` : ""} • edit before you export
            </p>
          </div>
          <button
            onClick={handleSave}
            disabled={busy === "save"}
            className="shrink-0 rounded-full bg-black px-4 py-2 text-xs font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
          >
            {busy === "save" ? "Saving…" : "Save"}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-3 py-4 sm:px-4 sm:py-6">
        {mocked && (
          <p className="builder-no-print mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-200">
            Offline/AI-mock mode — set <code>GEMINI_API_KEY</code> for real AI parse + tailor. Manual editing + exports always work.
          </p>
        )}

        <div className="grid gap-4 lg:grid-cols-[400px_1fr]">
          {/* Left: controls */}
          <div className="builder-no-print min-w-0 space-y-4">
            {/* 1. Job context */}
            <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="text-sm font-semibold">1. Target job</h2>
              {job ? (
                <div className="mt-2 text-xs leading-5">
                  <p className="font-semibold">{job.title} @ {job.company}</p>
                  {job.location && <p className="text-zinc-500">{job.location}</p>}
                  <p className="mt-1 line-clamp-4 text-zinc-600 dark:text-zinc-400">{job.description}</p>
                  {job.apply_url && <a href={job.apply_url} target="_blank" rel="noopener noreferrer" className="underline">View posting ↗</a>}
                </div>
              ) : (
                <div className="mt-2 space-y-2">
                  <p className="text-xs text-zinc-500">No job passed — paste details manually (or open builder from a job card).</p>
                  <input value={manualTitle} onChange={(e) => setManualTitle(e.target.value)} placeholder="Job title + company" className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950" />
                  <textarea value={manualJd} onChange={(e) => setManualJd(e.target.value)} rows={5} placeholder="Paste job description…" className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950" />
                </div>
              )}
              <div className="mt-3 flex gap-2">
                <button onClick={() => handleAts("before")} disabled={busy === "ats"} className="rounded-full border border-zinc-200 px-3 py-1.5 text-xs font-medium disabled:opacity-50 dark:border-zinc-700">
                  {busy === "ats" ? "Scoring…" : atsBefore ? `Current resume: ${atsBefore.overall_score}% — recheck` : "Score current resume"}
                </button>
                <button onClick={() => handleAts("after")} disabled={busy === "ats"} className="rounded-full bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-black">
                  {atsAfter ? `Tailored: ${atsAfter.overall_score}% — recheck` : "Score tailored resume"}
                </button>
              </div>
              {atsBefore && atsAfter && (
                <p className="mt-2 text-xs font-semibold">
                  Lift: {atsBefore.overall_score}% → {atsAfter.overall_score}% ({atsAfter.overall_score - atsBefore.overall_score >= 0 ? "+" : ""}{atsAfter.overall_score - atsBefore.overall_score})
                </p>
              )}
            </section>

            {/* 2. Source */}
            <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="text-sm font-semibold">2. Prefill from your resume</h2>
              <div className="mt-2">
                <ResumeUploader onText={setResumeText} initialText={resumeText} />
              </div>
              <button
                onClick={handleParse}
                disabled={busy === "parse"}
                className="mt-3 w-full rounded-full bg-black px-4 py-2 text-xs font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
              >
                {busy === "parse" ? "Parsing…" : "Parse & prefill form"}
              </button>
            </section>

            {/* 3b. Skills assist */}
            <SkillsAssist
              jobKeywords={jobKeywords}
              missingKeywords={missing}
              skills={resume.skills}
              dismissed={dismissed}
              onAdd={addSkill}
              onDismiss={(s) => setDismissed((d) => [...d, s])}
            />

            {/* 4. AI tailor */}
            <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="text-sm font-semibold">3. AI tailor (conservative)</h2>
              <p className="mt-1 text-xs text-zinc-500">Reorders matched skills, rewrites summary from real skills. Never invents jobs or degrees.</p>
              <button
                onClick={handleTailor}
                disabled={busy === "tailor"}
                className="mt-2 w-full rounded-full border border-zinc-300 px-4 py-2 text-xs font-medium disabled:opacity-50 dark:border-zinc-700"
              >
                {busy === "tailor" ? "Tailoring…" : "✨ Tailor to this job"}
              </button>
              {tailorNotes.length > 0 && (
                <ul className="mt-2 list-disc pl-5 text-xs leading-5 text-zinc-600 dark:text-zinc-400">
                  {tailorNotes.map((n, i) => <li key={i}>{n}</li>)}
                </ul>
              )}
            </section>
          </div>

          {/* Right: form + preview */}
          <div className="min-w-0 space-y-4">
            <div className="builder-no-print">
              <ResumeForm resume={resume} onChange={setResume} />
            </div>

            <section>
              <h2 className="builder-no-print mb-2 text-sm font-semibold">Preview (exactly what ATS sees — single column)</h2>
              <ResumePreview resume={resume} />
            </section>

            <div className="builder-no-print rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="mb-2 text-sm font-semibold">4. Export</h2>
              <ExportButtons resume={resume} company={effectiveCompany} fileBase={fileBase} />
              <p className="mt-2 text-[11px] text-zinc-500">
                Draft autosaves on this device. Review every field — only export what is true.
              </p>
            </div>
          </div>
        </div>
      </main>

      {toast && (
        <div role="status" className="builder-no-print fixed bottom-4 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-2xl bg-black px-4 py-3 text-center text-xs leading-5 text-white shadow-xl dark:bg-white dark:text-black">
          {toast}
        </div>
      )}
    </div>
  );
}
