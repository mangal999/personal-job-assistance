export interface UnifiedJob {
  id: string;
  title: string;
  company: string;
  location: string;
  description: string;
  apply_url: string;
  source: string;
  source_logo?: string;
  posted_at: string; // ISO
  salary?: string;
  remote: boolean;
  type?: string; // Full-time, Contract etc
  tags?: string[];
}

export interface ATSScore {
  overall_score: number;
  verdict: "Strong Match" | "Moderate Match" | "Weak Match";
  breakdown: {
    skills_match: number;
    experience_match: number;
    education_match: number;
    keyword_match: number;
  };
  matched_keywords: string[];
  missing_keywords: string[];
  improvement_tips: string[];
  summary: string;
}

export interface JobProviderResult {
  jobs: UnifiedJob[];
  source: string;
  error?: string;
}
