import { UnifiedJob } from "./types";

// -- Helpers --
function toIso(dateStr?: string): string {
  if (!dateStr) return new Date().toISOString();
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function isRemoteLocation(loc: string, tags: string[] = []): boolean {
  const l = loc.toLowerCase();
  if (l.includes("remote") || l.includes("worldwide") || l.includes("anywhere")) return true;
  if (tags.some((t) => t.toLowerCase() === "remote")) return true;
  return false;
}

// -- Arbeitnow (https://www.arbeitnow.com/api/job-board-api) --
interface ArbeitnowResponse {
  data: Array<{
    slug: string;
    company_name: string;
    title: string;
    description: string;
    remote: boolean;
    url: string;
    tags: string[];
    job_types: string[];
    location: string;
    created_at: string;
  }>;
}

export async function fetchArbeitnow(query?: string): Promise<UnifiedJob[]> {
  const res = await fetch("https://www.arbeitnow.com/api/job-board-api", {
    next: { revalidate: 1800 },
  });
  if (!res.ok) throw new Error(`Arbeitnow ${res.status}`);
  const json: ArbeitnowResponse = await res.json();
  let jobs = json.data.map((j) => ({
    id: `arbeitnow-${j.slug}`,
    title: j.title,
    company: j.company_name,
    location: j.location || (j.remote ? "Remote" : "Unknown"),
    description: stripHtml(j.description),
    apply_url: j.url,
    source: "Arbeitnow",
    posted_at: toIso(j.created_at),
    remote: j.remote || isRemoteLocation(j.location, j.tags),
    type: j.job_types?.[0],
    tags: j.tags,
  }));

  if (query) {
    const q = query.toLowerCase();
    jobs = jobs.filter(
      (j) =>
        j.title.toLowerCase().includes(q) ||
        j.description.toLowerCase().includes(q) ||
        j.company.toLowerCase().includes(q) ||
        j.tags?.some((t) => t.toLowerCase().includes(q))
    );
  }
  return jobs;
}

// -- Remotive (https://remotive.com/api/remote-jobs) --
interface RemotiveResponse {
  jobs: Array<{
    id: number;
    title: string;
    company_name: string;
    category: string;
    job_type: string;
    candidate_required_location: string;
    description: string;
    url: string;
    publication_date: string;
    salary?: string;
    tags: string[];
  }>;
}

export async function fetchRemotive(query?: string): Promise<UnifiedJob[]> {
  const url = new URL("https://remotive.com/api/remote-jobs");
  if (query) url.searchParams.set("search", query);
  const res = await fetch(url.toString(), { next: { revalidate: 1800 } });
  if (!res.ok) throw new Error(`Remotive ${res.status}`);
  const json: RemotiveResponse = await res.json();
  return json.jobs.slice(0, 50).map((j) => ({
    id: `remotive-${j.id}`,
    title: j.title,
    company: j.company_name,
    location: j.candidate_required_location || "Remote",
    description: stripHtml(j.description),
    apply_url: j.url,
    source: "Remotive",
    posted_at: toIso(j.publication_date),
    salary: j.salary,
    remote: true,
    type: j.job_type,
    tags: j.tags,
  }));
}

// -- Adzuna (optional, requires keys) --
export async function fetchAdzuna(query?: string, location?: string): Promise<UnifiedJob[]> {
  const appId = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;
  if (!appId || !appKey) return [];

  const country = process.env.ADZUNA_COUNTRY || "gb";
  const url = new URL(`https://api.adzuna.com/v1/api/jobs/${country}/search/1`);
  url.searchParams.set("app_id", appId);
  url.searchParams.set("app_key", appKey);
  url.searchParams.set("results_per_page", "20");
  url.searchParams.set("content-type", "application/json");
  if (query) url.searchParams.set("what", query);
  if (location) url.searchParams.set("where", location);

  const res = await fetch(url.toString(), { next: { revalidate: 1800 } });
  if (!res.ok) {
    // Adzuna returns 429 when quota exceeded - degrade gracefully
    console.warn("Adzuna fetch failed", res.status);
    return [];
  }
  const json = await res.json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (json.results || []).map((j: any) => ({
    id: `adzuna-${j.id}`,
    title: j.title,
    company: j.company?.display_name || "Unknown",
    location: j.location?.display_name || location || "Unknown",
    description: stripHtml(j.description),
    apply_url: j.redirect_url,
    source: "Adzuna",
    posted_at: toIso(j.created),
    salary: j.salary_min && j.salary_max ? `${j.salary_min}-${j.salary_max}` : undefined,
    remote: j.location?.display_name?.toLowerCase().includes("remote") || false,
    type: j.contract_time || j.contract_type,
    tags: j.category ? [j.category.label] : [],
  }));
}

// -- Aggregator --
export async function aggregateJobs(opts: { query?: string; location?: string; remoteOnly?: boolean }) {
  const results = await Promise.allSettled([
    fetchArbeitnow(opts.query),
    fetchRemotive(opts.query),
    fetchAdzuna(opts.query, opts.location),
  ]);

  const allJobs: UnifiedJob[] = [];
  const sourceStatus: Record<string, string> = {};

  const sources = ["Arbeitnow", "Remotive", "Adzuna"];
  results.forEach((r, i) => {
    const source = sources[i];
    if (r.status === "fulfilled") {
      allJobs.push(...r.value);
      sourceStatus[source] = `ok (${r.value.length})`;
    } else {
      sourceStatus[source] = `error: ${r.reason}`;
    }
  });

  // Deduplicate by title+company lowercase
  const seen = new Map<string, UnifiedJob>();
  for (const job of allJobs) {
    const key = `${job.title.toLowerCase()}|${job.company.toLowerCase()}`;
    if (!seen.has(key)) seen.set(key, job);
  }
  let deduped = Array.from(seen.values());

  // Filters
  if (opts.remoteOnly) deduped = deduped.filter((j) => j.remote);
  if (opts.location && !opts.remoteOnly) {
    const loc = opts.location.toLowerCase();
    // soft filter: if location is remote, already handled; otherwise keep jobs that mention location or are remote
    if (loc !== "remote" && loc !== "worldwide") {
      // don't strict filter; let UI handle, but prioritize matches
      deduped.sort((a, b) => {
        const aMatch = a.location.toLowerCase().includes(loc) ? 1 : 0;
        const bMatch = b.location.toLowerCase().includes(loc) ? 1 : 0;
        return bMatch - aMatch;
      });
    }
  }

  // Sort by posted_at desc
  deduped.sort((a, b) => new Date(b.posted_at).getTime() - new Date(a.posted_at).getTime());

  return { jobs: deduped, sourceStatus };
}
