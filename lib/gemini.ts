import { GoogleGenerativeAI } from "@google/generative-ai";
import { ATSScore } from "./types";
import { ResumeData, emptyResume, newId } from "./resume-types";

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

// ---------- Resume Builder: structured parse + conservative tailor ----------

function parseJsonLoose<T>(text: string): T {
  const cleaned = cleanJson(text);
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Gemini did not return valid JSON");
    return JSON.parse(match[0]) as T;
  }
}

/** Coerce unknown Gemini output into a safe ResumeData (never throws on shape). */
export function sanitizeResumeData(input: unknown): ResumeData {
  const base = emptyResume();
  if (!input || typeof input !== "object") return base;
  const o = input as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v.slice(0, 2000) : "");
  const strArr = (v: unknown, max = 60) =>
    Array.isArray(v) ? v.filter((x) => typeof x === "string").map((x) => (x as string).slice(0, 300)).slice(0, max) : [];

  const contact = (o.contact ?? {}) as Record<string, unknown>;
  base.contact = {
    fullName: str(contact.fullName),
    email: str(contact.email).slice(0, 200),
    phone: str(contact.phone).slice(0, 100),
    location: str(contact.location).slice(0, 200),
    linkedin: str(contact.linkedin).slice(0, 300),
    portfolio: str(contact.portfolio).slice(0, 300),
  };
  base.summary = str(o.summary).slice(0, 2000);
  base.skills = strArr(o.skills, 60);
  if (Array.isArray(o.experience)) {
    base.experience = (o.experience as unknown[]).slice(0, 15).map((e) => {
      const r = (e ?? {}) as Record<string, unknown>;
      const bullets = strArr(r.bullets, 12);
      return {
        id: typeof r.id === "string" ? (r.id as string).slice(0, 40) : newId(),
        title: str(r.title).slice(0, 200),
        company: str(r.company).slice(0, 200),
        start: str(r.start).slice(0, 100),
        end: str(r.end).slice(0, 100),
        bullets,
      };
    });
  }
  if (Array.isArray(o.education)) {
    base.education = (o.education as unknown[]).slice(0, 8).map((e) => {
      const r = (e ?? {}) as Record<string, unknown>;
      return {
        id: typeof r.id === "string" ? (r.id as string).slice(0, 40) : newId(),
        degree: str(r.degree).slice(0, 300),
        school: str(r.school).slice(0, 300),
        year: str(r.year).slice(0, 100),
      };
    });
  }
  if (Array.isArray(o.projects)) {
    base.projects = (o.projects as unknown[]).slice(0, 10).map((p) => {
      const r = (p ?? {}) as Record<string, unknown>;
      return {
        id: typeof r.id === "string" ? (r.id as string).slice(0, 40) : newId(),
        name: str(r.name).slice(0, 300),
        link: str(r.link).slice(0, 300),
        bullets: strArr(r.bullets, 8),
      };
    });
  }
  base.certifications = strArr(o.certifications, 20);
  return base;
}

const RESUME_PARSE_PROMPT = (resume: string) => `
You extract structured resume data. Return ONLY valid JSON, no markdown fences.
Resume text:
"""${resume.slice(0, 10000)}"""
Schema:
{"contact":{"fullName":"","email":"","phone":"","location":"","linkedin":"","portfolio":""},"summary":"","skills":[],"experience":[{"id":"e1","title":"","company":"","start":"","end":"","bullets":[]}],"education":[{"id":"ed1","degree":"","school":"","year":""}],"projects":[{"id":"p1","name":"","link":"","bullets":[]}],"certifications":[]}
Rules: extract only what is present; use "" or [] when missing. Never invent employers, dates, or skills. Max 15 experience bullets total, skills max 40.
`.trim();

const RESUME_TAILOR_PROMPT = (resumeJson: string, jobTitle: string, jobDesc: string, missing: string[]) => `
You are a conservative resume tailor. You NEVER invent employers, degrees, dates, or skills the candidate lacks.
Current resume JSON:
"""${resumeJson.slice(0, 10000)}"""
Target job title: ${jobTitle}
Job description:
"""${jobDesc.slice(0, 6000)}"""
ATS missing keywords: ${missing.slice(0, 15).join(", ") || "none"}
Task: return ONLY valid JSON: {"tailored": <full ResumeData same schema>, "notes": ["...max 5..."], "addedKeywords": ["..."]}
Rules:
1. Keep all experience/education/projects as-is (same companies, titles, dates). You may lightly rephrase bullets to use JD wording ONLY when the underlying skill already exists.
2. Reorder skills so JD-matched skills come first. Do NOT add missing keywords as skills unless already present elsewhere in the resume.
3. Rewrite summary to 2-3 lines mentioning the target role using only real skills from the resume.
4. notes: explain what changed + which missing keywords still need honest user action.
5. addedKeywords: JD keywords now naturally present after tailoring (subset of existing content).
`.trim();

