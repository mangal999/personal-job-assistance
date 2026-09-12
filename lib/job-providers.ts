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

export const AVAILABLE_SOURCES = ["LinkedIn India", "Arbeitnow", "Remotive", "RemoteOK", "JSearch", "Active Jobs"] as const;
export type SourceName = (typeof AVAILABLE_SOURCES)[number];

// Indian cities + markers used to detect / prioritize India jobs.
// LinkedIn India (location=India) and JSearch (country=in) are the
// India-capable ones; Arbeitnow/Remotive are EU/US-centric and RemoteOK
// is worldwide-remote (open to India applicants).
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

// -- LinkedIn India via public guest API (free, no key) --
// Uses LinkedIn's logged-out guest endpoints:
//   search: /jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=&location=India
//   detail: /jobs-guest/jobs/api/jobPosting/{id} (for full description)
// location defaults to India so empty searches still return India jobs.
const LI_UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

function liDecode(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

interface LiCard {
  id: string;
  title: string;
  company: string;
  location: string;
  applyUrl: string;
  postedAt?: string;
}

function parseLiCards(html: string): LiCard[] {
  const cards: LiCard[] = [];
  // Each card is an <li> containing data-entity-urn="urn:li:jobPosting:ID"
  const liBlocks = html.split(/<li[^>]*>/i);
  for (const block of liBlocks) {
    const idMatch = block.match(/urn:li:jobPosting:(\d+)/);
    if (!idMatch) continue;
    const id = idMatch[1];
    const titleMatch =
      block.match(/base-search-card__title[^>]*>([\s\S]*?)<\/h3>/i) ||
      block.match(/job-title[^>]*>([\s\S]*?)</i);
    const companyMatch = block.match(/base-search-card__subtitle[^>]*>([\s\S]*?)<\/h4>/i);
    const locationMatch = block.match(/job-search-card__location[^>]*>([\s\S]*?)<\/span>/i);
    const linkMatch = block.match(/base-card__full-link[^>]*href="([^"]+)/i);
    const timeMatch = block.match(/<time[^>]*datetime="([^"]+)"/i);
    const title = titleMatch ? liDecode(stripHtml(titleMatch[1])) : "";
    if (!title) continue;
    const company = companyMatch ? liDecode(stripHtml(companyMatch[1])) : "Unknown";
    const location = locationMatch ? liDecode(stripHtml(locationMatch[1])) : "India";
    const applyUrl =
      (linkMatch ? linkMatch[1].split("?")[0] : `https://www.linkedin.com/jobs/view/${id}/`) ||
      `https://www.linkedin.com/jobs/view/${id}/`;
    cards.push({
      id,
      title: title.slice(0, 200),
      company: company.slice(0, 120),
      location,
      applyUrl,
      postedAt: timeMatch ? timeMatch[1] : undefined,
    });
  }
  // Dedupe by id (search pages can overlap)
  const seen = new Set<string>();
  return cards.filter((c) => (seen.has(c.id) ? false : (seen.add(c.id), true)));
}

function parseLiDescription(html: string): string {
  const m = html.match(
    /show-more-less-html__markup[^>]*>([\s\S]*?)<\/div>/i
  );
  if (!m) return "";
  return stripHtml(liDecode(m[1])).slice(0, 4000);
}

