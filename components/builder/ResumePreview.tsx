"use client";

import type { ResumeData } from "@/lib/resume-types";

/** ATS-safe single-column preview. id="resume-print" is the PDF print source. */
export default function ResumePreview({ resume }: { resume: ResumeData }) {
  const c = resume.contact;
  const contactLine = [c.email, c.phone, c.location, c.linkedin, c.portfolio].filter(Boolean).join("  •  ");
  return (
    <div
      id="resume-print"
      className="rounded-xl border border-zinc-200 bg-white p-6 text-black shadow-sm dark:border-zinc-800 dark:bg-white dark:text-black"
      style={{ fontFamily: "Arial, Helvetica, sans-serif" }}
    >
      {c.fullName ? (
        <h2 className="text-center text-xl font-bold tracking-wide">{c.fullName.toUpperCase()}</h2>
      ) : (
        <h2 className="text-center text-xl font-bold text-zinc-400">YOUR NAME</h2>
      )}
      {contactLine && <p className="mt-1 text-center text-xs break-words">{contactLine}</p>}
      <hr className="my-3 border-zinc-300" />

      {resume.summary.trim() && (
        <section className="mt-2">
          <h3 className="text-xs font-bold tracking-widest">SUMMARY</h3>
          <p className="mt-1 text-sm leading-6 whitespace-pre-line">{resume.summary.trim()}</p>
        </section>
      )}

      {resume.skills.length > 0 && (
        <section className="mt-3">
          <h3 className="text-xs font-bold tracking-widest">SKILLS</h3>
          <p className="mt-1 text-sm leading-6">{resume.skills.join(", ")}</p>
        </section>
      )}

      {resume.experience.length > 0 && (
        <section className="mt-3">
          <h3 className="text-xs font-bold tracking-widest">EXPERIENCE</h3>
          {resume.experience.map((e) => (
            <div key={e.id} className="mt-2">
              <p className="text-sm font-bold">
                {[e.title, e.company].filter(Boolean).join(" — ")}
                {[e.start, e.end].filter(Boolean).length > 0 && (
                  <span className="font-normal"> ({[e.start, e.end].filter(Boolean).join(" – ")})</span>
                )}
              </p>
              <ul className="mt-1 list-disc pl-5 text-sm leading-6">
                {e.bullets.filter((b) => b.trim()).map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}

      {resume.projects.length > 0 && (
        <section className="mt-3">
          <h3 className="text-xs font-bold tracking-widest">PROJECTS</h3>
          {resume.projects.map((p) => (
            <div key={p.id} className="mt-2">
              <p className="text-sm font-bold">{[p.name, p.link].filter(Boolean).join(" — ")}</p>
              <ul className="mt-1 list-disc pl-5 text-sm leading-6">
                {p.bullets.filter((b) => b.trim()).map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}

      {resume.education.length > 0 && (
        <section className="mt-3">
          <h3 className="text-xs font-bold tracking-widest">EDUCATION</h3>
          <ul className="mt-1 list-disc pl-5 text-sm leading-6">
            {resume.education.map((e) => (
              <li key={e.id}>{[e.degree, e.school, e.year].filter(Boolean).join(", ")}</li>
            ))}
          </ul>
        </section>
      )}

      {resume.certifications.length > 0 && (
        <section className="mt-3">
          <h3 className="text-xs font-bold tracking-widest">CERTIFICATIONS</h3>
          <ul className="mt-1 list-disc pl-5 text-sm leading-6">
            {resume.certifications.filter((x) => x.trim()).map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
