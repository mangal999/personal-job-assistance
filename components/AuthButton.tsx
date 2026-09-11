"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowser, isSupabaseConfigured } from "@/lib/supabase";

export const PJA_AUTH_EVENT = "pja-auth";

export function emitAuth(user: User | null) {
  window.dispatchEvent(new CustomEvent<User | null>(PJA_AUTH_EVENT, { detail: user }));
}

/** Header auth widget. Works without Supabase (shows setup hint). */
export default function AuthButton() {
  const [configured] = useState(() => isSupabaseConfigured());
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!configured) return;
    const supabase = getSupabaseBrowser();
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      emitAuth(data.session?.user ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      setUser(session?.user ?? null);
      emitAuth(session?.user ?? null);
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

  async function google() {
    setBusy(true);
    setMsg(null);
    try {
      const supabase = getSupabaseBrowser()!;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/login` },
      });
      if (error) throw error;
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function sendOtp() {
    setBusy(true);
    setMsg(null);
    try {
      const supabase = getSupabaseBrowser()!;
      const { error } = await supabase.auth.signInWithOtp({ email: email.trim() });
      if (error) throw error;
      setOtpSent(true);
      setMsg("Check your email for the 6-digit code.");
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function verifyOtp() {
    setBusy(true);
    setMsg(null);
    try {
      const supabase = getSupabaseBrowser()!;
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: otp.trim(),
        type: "email",
      });
      if (error) throw error;
      setOpen(false);
    } catch (e) {
      setMsg((e as Error).message);
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
          <button
            onClick={google}
            disabled={busy}
            className="w-full rounded-full bg-black px-3 py-2 text-xs font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
          >
            Continue with Google
          </button>
          <div className="my-2 text-center text-[11px] text-zinc-400">or email code</div>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@email.com"
            type="email"
            className="w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-xs dark:border-zinc-700 dark:bg-black"
          />
          {!otpSent ? (
            <button
              onClick={sendOtp}
              disabled={busy || !email.includes("@")}
              className="mt-2 w-full rounded-full border border-zinc-200 px-3 py-1.5 text-xs disabled:opacity-50 dark:border-zinc-700"
            >
              Send code
            </button>
          ) : (
            <>
              <input
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="6-digit code"
                inputMode="numeric"
                className="mt-2 w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-xs dark:border-zinc-700 dark:bg-black"
              />
              <button
                onClick={verifyOtp}
                disabled={busy || otp.trim().length < 6}
                className="mt-2 w-full rounded-full bg-black px-3 py-1.5 text-xs text-white disabled:opacity-50 dark:bg-white dark:text-black"
              >
                Verify & login
              </button>
            </>
          )}
          {msg && <p className="mt-2 text-[11px] text-zinc-500">{msg}</p>}
        </div>
      )}
    </div>
  );
}