export async function parseResumeToStructured(resumeText: string): Promise<ResumeData> {
  const client = getGeminiClient();
  if (!client) throw new Error("GEMINI_API_KEY not configured");
  const model = client.getGenerativeModel({ model: process.env.GEMINI_MODEL || "gemini-2.0-flash" });
  const result = await model.generateContent(RESUME_PARSE_PROMPT(resumeText));
  return sanitizeResumeData(parseJsonLoose(result.response.text()));
}

export async function tailorResumeForJob(params: {
  resume: ResumeData;
  jobTitle: string;
  jobDescription: string;
  missingKeywords?: string[];
}): Promise<{ tailored: ResumeData; notes: string[]; addedKeywords: string[] }> {
  const client = getGeminiClient();
  if (!client) throw new Error("GEMINI_API_KEY not configured");
  const model = client.getGenerativeModel({ model: process.env.GEMINI_MODEL || "gemini-2.0-flash" });
  const result = await model.generateContent(
    RESUME_TAILOR_PROMPT(
      JSON.stringify(params.resume),
      params.jobTitle,
      params.jobDescription,
      params.missingKeywords ?? []
    )
  );
  const parsed = parseJsonLoose<{ tailored: unknown; notes: unknown; addedKeywords: unknown }>(
    result.response.text()
  );
  return {
    tailored: sanitizeResumeData(parsed.tailored),
    notes: Array.isArray(parsed.notes)
      ? (parsed.notes as unknown[]).filter((x) => typeof x === "string").map((x) => (x as string).slice(0, 500)).slice(0, 6)
      : [],
    addedKeywords: Array.isArray(parsed.addedKeywords)
      ? (parsed.addedKeywords as unknown[]).filter((x) => typeof x === "string").map((x) => (x as string).slice(0, 100)).slice(0, 15)
      : [],
  };
}

/** Offline fallback so builder works without GEMINI_API_KEY (same philosophy as mockATSScore). */
export function mockParseResume(resumeText: string): ResumeData {
  const base = emptyResume();
  const email = resumeText.match(/[\w.+-]+@[\w-]+\.[\w.]+/)?.[0] ?? "";
  const phone = resumeText.match(/(\+?\d[\d\s\-()]{7,}\d)/)?.[0] ?? "";
  const linkedin = resumeText.match(/(linkedin\.com\/[^\s)]+)/i)?.[0] ?? "";
  const lines = resumeText.split("\n").map((l) => l.trim()).filter(Boolean);
  base.contact = {
    fullName: (lines[0] ?? "").slice(0, 120),
    email: email.slice(0, 200),
    phone: phone.slice(0, 100),
    location: "",
    linkedin: linkedin ? `https://${linkedin}` : "",
    portfolio: resumeText.match(/(github\.com\/[^\s)]+)/i)?.[0] ?? "",
  };
  // Naive summary: first substantive paragraph
  const para = lines.find((l) => l.length > 80 && l.length < 600) ?? "";
  base.summary = para.slice(0, 600);
  // Skill scan from a common dictionary present in text
  const dict = [
    "JavaScript", "TypeScript", "React", "Next.js", "Node.js", "Python", "Java", "SQL",
    "PostgreSQL", "MongoDB", "AWS", "Docker", "Kubernetes", "Git", "REST", "GraphQL",
    "HTML", "CSS", "Tailwind", "Redux", "Express", "Django", "Spring", "Figma",
    "Agile", "Testing", "Jest", "CI/CD", "Linux", "Firebase", "Supabase",
  ];
  const lower = resumeText.toLowerCase();
  base.skills = dict.filter((s) => lower.includes(s.toLowerCase())).slice(0, 30);
  if (para) {
    base.experience = [
      { id: "e1", title: "", company: "", start: "", end: "", bullets: [para.slice(0, 300)] },
    ];
  }
  return base;
}

/** Offline conservative tailor: reorder existing skills by JD overlap, never invent. */
export function mockTailorResume(
  resume: ResumeData,
  jobDescription: string,
  missingKeywords: string[] = []
): { tailored: ResumeData; notes: string[]; addedKeywords: string[] } {
  const jd = jobDescription.toLowerCase();
  const matched = resume.skills.filter((s) => jd.includes(s.toLowerCase()));
  const rest = resume.skills.filter((s) => !jd.includes(s.toLowerCase()));
  const tailored: ResumeData = { ...resume, skills: [...matched, ...rest] };
  const stillMissing = missingKeywords.filter(
    (k) => !resumeToPlainTextForMock(tailored).includes(k.toLowerCase())
  );
  return {
    tailored,
    notes: [
      `Reordered ${matched.length} JD-matched skills first (mock — set GEMINI_API_KEY for AI summary/bullet tweaks).`,
      stillMissing.length > 0
        ? `Still missing (add honestly if true): ${stillMissing.slice(0, 5).join(", ")}`
        : "Good keyword coverage in mock pass.",
    ],
    addedKeywords: matched.slice(0, 10),
  };
}

function resumeToPlainTextForMock(r: ResumeData): string {
  return `${r.summary} ${r.skills.join(" ")} ${r.experience.flatMap((e) => e.bullets).join(" ")}`.toLowerCase();
}
