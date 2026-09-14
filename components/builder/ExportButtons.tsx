"use client";

import { useState } from "react";
import type { ResumeData } from "@/lib/resume-types";
import { downloadResumeDocx } from "@/lib/resume-docx";

export default function ExportButtons({
  resume,
  company,
  fileBase,
}: {
  resume: ResumeData;
  company: string;
  fileBase: string;
}) {
  const [docxBusy, setDocxBusy] = useState(false);

  async function handleDocx() {
    setDocxBusy(true);
    try {
      await downloadResumeDocx(resume, company, fileBase);
    } catch (e) {
      alert(`DOCX export failed: ${(e as Error).message}`);
    } finally {
      setDocxBusy(false);
    }
  }

  function handlePdf() {
    // Swap document.title so that if the browser still prints its own
    // header line, it shows a clean resume name instead of the app title.
    // The URL/date/page strip itself can only be removed via the print
    // dialog's "Headers and footers" checkbox (see hint below).
    const prev = document.title;
    document.title = fileBase || "Resume";
    const restore = () => {
      document.title = prev;
      window.removeEventListener("afterprint", restore);
    };
    window.addEventListener("afterprint", restore);
    window.print();
    // Fallback in case afterprint doesn't fire (e.g. print cancelled)
    setTimeout(restore, 2000);
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={handlePdf}
        className="inline-flex flex-1 items-center justify-center gap-1 rounded-full bg-black px-4 py-2.5 text-xs font-medium text-white hover:bg-zinc-800 sm:flex-none dark:bg-white dark:text-black"
      >
        ⬇ Download PDF
      </button>
      <button
        onClick={handleDocx}
        disabled={docxBusy}
        className="inline-flex flex-1 items-center justify-center gap-1 rounded-full border border-zinc-300 px-4 py-2.5 text-xs font-medium hover:border-black sm:flex-none dark:border-zinc-700"
      >
        {docxBusy ? "Building DOCX…" : "⬇ Download DOCX"}
      </button>
      <span className="w-full text-[11px] text-zinc-500">
        PDF uses print CSS (single-column, ATS-safe). In the print dialog choose “Save as PDF” and{" "}
        <span className="font-semibold">uncheck “Headers and footers”</span> to remove the date/title/URL strip.
        DOCX is generated locally in your browser.
      </span>
    </div>
  );
}
