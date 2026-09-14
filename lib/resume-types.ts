export interface ResumeContact {
  fullName: string;
  email: string;
  phone: string;
  location: string;
  linkedin: string;
  portfolio: string;
}

export interface ResumeExperience {
  id: string;
  title: string;
  company: string;
  start: string;
  end: string;
  bullets: string[];
}

export interface ResumeEducation {
  id: string;
  degree: string;
  school: string;
  year: string;
}

export interface ResumeProject {
  id: string;
  name: string;
  link: string;
  bullets: string[];
}

export interface ResumeData {
  contact: ResumeContact;
  summary: string;
  skills: string[];
  experience: ResumeExperience[];
  education: ResumeEducation[];
  projects: ResumeProject[];
  certifications: string[];
}

export function newId(): string {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return crypto.randomUUID().slice(0, 8);
    }
  } catch {}
  return `id-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}

export function emptyResume(): ResumeData {
  return {
    contact: { fullName: "", email: "", phone: "", location: "", linkedin: "", portfolio: "" },
    summary: "",
    skills: [],
    experience: [],
    education: [],
    projects: [],
    certifications: [],
  };
}

/** Stable hash key for per-job drafts / saved resumes. Mirrors JobCard save-key logic. */
export function jobHashFor(title: string, company: string, applyUrl?: string): string {
  const base = `${title.toLowerCase()}|${company.toLowerCase()}|${(applyUrl || "").toLowerCase()}`;
  return base.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120) || "job";
}

/** Lightweight JD keyword extraction (client + server fallback when Gemini unavailable). */
export function extractJobKeywords(description: string, title: string, tags?: string[]): string[] {
  const stop = new Set([
    "with", "from", "that", "this", "will", "have", "your", "about", "into", "over",
    "under", "between", "their", "there", "they", "them", "then", "than", "what",
    "when", "where", "which", "while", "work", "working", "team", "role", "join",
    "looking", "help", "including", "experience", "years", "year", "ability", "strong",
    "plus", "must", "should", "using", "used", "also", "more", "such", "candidate",
  ]);
  const raw = `${title} ${tags?.join(" ") ?? ""} ${description}`
    .toLowerCase()
    .replace(/[^a-z0-9+#. ]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !stop.has(w));
  const freq = new Map<string, number>();
  for (const w of raw) freq.set(w, (freq.get(w) ?? 0) + 1);
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([w]) => w)
    .slice(0, 30);
}

export function isResumeUsable(r: ResumeData): boolean {
  return (
    r.contact.fullName.trim().length > 1 ||
    r.summary.trim().length > 20 ||
    r.skills.length > 0 ||
    r.experience.length > 0
  );
}
