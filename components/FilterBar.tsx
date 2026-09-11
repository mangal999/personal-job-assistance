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
  const inputCls =
    "min-w-0 rounded-full border border-zinc-200 px-4 py-2 text-sm outline-none focus:border-black dark:border-zinc-800 dark:bg-black dark:focus:border-white";
  return (
    <div className="sticky top-0 z-10 border-b border-zinc-100 bg-white/90 px-3 py-2 backdrop-blur dark:border-zinc-900 dark:bg-zinc-950/90 sm:px-4 sm:py-3">
      {/* Mobile: 2 compact rows. Desktop (sm+): single row. */}
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSearch()}
          placeholder="Search: React, Python, Nurse..."
          enterKeyHint="search"
          className={`${inputCls} flex-1 basis-40 sm:max-w-sm sm:flex-none sm:basis-72`}
        />
        <div className="flex shrink-0 gap-2">
          <button onClick={onSearch} className="rounded-full bg-black px-4 py-2 text-sm font-medium text-white sm:px-5 dark:bg-white dark:text-black">
            Search
          </button>
          <button
            onClick={onPersonalized}
            disabled={!hasResume}
            title={hasResume ? "Rank jobs by your resume (client-side keyword overlap)" : "Upload resume to enable"}
            className="rounded-full border border-zinc-200 px-3 py-2 text-sm font-medium disabled:opacity-40 sm:px-4 dark:border-zinc-800"
          >
            For You
          </button>
        </div>
        <input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSearch()}
          placeholder="Location: India, Remote"
          enterKeyHint="search"
          className={`${inputCls} flex-1 basis-32 sm:max-w-[220px] sm:flex-none`}
        />
        <label className="flex shrink-0 items-center gap-1.5 py-2 text-xs sm:text-sm">
          <input type="checkbox" checked={remoteOnly} onChange={(e) => setRemoteOnly(e.target.checked)} className="h-4 w-4" />
          Remote only
        </label>
      </div>
      {availableSources.length > 0 && (
        <div className="mx-auto mt-2 flex max-w-6xl flex-nowrap items-center gap-1.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] sm:flex-wrap sm:overflow-visible sm:pb-0 [&::-webkit-scrollbar]:hidden">
          <span className="shrink-0 text-xs text-zinc-500">Sources:</span>
          {availableSources.map((s) => {
            // Explicit toggle: a chip is on only if selected. Deselecting the
            // last one leaves an empty selection (empty feed), never "all".
            const active = selectedSources.includes(s);
            return (
              <button
                key={s}
                onClick={() => onToggleSource(s)}
                title={
                  KEY_SOURCES.has(s)
                    ? `${s} needs API key (${s === "Adzuna" ? "ADZUNA_APP_ID/KEY" : "RAPIDAPI_KEY"}), otherwise returns 0`
                    : `${s} is free, no key needed`
                }
                className={`shrink-0 whitespace-nowrap rounded-full border px-2.5 py-1.5 text-xs font-medium transition sm:py-1 ${
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
          {selectedSources.length !== availableSources.length && (
            <button onClick={onClearSources} title="Select all sources" className="shrink-0 whitespace-nowrap text-xs text-zinc-500 underline">
              All
            </button>
          )}
          <span className="hidden shrink-0 text-[11px] text-zinc-400 sm:inline">*needs key • tap a chip to toggle it</span>
        </div>
      )}
    </div>
  );
}
