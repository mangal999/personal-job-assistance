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

// -- Shared query matching --
// Token-based AND matching: every word in the query must appear somewhere
// in title/description/company/tags. This makes search actually filter
// ("product manager" matches only jobs containing BOTH words), instead of
// returning unfiltered provider results that look like "always developer".
export function matchesQuery(
  job: Pick<UnifiedJob, "title" | "description" | "company" | "tags">,
  query?: string
): boolean {
  if (!query) return true;
  const tokens = query
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1);
  if (tokens.length === 0) return true;
  const haystack =
    `${job.title} ${job.description} ${job.company} ${job.tags?.join(" ") ?? ""}`.toLowerCase();
  return tokens.every((t) => haystack.includes(t));
}

export const AVAILABLE_SOURCES = ["Arbeitnow", "Remotive", "Adzuna", "RemoteOK", "JSearch"] as const;
export type SourceName = (typeof AVAILABLE_SOURCES)[number];

// Indian cities + markers used to detect / prioritize India jobs.
// Arbeitnow/Remotive are EU/US-centric; Adzuna (country=in), RemoteOK
// (worldwide remote) and JSearch (country=in) are the India-capable ones.
const INDIA_MARKERS = [
  "india",
  "bengaluru",
  "bangalore",
  "mumbai",
  "delhi",
  "new delhi",
  "hyderabad",
  "chennai",
  "pune",
  "kolkata",
  "ahmedabad",
  "jaipur",
  "noida",
  "gurgaon",
  "gurugram",
  "kochi",
  "cochin",
  "thiruvananthapuram",
  "coimbatore",
  "indore",
  "bhopal",
  "lucknow",
  "kanpur",
  "nagpur",
  "surat",
  "chandigarh",
  "mysore",
  "mysuru",
  "vizag",
  "visakhapatnam",
  "bhubaneswar",
];

export function isIndiaLocation(loc: string): boolean {
  const l = loc.toLowerCase();
  return INDIA_MARKERS.some((m) => l.includes(m));
}

function isRemoteOpenLocation(loc: string): boolean {
  const l = loc.toLowerCase();
  return (
    l.includes("remote") ||
    l.includes("worldwide") ||
    l.includes("anywhere") ||
    l.includes("global") ||
    l.trim() === ""
  );
}

// -- Arbeitnow (https://www.arbeitnow.com/api/job-board-api) --
// NOTE: mostly EU/US listings, kept as a "Global" source. No location
// filtering server-side (API has none); India prioritization happens in aggregateJobs.
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
    next: { revalidate: 300 },
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
    jobs = jobs.filter((j) => matchesQuery(j, query));
  }
  return jobs;
}

