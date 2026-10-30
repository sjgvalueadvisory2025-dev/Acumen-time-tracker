import "server-only";
import { query } from "./db";
import type { User } from "./auth";
import { appTimeZone, isIsoDate, normalizeEmail, parseId, todayIn } from "./validate";

export type ReportFilters = { projectId: number | null; email: string | null; from: string; to: string };
export type ReportRow = {
  work_date: string;
  project: string;
  person: string;
  email: string;
  hours: number;
  task: string;
  description: string;
};

type Params = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Reads report filters from query params. Non-admins are always limited to their own hours. */
export function parseFilters(user: User, params: Params): ReportFilters {
  const today = todayIn(appTimeZone());
  const from = first(params.from);
  const to = first(params.to);
  const all = first(params.range) === "all";
  return {
    projectId: parseId(first(params.project)),
    email: user.isAdmin ? normalizeEmail(first(params.person)) : user.email,
    from: isIsoDate(from) ? from : all ? "1900-01-01" : today.slice(0, 8) + "01",
    to: isIsoDate(to) ? to : all ? "9999-12-31" : today,
  };
}

const WHERE = `
  WHERE e.work_date BETWEEN $1::date AND $2::date
    AND ($3::int IS NULL OR e.project_id = $3::int)
    AND ($4::text IS NULL OR e.email = $4::text)`;

function args(f: ReportFilters) {
  return [f.from, f.to, f.projectId, f.email];
}

export async function reportRows(f: ReportFilters, limit = 100000) {
  return query<ReportRow>(
    `SELECT to_char(e.work_date, 'YYYY-MM-DD') AS work_date, p.name AS project, e.email,
            COALESCE(NULLIF(pe.name, ''), e.email) AS person,
            e.hours::float8 AS hours, e.task, e.description
     FROM time_entries e JOIN projects p ON p.id = e.project_id
     LEFT JOIN people pe ON pe.email = e.email
     ${WHERE}
     ORDER BY e.work_date, p.name, e.email, e.id
     LIMIT ${Math.floor(limit)}`,
    args(f),
  );
}

export async function reportSummary(f: ReportFilters) {
  return query<{ project: string; person: string; email: string; hours: number; entries: number }>(
    `SELECT p.name AS project, e.email,
            COALESCE(NULLIF(pe.name, ''), e.email) AS person,
            sum(e.hours)::float8 AS hours, count(*)::int AS entries
     FROM time_entries e JOIN projects p ON p.id = e.project_id
     LEFT JOIN people pe ON pe.email = e.email
     ${WHERE}
     GROUP BY p.name, e.email, pe.name
     ORDER BY p.name, person`,
    args(f),
  );
}

/** Escapes a CSV cell and neutralises spreadsheet formula injection. */
export function csvCell(value: string | number): string {
  let s = String(value);
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
