import { NextRequest, NextResponse } from "next/server";
import { scoreResumeWithGemini, mockATSScore } from "@/lib/gemini";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { resumeText, jobTitle, jobDescription } = body as {
      resumeText?: string;
      jobTitle?: string;
      jobDescription?: string;
    };

    if (!jobDescription || !jobTitle) {
      return NextResponse.json({ error: "jobTitle and jobDescription required" }, { status: 400 });
    }
    if (!resumeText || resumeText.trim().length < 50) {
      return NextResponse.json({ error: "resumeText too short - upload resume first" }, { status: 400 });
    }

    // If no Gemini key, return mock (so app works without setup)
    if (!process.env.GEMINI_API_KEY) {
      const mock = mockATSScore(resumeText, jobTitle, jobDescription);
      return NextResponse.json({ ...mock, mocked: true });
    }

    const score = await scoreResumeWithGemini({
      resumeText,
      jobTitle,
      jobDescription,
    });

    return NextResponse.json({ ...score, mocked: false });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    // If Gemini fails, fallback to mock so UX not blocked
    console.error("ATS error", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
