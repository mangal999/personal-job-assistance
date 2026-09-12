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
  if (lower.includes("rate limit") || lower.includes("over_email_send") || lower.includes("email limit")) {
    return (
      `${raw} — Supabase free tier caps auth emails per hour. ` +
      `Use the Password tab (signup once, then login — no email needed), or wait ~1h before magic links.`
    );
  }
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

// Verify email callbacks. Supabase redirects email links to our
// `emailRedirectTo` (/login). Links carry either:
//   - ?token_hash=...&type=magiclink|recovery|signup... (PKCE — needs explicit verifyOtp), or
//   - #access_token=... (implicit — supabase-js session detection picks it up).
// Returns the verified type so callers can enter recovery mode. Tokens are
// scrubbed from the address bar afterwards.
async function handleEmailLinkCallback(
  supabase: NonNullable<ReturnType<typeof getSupabaseBrowser>>,
  onError: (msg: string) => void
): Promise<string | null> {
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
    if (error) {
      onError(friendlyAuthError(error));
      return null;
    }
    return type;
  }
  if (window.location.hash.includes("access_token")) {
    const isRecovery =
      window.location.hash.includes("type=recovery") || url.searchParams.get("type") === "recovery";
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
      return isRecovery ? "recovery" : "magiclink";
    }
  }
  // Direct visit with ?type=recovery (e.g. after redirect) — session may
  // already be established by supabase-js.
  if (url.searchParams.get("type") === "recovery") {
    url.searchParams.delete("type");
    const clean = url.pathname + (url.searchParams.toString() ? `?${url.searchParams}` : "") + url.hash;
    window.history.replaceState(null, "", clean);
    return "recovery";
  }
  return null;
}

