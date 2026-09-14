import { NextRequest, NextResponse } from "next/server";
import { parseResumeToStructured, mockParseResume, sanitizeResumeData } from "@/lib/gemini";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { resumeText } = body as { resumeText?: string };
    if (!resumeText || resumeText.trim().length < 50) {
      return NextResponse.json({ error: "resumeText too short — upload resume first" }, { status: 400 });
    }
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ resume: mockParseResume(resumeText), mocked: true });
    }
    const resume = await parseResumeToStructured(resumeText);
    return NextResponse.json({ resume: sanitizeResumeData(resume), mocked: false });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("resume/parse error", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
