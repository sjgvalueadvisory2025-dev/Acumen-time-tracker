import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { query } from "./db";

const SESSION_DAYS = 30;

const isProd = process.env.NODE_ENV === "production";
export const SESSION_COOKIE = isProd ? "__Host-tt_session" : "tt_session";

export type User = { email: string; isAdmin: boolean };

function hash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS || "")
    .split(/[\s,;]+/)
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string): boolean {
  return adminEmails().includes(email);
}

/** Only admins and people added to at least one active project may sign in. */
async function isAllowed(email: string): Promise<boolean> {
  if (isAdminEmail(email)) return true;
  const rows = await query(
    `SELECT 1 FROM project_members m JOIN projects p ON p.id = m.project_id
     WHERE m.email = $1 AND NOT p.archived LIMIT 1`,
    [email],
  );
  return rows.length > 0;
}

/** Signs in with just an email address, if that email has access. */
export async function signIn(email: string): Promise<boolean> {
  await query(`DELETE FROM sessions WHERE expires_at < now()`);
  if (!(await isAllowed(email))) return false;

  const token = randomBytes(32).toString("base64url");
  await query(
    `INSERT INTO sessions (token_hash, email, expires_at)
     VALUES ($1, $2, now() + make_interval(days => $3))`,
    [hash(token), email, SESSION_DAYS],
  );
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
  return true;
}

export const getCurrentUser = cache(async (): Promise<User | null> => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token || token.length > 100) return null;

  const [row] = await query<{ email: string }>(
    `SELECT email FROM sessions WHERE token_hash = $1 AND expires_at > now()`,
    [hash(token)],
  );
  if (!row) return null;
  // Access is re-checked on every request, so removing someone takes effect immediately.
  if (!(await isAllowed(row.email))) return null;
  return { email: row.email, isAdmin: isAdminEmail(row.email) };
});

export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin(): Promise<User> {
  const user = await requireUser();
  if (!user.isAdmin) redirect("/");
  return user;
}

export async function signOut(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await query(`DELETE FROM sessions WHERE token_hash = $1`, [hash(token)]);
  jar.delete(SESSION_COOKIE);
}

/** Projects the user can charge hours to (active projects they are a member of). */
export async function memberProjects(email: string) {
  return query<{ id: number; name: string }>(
    `SELECT p.id, p.name FROM projects p
     JOIN project_members m ON m.project_id = p.id
     WHERE m.email = $1 AND NOT p.archived
     ORDER BY p.name`,
    [email],
  );
}

export async function isProjectMember(email: string, projectId: number): Promise<boolean> {
  const rows = await query(
    `SELECT 1 FROM project_members m JOIN projects p ON p.id = m.project_id
     WHERE m.email = $1 AND m.project_id = $2 AND NOT p.archived`,
    [email, projectId],
  );
  return rows.length > 0;
}
