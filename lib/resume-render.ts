import type { ResumeData } from "./resume-types";

/** Single-column ATS-safe plain text. Also the source for ATS re-scoring + DOCX. */
export function resumeToPlainText(r: ResumeData): string {
  const lines: string[] = [];
  const c = r.contact;
  if (c.fullName) lines.push(c.fullName.toUpperCase());
  const contactLine = [c.email, c.phone, c.location, c.linkedin, c.portfolio].filter(Boolean).join(" | ");
  if (contactLine) lines.push(contactLine);
  if (r.summary.trim()) {
    lines.push("", "SUMMARY", r.summary.trim());
  }
  if (r.skills.length > 0) {
    lines.push("", "SKILLS", r.skills.join(", "));
  }
  if (r.experience.length > 0) {
    lines.push("", "EXPERIENCE");
    for (const e of r.experience) {
      const head = [e.title, e.company].filter(Boolean).join(" — ");
      const dates = [e.start, e.end].filter(Boolean).join(" to ");
      lines.push("", head + (dates ? ` (${dates})` : ""));
      for (const b of e.bullets) {
        if (b.trim()) lines.push(`- ${b.trim()}`);
      }
    }
  }
  if (r.projects.length > 0) {
    lines.push("", "PROJECTS");
    for (const p of r.projects) {
      lines.push("", [p.name, p.link].filter(Boolean).join(" — "));
      for (const b of p.bullets) {
        if (b.trim()) lines.push(`- ${b.trim()}`);
      }
    }
  }
  if (r.education.length > 0) {
    lines.push("", "EDUCATION");
    for (const e of r.education) {
      lines.push(`- ${[e.degree, e.school, e.year].filter(Boolean).join(", ")}`);
    }
  }
  if (r.certifications.length > 0) {
    lines.push("", "CERTIFICATIONS");
    for (const cert of r.certifications) {
      if (cert.trim()) lines.push(`- ${cert.trim()}`);
    }
  }
  return lines.join("\n").slice(0, 15000);
}

export function resumeFileBase(r: ResumeData, company: string): string {
  const name = (r.contact.fullName || "resume").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const co = (company || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return `${name || "resume"}${co ? `-${co}` : ""}`.slice(0, 80);
}
