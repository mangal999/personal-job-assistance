import type { ResumeData } from "./resume-types";
import { resumeToPlainText } from "./resume-render";

/** Client-side DOCX generation (dynamic import keeps initial bundle small). */
export async function downloadResumeDocx(resume: ResumeData, company: string, fileBase: string): Promise<void> {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } = await import("docx");

  const heading = (text: string) =>
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      children: [new TextRun({ text, bold: true, size: 26 })],
      spacing: { before: 240, after: 120 },
    });

  const body = (text: string) =>
    new Paragraph({ children: [new TextRun({ text, size: 22 })], spacing: { after: 80 } });

  const bullet = (text: string) =>
    new Paragraph({ bullet: { level: 0 }, children: [new TextRun({ text, size: 22 })] });

  const children: InstanceType<typeof Paragraph>[] = [];
  const c = resume.contact;

  if (c.fullName) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: c.fullName.toUpperCase(), bold: true, size: 36 })],
      })
    );
  }
  const contactLine = [c.email, c.phone, c.location, c.linkedin, c.portfolio].filter(Boolean).join(" | ");
  if (contactLine) {
    children.push(
      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: contactLine, size: 20 })] })
    );
  }
  if (resume.summary.trim()) {
    children.push(heading("SUMMARY"), body(resume.summary.trim()));
  }
  if (resume.skills.length > 0) {
    children.push(heading("SKILLS"), body(resume.skills.join(", ")));
  }
  if (resume.experience.length > 0) {
    children.push(heading("EXPERIENCE"));
    for (const e of resume.experience) {
      const head = [e.title, e.company].filter(Boolean).join(" — ");
      const dates = [e.start, e.end].filter(Boolean).join(" to ");
      if (head) children.push(new Paragraph({ children: [new TextRun({ text: head + (dates ? ` (${dates})` : ""), bold: true, size: 22 })] }));
      for (const b of e.bullets) if (b.trim()) children.push(bullet(b.trim()));
    }
  }
  if (resume.projects.length > 0) {
    children.push(heading("PROJECTS"));
    for (const p of resume.projects) {
      const head = [p.name, p.link].filter(Boolean).join(" — ");
      if (head) children.push(new Paragraph({ children: [new TextRun({ text: head, bold: true, size: 22 })] }));
      for (const b of p.bullets) if (b.trim()) children.push(bullet(b.trim()));
    }
  }
  if (resume.education.length > 0) {
    children.push(heading("EDUCATION"));
    for (const e of resume.education) {
      const line = [e.degree, e.school, e.year].filter(Boolean).join(", ");
      if (line) children.push(bullet(line));
    }
  }
  if (resume.certifications.length > 0) {
    children.push(heading("CERTIFICATIONS"));
    for (const cert of resume.certifications) if (cert.trim()) children.push(bullet(cert.trim()));
  }

  // Sanity: plain-text length matches what ATS scoring sees
  void resumeToPlainText(resume);

  const doc = new Document({
    sections: [{ children }],
    creator: "Personal Job Assistance",
    title: `${resume.contact.fullName || "Resume"} — ${company || "Tailored"}`,
  });
  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${fileBase}.docx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
