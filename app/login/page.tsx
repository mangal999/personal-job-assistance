import Link from "next/link";
import AuthButton from "@/components/AuthButton";

export const metadata = { title: "Login — Personal Job Assistance" };

export default function LoginPage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-4">
      <h1 className="text-xl font-bold">Login</h1>
      <p className="mt-1 text-center text-xs text-zinc-500">
        Google OAuth or email code via Supabase (free). After login you get cloud-saved jobs, resume sync
        and ATS history. Without Supabase keys the app still works with localStorage.
      </p>
      <div className="mt-4">
        <AuthButton />
      </div>
      <ol className="mt-6 list-decimal space-y-1 pl-5 text-xs text-zinc-500">
        <li>
          Create a free Supabase project — easiest via <b>Vercel Marketplace → Supabase</b> (see
          SUPABASE_SETUP.md).
        </li>
        <li>
          Run <code>supabase/schema.sql</code> in the Supabase SQL editor.
        </li>
        <li>
          Enable <b>Auth → Google provider</b> + add your Vercel URL to redirect allowlist.
        </li>
      </ol>
      <Link href="/" className="mt-6 text-xs underline">
        ← Back to jobs
      </Link>
    </div>
  );
}
