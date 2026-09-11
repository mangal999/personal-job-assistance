// Server-side fetcher for user-defined custom job sources (RSS / Greenhouse / Lever).
// Imported by app/api/jobs/route.ts only — never from client components
// (import the type via lib/custom-source-types instead).

import { XMLParser } from "fast-xml-parser";
import { UnifiedJob } from "./types";
import { matchesQuery } from "./job-providers";
import {
  CustomSource,
  buildPresetUrl,
  prettifyToken,
  validateCustomUrl,
} from "./custom-source-types";

const UA = "PersonalJobAssistance/1.0 (custom job source)";
const TIMEOUT_MS = 12000;
const MAX_BYTES = 8_000_000; // 8MB cap per custom source (large Greenhouse boards with ?content=true reach several MB)
const MAX_JOBS_PER_SOURCE = 40;

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function toIso(dateStr?: string): string {
  if (!dateStr) return new Date().toISOString();
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

/** Short stable hash so job ids survive refetches (stable React keys). */
function hashStr(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

function safeId(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "src";
}

function isRemoteText(t: string): boolean {
  return /remote|worldwide|anywhere|work from home|wfh/i.test(t);
}

async function fetchText(url: string): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { "User-Agent": UA, Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, application/json, */*" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    if (text.length > MAX_BYTES) throw new Error("Response too large (>3MB).");
    return text;
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") throw new Error("Timed out after 12s.");
    throw e;
  } finally {
    clearTimeout(t);
  }
}

// -- RSS / Atom --
const rssParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  trimValues: true,
  parseTagValue: false,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function nodeText(v: any): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) return v.map(nodeText).join(" ").trim();
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    for (const k of ["#text", "__cdata"]) {
      if (typeof o[k] === "string" && (o[k] as string).trim()) return (o[k] as string).trim();
    }
    if (typeof o["@_href"] === "string") return o["@_href"] as string;
    return "";
  }
  return "";
}

/** Extract link string from RSS <link> which may be text, {href}, or array. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function linkText(v: any, fallback: any): string {
  const direct = nodeText(v);
  if (direct && /^https?:\/\//i.test(direct)) return direct;
  if (Array.isArray(v)) {
    for (const item of v) {
      const t = nodeText(item);
      if (t && /^https?:\/\//i.test(t)) return t;
    }
  }
  if (v && typeof v === "object" && !Array.isArray(v)) {
    const o = v as Record<string, unknown>;
    if (typeof o["@_href"] === "string") return o["@_href"];
  }
  const fb = nodeText(fallback);
  return /^https?:\/\//i.test(fb) ? fb : "";
}

async function fetchRss(src: CustomSource): Promise<UnifiedJob[]> {
  const text = await fetchText(src.url);
  let doc: unknown;
  try {
    doc = rssParser.parse(text);
  } catch {
    throw new Error("Could not parse as RSS/Atom XML.");
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = doc as any;
  const channel = d?.rss?.channel ?? d?.feed ?? d?.channel ?? {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawItems: any[] = (() => {
    const items = channel?.item ?? d?.feed?.entry ?? channel?.entry ?? [];
    return (Array.isArray(items) ? items : [items]).filter(Boolean);
  })();
  if (rawItems.length === 0) throw new Error("Feed parsed but contains no items.");

  const feedCompany = nodeText(channel?.title) || src.name;
  const sid = safeId(src.id || src.name);

  return rawItems.slice(0, 60).map((it) => {
    const title = nodeText(it?.title) || "Untitled posting";
    const link = linkText(it?.link, it?.guid) || src.url;
    const descRaw =
      nodeText(it?.["content:encoded"]) ||
      nodeText(it?.content) ||
      nodeText(it?.description) ||
      nodeText(it?.summary) ||
      "";
    const description = stripHtml(descRaw).slice(0, 4000) || title;
    const company = nodeText(it?.author) || nodeText(it?.["dc:creator"]) || nodeText(it?.creator) || feedCompany;
    const posted = nodeText(it?.pubDate) || nodeText(it?.published) || nodeText(it?.updated) || nodeText(it?.["dc:date"]);
    return {
      id: `custom-${sid}-${hashStr(link + title)}`,
      title: title.slice(0, 200),
      company: company.slice(0, 120) || src.name,
      location: "See posting",
      description,
      apply_url: link,
      source: src.name,
      posted_at: toIso(posted || undefined),
      remote: isRemoteText(`${title} ${description}`),
      type: "See posting",
      tags: nodeText(it?.category).split(/\s*,\s*/).filter(Boolean).slice(0, 5),
    } satisfies UnifiedJob;
  });
}

