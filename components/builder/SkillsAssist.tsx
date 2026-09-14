"use client";

/** JD skills vs current skills with honest 1-click add. Never auto-invents. */
export default function SkillsAssist({
  jobKeywords,
  missingKeywords,
  skills,
  dismissed,
  onAdd,
  onDismiss,
}: {
  jobKeywords: string[];
  missingKeywords: string[];
  skills: string[];
  dismissed: string[];
  onAdd: (skill: string) => void;
  onDismiss: (skill: string) => void;
}) {
  const lower = new Set(skills.map((s) => s.toLowerCase()));
  const dismissedSet = new Set(dismissed.map((s) => s.toLowerCase()));
  const matched = jobKeywords.filter((k) => lower.has(k.toLowerCase())).slice(0, 15);
  const missing = missingKeywords.filter((k) => !lower.has(k.toLowerCase()) && !dismissedSet.has(k.toLowerCase()));
  const suggested = jobKeywords.filter((k) => !lower.has(k.toLowerCase()) && !dismissedSet.has(k.toLowerCase())).slice(0, 12);

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <h3 className="text-sm font-semibold">Skills Assist — from this job</h3>
      <p className="mt-1 text-xs text-zinc-500">
        Only add skills you truly have. AI reorders matched skills first; it never invents experience.
      </p>

      {matched.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-semibold text-green-700 dark:text-green-300">✅ Already covered ({matched.length})</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {matched.map((k) => (
              <span key={k} className="rounded bg-green-50 px-2 py-1 text-xs text-green-800 dark:bg-green-950 dark:text-green-200">{k}</span>
            ))}
          </div>
        </div>
      )}

      {missing.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-semibold text-red-700 dark:text-red-300">⚠️ ATS missing ({missing.length})</p>
          <div className="mt-1 space-y-1">
            {missing.slice(0, 8).map((k) => (
              <div key={k} className="flex items-center justify-between gap-2 rounded bg-red-50 px-2 py-1 text-xs dark:bg-red-950">
                <span className="min-w-0 truncate text-red-800 dark:text-red-200">{k}</span>
                <span className="flex shrink-0 gap-2">
                  <button onClick={() => onAdd(k)} className="font-medium underline" title="Add only if you truly have this skill">+ Add</button>
                  <button onClick={() => onDismiss(k)} className="text-zinc-500 underline" title="Dismiss">Dismiss</button>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {suggested.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-semibold">💡 JD keywords you could add (if true)</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {suggested.map((k) => (
              <button
                key={k}
                onClick={() => onAdd(k)}
                className="rounded border border-dashed border-zinc-300 px-2 py-1 text-xs hover:border-black dark:border-zinc-700"
                title="Add only if you truly have this skill"
              >
                + {k}
              </button>
            ))}
          </div>
        </div>
      )}

      {matched.length === 0 && missing.length === 0 && suggested.length === 0 && (
        <p className="mt-2 text-xs text-zinc-500">Run an ATS check to populate missing keywords for this job.</p>
      )}
    </div>
  );
}
