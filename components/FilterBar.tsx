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
  availableSources?: string[];
  selectedSources?: string[];
  onToggleSource?: (s: string) => void;
  onClearSources?: () => void;
}) {
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
    </div>
  );
}
