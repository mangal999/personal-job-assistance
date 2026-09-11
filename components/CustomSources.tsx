"use client";

import { useState } from "react";
import {
  CustomSource,
  CustomSourceType,
  CUSTOM_SOURCE_TYPES,
  validateCustomSource,
} from "@/lib/custom-source-types";

/** Compact wire format for ?custom= (enabled sources only). */
export function encodeCustomParam(sources: CustomSource[]): string | null {
  const enabled = sources.filter((s) => s.enabled !== false);
  if (enabled.length === 0) return null;
  return JSON.stringify(enabled.slice(0, 10).map((s) => ({ n: s.name, t: s.type, u: s.url })));
}

export default function CustomSources({
  sources,
  onChange,
  isCloud,
}: {
  sources: CustomSource[];
  onChange: (next: CustomSource[]) => void;
  isCloud: boolean;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<CustomSourceType>("rss");
  const [url, setUrl] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<Record<string, string>>({});

  const typeHint = CUSTOM_SOURCE_TYPES.find((t) => t.value === type)?.hint;

  function add() {
    const v = validateCustomSource(name, type, url);
    if (!v.ok) {
      setFormError(v.reason);
      return;
    }
    if (sources.some((s) => s.name.toLowerCase() === name.trim().toLowerCase())) {
      setFormError("A source with this name already exists.");
      return;
    }
    const next: CustomSource[] = [
      ...sources,
      {
        id: `cs-${Date.now().toString(36)}`,
        name: name.trim(),
        type,
        url: v.url,
        enabled: true,
      },
    ];
    onChange(next);
    setName("");
    setUrl("");
    setFormError(null);
  }

  async function test(src: CustomSource) {
    setTesting(src.id);
    setTestResult((p) => ({ ...p, [src.id]: "testing..." }));
    try {
      const params = new URLSearchParams();
      params.set("custom", JSON.stringify([{ n: src.name, t: src.type, u: src.url }]));
      params.set("sources", src.name); // fetch ONLY this source
      const res = await fetch(`/api/jobs?${params.toString()}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      const status: string = data.sources?.[src.name] ?? `ok (${data.total})`;
      setTestResult((p) => ({ ...p, [src.id]: status.startsWith("ok") ? `✓ ${status}` : `✗ ${status}` }));
    } catch (e) {
      setTestResult((p) => ({ ...p, [src.id]: `✗ ${(e as Error).message}` }));
    } finally {
      setTesting(null);
    }
  }

  return (
    <div>
      {sources.length > 0 && (
        <ul className="space-y-2">
          {sources.map((s) => (
            <li
              key={s.id}
              className="rounded-lg border border-zinc-200 p-2 dark:border-zinc-800"
            >
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={s.enabled !== false}
                  onChange={() =>
                    onChange(sources.map((x) => (x.id === s.id ? { ...x, enabled: !(x.enabled !== false) } : x)))
                  }
                  title="Include this source in searches"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold">
                    {s.name}{" "}
                    <span className="ml-1 rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500 dark:bg-zinc-800">
                      {s.type}
                    </span>
                  </p>
                  <p className="truncate text-[11px] text-zinc-400" title={s.url}>
                    {s.url}
                  </p>
                </div>
                <button
                  onClick={() => test(s)}
                  disabled={testing === s.id}
                  className="shrink-0 rounded-full border border-zinc-200 px-2 py-1 text-[11px] disabled:opacity-50 dark:border-zinc-700"
                  title="Fetch only this source to verify it works"
                >
                  Test
                </button>
                <button
                  onClick={() => onChange(sources.filter((x) => x.id !== s.id))}
                  className="shrink-0 rounded px-1 text-xs text-zinc-400 hover:text-red-600"
                  title="Remove source"
                >
                  ✕
                </button>
              </div>
              {testResult[s.id] && (
                <p
                  className={`mt-1 text-[11px] ${testResult[s.id].startsWith("✓") ? "text-green-600" : testResult[s.id] === "testing..." ? "text-zinc-400" : "text-red-500"}`}
                >
                  {testResult[s.id]}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 space-y-2 rounded-lg bg-zinc-50 p-2 dark:bg-zinc-800/50">
        <p className="text-xs font-semibold">+ Add source</p>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name — e.g. Acme careers"
          maxLength={40}
          className="w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs dark:border-zinc-700 dark:bg-black"
        />
        <select
          value={type}
          onChange={(e) => setType(e.target.value as CustomSourceType)}
          className="w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs dark:border-zinc-700 dark:bg-black"
        >
          {CUSTOM_SOURCE_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder={type === "rss" ? "https://.../jobs.rss" : type === "greenhouse" ? "board token — e.g. acme" : "company slug — e.g. acme"}
          className="w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs dark:border-zinc-700 dark:bg-black"
        />
        {typeHint && <p className="text-[11px] text-zinc-400">{typeHint}</p>}
        {formError && <p className="text-[11px] text-red-500">{formError}</p>}
        <button
          onClick={add}
          disabled={!name.trim() || !url.trim()}
          className="w-full rounded-full bg-black px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40 dark:bg-white dark:text-black"
        >
          Add source
        </button>
        <p className="text-[11px] text-zinc-400">
          {isCloud ? "☁️ Saved to your account." : "Stored in this browser (login for cloud sync)."} Click its chip
          above the feed to fetch from that source only.
        </p>
      </div>
    </div>
  );
}
