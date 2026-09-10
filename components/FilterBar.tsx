"use client";

export default function FilterBar({
  q,
  setQ,
  location,
  setLocation,
  remoteOnly,
  setRemoteOnly,
  onSearch,
  onPersonalized,
  hasResume,
  availableSources,
  selectedSources,
  onToggleSource,
  onClearSources,
}: {
  q: string;
  setQ: (v: string) => void;
  location: string;
  setLocation: (v: string) => void;
  remoteOnly: boolean;
  setRemoteOnly: (v: boolean) => void;
  onSearch: () => void;
  onPersonalized: () => void;
  hasResume: boolean;
  availableSources: string[];
  selectedSources: string[];
  onToggleSource: (s: string) => void;
  onClearSources: () => void;
}) {
  const KEY_SOURCES = new Set(["Adzuna", "JSearch"]);
  return (
    <div className="sticky top-0 z-10 -mx-4 border-b border-zinc-100 bg-white/80 px-4 py-3 backdrop-blur dark:border-zinc-900 dark:bg-zinc-950/80">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 sm:flex-row sm:items-center">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSearch()}
          placeholder="Search: React, Python, Product Manager..."
          className="w-full rounded-full border border-zinc-200 px-4 py-2 text-sm outline-none focus:border-black dark:border-zinc-800 dark:bg-black dark:focus:border-white sm:max-w-sm"
        />
        <input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSearch()}
          placeholder="Location: India, Bangalore, Remote"
          className="w-full rounded-full border border-zinc-200 px-4 py-2 text-sm outline-none focus:border-black dark:border-zinc-800 dark:bg-black sm:max-w-[240px]"
        />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={remoteOnly} onChange={(e) => setRemoteOnly(e.target.checked)} />
          Remote only
        </label>
        <div className="flex gap-2 sm:ml-auto">
          <button onClick={onSearch} className="rounded-full bg-black px-5 py-2 text-sm font-medium text-white dark:bg-white dark:text-black">
            Search
          </button>
          <button
            onClick={onPersonalized}
            disabled={!hasResume}
            title={hasResume ? "Rank jobs by your resume (client-side keyword overlap)" : "Upload resume to enable"}
            className="rounded-full border border-zinc-200 px-4 py-2 text-sm font-medium disabled:opacity-40 dark:border-zinc-800"
          >
            For You
          </button>
        </div>
      </div>
      {availableSources.length > 0 && (
        <div className="mx-auto mt-2 flex max-w-6xl flex-wrap items-center gap-1.5">
          <span className="text-xs text-zinc-500">Sources:</span>
          {availableSources.map((s) => {
            const active = selectedSources.length === 0 || selectedSources.includes(s);
            return (
              <button
                key={s}
                onClick={() => onToggleSource(s)}
                title={
                  KEY_SOURCES.has(s)
                    ? `${s} needs API key (${s === "Adzuna" ? "ADZUNA_APP_ID/KEY" : "RAPIDAPI_KEY"}), otherwise returns 0`
                    : `${s} is free, no key needed`
                }
                className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                  active
                    ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
                    : "border-zinc-200 text-zinc-500 hover:border-zinc-400 dark:border-zinc-800"
                }`}
              >
                {s}
                {KEY_SOURCES.has(s) ? "*" : ""}
              </button>
            );
          })}
          {selectedSources.length > 0 && (
            <button onClick={onClearSources} className="text-xs text-zinc-500 underline">
              All
            </button>
          )}
          <span className="text-[11px] text-zinc-400">*needs key • empty = all sources</span>
        </div>
      )}
    </div>
  );
}
