"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowser, isSupabaseConfigured } from "@/lib/supabase";

export const PJA_AUTH_EVENT = "pja-auth";

export function emitAuth(user: User | null) {
  window.dispatchEvent(new CustomEvent<User | null>(PJA_AUTH_EVENT, { detail: user }));
}

// Supabase returns terse API errors — translate the common ones into
// actionable setup steps instead of showing raw JSON to the user.
function friendlyAuthError(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e);
  const lower = raw.toLowerCase();
  if (
    lower.includes("redirect") ||
    lower.includes("unauthorized_client") ||
    lower.includes("validation_failed")
  ) {
    return (
      `${raw} — Fix: Supabase dashboard → Authentication → URL Configuration → add ` +
      `your app URL + "/login" to Redirect URLs (e.g. https://YOUR-APP.vercel.app/login ` +
      `and http://localhost:3000/login for local dev).`
    );
  }
  return raw;
}

// Verify email magic-link callbacks. Supabase redirects email links to our
// `emailRedirectTo` (/login). Links carry either:
//   - ?token_hash=...&type=magiclink (PKCE-style — needs explicit verifyOtp), or
//   - #access_token=... (implicit — supabase-js session detection picks it up).
// Either way we scrub the tokens from the address bar afterwards.
async function handleEmailLinkCallback(
  supabase: NonNullable<ReturnType<typeof getSupabaseBrowser>>,
  onError: (msg: string) => void
) {
  const url = new URL(window.location.href);
  const tokenHash = url.searchParams.get("token_hash");
  const typeParam = url.searchParams.get("type");
  if (tokenHash) {
    const allowed = ["signup", "invite", "magiclink", "recovery", "email_change"] as const;
    const type = allowed.includes(typeParam as (typeof allowed)[number])
      ? (typeParam as (typeof allowed)[number])
      : "magiclink";
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    url.searchParams.delete("token_hash");
    url.searchParams.delete("type");
    const clean = url.pathname + (url.searchParams.toString() ? `?${url.searchParams}` : "") + url.hash;
    window.history.replaceState(null, "", clean);
    if (error) onError(friendlyAuthError(error));
    return;
  }
  if (window.location.hash.includes("access_token")) {
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }
  }
}

/** Header auth widget. Works without Supabase (shows setup hint). */
export default function AuthButton() {
  const [configured] = useState(() => isSupabaseConfigured());
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState("");
  const [linkSent, setLinkSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  // Ensure a profiles row exists right after login. Upserting only id+email
  // never clobbers resume_text (PostgREST only touches provided columns).
  // Without this, saved_jobs/custom_sources inserts fail on the FK to profiles(id).
  async function ensureProfile(
    supabase: NonNullable<ReturnType<typeof getSupabaseBrowser>>,
    u: User
  ) {
    await supabase
      .from("profiles")
      .upsert({ id: u.id, email: u.email }, { onConflict: "id" });
  }

  useEffect(() => {
    if (!configured) return;
    const supabase = getSupabaseBrowser();
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user ?? null;
      setUser(u);
      emitAuth(u);
      if (u) void ensureProfile(supabase, u);
    });
    // Pick up email magic-link callbacks (?token_hash=... or #access_token=...)
    // landing on this page. supabase-js won't verify ?token_hash links on its own.
    void handleEmailLinkCallback(supabase, (m) => {
      setMsg(m);
      setOpen(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      const u = session?.user ?? null;
      setUser(u);
      emitAuth(u);
      if (u) void ensureProfile(supabase, u);
    });
    return () => sub.subscription.unsubscribe();
  }, [configured]);

  if (!configured) {
    return (
      <a
        href="/SUPABASE_SETUP.md"
        title="Supabase not configured — see SUPABASE_SETUP.md (free via Vercel Marketplace)"
        className="rounded-full border border-dashed border-zinc-300 px-3 py-1.5 text-xs text-zinc-500 hover:border-zinc-500 dark:border-zinc-700"
      >
        Login (needs Supabase)
      </a>
    );
  }

  // Base URL for auth redirects. Prefers the deployed URL so magic links
  // clicked from email land on production, not localhost.
  // Set NEXT_PUBLIC_APP_URL=https://YOUR-APP.vercel.app in Vercel.
  function getRedirectBase() {
    const envUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
    if (envUrl) return envUrl.replace(/\/$/, "");
    return window.location.origin;
  }

  async function sendMagicLink() {
    setBusy(true);
    setMsg(null);
    try {
      const supabase = getSupabaseBrowser()!;
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        // Without this, Supabase falls back to the dashboard Site URL
        // (often localhost:3000) for the magic link. /login handles the
        // callback (link exchange) — keep it allow-listed in
        // Supabase → Authentication → URL Configuration → Redirect URLs.
        options: { emailRedirectTo: `${getRedirectBase()}/login` },
      });
      if (error) throw error;
      setLinkSent(true);
      setMsg("Check your email — click the login link to sign in.");
    } catch (e) {
      setMsg(friendlyAuthError(e));
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    const supabase = getSupabaseBrowser()!;
    await supabase.auth.signOut();
    setUser(null);
    emitAuth(null);
  }

  if (user) {
    return (
      <div className="flex items-center gap-2">
        <span className="hidden max-w-[160px] truncate text-xs text-zinc-500 sm:block" title={user.email}>
          {user.email}
        </span>
        <button
          onClick={logout}
          className="rounded-full border border-zinc-200 px-3 py-1.5 text-xs hover:bg-zinc-100 dark:border-zinc-800 dark:hover:bg-zinc-900"
        >
          Logout
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="rounded-full bg-black px-4 py-1.5 text-xs font-medium text-white dark:bg-white dark:text-black"
      >
        Login
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-2 w-72 rounded-xl border border-zinc-200 bg-white p-3 shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs font-medium">Sign in with email magic link</p>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@email.com"
            type="email"
            className="mt-2 w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-xs dark:border-zinc-700 dark:bg-black"
          />
          <button
            onClick={sendMagicLink}
            disabled={busy || !email.includes("@")}
            className="mt-2 w-full rounded-full border border-zinc-200 px-3 py-1.5 text-xs disabled:opacity-50 dark:border-zinc-700"
          >
            {linkSent ? "Resend magic link" : "Send magic link"}
          </button>
          {msg && <p className="mt-2 text-[11px] text-zinc-500">{msg}</p>}
        </div>
      )}
    </div>
  );
}
