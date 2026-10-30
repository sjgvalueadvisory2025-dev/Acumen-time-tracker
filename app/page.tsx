import Link from "next/link";
import { memberProjects, requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { appTimeZone, isIsoDate, parseId, todayIn } from "@/lib/validate";
import { Flash } from "@/components/Flash";
import { ConfirmButton } from "@/components/ConfirmButton";
import { addEntryAction, deleteEntryAction, updateEntryAction } from "./entries-actions";

type Entry = { id: string; project_id: number; project: string; work_date: string; hours: number; description: string };

function weekStart(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  const day = (d.getUTCDay() + 6) % 7; // Monday = 0
  d.setUTCDate(d.getUTCDate() - day);
  return d.toISOString().slice(0, 10);
}

export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string | string[]>> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const today = todayIn(appTimeZone());
  const projects = await memberProjects(user.email);
  const editId = parseId(sp.edit);

  const entries = await query<Entry>(
    `SELECT e.id, e.project_id, p.name AS project, to_char(e.work_date, 'YYYY-MM-DD') AS work_date,
            e.hours::float8 AS hours, e.description
     FROM time_entries e JOIN projects p ON p.id = e.project_id
     WHERE e.email = $1 AND e.work_date >= ($2::date - 60)
     ORDER BY e.work_date DESC, e.id DESC
     LIMIT 200`,
    [user.email, today],
  );

  const wk = weekStart(today);
  const weekTotal = entries.filter((e) => e.work_date >= wk && e.work_date <= today).reduce((s, e) => s + e.hours, 0);
  const todayTotal = entries.filter((e) => e.work_date === today).reduce((s, e) => s + e.hours, 0);
  const editing = editId ? entries.find((e) => Number(e.id) === editId) : undefined;
  const defaultDate = typeof sp.date === "string" && isIsoDate(sp.date) ? sp.date : today;

  return (
    <>
      <h1>Log time</h1>
      <Flash m={sp.m} e={sp.e} />

      <div className="stats">
        <div className="stat"><span className="stat-num">{todayTotal.toFixed(2)}</span><span>hours today</span></div>
        <div className="stat"><span className="stat-num">{weekTotal.toFixed(2)}</span><span>hours this week</span></div>
      </div>

      {projects.length === 0 ? (
        <div className="card">
          <p>You are not a member of any active project yet.</p>
          {user.isAdmin && <p><Link href="/projects">Create a project</Link> and add yourself to it to log time.</p>}
        </div>
      ) : (
        <form action={editing ? updateEntryAction : addEntryAction} className="card entry-form">
          <h2>{editing ? "Edit entry" : "New entry"}</h2>
          {editing && <input type="hidden" name="id" value={editing.id} />}
          <div className="grid">
            <label>
              Project
              <select name="project_id" required defaultValue={editing?.project_id ?? (projects.length === 1 ? projects[0].id : "")}>
                <option value="" disabled>Choose a project</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
            <label>
              Date
              <input type="date" name="work_date" required defaultValue={editing?.work_date ?? defaultDate} />
            </label>
            <label>
              Hours
              <input type="number" name="hours" required min="0.01" max="24" step="0.01" placeholder="e.g. 1.5"
                defaultValue={editing?.hours ?? ""} />
            </label>
          </div>
          <label>
            Description (optional)
            <textarea name="description" rows={2} maxLength={1000} defaultValue={editing?.description ?? ""} />
          </label>
          <div className="row">
            <button type="submit">{editing ? "Save changes" : "Add entry"}</button>
            {editing && <Link href="/" className="button secondary">Cancel</Link>}
          </div>
        </form>
      )}

      <h2>My recent entries <span className="muted small">(last 60 days)</span></h2>
      {entries.length === 0 ? (
        <p className="muted">No entries yet.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Date</th><th>Project</th><th className="num">Hours</th><th>Description</th><th></th></tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id}>
                  <td className="nowrap">{e.work_date}</td>
                  <td>{e.project}</td>
                  <td className="num">{e.hours.toFixed(2)}</td>
                  <td className="desc">{e.description}</td>
                  <td className="actions">
                    {projects.some((p) => p.id === e.project_id) && <Link href={`/?edit=${e.id}`}>Edit</Link>}
                    <form action={deleteEntryAction}>
                      <input type="hidden" name="id" value={e.id} />
                      <ConfirmButton message="Delete this entry?" className="link-button danger">Delete</ConfirmButton>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
