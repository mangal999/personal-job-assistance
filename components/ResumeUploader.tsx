"use client";

import { useState, useRef } from "react";

export default function ResumeUploader({
  onText,
  initialText,
}: {
  onText: (text: string) => void;
  initialText: string;
}) {
  const [drag, setDrag] = useState(false);
  const [filename, setFilename] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [preview, setPreview] = useState(initialText.slice(0, 400));
  const inputRef = useRef<HTMLInputElement>(null);

  async function parseFile(file: File) {
    setFilename(file.name);
    setParsing(true);
    try {
      // TXT fast path
      if (file.name.toLowerCase().endsWith(".txt") || file.type.includes("text")) {
        const text = await file.text();
        onText(text.slice(0, 15000));
        setPreview(text.slice(0, 400));
        setParsing(false);
        return;
      }

      // PDF via pdfjs-dist (client side)
      if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
        // dynamic import to avoid SSR
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pdfjs: any = await import("pdfjs-dist");
        // set worker
        if (typeof window !== "undefined") {
          pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;
        }
        const buf = await file.arrayBuffer();
        const pdf = await pdfjs.getDocument({ data: buf }).promise;
        let full = "";
        for (let i = 1; i <= Math.min(pdf.numPages, 5); i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const strings = content.items.map((it: any) => it.str).join(" ");
          full += strings + "\n";
        }
        if (full.trim().length < 50) throw new Error("PDF text too short");
        onText(full.slice(0, 15000));
        setPreview(full.slice(0, 400));
        setParsing(false);
        return;
      }

      // DOCX via mammoth
      if (file.name.toLowerCase().endsWith(".docx")) {
        const mammoth = await import("mammoth");
        const buf = await file.arrayBuffer();
        const res = await mammoth.extractRawText({ arrayBuffer: buf });
        const text = res.value;
        onText(text.slice(0, 15000));
        setPreview(text.slice(0, 400));
        setParsing(false);
        return;
      }

      // fallback: try as text
      const text = await file.text();
      if (text.trim().length > 50) {
        onText(text.slice(0, 15000));
        setPreview(text.slice(0, 400));
      } else {
        alert("Unsupported file type. Please upload PDF, DOCX, or TXT.");
      }
    } catch (e) {
      console.error(e);
      alert("Failed to parse file. Try TXT export or paste text manually.");
    } finally {
      setParsing(false);
    }
  }

  return (
    <div className="w-full">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          const f = e.dataTransfer.files?.[0];
          if (f) parseFile(f);
        }}
        onClick={() => inputRef.current?.click()}
        className={`cursor-pointer rounded-xl border-2 border-dashed p-6 text-center transition ${drag ? "border-black bg-zinc-50 dark:border-white dark:bg-zinc-900" : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-800"}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx,.txt"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) parseFile(f);
          }}
        />
        <p className="text-sm font-medium">
          {parsing ? "Parsing..." : filename ? filename : "Drop resume here or click to upload"}
        </p>
        <p className="mt-1 text-xs text-zinc-500">PDF, DOCX, TXT — max 3MB — stored locally (or Supabase if configured)</p>
      </div>

      {initialText && (
        <div className="mt-3 rounded-lg bg-zinc-50 p-3 dark:bg-zinc-900">
          <p className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">Resume parsed ({initialText.length} chars) — preview:</p>
          <p className="mt-1 line-clamp-3 text-xs text-zinc-700 dark:text-zinc-300">{preview}...</p>
          <textarea
            value={initialText}
            onChange={(e) => {
              onText(e.target.value);
              setPreview(e.target.value.slice(0, 400));
            }}
            rows={4}
            className="mt-2 w-full rounded border border-zinc-200 p-2 text-xs dark:border-zinc-800 dark:bg-black"
            placeholder="Or paste resume text here..."
          />
          <p className="mt-1 text-[11px] text-zinc-500">You can edit text above — ATS scoring uses this text.</p>
        </div>
      )}
    </div>
  );
}
