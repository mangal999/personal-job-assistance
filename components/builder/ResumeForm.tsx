"use client";

const inputCls =
  "w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950";
const labelCls = "mb-1 block text-xs font-semibold text-zinc-600 dark:text-zinc-400";

import type { ResumeData } from "@/lib/resume-types";
import { newId } from "@/lib/resume-types";

export default function ResumeForm({
  resume,
  onChange,
}: {
  resume: ResumeData;
  onChange: (r: ResumeData) => void;
}) {
  const set = (patch: Partial<ResumeData>) => onChange({ ...resume, ...patch });

  return (
    <div className="space-y-4">
      {/* Contact */}
      <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <h3 className="text-sm font-semibold">Contact</h3>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {(
            [
              ["fullName", "Full name"],
              ["email", "Email"],
              ["phone", "Phone"],
              ["location", "Location"],
              ["linkedin", "LinkedIn URL"],
              ["portfolio", "Portfolio / GitHub"],
            ] as const
          ).map(([k, label]) => (
            <label key={k} className="min-w-0">
              <span className={labelCls}>{label}</span>
              <input
                className={inputCls}
                value={resume.contact[k]}
                onChange={(e) => set({ contact: { ...resume.contact, [k]: e.target.value } })}
                placeholder={label}
              />
            </label>
          ))}
        </div>
      </section>

      {/* Summary */}
      <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <h3 className="text-sm font-semibold">Summary</h3>
        <p className="mt-1 text-xs text-zinc-500">2–3 lines, mention the target role using only real skills.</p>
        <textarea
          className={`${inputCls} mt-2`}
          rows={4}
          value={resume.summary}
          onChange={(e) => set({ summary: e.target.value })}
          placeholder="e.g. Frontend developer with 3 years building React apps..."
        />
      </section>

      {/* Skills */}
      <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <h3 className="text-sm font-semibold">Skills ({resume.skills.length})</h3>
        <SkillsEditor skills={resume.skills} onChange={(skills) => set({ skills })} />
      </section>

      {/* Experience */}
      <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Experience ({resume.experience.length})</h3>
          <button
            onClick={() =>
              set({
                experience: [
                  ...resume.experience,
                  { id: newId(), title: "", company: "", start: "", end: "", bullets: [""] },
                ],
              })
            }
            className="rounded-full border border-zinc-200 px-3 py-1 text-xs font-medium dark:border-zinc-700"
          >
            + Add role
          </button>
        </div>
        <div className="mt-3 space-y-3">
          {resume.experience.map((e, idx) => (
            <div key={e.id} className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-950">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <input className={inputCls} placeholder="Title" value={e.title} onChange={(ev) => {
                  const arr = [...resume.experience]; arr[idx] = { ...e, title: ev.target.value }; set({ experience: arr });
                }} />
                <input className={inputCls} placeholder="Company" value={e.company} onChange={(ev) => {
                  const arr = [...resume.experience]; arr[idx] = { ...e, company: ev.target.value }; set({ experience: arr });
                }} />
                <input className={inputCls} placeholder="Start (e.g. Jan 2022)" value={e.start} onChange={(ev) => {
                  const arr = [...resume.experience]; arr[idx] = { ...e, start: ev.target.value }; set({ experience: arr });
                }} />
                <input className={inputCls} placeholder="End (e.g. Present)" value={e.end} onChange={(ev) => {
                  const arr = [...resume.experience]; arr[idx] = { ...e, end: ev.target.value }; set({ experience: arr });
                }} />
              </div>
              <label className="mt-2 block">
                <span className={labelCls}>Bullets (one per line)</span>
                <textarea
                  className={inputCls}
                  rows={3}
                  value={e.bullets.join("\n")}
                  onChange={(ev) => {
                    const arr = [...resume.experience];
                    arr[idx] = { ...e, bullets: ev.target.value.split("\n") };
                    set({ experience: arr });
                  }}
                  placeholder="Shipped X…&#10;Improved Y by Z%…"
                />
              </label>
              <button
                onClick={() => set({ experience: resume.experience.filter((x) => x.id !== e.id) })}
                className="mt-2 text-xs text-red-600 underline"
              >
                Remove role
              </button>
            </div>
          ))}
          {resume.experience.length === 0 && <p className="text-xs text-zinc-500">No roles yet — add your most recent first.</p>}
        </div>
      </section>

      {/* Projects */}
      <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Projects ({resume.projects.length})</h3>
          <button
            onClick={() => set({ projects: [...resume.projects, { id: newId(), name: "", link: "", bullets: [""] }] })}
            className="rounded-full border border-zinc-200 px-3 py-1 text-xs font-medium dark:border-zinc-700"
          >
            + Add project
          </button>
        </div>
        <div className="mt-3 space-y-3">
          {resume.projects.map((p, idx) => (
            <div key={p.id} className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-950">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <input className={inputCls} placeholder="Project name" value={p.name} onChange={(ev) => {
                  const arr = [...resume.projects]; arr[idx] = { ...p, name: ev.target.value }; set({ projects: arr });
                }} />
                <input className={inputCls} placeholder="Link (optional)" value={p.link} onChange={(ev) => {
                  const arr = [...resume.projects]; arr[idx] = { ...p, link: ev.target.value }; set({ projects: arr });
                }} />
              </div>
              <textarea
                className={`${inputCls} mt-2`}
                rows={2}
                value={p.bullets.join("\n")}
                onChange={(ev) => {
                  const arr = [...resume.projects];
                  arr[idx] = { ...p, bullets: ev.target.value.split("\n") };
                  set({ projects: arr });
                }}
                placeholder="What it does, stack, outcome…"
              />
              <button
                onClick={() => set({ projects: resume.projects.filter((x) => x.id !== p.id) })}
                className="mt-2 text-xs text-red-600 underline"
              >
                Remove project
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Education + certs */}
      <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Education ({resume.education.length})</h3>
          <button
            onClick={() => set({ education: [...resume.education, { id: newId(), degree: "", school: "", year: "" }] })}
            className="rounded-full border border-zinc-200 px-3 py-1 text-xs font-medium dark:border-zinc-700"
          >
            + Add
          </button>
        </div>
        <div className="mt-3 space-y-2">
          {resume.education.map((e, idx) => (
            <div key={e.id} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto]">
              <input className={inputCls} placeholder="Degree" value={e.degree} onChange={(ev) => {
                const arr = [...resume.education]; arr[idx] = { ...e, degree: ev.target.value }; set({ education: arr });
              }} />
              <input className={inputCls} placeholder="School" value={e.school} onChange={(ev) => {
                const arr = [...resume.education]; arr[idx] = { ...e, school: ev.target.value }; set({ education: arr });
              }} />
              <div className="flex gap-2">
                <input className={inputCls} placeholder="Year" value={e.year} onChange={(ev) => {
                  const arr = [...resume.education]; arr[idx] = { ...e, year: ev.target.value }; set({ education: arr });
                }} />
                <button onClick={() => set({ education: resume.education.filter((x) => x.id !== e.id) })} className="text-xs text-red-600 underline">✕</button>
              </div>
            </div>
          ))}
        </div>
        <label className="mt-3 block">
          <span className={labelCls}>Certifications (one per line)</span>
          <textarea
            className={inputCls}
            rows={2}
            value={resume.certifications.join("\n")}
            onChange={(e) => set({ certifications: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })}
            placeholder="AWS Certified…, PMP…"
          />
        </label>
      </section>
    </div>
  );
}

function SkillsEditor({ skills, onChange }: { skills: string[]; onChange: (s: string[]) => void }) {
  return (
    <div>
      <div className="mt-2 flex flex-wrap gap-1">
        {skills.map((s, i) => (
          <span key={`${s}-${i}`} className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-1 text-xs dark:bg-zinc-800">
            {s}
            <button
              onClick={() => onChange(skills.filter((_, j) => j !== i))}
              className="text-zinc-500 hover:text-red-600"
              title={`Remove ${s}`}
            >
              ✕
            </button>
          </span>
        ))}
        {skills.length === 0 && <span className="text-xs text-zinc-500">No skills yet — add below or via Skills Assist.</span>}
      </div>
      <form
        className="mt-2 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const input = form.elements.namedItem("skill") as HTMLInputElement;
          const v = input.value.trim();
          if (v && !skills.some((s) => s.toLowerCase() === v.toLowerCase())) onChange([...skills, v]);
          input.value = "";
        }}
      >
        <input name="skill" className={inputCls} placeholder="Add a skill you truly have…" />
        <button type="submit" className="shrink-0 rounded-lg bg-black px-3 py-2 text-xs font-medium text-white dark:bg-white dark:text-black">
          Add
        </button>
      </form>
    </div>
  );
}
