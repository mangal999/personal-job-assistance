import { NextRequest, NextResponse } from "next/server";
import { aggregateJobs, AVAILABLE_SOURCES } from "@/lib/job-providers";

export const dynamic = "force-dynamic";

// Simple in-memory cache (per instance, 10 min). For Vercel edge, also uses fetch revalidate.
const cache = new Map<string, { ts: number; data: unknown }>();
const TTL_MS = 1000 * 60 * 10; // 10 min

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") || undefined;
  const location = searchParams.get("location") || undefined;
  const remoteOnly = searchParams.get("remote") === "true";
  // ?sources=Adzuna,RemoteOK or ?sources=Adzuna&sources=RemoteOK
  const rawSources = [
    ...searchParams.getAll("sources"),
    ...(searchParams.get("source") ? [searchParams.get("source")!] : []),
  ]
    .flatMap((s) => s.split(","))
    .map((s) => s.trim())
    .filter(Boolean);
  const canonical = [...AVAILABLE_SOURCES];
  // Pass through even when nothing matched: aggregateJobs then returns []
  // instead of silently falling back to all sources.
  const sources =
    rawSources.length > 0
      ? canonical.filter((c) => rawSources.some((s) => s.toLowerCase() === c.toLowerCase()))
      : undefined;
  const cacheKey = JSON.stringify({ q, location, remoteOnly, sources });

  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < TTL_MS) {
    return NextResponse.json({ ...(cached.data as object), cached: true });
  }

  try {
    const { jobs, sourceStatus } = await aggregateJobs({ query: q, location, remoteOnly, sources });

    const payload = {
      jobs,
      total: jobs.length,
      sources: sourceStatus,
      availableSources: [...AVAILABLE_SOURCES],
      cached: false,
      query: { q, location, remoteOnly, sources },
    };

    cache.set(cacheKey, { ts: Date.now(), data: payload });

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "public, s-maxage=600, stale-while-revalidate=60",
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ jobs: [], total: 0, error: msg }, { status: 500 });
  }
}
