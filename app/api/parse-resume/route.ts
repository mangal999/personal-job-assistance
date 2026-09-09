import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// We do simple text extraction server-side without heavy deps.
// Client also does pdfjs, but server fallback uses raw text if provided.
// For PDF binary, we try to extract via regex if possible, otherwise return error instructing client parse.
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "file required" }, { status: 400 });

  if (file.size > 3 * 1024 * 1024) {
    return NextResponse.json({ error: "File too large (max 3MB)" }, { status: 400 });
  }

  const name = file.name.toLowerCase();

  try {
    if (name.endsWith(".txt") || file.type.includes("text")) {
      const text = await file.text();
      return NextResponse.json({ text: text.slice(0, 15000), filename: file.name });
    }

    if (name.endsWith(".pdf") || file.type === "application/pdf") {
      // Try naive extraction - if truly needed, client will have already parsed via pdfjs.
      // Here we just return a hint that client-side parsing is preferred.
      // As fallback, attempt to read as text and strip binary.
      const buf = await file.arrayBuffer();
      const uint = new Uint8Array(buf);
      let raw = "";
      // pdf binary contains text between () and BT/ET operators - naive
      const decoder = new TextDecoder("utf-8", { fatal: false });
      raw = decoder.decode(uint);
      // Extract strings in parentheses (PDF text objects)
      const matches = raw.match(/\(([^\)]{5,200})\)/g);
      let extracted = "";
      if (matches) {
        extracted = matches
          .slice(0, 500)
          .map((m) => m.slice(1, -1))
          .join(" ")
          .replace(/\\n/g, " ");
      }
      if (extracted.trim().length > 100) {
        return NextResponse.json({ text: extracted.slice(0, 15000), filename: file.name, note: "naive pdf extract" });
      }
      return NextResponse.json({
        text: "",
        filename: file.name,
        error: "Could not parse PDF server-side. Please rely on client-side pdfjs parsing (text will be sent from client).",
      });
    }

    if (name.endsWith(".docx")) {
      return NextResponse.json({
        text: "",
        filename: file.name,
        error: "DOCX parsing on server not enabled. Please use client-side parser or upload as PDF/TXT for now.",
      });
    }

    const text = await file.text().catch(() => "");
    if (text.trim().length > 50) return NextResponse.json({ text: text.slice(0, 15000), filename: file.name });
    return NextResponse.json({ error: "Unsupported file type. Use PDF or TXT." }, { status: 400 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "parse error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
