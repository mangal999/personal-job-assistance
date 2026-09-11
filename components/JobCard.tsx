"use client";

import { UnifiedJob, ATSScore } from "@/lib/types";
import { useState } from "react";

export default function JobCard({
  job,
  resumeText,
  onSave,
  saved,
}: {
  job: UnifiedJob;
  resumeText: string;
  onSave: (job: UnifiedJob) => void;
  saved: boolean;
}) {
  const [score, setScore] = useState<ATSScore | null>(null);
  const [loading, setLoading] = useState(false);
  const [mocked, setMocked] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  async function handleATS() {
    if (!resumeText || resumeText.length < 50) {
      alert("Upload your resume first to get ATS score.");
      return;
    }
    // if cached score exists, just open
    if (score) {
      setDrawerOpen(true);
      return;
    }
    setLoading(true);
    setDrawerOpen(true);
    try {
      const res = await fetch("/api/ats-score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resumeText,
          jobTitle: job.title,
          jobDescription: job.description,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setScore(data);
      setMocked(!!data.mocked);
    } catch (e) {
      alert((e as Error).message);
      setDrawerOpen(false);
    } finally {
      setLoading(false);
    }
  }

  const posted = new Date(job.posted_at).toLocaleDateString();
  const badgeColor =
    score?.overall_score !== undefined
      ? score.overall_score >= 75
        ? "bg-green-600"
        : score.overall_score >= 50
          ? "bg-amber-500"
          : "bg-red-500"
      : "bg-zinc-800";

  return (
    <>
      <div className="rounded-xl border border-zinc-200 bg-white p-3 shadow-sm transition hover:shadow sm:p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="line-clamp-2 text-[15px] font-semibold leading-tight">{job.title}</h3>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              {job.company} • {job.location} {job.remote && "🌐 Remote"} • {posted}
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-1 text-[11px] font-medium dark:bg-zinc-800">{job.source}</span>
        </div>

        <p className="mt-2 line-clamp-3 text-sm leading-6 text-zinc-700 dark:text-zinc-300">{job.description.slice(0, 280)}...</p>

        {job.tags && job.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {job.tags.slice(0, 5).map((t) => (
              <span key={t} className="rounded bg-zinc-50 px-2 py-0.5 text-[11px] dark:bg-zinc-800">
                {t}
              </span>
            ))}
            {job.type && <span className="rounded bg-zinc-50 px-2 py-0.5 text-[11px] dark:bg-zinc-800">{job.type}</span>}
            {job.salary && <span className="rounded bg-zinc-50 px-2 py-0.5 text-[11px] dark:bg-zinc-800">{job.salary}</span>}
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <a
            href={job.apply_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex flex-1 items-center justify-center gap-1 rounded-full bg-black px-4 py-2.5 text-xs font-medium text-white hover:bg-zinc-800 sm:flex-none sm:py-2 dark:bg-white dark:text-black"
          >
            Apply ↗
          </a>

          <button
            onClick={handleATS}
            className={`inline-flex items-center rounded-full px-3 py-2.5 text-xs font-medium text-white sm:py-2 ${score ? badgeColor : "bg-zinc-800 hover:bg-zinc-700"}`}
          >
            {score ? `ATS: ${score.overall_score}% ${score.verdict === "Strong Match" ? "✓" : score.verdict === "Moderate Match" ? "≈" : "✗"}` : "ATS Score"}
          </button>

          <button
            onClick={() => onSave(job)}
            className={`ml-auto text-xs ${saved ? "text-red-600" : "text-zinc-500 hover:text-black dark:hover:text-white"}`}
            title={saved ? "Saved" : "Save job"}
          >
            {saved ? "♥ Saved" : "♡ Save"}
          </button>
        </div>
      </div>

      {/* Drawer */}
      {drawerOpen && (
        <Drawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          score={score}
          loading={loading}
          jobTitle={job.title}
          mocked={mocked}
        />
      )}
    </>
  );
}

function Drawer({
  open,
  onClose,
  score,
  loading,
  jobTitle,
  mocked,
}: {
  open: boolean;
  onClose: () => void;
  score: ATSScore | null;
  loading: boolean;
  jobTitle: string;
  mocked?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative h-full w-full max-w-md overflow-auto bg-white p-6 shadow-xl dark:bg-zinc-950">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">ATS Score</h3>
          <button onClick={onClose} className="rounded p-2 hover:bg-zinc-100 dark:hover:bg-zinc-900">
            ✕
          </button>
        </div>
        <p className="mt-1 text-sm text-zinc-500">{jobTitle}</p>
        {mocked && (
          <p className="mt-2 rounded bg-amber-50 px-2 py-1 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-200">
            Mock score — set GEMINI_API_KEY for real AI scoring.
          </p>
        )}
        {loading && <p className="mt-6 animate-pulse text-sm">Scoring with Gemini...</p>}
        {score && !loading && (
          <div className="mt-4 space-y-4">
            <div className="flex items-center gap-4">
              <div
                className={`flex h-20 w-20 items-center justify-center rounded-full text-2xl font-bold text-white ${score.overall_score >= 75 ? "bg-green-600" : score.overall_score >= 50 ? "bg-amber-500" : "bg-red-500"}`}
              >
                {score.overall_score}
              </div>
              <div>
                <p className="font-semibold">{score.verdict}</p>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">{score.summary}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <MiniBar label="Skills" value={score.breakdown.skills_match} />
              <MiniBar label="Experience" value={score.breakdown.experience_match} />
              <MiniBar label="Education" value={score.breakdown.education_match} />
              <MiniBar label="Keywords" value={score.breakdown.keyword_match} />
            </div>
            <div>
              <p className="text-sm font-semibold">✅ Matched</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {score.matched_keywords.map((k) => (
                  <span key={k} className="rounded bg-green-50 px-2 py-1 text-xs text-green-800 dark:bg-green-950 dark:text-green-200">
                    {k}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold">⚠️ Missing</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {score.missing_keywords.map((k) => (
                  <span key={k} className="rounded bg-red-50 px-2 py-1 text-xs text-red-800 dark:bg-red-950 dark:text-red-200">
                    {k}
                  </span>
                ))}
              </div>
              <button onClick={() => navigator.clipboard.writeText(score.missing_keywords.join(", "))} className="mt-2 text-xs underline">
                Copy missing
              </button>
            </div>
            <div>
              <p className="text-sm font-semibold">💡 Tips</p>
              <ul className="mt-1 list-disc pl-5 text-sm">
                {score.improvement_tips.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MiniBar({ label, value }: { label: string; value: number }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className="rounded border border-zinc-100 p-2 dark:border-zinc-900">
      <p className="text-xs text-zinc-500">{label}</p>
      <div className="mt-1 h-2 rounded bg-zinc-100 dark:bg-zinc-800">
        <div className="h-2 rounded bg-black dark:bg-white" style={{ width: `${v}%` }} />
      </div>
      <p className="mt-1 text-xs font-medium">{v}%</p>
    </div>
  );
}