// -- Remotive (https://remotive.com/api/remote-jobs) --
// NOTE: Remotive's `?search=` param is currently ignored server-side (API
// returns the same ~18 jobs for any query — verified Sep 2026). So we fetch
// the list and ALWAYS filter client-side with matchesQuery, otherwise every
// search looks like "always developer / always cached".
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
  const res = await fetch(url.toString(), { next: { revalidate: 300 } });
  if (!res.ok) throw new Error(`Remotive ${res.status}`);
  const json: RemotiveResponse = await res.json();
  let jobs: UnifiedJob[] = json.jobs.slice(0, 100).map((j) => ({
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
  // Client-side filter is REQUIRED (server ignores ?search=).
  if (query) jobs = jobs.filter((j) => matchesQuery(j, query));
  return jobs.slice(0, 50);
}

// -- Adzuna (optional, requires keys) --
// Supports India via country code "in". Set ADZUNA_COUNTRY=in in env
// (free tier: 500 calls/mo). This is the primary India-jobs source.
export async function fetchAdzuna(query?: string, location?: string): Promise<UnifiedJob[]> {
  const appId = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;
  if (!appId || !appKey) return [];

  const country = process.env.ADZUNA_COUNTRY || "in";
  const url = new URL(`https://api.adzuna.com/v1/api/jobs/${country}/search/1`);
  url.searchParams.set("app_id", appId);
  url.searchParams.set("app_key", appKey);
  url.searchParams.set("results_per_page", "20");
  url.searchParams.set("content-type", "application/json");
  if (query) url.searchParams.set("what", query);
  if (location) url.searchParams.set("where", location);

  const res = await fetch(url.toString(), { next: { revalidate: 300 } });
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

// -- RemoteOK (https://remoteok.com/api) --
// Free, no key. Mostly worldwide-remote listings which are open to
// applicants in India, plus some explicit India locations.
export async function fetchRemoteOK(query?: string): Promise<UnifiedJob[]> {
  try {
    const res = await fetch("https://remoteok.com/api", {
      next: { revalidate: 300 },
      headers: {
        // RemoteOK rejects requests without a UA
        "User-Agent": "PersonalJobAssistance/1.0 (job aggregator)",
      },
    });
    if (!res.ok) throw new Error(`RemoteOK ${res.status}`);
    const json: unknown = await res.json();
    if (!Array.isArray(json)) return [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items = (json as any[]).filter((j) => j && j.id && j.position);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let jobs: UnifiedJob[] = items.map((j: any) => {
      const loc: string = j.location || (j.candidate_required_location as string) || "Remote";
      return {
        id: `remoteok-${String(j.id)}`,
        title: String(j.position ?? "Unknown"),
        company: String(j.company ?? "Unknown"),
        location: loc,
        description: stripHtml(String(j.description ?? "")),
        apply_url: String(j.url ?? j.apply_url ?? "https://remoteok.com"),
        source: "RemoteOK",
        posted_at: toIso(j.date as string | undefined),
        salary: j.salary_min && j.salary_max ? `${j.salary_min}-${j.salary_max}` : (j.salary as string | undefined),
        remote: true,
        type: (j.job_type as string | undefined) ?? "Full-time",
        tags: Array.isArray(j.tags) ? (j.tags as string[]).slice(0, 8) : [],
      };
    });

    if (query) {
      jobs = jobs.filter((j) => matchesQuery(j, query));
    }
    return jobs.slice(0, 50);
  } catch (e) {
    console.warn("RemoteOK fetch failed", e);
    return [];
  }
}

// -- JSearch via RapidAPI (optional, requires RAPIDAPI_KEY) --
// Supports country=in for India listings (LinkedIn/Indeed/Glassdoor aggregate).
// NOTE: no "developer" fallback — an empty query returns [] instead of
// biasing every empty search toward developer jobs.
export async function fetchJSearch(query?: string, location?: string): Promise<UnifiedJob[]> {
  const key = process.env.RAPIDAPI_KEY;
  if (!key) return [];
  const what = [query?.trim(), location?.trim()].filter(Boolean).join(" in ");
  if (!what) return [];
  try {
    const url = new URL("https://jsearch.p.rapidapi.com/search");
    url.searchParams.set("query", what);
    url.searchParams.set("page", "1");
    url.searchParams.set("num_pages", "1");
    url.searchParams.set("country", "in");
    url.searchParams.set("date_posted", "all");

    const res = await fetch(url.toString(), {
      next: { revalidate: 300 },
      headers: {
        "X-RapidAPI-Key": key,
        "X-RapidAPI-Host": "jsearch.p.rapidapi.com",
      },
    });
    if (!res.ok) {
      console.warn("JSearch fetch failed", res.status);
      return [];
    }
    const json = await res.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items: any[] = json.data || [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return items.slice(0, 20).map((j: any) => {
      const city = j.job_city || "";
      const countryName = j.job_country || "India";
      const loc = [city, countryName].filter(Boolean).join(", ") || "India";
      return {
        id: `jsearch-${String(j.job_id ?? `${j.employer_name}-${j.job_title}`.toLowerCase().replace(/[^a-z0-9]+/g, "-"))}`,
        title: String(j.job_title ?? "Unknown"),
        company: String(j.employer_name ?? "Unknown"),
        location: loc,
        description: stripHtml(String(j.job_description ?? "")),
        apply_url: String(j.job_apply_link ?? j.job_google_link ?? "https://in.indeed.com"),
        source: "JSearch",
        posted_at: toIso(j.job_posted_at_datetime_utc as string | undefined),
        remote: Boolean(j.job_is_remote),
        type: (j.job_employment_type as string | undefined) ?? "Full-time",
        tags: Array.isArray(j.job_required_skills) ? (j.job_required_skills as string[]).slice(0, 8) : [],
      };
    });
  } catch (e) {
    console.warn("JSearch fetch failed", e);
    return [];
  }
}

// -- Aggregator --
export async function aggregateJobs(opts: {
  query?: string;
  location?: string;
  remoteOnly?: boolean;
  sources?: string[];
}) {
  const fetchers: Record<string, () => Promise<UnifiedJob[]>> = {
    Arbeitnow: () => fetchArbeitnow(opts.query),
    Remotive: () => fetchRemotive(opts.query),
    Adzuna: () => fetchAdzuna(opts.query, opts.location),
    RemoteOK: () => fetchRemoteOK(opts.query),
    JSearch: () => fetchJSearch(opts.query, opts.location),
  };

  // Normalize requested source names (case-insensitive) so
  // ?sources=adzuna,remoteok also works.
  let selected = Object.keys(fetchers);
  if (opts.sources !== undefined) {
    const wanted = new Set(opts.sources.map((s) => s.trim().toLowerCase()).filter(Boolean));
    selected = selected.filter((s) => wanted.has(s.toLowerCase()));
    // Unknown source names -> return empty rather than everything.
    if (selected.length === 0) return { jobs: [], sourceStatus: {} };
  }

  const results = await Promise.allSettled(selected.map((s) => fetchers[s]()));

  const allJobs: UnifiedJob[] = [];
  const sourceStatus: Record<string, string> = {};

  results.forEach((r, i) => {
    const source = selected[i];
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
  // Location handling: prioritize (don't hard-exclude) matches so that a
  // search for "India" surfaces India jobs first while still showing
  // worldwide-remote jobs that are open to India applicants.
  const loc = opts.location?.toLowerCase().trim();
  const wantsIndia = loc ? INDIA_MARKERS.some((m) => loc.includes(m)) : false;

  function locationRank(j: UnifiedJob): number {
    if (!loc || loc === "remote" || loc === "worldwide") return 0;
    const jl = j.location.toLowerCase();
    if (jl.includes(loc)) return 2;
    if (wantsIndia && (isIndiaLocation(j.location) || isRemoteOpenLocation(j.location))) return 1;
    return 0;
  }

  deduped.sort((a, b) => {
    const rank = locationRank(b) - locationRank(a);
    if (rank !== 0) return rank;
    return new Date(b.posted_at).getTime() - new Date(a.posted_at).getTime();
  });

  return { jobs: deduped, sourceStatus };
}
