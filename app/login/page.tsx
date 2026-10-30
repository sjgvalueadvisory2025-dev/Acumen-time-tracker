import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { Flash } from "@/components/Flash";
import { requestCodeAction } from "./actions";

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[]>> }) {
  if (await getCurrentUser()) redirect("/");
  const sp = await searchParams;
  return (
    <div className="auth-card">
      <h1>Sign in</h1>
      <p className="muted">Enter your work email. We will email you a one-time code.</p>
      <Flash m={sp.m} e={sp.e} />
      <form action={requestCodeAction} className="stack">
        <label>
          Email
          <input type="email" name="email" required autoComplete="email" autoFocus maxLength={254} />
        </label>
        <button type="submit">Send code</button>
      </form>
    </div>
  );
}
