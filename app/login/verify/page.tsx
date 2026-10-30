import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PENDING_COOKIE, getCurrentUser } from "@/lib/auth";
import { Flash } from "@/components/Flash";
import { verifyCodeAction } from "../actions";

export default async function VerifyPage({ searchParams }: { searchParams: Promise<Record<string, string | string[]>> }) {
  if (await getCurrentUser()) redirect("/");
  const email = (await cookies()).get(PENDING_COOKIE)?.value;
  if (!email) redirect("/login?e=no_pending");
  const sp = await searchParams;
  return (
    <div className="auth-card">
      <h1>Enter your code</h1>
      <p className="muted">Sent to <strong>{email}</strong></p>
      <Flash m={sp.m} e={sp.e} />
      <form action={verifyCodeAction} className="stack">
        <label>
          6-digit code
          <input
            name="code"
            required
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            maxLength={6}
            autoFocus
            className="code-input"
          />
        </label>
        <button type="submit">Sign in</button>
      </form>
      <p className="muted small"><Link href="/login">Use a different email or resend the code</Link></p>
    </div>
  );
}
