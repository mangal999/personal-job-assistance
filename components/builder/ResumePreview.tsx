"use client";

import type { ResumeData } from "@/lib/resume-types";

/** ATS-safe single-column preview. id="resume-print" is the PDF print source. */
export default function ResumePreview({ resume }: { resume: ResumeData }) {
  const c = resume.contact;

  const contactItems: React.ReactNode[] = [];
  if (c.email) {
    contactItems.push(
      <a key="email" href={`mailto:${c.email}`} className="text-zinc-900 hover:underline">
        {c.email}
      </a>
    );
  }
  if (c.phone) {
    contactItems.push(
      <a key="phone" href={`tel:${c.phone}`} className="text-zinc-900 hover:underline">
        {c.phone}
      </a>
    );
  }
  if (c.location) {
    contactItems.push(<span key="location">{c.location}</span>);
  }
  if (c.linkedin) {
    const url = c.linkedin.startsWith("http") ? c.linkedin : `https://${c.linkedin}`;
    const label = c.linkedin.replace(/^https?:\/\/(www\.)?/i, "").replace(/\/$/, "");
    contactItems.push(
      <a key="linkedin" href={url} target="_blank" rel="noopener noreferrer" className="text-zinc-900 hover:underline">
        {label}
      </a>
    );
  }
  if (c.portfolio) {
    const url = c.portfolio.startsWith("http") ? c.portfolio : `https://${c.portfolio}`;
    const label = c.portfolio.replace(/^https?:\/\/(www\.)?/i, "").replace(/\/$/, "");
    contactItems.push(
      <a key="portfolio" href={url} target="_blank" rel="noopener noreferrer" className="text-zinc-900 hover:underline">
        {label}
      </a>
    );
  }

  return (
    <div
      id="resume-print"
      className="rounded-xl border border-zinc-200 bg-white p-6 text-black shadow-sm dark:border-zinc-800 dark:bg-white dark:text-black"
      style={{ fontFamily: "Arial, Helvetica, sans-serif" }}
    >
      {/* Name as semantic H1 */}
      {c.fullName ? (
        <h1 className="text-center text-xl font-bold tracking-wide text-zinc-900">{c.fullName.toUpperCase()}</h1>
      ) : (
        <h1 className="text-center text-xl font-bold text-zinc-400">YOUR NAME</h1>
      )}

      {/* Clickable, ATS-safe contact line */}
      {contactItems.length > 0 && (
        <p className="mt-1.5 flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 text-center text-xs text-zinc-700">
          {contactItems.map((item, i) => (
            <span key={i} className="inline-flex items-center">
              {i > 0 && <span className="mr-2 text-zinc-400 select-none">|</span>}
              {item}
            </span>
          ))}
        </p>
      )}

      {resume.summary.trim() && (
        <section className="mt-3.5">
          <h2 className="border-b border-zinc-300 pb-0.5 text-xs font-bold tracking-widest text-zinc-900">
            SUMMARY
          </h2>
          <p className="mt-1 text-sm leading-6 whitespace-pre-line text-zinc-900">{resume.summary.trim()}</p>
        </section>
      )}

      {resume.skills.length > 0 && (
        <section className="mt-3.5">
          <h2 className="border-b border-zinc-300 pb-0.5 text-xs font-bold tracking-widest text-zinc-900">
            SKILLS
          </h2>
          <p className="mt-1 text-sm leading-6 text-zinc-900">{resume.skills.join(", ")}</p>
        </section>
      )}

      {resume.experience.length > 0 && (
        <section className="mt-3.5">
          <h2 className="border-b border-zinc-300 pb-0.5 text-xs font-bold tracking-widest text-zinc-900">
            EXPERIENCE
          </h2>
          {resume.experience.map((e) => (
            <div key={e.id} className="resume-item mt-2 break-inside-avoid">
              <div className="flex flex-wrap items-baseline justify-between gap-x-2 text-sm">
                <span className="font-bold text-zinc-900">
                  {e.title || "Job Title"}
                  {e.company && <span className="font-semibold text-zinc-800"> — {e.company}</span>}
                  {e.location && <span className="font-normal text-zinc-600"> | {e.location}</span>}
                </span>
                {[e.start, e.end].filter(Boolean).length > 0 && (
                  <span className="text-xs font-medium text-zinc-600">
                    {[e.start, e.end].filter(Boolean).join(" – ")}
                  </span>
                )}
              </div>
              <ul className="mt-1 list-disc pl-5 text-sm leading-6 text-zinc-900">
                {e.bullets.filter((b) => b.trim()).map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}

      {resume.projects.length > 0 && (
        <section className="mt-3.5">
          <h2 className="border-b border-zinc-300 pb-0.5 text-xs font-bold tracking-widest text-zinc-900">
            PROJECTS
          </h2>
          {resume.projects.map((p) => {
            const url = p.link ? (p.link.startsWith("http") ? p.link : `https://${p.link}`) : "";
            return (
              <div key={p.id} className="resume-item mt-2 break-inside-avoid">
                <div className="flex flex-wrap items-baseline justify-between gap-x-2 text-sm">
                  <span className="font-bold text-zinc-900">
                    {p.name}
                    {url && (
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-2 font-normal text-xs text-zinc-600 underline hover:text-black"
                      >
                        {p.link.replace(/^https?:\/\/(www\.)?/i, "").replace(/\/$/, "")} ↗
                      </a>
                    )}
                  </span>
                </div>
                <ul className="mt-1 list-disc pl-5 text-sm leading-6 text-zinc-900">
                  {p.bullets.filter((b) => b.trim()).map((b, i) => (
                    <li key={i}>{b}</li>
                  ))}
                </ul>
              </div>
            );
          })}
        </section>
      )}

      {resume.education.length > 0 && (
        <section className="mt-3.5">
          <h2 className="border-b border-zinc-300 pb-0.5 text-xs font-bold tracking-widest text-zinc-900">
            EDUCATION
          </h2>
          {resume.education.map((e) => (
            <div key={e.id} className="resume-item mt-2 flex flex-wrap items-baseline justify-between gap-x-2 text-sm break-inside-avoid">
              <div>
                <span className="font-bold text-zinc-900">{e.degree}</span>
                {e.school && <span className="text-zinc-700">, {e.school}</span>}
              </div>
              {e.year && <span className="text-xs font-medium text-zinc-600">{e.year}</span>}
            </div>
          ))}
        </section>
      )}

      {resume.certifications.length > 0 && (
        <section className="mt-3.5">
          <h2 className="border-b border-zinc-300 pb-0.5 text-xs font-bold tracking-widest text-zinc-900">
            CERTIFICATIONS
          </h2>
          <ul className="mt-1 list-disc pl-5 text-sm leading-6 text-zinc-900">
            {resume.certifications.filter((x) => x.trim()).map((x, i) => (
              <li key={i} className="resume-item break-inside-avoid">{x}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
