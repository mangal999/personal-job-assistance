import type { ResumeData } from "./resume-types";
import { resumeToPlainText } from "./resume-render";

/** Client-side DOCX generation (dynamic import keeps initial bundle small). */
export async function downloadResumeDocx(resume: ResumeData, company: string, fileBase: string): Promise<void> {
  const {
    Document,
    Packer,
    Paragraph,
    TextRun,
    HeadingLevel,
    AlignmentType,
    BorderStyle,
    ExternalHyperlink,
  } = await import("docx");

  const FONT = "Arial";

  const heading = (text: string) =>
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      border: {
        bottom: {
          color: "CCCCCC",
          space: 4,
          style: BorderStyle.SINGLE,
          size: 6,
        },
      },
      children: [new TextRun({ text, bold: true, size: 24, font: FONT, color: "000000" })],
      spacing: { before: 220, after: 100 },
    });

  const body = (text: string) =>
    new Paragraph({
      children: [new TextRun({ text, size: 21, font: FONT })],
      spacing: { after: 60 },
    });

  const bullet = (text: string) =>
    new Paragraph({
      bullet: { level: 0 },
      children: [new TextRun({ text, size: 21, font: FONT })],
      spacing: { after: 40 },
    });

  const children: InstanceType<typeof Paragraph>[] = [];
  const c = resume.contact;

  if (c.fullName) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: c.fullName.toUpperCase(), bold: true, size: 34, font: FONT })],
        spacing: { after: 60 },
      })
    );
  }

  // Clickable, professional ATS contact line
  const contactChildren: (InstanceType<typeof TextRun> | InstanceType<typeof ExternalHyperlink>)[] = [];
  const addSep = () => {
    if (contactChildren.length > 0) {
      contactChildren.push(new TextRun({ text: "  |  ", size: 19, font: FONT, color: "666666" }));
    }
  };

  if (c.email) {
    addSep();
    contactChildren.push(
      new ExternalHyperlink({
        link: `mailto:${c.email}`,
        children: [new TextRun({ text: c.email, size: 19, font: FONT, style: "Hyperlink" })],
      })
    );
  }
  if (c.phone) {
    addSep();
    contactChildren.push(new TextRun({ text: c.phone, size: 19, font: FONT }));
  }
  if (c.location) {
    addSep();
    contactChildren.push(new TextRun({ text: c.location, size: 19, font: FONT }));
  }
  if (c.linkedin) {
    addSep();
    const url = c.linkedin.startsWith("http") ? c.linkedin : `https://${c.linkedin}`;
    const label = c.linkedin.replace(/^https?:\/\/(www\.)?/i, "").replace(/\/$/, "");
    contactChildren.push(
      new ExternalHyperlink({
        link: url,
        children: [new TextRun({ text: label, size: 19, font: FONT, style: "Hyperlink" })],
      })
    );
  }
  if (c.portfolio) {
    addSep();
    const url = c.portfolio.startsWith("http") ? c.portfolio : `https://${c.portfolio}`;
    const label = c.portfolio.replace(/^https?:\/\/(www\.)?/i, "").replace(/\/$/, "");
    contactChildren.push(
      new ExternalHyperlink({
        link: url,
        children: [new TextRun({ text: label, size: 19, font: FONT, style: "Hyperlink" })],
      })
    );
  }

  if (contactChildren.length > 0) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: contactChildren,
        spacing: { after: 140 },
      })
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
      const titleAndCo = [e.title, e.company].filter(Boolean).join(" — ");
      if (titleAndCo) {
        children.push(
          new Paragraph({
            spacing: { before: 120, after: 40 },
            children: [
              new TextRun({ text: e.title || "Job Title", bold: true, size: 21, font: FONT }),
              ...(e.company ? [new TextRun({ text: ` — ${e.company}`, bold: true, size: 21, font: FONT })] : []),
              ...(e.location ? [new TextRun({ text: ` | ${e.location}`, size: 20, font: FONT, color: "444444" })] : []),
              ...([e.start, e.end].filter(Boolean).length > 0
                ? [
                    new TextRun({
                      text: `  (${[e.start, e.end].filter(Boolean).join(" – ")})`,
                      size: 20,
                      font: FONT,
                      color: "444444",
                    }),
                  ]
                : []),
            ],
          })
        );
      }
      for (const b of e.bullets) {
        if (b.trim()) children.push(bullet(b.trim()));
      }
    }
  }

  if (resume.projects.length > 0) {
    children.push(heading("PROJECTS"));
    for (const p of resume.projects) {
      const projChildren: (InstanceType<typeof TextRun> | InstanceType<typeof ExternalHyperlink>)[] = [
        new TextRun({ text: p.name, bold: true, size: 21, font: FONT }),
      ];
      if (p.link) {
        const url = p.link.startsWith("http") ? p.link : `https://${p.link}`;
        const label = p.link.replace(/^https?:\/\/(www\.)?/i, "").replace(/\/$/, "");
        projChildren.push(new TextRun({ text: " — ", size: 21, font: FONT }));
        projChildren.push(
          new ExternalHyperlink({
            link: url,
            children: [new TextRun({ text: label, size: 20, font: FONT, style: "Hyperlink" })],
          })
        );
      }
      children.push(
        new Paragraph({
          spacing: { before: 120, after: 40 },
          children: projChildren,
        })
      );
      for (const b of p.bullets) {
        if (b.trim()) children.push(bullet(b.trim()));
      }
    }
  }

  if (resume.education.length > 0) {
    children.push(heading("EDUCATION"));
    for (const e of resume.education) {
      const line = [e.degree, e.school].filter(Boolean).join(", ");
      const full = [line, e.year].filter(Boolean).join("  •  ");
      if (full) children.push(bullet(full));
    }
  }

  if (resume.certifications.length > 0) {
    children.push(heading("CERTIFICATIONS"));
    for (const cert of resume.certifications) {
      if (cert.trim()) children.push(bullet(cert.trim()));
    }
  }

  // Sanity: plain-text length matches what ATS scoring sees
  void resumeToPlainText(resume);

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: FONT,
            size: 21,
          },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 },
          },
        },
        children,
      },
    ],
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
