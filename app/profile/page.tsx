import Link from "next/link";
import { memberProjects, requireUser } from "@/lib/auth";
import { Flash } from "@/components/Flash";
import { saveDetailsAction } from "./actions";

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[]>>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const projects = await memberProjects(user.email);

  return (
    <>
      <h1>Your details</h1>
      <Flash m={sp.m} e={sp.e} />

      <div className="card">
        <form action={saveDetailsAction} className="stack">
          <label>
            Your name
            <input
              type="text"
              name="name"
              defaultValue={user.name}
              required
              maxLength={100}
              autoComplete="name"
              placeholder="Jill Shah"
            />
          </label>
          <p className="muted small">
            This is the name shown against your hours in reports and CSV downloads.
          </p>
          <div className="row">
            <button type="submit">Save</button>
          </div>
        </form>
      </div>

      <div className="card">
        <h2>Sign-in email</h2>
        <p>
          {user.email} {user.isAdmin && <span className="badge ok">Admin</span>}
        </p>
        <p className="muted small">
          Your email is how you sign in, so only an admin can change it. Ask an admin to add your new
          address to your projects and remove the old one.
        </p>
      </div>

      <div className="card">
        <h2>Projects you can log hours to</h2>
        {projects.length === 0 ? (
          <p className="muted">
            You are not on any active project yet. Ask an admin to add you to one.
          </p>
        ) : (
          <ul>
            {projects.map((p) => (
              <li key={p.id}>{p.name}</li>
            ))}
          </ul>
        )}
        <p className="small">
          <Link href="/">Log time</Link> · <Link href="/reports">Your report</Link>
        </p>
      </div>
    </>
  );
}
