import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { Flash } from "@/components/Flash";
import { signInAction } from "./actions";

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[]>> }) {
  if (await getCurrentUser()) redirect("/");
  const sp = await searchParams;
  return (
    <div className="auth-card">
      <h1>Sign in</h1>
      <p className="muted">Enter the email address you were added with.</p>
      <Flash m={sp.m} e={sp.e} />
      <form action={signInAction} className="stack">
        <label>
          Email
          <input type="email" name="email" required autoComplete="email" autoFocus maxLength={254} />
        </label>
        <button type="submit">Sign in</button>
      </form>
    </div>
  );
}
