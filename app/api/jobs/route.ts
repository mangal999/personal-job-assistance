import { NextRequest, NextResponse } from "next/server";
import { aggregateJobs } from "@/lib/job-providers";

export const dynamic = "force-dynamic";

// Simple in-memory cache (per instance, 10 min). For Vercel edge, also uses fetch revalidate.
const cache = new Map<string, { ts: number; data: unknown }>();
const TTL_MS = 1000 * 60 * 10; // 10 min

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") || undefined;
  const location = searchParams.get("location") || undefined;
  const remoteOnly = searchParams.get("remote") === "true";
  const cacheKey = JSON.stringify({ q, location, remoteOnly });

  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < TTL_MS) {
    return NextResponse.json({ ...(cached.data as object), cached: true });
  }

  try {
    const { jobs, sourceStatus } = await aggregateJobs({ query: q, location, remoteOnly });

    const payload = {
      jobs,
      total: jobs.length,
      sources: sourceStatus,
      cached: false,
      query: { q, location, remoteOnly },
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
