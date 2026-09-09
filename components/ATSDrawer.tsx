"use client";

import { ATSScore } from "@/lib/types";

export default function ATSDrawer({
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
              <ScoreBar label="Skills" value={score.breakdown.skills_match} />
              <ScoreBar label="Experience" value={score.breakdown.experience_match} />
              <ScoreBar label="Education" value={score.breakdown.education_match} />
              <ScoreBar label="Keywords" value={score.breakdown.keyword_match} />
            </div>

            <div>
              <p className="text-sm font-semibold">✅ Matched keywords</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {score.matched_keywords.map((k) => (
                  <span key={k} className="rounded bg-green-50 px-2 py-1 text-xs text-green-800 dark:bg-green-950 dark:text-green-200">
                    {k}
                  </span>
                ))}
                {score.matched_keywords.length === 0 && <span className="text-xs text-zinc-500">None</span>}
              </div>
            </div>

            <div>
              <p className="text-sm font-semibold">⚠️ Missing keywords</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {score.missing_keywords.map((k) => (
                  <span key={k} className="rounded bg-red-50 px-2 py-1 text-xs text-red-800 dark:bg-red-950 dark:text-red-200">
                    {k}
                  </span>
                ))}
                {score.missing_keywords.length === 0 && <span className="text-xs text-zinc-500">None — great!</span>}
              </div>
              <button
                onClick={() => navigator.clipboard.writeText(score.missing_keywords.join(", "))}
                className="mt-2 text-xs underline"
              >
                Copy missing keywords
              </button>
            </div>

            <div>
              <p className="text-sm font-semibold">💡 Tips to improve</p>
              <ul className="mt-1 list-disc pl-5 text-sm text-zinc-700 dark:text-zinc-300">
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

function ScoreBar({ label, value }: { label: string; value: number }) {
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