async function fetchWithTimeout(url: string, ms = 10000): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        "User-Agent": LI_UA,
        Accept: "text/html,*/*",
      },
      next: { revalidate: 300 },
    });
    if (!res.ok) throw new Error(`LinkedIn ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

export async function fetchLinkedInIndia(query?: string, location?: string): Promise<UnifiedJob[]> {
  try {
    const loc = location?.trim() || "India";
    const keywords = query?.trim() || "";
    const jobs: UnifiedJob[] = [];
    // 2 pages x ~10-12 cards = ~20-25 jobs (guest API paginates by 10-25)
    for (const start of [0, 25]) {
      const url = new URL("https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search");
      if (keywords) url.searchParams.set("keywords", keywords);
      url.searchParams.set("location", loc);
      url.searchParams.set("start", String(start));
      let html: string;
      try {
        html = await fetchWithTimeout(url.toString());
      } catch (e) {
        console.warn("LinkedIn India page failed", start, e);
        break;
      }
      const cards = parseLiCards(html);
      if (cards.length === 0) break;
      // Fetch full descriptions in parallel (cap to keep latency sane)
      const details = await Promise.allSettled(
        cards.slice(0, 20).map(async (c) => {
          try {
            const dHtml = await fetchWithTimeout(
              `https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/${c.id}`
            );
            return parseLiDescription(dHtml);
          } catch {
            return "";
          }
        })
      );
      cards.slice(0, 20).forEach((c, i) => {
        const desc =
          (details[i].status === "fulfilled" ? (details[i].value as string) : "") ||
          `${c.title} at ${c.company} — ${c.location}. Full description on LinkedIn.`;
        jobs.push({
          id: `linkedin-${c.id}`,
          title: c.title,
          company: c.company,
          location: c.location,
          description: desc,
          apply_url: c.applyUrl,
          source: "LinkedIn India",
          posted_at: toIso(c.postedAt),
          remote: /remote|work from home|wfh/i.test(`${c.title} ${c.location} ${desc.slice(0, 500)}`),
          type: "See posting",
          tags: [],
        });
      });
      if (cards.length < 10) break;
      if (jobs.length >= 30) break;
    }
    // Provider ignores nothing — but apply client filter so "nurse" never
    // returns react jobs from a loose page.
    const filtered = query ? jobs.filter((j) => matchesQuery(j, query)) : jobs;
    return filtered.slice(0, 30);
  } catch (e) {
    console.warn("LinkedIn India fetch failed", e);
    return [];
  }
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
// Uses GET /search-v2 (verified Sep 2026 — v1 /search 404s on current plans).
// Response shape: { status, data: { jobs: [...], cursor } }.
// Supports country=in for India listings (LinkedIn/Indeed/Glassdoor aggregate).
// NOTE: no "developer" fallback — an empty query returns [] instead of
// biasing every empty search toward developer jobs.
export async function fetchJSearch(query?: string, location?: string): Promise<UnifiedJob[]> {
  const key = process.env.RAPIDAPI_KEY;
  // Throw (not silent []) so aggregateJobs records the reason in sourceStatus,
  // which the UI's Env Setup panel displays — otherwise this shows "ok (0)".
  if (!key) throw new Error("missing RAPIDAPI_KEY");
  const what = [query?.trim(), location?.trim()].filter(Boolean).join(" in ");
  if (!what) return [];
  try {
    const url = new URL("https://jsearch.p.rapidapi.com/search-v2");
    url.searchParams.set("query", what);
    url.searchParams.set("num_pages", "1");
    url.searchParams.set("country", "in");
    url.searchParams.set("date_posted", "all");

    const res = await fetch(url.toString(), {
      next: { revalidate: 300 },
      // /search-v2 is slow (~9s observed) — allow headroom without
      // holding /api/jobs forever.
      signal: AbortSignal.timeout(25000),
      headers: {
        "X-RapidAPI-Key": key,
        "X-RapidAPI-Host": "jsearch.p.rapidapi.com",
      },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`JSearch HTTP ${res.status}: ${body.slice(0, 120) || res.statusText}`);
    }
    const json = await res.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = json.data;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items: any[] = Array.isArray(data) ? data : (data?.jobs || []);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return items.slice(0, 20).map((j: any) => {
      const city = j.job_city || "";
      const countryName = j.job_country || "India";
      const loc = [city, countryName].filter(Boolean).join(", ") || "India";
      const salary =
        j.job_salary_string ||
        (j.job_min_salary && j.job_max_salary
          ? `${j.job_min_salary}-${j.job_max_salary}`
          : undefined);
      return {
        id: `jsearch-${String(j.job_id ?? `${j.employer_name}-${j.job_title}`.toLowerCase().replace(/[^a-z0-9]+/g, "-"))}`,
        title: String(j.job_title ?? "Unknown"),
        company: String(j.employer_name ?? "Unknown"),
        location: loc,
        description: stripHtml(String(j.job_description ?? "")),
        apply_url: String(j.job_apply_link ?? j.job_google_link ?? "https://in.indeed.com"),
        source: "JSearch",
        posted_at: toIso(j.job_posted_at_datetime_utc as string | undefined),
        salary,
        remote: Boolean(j.job_is_remote),
        type: (j.job_employment_type as string | undefined) ?? "Full-time",
        tags: [],
      };
    });
  } catch (e) {
    // Re-throw so the failure reason lands in sourceStatus (shown in UI).
    // aggregateJobs isolates per-source failures via Promise.allSettled.
    throw e instanceof Error ? e : new Error(`JSearch failed: ${String(e)}`);
  }
}

// -- Active Jobs DB via RapidAPI (optional, shares RAPIDAPI_KEY) --
// Large live database (verified Sep 2026: GET /active-ats returns 200).
// location defaults to India so empty searches return India jobs.
export async function fetchActiveJobs(query?: string, location?: string): Promise<UnifiedJob[]> {
  const key = process.env.RAPIDAPI_KEY;
  if (!key) throw new Error("missing RAPIDAPI_KEY");
  const loc = location?.trim() || "India";
  try {
    const url = new URL("https://active-jobs-db.p.rapidapi.com/active-ats");
    if (query?.trim()) url.searchParams.set("title", query.trim());
    url.searchParams.set("location", loc);
    url.searchParams.set("time_frame", "7d");
    url.searchParams.set("limit", "20");
    url.searchParams.set("offset", "0");
    url.searchParams.set("description_format", "text");

    const res = await fetch(url.toString(), {
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(15000),
      headers: {
        "Content-Type": "application/json",
        "X-RapidAPI-Key": key,
        "X-RapidAPI-Host": "active-jobs-db.p.rapidapi.com",
      },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Active Jobs HTTP ${res.status}: ${body.slice(0, 120) || res.statusText}`);
    }
    const json: unknown = await res.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d: any = json;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items: any[] = Array.isArray(d) ? d : (d?.jobs || d?.data || []);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const jobs: UnifiedJob[] = items.slice(0, 20).map((j: any) => {
      const derived: string[] = Array.isArray(j.locations_derived) ? j.locations_derived : [];
      const countries: string[] = Array.isArray(j.countries_derived) ? j.countries_derived : [];
      const place = derived[0] || countries[0] || loc;
      const salary =
        j.ai_salary_min_value && j.ai_salary_max_value
          ? `${j.ai_salary_min_value}-${j.ai_salary_max_value}${j.ai_salary_currency ? ` ${j.ai_salary_currency}` : ""}${j.ai_salary_unit_text ? ` ${j.ai_salary_unit_text}` : ""}`
          : (typeof j.salary === "string" && j.salary) || undefined;
      const arrangement: string = String(j.ai_work_arrangement ?? "");
      const desc = String(j.description_text ?? "");
      return {
        id: `activejobs-${String(j.id ?? `${j.organization}-${j.title}`.toLowerCase().replace(/[^a-z0-9]+/g, "-"))}`,
        title: String(j.title ?? "Unknown").slice(0, 200),
        company: String(j.organization ?? "Unknown").slice(0, 120),
        location: String(place),
        description: stripHtml(desc).slice(0, 4000) || String(j.title ?? "Unknown"),
        apply_url: String(j.url ?? "https://active-jobs-db.p.rapidapi.com"),
        source: "Active Jobs",
        posted_at: toIso(j.date_posted as string | undefined),
        salary,
        remote:
          /remote/i.test(arrangement) ||
          /remote|work from home|wfh/i.test(`${j.title ?? ""} ${place} ${desc.slice(0, 500)}`),
        type: (Array.isArray(j.employment_type) ? j.employment_type[0] : j.employment_type) || "See posting",
        tags: (Array.isArray(j.ai_key_skills) ? (j.ai_key_skills as string[]) : []).slice(0, 8),
      };
    });
    return query ? jobs.filter((j) => matchesQuery(j, query)) : jobs;
  } catch (e) {
    throw e instanceof Error ? e : new Error(`Active Jobs failed: ${String(e)}`);
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
    "LinkedIn India": () => fetchLinkedInIndia(opts.query, opts.location),
    Arbeitnow: () => fetchArbeitnow(opts.query),
    Remotive: () => fetchRemotive(opts.query),
    RemoteOK: () => fetchRemoteOK(opts.query),
    JSearch: () => fetchJSearch(opts.query, opts.location),
    "Active Jobs": () => fetchActiveJobs(opts.query, opts.location),
  };

  // Normalize requested source names (case-insensitive) so
  // ?sources=linkedin india,remoteok also works.
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
      const msg = r.reason instanceof Error ? r.reason.message : String(r.reason);
      sourceStatus[source] = `error: ${msg}`.slice(0, 200);
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
