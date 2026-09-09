import { GoogleGenerativeAI } from "@google/generative-ai";
import { ATSScore } from "./types";

export function getGeminiClient() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  return new GoogleGenerativeAI(key);
}

const ATS_PROMPT = (resume: string, jobTitle: string, jobDesc: string) => `
You are an ATS (Applicant Tracking System) expert similar to Greenhouse/Lever.

Resume Text:
"""${resume.slice(0, 8000)}"""

Job Title: ${jobTitle}
Job Description:
"""${jobDesc.slice(0, 6000)}"""

Task: Score the resume against the job 0-100 and return ONLY valid JSON with no markdown fences:
{
  "overall_score": number (0-100),
  "verdict": "Strong Match" | "Moderate Match" | "Weak Match",
  "breakdown": {
    "skills_match": number,
    "experience_match": number,
    "education_match": number,
    "keyword_match": number
  },
  "matched_keywords": ["keyword1", ...],
  "missing_keywords": ["keyword2", ...],
  "improvement_tips": ["tip1", ...],
  "summary": "1-2 line recruiter perspective"
}
Rules: Be strict. If resume lacks core skill (e.g., job needs React but resume has no React), cap score at 60. Max 10 missing_keywords, 3-5 tips.
`.trim();

function cleanJson(text: string): string {
  return text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
}

export async function scoreResumeWithGemini(params: {
  resumeText: string;
  jobTitle: string;
  jobDescription: string;
}): Promise<ATSScore> {
  const client = getGeminiClient();
  if (!client) throw new Error("GEMINI_API_KEY not configured");

  const model = client.getGenerativeModel({ model: process.env.GEMINI_MODEL || "gemini-2.0-flash" });
  const prompt = ATS_PROMPT(params.resumeText, params.jobTitle, params.jobDescription);

  const result = await model.generateContent(prompt);
  const text = result.response.text();
  const cleaned = cleanJson(text);

  let parsed: ATSScore;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    // try to extract JSON object
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Gemini did not return valid JSON: " + text.slice(0, 500));
    parsed = JSON.parse(match[0]);
  }

  // basic validation / clamp
  parsed.overall_score = Math.max(0, Math.min(100, Math.round(parsed.overall_score)));
  if (!["Strong Match", "Moderate Match", "Weak Match"].includes(parsed.verdict)) {
    parsed.verdict = parsed.overall_score >= 75 ? "Strong Match" : parsed.overall_score >= 50 ? "Moderate Match" : "Weak Match";
  }
  return parsed;
}

// Mock scorer for when no API key (so app works without setup)
export function mockATSScore(resumeText: string, jobTitle: string, jobDesc: string): ATSScore {
  const resumeLower = resumeText.toLowerCase();
  const jobTokens = Array.from(
    new Set(
      jobDesc
        .toLowerCase()
        .replace(/[^a-z0-9 ]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length > 3)
        .slice(0, 30)
    )
  );
  const matched = jobTokens.filter((t) => resumeLower.includes(t)).slice(0, 10);
  const missing = jobTokens.filter((t) => !resumeLower.includes(t)).slice(0, 8);
  const score = Math.round((matched.length / Math.max(jobTokens.length, 1)) * 100 * 0.7 + 30) % 100;
  const clamped = Math.max(35, Math.min(92, score));
  return {
    overall_score: clamped,
    verdict: clamped >= 75 ? "Strong Match" : clamped >= 50 ? "Moderate Match" : "Weak Match",
    breakdown: {
      skills_match: clamped,
      experience_match: Math.max(40, clamped - 5),
      education_match: Math.max(50, clamped - 10),
      keyword_match: matched.length * 8,
    },
    matched_keywords: matched,
    missing_keywords: missing,
    improvement_tips: [
      missing.length ? `Add missing keywords: ${missing.slice(0, 3).join(", ")}` : "Good keyword coverage",
      "Quantify achievements with numbers (e.g., improved performance by 30%)",
      `Tailor resume summary to mention "${jobTitle}" explicitly`,
    ],
    summary: `Mock score (no Gemini key set). Matched ${matched.length}/${jobTokens.length} keywords. Set GEMINI_API_KEY for real AI scoring.`,
  };
}
