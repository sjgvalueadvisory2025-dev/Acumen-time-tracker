import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { query } from "@/lib/db";
import { parseId } from "@/lib/validate";
import { Flash } from "@/components/Flash";
import { ConfirmButton } from "@/components/ConfirmButton";
import {
  addMembersAction,
  deleteProjectAction,
  removeMemberAction,
  setArchivedAction,
  updateProjectAction,
} from "../actions";

type Project = { id: number; name: string; description: string; archived: boolean; created_by: string; created: string };
type Member = { email: string; hours: number; last_entry: string | null; is_member: boolean };

export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[]>>;
}) {
  await requireAdmin();
  const id = parseId((await params).id);
  if (!id) notFound();
  const sp = await searchParams;

  const [project] = await query<Project>(
    `SELECT id, name, description, archived, created_by, to_char(created_at, 'YYYY-MM-DD') AS created
     FROM projects WHERE id = $1`,
    [id],
  );
  if (!project) notFound();

  // Current members plus anyone who logged time before being removed.
  const people = await query<Member>(
    `SELECT x.email,
            COALESCE(sum(e.hours), 0)::float8 AS hours,
            to_char(max(e.work_date), 'YYYY-MM-DD') AS last_entry,
            bool_or(x.is_member) AS is_member
     FROM (
       SELECT email, TRUE AS is_member FROM project_members WHERE project_id = $1
       UNION SELECT DISTINCT email, FALSE FROM time_entries WHERE project_id = $1
     ) x
     LEFT JOIN time_entries e ON e.project_id = $1 AND e.email = x.email
     GROUP BY x.email
     ORDER BY bool_or(x.is_member) DESC, x.email`,
    [id],
  );
  const total = people.reduce((s, p) => s + p.hours, 0);

  return (
    <>
      <p className="small"><Link href="/projects">← All projects</Link></p>
      <h1>
        {project.name} {project.archived && <span className="badge">Archived</span>}
      </h1>
      <p className="muted small">Created {project.created} by {project.created_by} · {total.toFixed(2)} hours logged</p>
      <Flash m={sp.m} e={sp.e} />

      <div className="row wrap">
        <Link className="button secondary" href={`/reports?project=${project.id}`}>View report</Link>
        <a className="button secondary" href={`/api/report?project=${project.id}`}>Download CSV (all time)</a>
      </div>

      <section className="card">
        <h2>Members</h2>
        <form action={addMembersAction} className="stack">
          <input type="hidden" name="id" value={project.id} />
          <label>
            Add people (email addresses)
            <textarea name="emails" rows={3} placeholder={"carol@company.com, dave@company.com"} />
          </label>
          <div><button type="submit">Add members</button></div>
        </form>

        <div className="table-wrap">
          <table>
            <thead><tr><th>Email</th><th className="num">Hours</th><th>Last entry</th><th></th></tr></thead>
            <tbody>
              {people.map((m) => (
                <tr key={m.email}>
                  <td>{m.email} {!m.is_member && <span className="badge">Removed</span>}</td>
                  <td className="num">{m.hours.toFixed(2)}</td>
                  <td>{m.last_entry ?? "—"}</td>
                  <td className="actions">
                    {m.is_member && (
                      <form action={removeMemberAction}>
                        <input type="hidden" name="id" value={project.id} />
                        <input type="hidden" name="email" value={m.email} />
                        <ConfirmButton message={`Remove ${m.email} from this project? Their logged hours are kept.`} className="link-button danger">
                          Remove
                        </ConfirmButton>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
              {people.length === 0 && <tr><td colSpan={4} className="muted">No members yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <h2>Details</h2>
        <form action={updateProjectAction} className="stack">
          <input type="hidden" name="id" value={project.id} />
          <label>
            Name
            <input name="name" required maxLength={200} defaultValue={project.name} />
          </label>
          <label>
            Description
            <textarea name="description" rows={2} maxLength={2000} defaultValue={project.description} />
          </label>
          <div><button type="submit">Save</button></div>
        </form>
      </section>

      <section className="card danger-zone">
        <h2>Archive or delete</h2>
        <form action={setArchivedAction} className="stack">
          <input type="hidden" name="id" value={project.id} />
          <input type="hidden" name="archived" value={project.archived ? "false" : "true"} />
          <p className="muted small">
            {project.archived
              ? "Unarchiving lets members log time to this project again."
              : "Archiving stops new time being logged. Existing hours stay in reports."}
          </p>
          <div><button type="submit" className="secondary">{project.archived ? "Unarchive project" : "Archive project"}</button></div>
        </form>
        <hr />
        <form action={deleteProjectAction} className="stack">
          <input type="hidden" name="id" value={project.id} />
          <label>
            To permanently delete this project and all its time entries, type its name:
            <input name="confirm_name" autoComplete="off" maxLength={200} />
          </label>
          <div><button type="submit" className="danger">Delete project</button></div>
        </form>
      </section>
    </>
  );
}
