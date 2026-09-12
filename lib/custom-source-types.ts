// Custom job sources — shared types + validation + preset URL builders.
// Zero dependencies on purpose: the UI imports this file in the browser,
// while lib/custom-sources.ts (server fetcher) imports from here.

export type CustomSourceType = "rss" | "greenhouse" | "lever";

export interface CustomSource {
  /** Client-generated stable id (persisted). Server ignores it for fetching. */
  id: string;
  /** Label shown as source chip + company fallback. Must not clash with built-ins. */
  name: string;
  type: CustomSourceType;
  /** Full https URL (RSS feed, Greenhouse board API, or Lever postings API). */
  url: string;
  enabled: boolean;
}

export const CUSTOM_SOURCE_TYPES: Array<{ value: CustomSourceType; label: string; hint: string }> = [
  {
    value: "rss",
    label: "RSS feed",
    hint: "Any job RSS/Atom URL, e.g. https://weworkremotely.com/categories/remote-programming-jobs.rss",
  },
  {
    value: "greenhouse",
    label: "Greenhouse board",
    hint: "Just the board token — e.g. 'acme' for boards.greenhouse.io/acme",
  },
  {
    value: "lever",
    label: "Lever company",
    hint: "Just the company slug — e.g. 'acme' for jobs.lever.co/acme",
  },
];

/** Built-in provider names — custom sources may not reuse these. */
export const BUILTIN_SOURCE_NAMES = ["LinkedIn India", "Arbeitnow", "Remotive", "RemoteOK", "JSearch", "Active Jobs"];

export function buildPresetUrl(type: CustomSourceType, tokenOrUrl: string): string {
  const t = tokenOrUrl.trim();
  if (/^https?:\/\//i.test(t)) return t;
  const token = t.replace(/^\/+|\/+$/g, "").split("/").filter(Boolean).pop() || t;
  if (type === "greenhouse") return `https://boards-api.greenhouse.io/v1/boards/${token}/jobs?content=true`;
  if (type === "lever") return `https://api.lever.co/v0/postings/${token}?mode=json`;
  return t;
}

/** "acme-inc" -> "Acme Inc" (company fallback for board APIs). */
export function prettifyToken(token: string): string {
  return token
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

// -- SSRF guard: user-supplied URLs are fetched server-side, so be strict. --
function isBlockedHostname(host: string): boolean {
  const h = host.toLowerCase().replace(/\.$/, "");
  if (h === "localhost" || h.endsWith(".localhost")) return true;
  if (h === "0.0.0.0" || h === "::" || h === "::1" || h === "[::1]") return true;
  if (h === "169.254.169.254" || h === "metadata.google.internal") return true; // cloud metadata
  if (/^127\./.test(h)) return true;
  if (/^10\./.test(h) || /^192\.168\./.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true;
  if (/^fc00:/.test(h) || /^fd[0-9a-f]{0,4}:/.test(h) || /^fe80:/.test(h)) return true; // IPv6 private/link-local
  return false;
}

export function validateCustomUrl(raw: string): { ok: true } | { ok: false; reason: string } {
  const t = (raw || "").trim();
  if (!t) return { ok: false, reason: "URL is empty." };
  let u: URL;
  try {
    u = new URL(t);
  } catch {
    return { ok: false, reason: "Not a valid URL." };
  }
  if (u.protocol !== "https:") return { ok: false, reason: "Only https:// URLs are allowed." };
  if (u.username || u.password) return { ok: false, reason: "URLs with credentials are not allowed." };
  if (isBlockedHostname(u.hostname))
    return { ok: false, reason: "Private/internal hosts are not allowed." };
  return { ok: true };
}

export function validateCustomSource(
  name: string,
  type: CustomSourceType,
  tokenOrUrl: string
): { ok: true; url: string } | { ok: false; reason: string } {
  const n = name.trim();
  if (n.length < 2) return { ok: false, reason: "Give the source a short name (min 2 chars)." };
  if (n.length > 40) return { ok: false, reason: "Name too long (max 40 chars)." };
  if (BUILTIN_SOURCE_NAMES.some((b) => b.toLowerCase() === n.toLowerCase()))
    return { ok: false, reason: `"${n}" is a built-in source — pick another name.` };
  const url = buildPresetUrl(type, tokenOrUrl);
  const v = validateCustomUrl(url);
  if (!v.ok) return v;
  return { ok: true, url };
}
