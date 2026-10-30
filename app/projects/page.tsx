import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { query } from "@/lib/db";
import { Flash } from "@/components/Flash";
import { createProjectAction } from "./actions";

type ProjectRow = { id: number; name: string; archived: boolean; members: number; hours: number };

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[]>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const projects = await query<ProjectRow>(
    `SELECT p.id, p.name, p.archived,
            (SELECT count(*)::int FROM project_members m WHERE m.project_id = p.id) AS members,
            COALESCE((SELECT sum(hours)::float8 FROM time_entries e WHERE e.project_id = p.id), 0) AS hours
     FROM projects p ORDER BY p.archived, p.name`,
  );

  return (
    <>
      <h1>Projects</h1>
      <Flash m={sp.m} e={sp.e} />

      <form action={createProjectAction} className="card stack">
        <h2>Create a project</h2>
        <label>
          Project name
          <input name="name" required maxLength={200} />
        </label>
        <label>
          Description (optional)
          <textarea name="description" rows={2} maxLength={2000} />
        </label>
        <label>
          People who can log hours (email addresses)
          <textarea name="emails" rows={4} placeholder={"alice@company.com\nbob@company.com"} />
          <span className="muted small">One per line, or separated by commas. Only these emails will be able to sign in and charge hours to this project.</span>
        </label>
        <label className="checkbox">
          <input type="checkbox" name="add_me" defaultChecked /> Add me as a member too
        </label>
        <div><button type="submit">Create project</button></div>
      </form>

      <h2>All projects</h2>
      {projects.length === 0 ? (
        <p className="muted">No projects yet.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Name</th><th className="num">Members</th><th className="num">Total hours</th><th>Status</th></tr></thead>
            <tbody>
              {projects.map((p) => (
                <tr key={p.id}>
                  <td><Link href={`/projects/${p.id}`}>{p.name}</Link></td>
                  <td className="num">{p.members}</td>
                  <td className="num">{p.hours.toFixed(2)}</td>
                  <td>{p.archived ? <span className="badge">Archived</span> : <span className="badge ok">Active</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
