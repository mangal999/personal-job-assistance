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
}) {
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
          placeholder="Location: Remote, London, Bangalore"
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
    </div>
  );
}