/** Header auth widget. Works without Supabase (shows setup hint). */
export default function AuthButton() {
  const [configured] = useState(() => isSupabaseConfigured());
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState("");
  const [linkSent, setLinkSent] = useState(false);
  const [mode, setMode] = useState<"magic" | "password">("password");
  const [pwMode, setPwMode] = useState<"login" | "signup">("login");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  // Password-reset states. `recovery` becomes true when the user lands via a
  // reset link (session is established, they may set a new password).
  const [resetSent, setResetSent] = useState(false);
  const [recovery, setRecovery] = useState(false);
  const [newPw, setNewPw] = useState("");
  const [newPwConfirm, setNewPwConfirm] = useState("");

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
    // Pick up email callbacks (?token_hash=... or #access_token=...).
    // A `recovery` link drops the user into set-new-password mode.
    void handleEmailLinkCallback(supabase, (m) => {
      setMsg(m);
      setOpen(true);
    }).then((type) => {
      if (type === "recovery") {
        setRecovery(true);
        setMode("password");
        setMsg("Reset link verified — set a new password below.");
        setOpen(true);
      }
    });
    const { data: sub } = supabase.auth.onAuthStateChange((evt, session) => {
      const u = session?.user ?? null;
      setUser(u);
      emitAuth(u);
      if (u) void ensureProfile(supabase, u);
      // PASSWORD_RECOVERY fires when the reset link session is established.
      if (evt === "PASSWORD_RECOVERY") {
        setRecovery(true);
        setMode("password");
        setMsg("Reset link verified — set a new password below.");
        setOpen(true);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [configured]);

  // Dev without keys: keep the dropdown open so the options are visible.
  // Auth actions short-circuit with a setup hint (getSupabaseBrowser() is null).
  function requireConfigured(): boolean {
    if (configured) return true;
    setMsg("Supabase not configured — add NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY (see SUPABASE_SETUP.md), then restart dev. App still works with localStorage.");
    return false;
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
    if (!requireConfigured()) return;
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

  async function signUpWithPassword() {
    if (!requireConfigured()) return;
    if (password !== confirm) {
      setMsg("Passwords do not match.");
      return;
    }
    if (password.length < 6) {
      setMsg("Password must be at least 6 characters.");
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const supabase = getSupabaseBrowser()!;
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { emailRedirectTo: `${getRedirectBase()}/login` },
      });
      if (error) throw error;
      // If email confirmation is ON, there is no session yet — user must
      // click the confirmation link (counts as 1 email, not rate-limited like OTP).
      if (!data.session) {
        setMsg("Account created — check your email to confirm, then log in.");
        setPwMode("login");
      } else if (data.user) {
        void ensureProfile(supabase, data.user as User);
        setOpen(false);
      }
      setPassword("");
      setConfirm("");
    } catch (e) {
      setMsg(friendlyAuthError(e));
    } finally {
      setBusy(false);
    }
  }

  async function loginWithPassword() {
    if (!requireConfigured()) return;
    setBusy(true);
    setMsg(null);
    try {
      const supabase = getSupabaseBrowser()!;
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw error;
      if (data.user) void ensureProfile(supabase, data.user as User);
      setPassword("");
      setConfirm("");
      setOpen(false);
    } catch (e) {
      setMsg(friendlyAuthError(e));
    } finally {
      setBusy(false);
    }
  }

  async function sendPasswordReset() {
    if (!requireConfigured()) return;
    if (!email.includes("@")) {
      setMsg("Enter your email first.");
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const supabase = getSupabaseBrowser()!;
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${getRedirectBase()}/login`,
      });
      if (error) throw error;
      setResetSent(true);
      setMsg("Reset link sent — check your email, then set a new password here.");
    } catch (e) {
      setMsg(friendlyAuthError(e));
    } finally {
      setBusy(false);
    }
  }

  async function updatePassword() {
    if (!requireConfigured()) return;
    if (newPw !== newPwConfirm) {
      setMsg("Passwords do not match.");
      return;
    }
    if (newPw.length < 6) {
      setMsg("Password must be at least 6 characters.");
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const supabase = getSupabaseBrowser()!;
      const { error } = await supabase.auth.updateUser({ password: newPw });
      if (error) throw error;
      setRecovery(false);
      setResetSent(false);
      setNewPw("");
      setNewPwConfirm("");
      setMsg(null);
      setOpen(false);
    } catch (e) {
      setMsg(friendlyAuthError(e));
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    const supabase = getSupabaseBrowser();
    if (supabase) await supabase.auth.signOut();
    setUser(null);
    emitAuth(null);
    setRecovery(false);
    setResetSent(false);
  }

  if (recovery) {
    return (
      <div className="relative">
        <div className="absolute right-0 z-20 mt-2 w-72 rounded-xl border border-zinc-200 bg-white p-3 shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs font-medium">Set a new password</p>
          <input
            value={newPw}
            onChange={(e) => setNewPw(e.target.value)}
            placeholder="New password (min 6 chars)"
            type="password"
            autoComplete="new-password"
            className="mt-2 w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-xs dark:border-zinc-700 dark:bg-black"
          />
          <input
            value={newPwConfirm}
            onChange={(e) => setNewPwConfirm(e.target.value)}
            placeholder="Confirm new password"
            type="password"
            autoComplete="new-password"
            className="mt-2 w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-xs dark:border-zinc-700 dark:bg-black"
          />
          <button
            onClick={updatePassword}
            disabled={busy || newPw.length < 6 || newPwConfirm.length < 6}
            className="mt-2 w-full rounded-full bg-black px-3 py-1.5 text-xs text-white disabled:opacity-50 dark:bg-white dark:text-black"
          >
            Save new password
          </button>
          <button
            onClick={() => { setRecovery(false); setMsg(null); }}
            className="mt-2 w-full text-center text-[11px] text-zinc-500 underline"
          >
            Cancel
          </button>
          {msg && <p className="mt-2 text-[11px] text-zinc-500">{msg}</p>}
        </div>
      </div>
    );
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
          {!configured && (
            <p className="mb-2 rounded-lg border border-dashed border-amber-300 bg-amber-50 p-2 text-[11px] leading-4 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
              Dev mode: Supabase keys missing — options stay visible but sign-in is disabled until you add{" "}
              <code>NEXT_PUBLIC_SUPABASE_URL</code> + <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> (see
              SUPABASE_SETUP.md) and restart dev. Local saves still work.
            </p>
          )}
          {/* Mode tabs — password first (no email sending), magic link fallback */}
          <div className="mb-2 flex rounded-full bg-zinc-100 p-0.5 text-[11px] dark:bg-zinc-800">
            <button
              onClick={() => { setMode("password"); setMsg(null); }}
              className={`flex-1 rounded-full px-2 py-1 ${mode === "password" ? "bg-white shadow dark:bg-black" : "text-zinc-500"}`}
            >
              Password
            </button>
            <button
              onClick={() => { setMode("magic"); setMsg(null); }}
              className={`flex-1 rounded-full px-2 py-1 ${mode === "magic" ? "bg-white shadow dark:bg-black" : "text-zinc-500"}`}
            >
              Magic link
            </button>
          </div>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@email.com"
            type="email"
            className="w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-xs dark:border-zinc-700 dark:bg-black"
          />
          {mode === "magic" ? (
            <>
              <button
                onClick={sendMagicLink}
                disabled={busy || !email.includes("@")}
                className="mt-2 w-full rounded-full border border-zinc-200 px-3 py-1.5 text-xs disabled:opacity-50 dark:border-zinc-700"
              >
                {linkSent ? "Resend magic link" : "Send magic link"}
              </button>
            </>
          ) : (
            <>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password (min 6 chars)"
                type="password"
                autoComplete={pwMode === "signup" ? "new-password" : "current-password"}
                className="mt-2 w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-xs dark:border-zinc-700 dark:bg-black"
              />
              {pwMode === "signup" && (
                <input
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Confirm password"
                  type="password"
                  autoComplete="new-password"
                  className="mt-2 w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-xs dark:border-zinc-700 dark:bg-black"
                />
              )}
              {pwMode === "login" ? (
                <>
                  <button
                    onClick={loginWithPassword}
                    disabled={busy || !email.includes("@") || password.length < 6}
                    className="mt-2 w-full rounded-full bg-black px-3 py-1.5 text-xs text-white disabled:opacity-50 dark:bg-white dark:text-black"
                  >
                    Login
                  </button>
                  <button
                    onClick={sendPasswordReset}
                    disabled={busy || !email.includes("@")}
                    className="mt-2 w-full text-center text-[11px] text-zinc-500 underline disabled:opacity-50"
                  >
                    {resetSent ? "Resend reset link" : "Forgot password?"}
                  </button>
                </>
              ) : (
                <button
                  onClick={signUpWithPassword}
                  disabled={busy || !email.includes("@") || password.length < 6 || confirm.length < 6}
                  className="mt-2 w-full rounded-full bg-black px-3 py-1.5 text-xs text-white disabled:opacity-50 dark:bg-white dark:text-black"
                >
                  Sign up
                </button>
              )}
              <button
                onClick={() => { setPwMode(pwMode === "login" ? "signup" : "login"); setMsg(null); }}
                className="mt-2 w-full text-center text-[11px] text-zinc-500 underline"
              >
                {pwMode === "login" ? "No account? Sign up" : "Have an account? Log in"}
              </button>
            </>
          )}
          {msg && <p className="mt-2 text-[11px] text-zinc-500">{msg}</p>}
        </div>
      )}
    </div>
  );
}