// -- Greenhouse board API --
async function fetchGreenhouse(src: CustomSource): Promise<UnifiedJob[]> {
  const url = /^https?:\/\//i.test(src.url) ? src.url : buildPresetUrl("greenhouse", src.url);
  const text = await fetchText(url);
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error("Greenhouse did not return JSON — check the board token.");
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items: any[] = (json as any)?.jobs ?? [];
  if (!Array.isArray(items) || items.length === 0)
    throw new Error("No jobs — wrong board token or empty board?");
  const token = (() => {
    const m = url.match(/\/boards\/([^/?#]+)/);
    return m ? m[1] : src.name;
  })();
  const company = prettifyToken(decodeURIComponent(token));
  const sid = safeId(src.id || src.name);
  return items.slice(0, 60).map((j) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const job = j as any;
    const title = String(job?.title ?? "Untitled posting");
    const loc = String(job?.location?.name ?? "See posting");
    const desc = stripHtml(String(job?.content ?? "")).slice(0, 4000) || `${title} — ${loc}`;
    const depts = Array.isArray(job?.departments) ? job.departments.map((x: unknown) => String((x as { name?: string })?.name ?? "")).filter(Boolean) : [];
    return {
      id: `custom-${sid}-gh-${String(job?.id ?? hashStr(title + loc))}`,
      title: title.slice(0, 200),
      company,
      location: loc,
      description: desc,
      apply_url: String(job?.absolute_url ?? url),
      source: src.name,
      posted_at: toIso(typeof job?.updated_at === "string" ? job.updated_at : undefined),
      remote: isRemoteText(`${title} ${loc}`),
      type: "Full-time",
      tags: depts.slice(0, 5),
    } satisfies UnifiedJob;
  });
}

// -- Lever postings API --
async function fetchLever(src: CustomSource): Promise<UnifiedJob[]> {
  const url = /^https?:\/\//i.test(src.url) ? src.url : buildPresetUrl("lever", src.url);
  const text = await fetchText(url);
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error("Lever did not return JSON — check the company slug.");
  }
  const items = Array.isArray(json) ? json : [];
  if (items.length === 0) throw new Error("No jobs — wrong company slug or empty board?");
  const token = (() => {
    const m = url.match(/\/postings\/([^/?#]+)/);
    return m ? m[1] : src.name;
  })();
  const company = prettifyToken(decodeURIComponent(token));
  const sid = safeId(src.id || src.name);
  return items.slice(0, 60).map((j) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const job = j as any;
    const title = String(job?.text ?? "Untitled posting");
    const loc = String(job?.categories?.location ?? "See posting");
    const team = String(job?.categories?.team ?? "");
    const commitment = String(job?.categories?.commitment ?? "");
    const desc = stripHtml(String(job?.description ?? "")).slice(0, 4000) || `${title} — ${loc}`;
    const created = typeof job?.createdAt === "number" ? new Date(job.createdAt).toISOString() : undefined;
    return {
      id: `custom-${sid}-lv-${String(job?.id ?? hashStr(title + loc))}`,
      title: title.slice(0, 200),
      company,
      location: loc,
      description: desc,
      apply_url: String(job?.hostedUrl ?? job?.applyUrl ?? url),
      source: src.name,
      posted_at: toIso(created),
      remote: isRemoteText(`${title} ${loc}`),
      type: commitment || "See posting",
      tags: [team].filter(Boolean).slice(0, 5),
    } satisfies UnifiedJob;
  });
}

export async function fetchCustomSource(src: CustomSource, query?: string): Promise<UnifiedJob[]> {
  if (!validateCustomUrl(src.url).ok) throw new Error("Blocked URL (https + public hosts only).");
  let jobs: UnifiedJob[];
  if (src.type === "greenhouse") jobs = await fetchGreenhouse(src);
  else if (src.type === "lever") jobs = await fetchLever(src);
  else jobs = await fetchRss(src);
  if (query) jobs = jobs.filter((j) => matchesQuery(j, query));
  return jobs.slice(0, MAX_JOBS_PER_SOURCE);
}

export async function fetchCustomSources(
  sources: CustomSource[],
  query?: string
): Promise<{ jobs: UnifiedJob[]; status: Record<string, string> }> {
  const enabled = sources.filter((s) => s.enabled !== false).slice(0, 10); // cap 10/sources per request
  const results = await Promise.allSettled(enabled.map((s) => fetchCustomSource(s, query)));
  const jobs: UnifiedJob[] = [];
  const status: Record<string, string> = {};
  results.forEach((r, i) => {
    const name = enabled[i].name;
    if (r.status === "fulfilled") {
      jobs.push(...r.value);
      status[name] = `ok (${r.value.length})`;
    } else {
      status[name] = `error: ${r.reason instanceof Error ? r.reason.message : String(r.reason)}`.slice(0, 120);
    }
  });
  return { jobs, status };
}
