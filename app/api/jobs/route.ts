import { NextRequest, NextResponse } from "next/server";
import { aggregateJobs, AVAILABLE_SOURCES } from "@/lib/job-providers";
import { fetchCustomSources } from "@/lib/custom-sources";
import {
  CustomSource,
  CustomSourceType,
  validateCustomUrl,
} from "@/lib/custom-source-types";
import { UnifiedJob } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Short in-memory cache (per instance, 3 min). Key ALWAYS includes the
// normalized query + location + filters + custom sources, so "designer" never
// gets "developer" results from cache. This only dedupes rapid repeat searches
// and saves provider quota — every distinct search still hits providers.
const cache = new Map<string, { ts: number; data: unknown }>();
const TTL_MS = 1000 * 60 * 3; // 3 min (was 10 min — felt like "always cached")

function norm(v: string | null): string | undefined {
  const t = (v || "").trim();
  return t ? t : undefined;
}

const CUSTOM_TYPES: CustomSourceType[] = ["rss", "greenhouse", "lever"];

// Client sends enabled custom sources as compact JSON:
//   ?custom=[{"n":"Acme","t":"greenhouse","u":"https://..."}]
// Re-validated server-side (type whitelist + https/public-host SSRF guard;
// fetchCustomSource validates again before fetching).
function parseCustomSources(param: string | null): CustomSource[] {
  if (!param) return [];
  try {
    const raw: unknown = JSON.parse(param);
    if (!Array.isArray(raw)) return [];
    const out: CustomSource[] = [];
    raw.slice(0, 10).forEach((c, i) => {
      if (!c || typeof c !== "object") return;
      const r = c as Record<string, unknown>;
      const type: CustomSourceType = CUSTOM_TYPES.includes(r.t as CustomSourceType)
        ? (r.t as CustomSourceType)
        : CUSTOM_TYPES.includes(r.type as CustomSourceType)
          ? (r.type as CustomSourceType)
          : "rss";
      const name = String(r.n ?? r.name ?? `Custom ${i + 1}`).slice(0, 40);
      const url = String(r.u ?? r.url ?? "");
      if (!name.trim() || !validateCustomUrl(url).ok) return;
      out.push({ id: `c${i}`, name: name.trim(), type, url, enabled: true });
    });
    return out;
  } catch {
    return [];
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = norm(searchParams.get("q"));
  const location = norm(searchParams.get("location"));
  const remoteOnly = searchParams.get("remote") === "true";
  // ?sources=LinkedIn India,RemoteOK or ?sources=JSearch&sources=RemoteOK
  const rawSources = [
    ...searchParams.getAll("sources"),
    ...(searchParams.get("source") ? [searchParams.get("source")!] : []),
  ]
    .flatMap((s) => s.split(","))
    .map((s) => s.trim())
    .filter(Boolean);
  const canonical = [...AVAILABLE_SOURCES];
  const wanted = rawSources.length > 0 ? new Set(rawSources.map((s) => s.toLowerCase())) : null;

  const allCustom = parseCustomSources(searchParams.get("custom"));
  // ?sources= also scopes custom sources by name — clicking a custom chip
  // fetches ONLY that source. Unknown names -> empty (no silent fallback).
  const customs = wanted ? allCustom.filter((c) => wanted.has(c.name.toLowerCase())) : allCustom;
  const builtinSources = wanted
    ? canonical.filter((c) => wanted.has(c.toLowerCase()))
    : undefined;

  if (wanted && builtinSources!.length === 0 && customs.length === 0) {
    return NextResponse.json(
      {
        jobs: [],
        total: 0,
        sources: {},
        availableSources: [...canonical, ...allCustom.map((c) => c.name)],
        cached: false,
        query: { q: q ?? null, location: location ?? null, remoteOnly, sources: rawSources },
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  // Lowercase the key so "Designer" and "designer" share cache.
  const cacheKey = JSON.stringify({
    q: q?.toLowerCase(),
    location: location?.toLowerCase(),
    remoteOnly,
    sources: wanted ? [...wanted].sort() : null,
    customs: customs.map((c) => `${c.type}|${c.name.toLowerCase()}|${c.url}`).sort(),
  });

  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < TTL_MS) {
    return NextResponse.json(
      { ...(cached.data as object), cached: true },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    const [{ jobs: builtinJobs, sourceStatus }, { jobs: customJobs, status: customStatus }] =
      await Promise.all([
        aggregateJobs({ query: q, location, remoteOnly, sources: builtinSources }),
        fetchCustomSources(customs, q),
      ]);

    // Built-ins keep their internal (location-ranked) order; customs
    // (already date-sorted per source) are appended, then de-duplicated.
    const seen = new Map<string, UnifiedJob>();
    for (const job of [...builtinJobs, ...customJobs]) {
      const key = `${job.title.toLowerCase()}|${job.company.toLowerCase()}`;
      if (!seen.has(key)) seen.set(key, job);
    }
    let jobs = Array.from(seen.values());
    if (remoteOnly) jobs = jobs.filter((j) => j.remote);

    const payload = {
      jobs,
      total: jobs.length,
      sources: { ...sourceStatus, ...customStatus },
      availableSources: [...AVAILABLE_SOURCES, ...allCustom.map((c) => c.name)],
      cached: false,
      query: {
        q: q ?? null,
        location: location ?? null,
        remoteOnly,
        sources: wanted ? rawSources : null,
        customs: customs.map((c) => c.name),
      },
    };

    cache.set(cacheKey, { ts: Date.now(), data: payload });
    // Prune stale entries so the Map can't grow unbounded in long-lived instances.
    if (cache.size > 200) {
      const now = Date.now();
      for (const [k, v] of cache) if (now - v.ts > TTL_MS) cache.delete(k);
    }

    return NextResponse.json(payload, {
      headers: {
        // Short edge cache, keyed by full URL (incl. query string) by default.
        "Cache-Control": "public, s-maxage=180, stale-while-revalidate=60",
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ jobs: [], total: 0, error: msg }, { status: 500 });
  }
}
