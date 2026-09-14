import { NextRequest, NextResponse } from "next/server";
import { tailorResumeForJob, mockTailorResume, sanitizeResumeData } from "@/lib/gemini";
import type { ResumeData } from "@/lib/resume-types";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { resume, jobTitle, jobDescription, missingKeywords } = body as {
      resume?: ResumeData;
      jobTitle?: string;
      jobDescription?: string;
      missingKeywords?: string[];
    };
    if (!resume) return NextResponse.json({ error: "resume required" }, { status: 400 });
    if (!jobTitle || !jobDescription) {
      return NextResponse.json({ error: "jobTitle and jobDescription required" }, { status: 400 });
    }
    const safe = sanitizeResumeData(resume);
    const missing = Array.isArray(missingKeywords)
      ? missingKeywords.filter((x) => typeof x === "string").slice(0, 15)
      : [];
    if (!process.env.GEMINI_API_KEY) {
      const mock = mockTailorResume(safe, jobDescription, missing);
      return NextResponse.json({ ...mock, mocked: true });
    }
    const result = await tailorResumeForJob({
      resume: safe,
      jobTitle,
      jobDescription,
      missingKeywords: missing,
    });
    return NextResponse.json({ ...result, mocked: false });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("resume/tailor error", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
