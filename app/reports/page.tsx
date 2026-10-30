import Link from "next/link";
import { memberProjects, requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { parseFilters, reportRows, reportSummary, type ReportFilters } from "@/lib/reports";
import { appTimeZone, todayIn } from "@/lib/validate";

const DISPLAY_LIMIT = 500;

function addDays(iso: string, days: number) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function presets(today: string) {
  const monthStart = today.slice(0, 8) + "01";
  const lastMonthEnd = addDays(monthStart, -1);
  const weekStart = addDays(today, -((new Date(today + "T00:00:00Z").getUTCDay() + 6) % 7));
  return [
    { label: "This week", from: weekStart, to: today },
    { label: "Last week", from: addDays(weekStart, -7), to: addDays(weekStart, -1) },
    { label: "This month", from: monthStart, to: today },
    { label: "Last month", from: lastMonthEnd.slice(0, 8) + "01", to: lastMonthEnd },
    { label: "All time", from: "1900-01-01", to: "9999-12-31" },
  ];
}

function qs(f: ReportFilters, extra: Record<string, string> = {}) {
  const p = new URLSearchParams({ from: f.from, to: f.to, ...extra });
  if (f.projectId) p.set("project", String(f.projectId));
  if (f.email) p.set("person", f.email);
  return p.toString();
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[]>> }) {
  const user = await requireUser();
  const f = parseFilters(user, await searchParams);
  const today = todayIn(appTimeZone());

  const projects = user.isAdmin
    ? await query<{ id: number; name: string }>(`SELECT id, name FROM projects ORDER BY archived, name`)
    : await memberProjects(user.email);
  const people = user.isAdmin
    ? await query<{ email: string }>(
        `SELECT email FROM project_members UNION SELECT email FROM time_entries ORDER BY email`,
      )
    : [];

  const [summary, rows] = await Promise.all([reportSummary(f), reportRows(f, DISPLAY_LIMIT + 1)]);
  const total = summary.reduce((s, r) => s + r.hours, 0);
  const byPerson = new Map<string, number>();
  for (const r of summary) byPerson.set(r.email, (byPerson.get(r.email) ?? 0) + r.hours);
  const byProject = new Map<string, number>();
  for (const r of summary) byProject.set(r.project, (byProject.get(r.project) ?? 0) + r.hours);
  const allTime = f.from === "1900-01-01";

  return (
    <>
      <h1>{user.isAdmin ? "Time reports" : "My time report"}</h1>

      <form className="card filters" method="get">
        <div className="grid">
          <label>
            Project
            <select name="project" defaultValue={f.projectId ?? ""}>
              <option value="">All projects</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          {user.isAdmin && (
            <label>
              Person
              <select name="person" defaultValue={f.email ?? ""}>
                <option value="">Everyone</option>
                {people.map((p) => <option key={p.email} value={p.email}>{p.email}</option>)}
              </select>
            </label>
          )}
          <label>
            From
            <input type="date" name="from" defaultValue={allTime ? "" : f.from} required />
          </label>
          <label>
            To
            <input type="date" name="to" defaultValue={allTime ? "" : f.to} required />
          </label>
        </div>
        <div className="row wrap">
          <button type="submit">Show report</button>
          {presets(today).map((p) => (
            <Link key={p.label} className="chip" href={`/reports?${qs({ ...f, from: p.from, to: p.to })}`}>{p.label}</Link>
          ))}
        </div>
      </form>

      <div className="row wrap">
        <a className="button" href={`/api/report?${qs(f)}`}>Download detailed CSV</a>
        <a className="button secondary" href={`/api/report?${qs(f, { type: "summary" })}`}>Download summary CSV</a>
      </div>

      <div className="stats">
        <div className="stat"><span className="stat-num">{total.toFixed(2)}</span><span>total hours</span></div>
        <div className="stat"><span className="stat-num">{byPerson.size}</span><span>{byPerson.size === 1 ? "person" : "people"}</span></div>
        <div className="stat"><span className="stat-num">{byProject.size}</span><span>{byProject.size === 1 ? "project" : "projects"}</span></div>
      </div>
      <p className="muted small">{allTime ? "All time" : `${f.from} to ${f.to}`}</p>

      {summary.length > 0 && (
        <>
          <h2>Summary</h2>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Project</th><th>Person</th><th className="num">Entries</th><th className="num">Hours</th></tr></thead>
              <tbody>
                {summary.map((r) => (
                  <tr key={r.project + r.email}>
                    <td>{r.project}</td><td>{r.email}</td><td className="num">{r.entries}</td><td className="num">{r.hours.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr><th colSpan={3}>Total</th><th className="num">{total.toFixed(2)}</th></tr></tfoot>
            </table>
          </div>
        </>
      )}

      <h2>Entries</h2>
      {rows.length === 0 ? (
        <p className="muted">No time logged for these filters.</p>
      ) : (
        <>
          {rows.length > DISPLAY_LIMIT && (
            <p className="muted small">Showing the first {DISPLAY_LIMIT} entries. Download the CSV for the full list.</p>
          )}
          <div className="table-wrap">
            <table>
              <thead><tr><th>Date</th><th>Project</th><th>Person</th><th>Task</th><th className="num">Hours</th><th>Work done</th></tr></thead>
              <tbody>
                {rows.slice(0, DISPLAY_LIMIT).map((r, i) => (
                  <tr key={i}>
                    <td className="nowrap">{r.work_date}</td><td>{r.project}</td><td>{r.email}</td><td>{r.task}</td>
                    <td className="num">{r.hours.toFixed(2)}</td><td className="desc">{r.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
