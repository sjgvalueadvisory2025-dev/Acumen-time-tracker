import "server-only";
import { createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { query } from "./db";
import { sendLoginCode } from "./email";

const SESSION_DAYS = 30;
const CODE_TTL_MINUTES = 10;
const MAX_CODE_ATTEMPTS = 5;

const isProd = process.env.NODE_ENV === "production";
export const SESSION_COOKIE = isProd ? "__Host-tt_session" : "tt_session";
export const PENDING_COOKIE = isProd ? "__Host-tt_pending" : "tt_pending";

export type User = { email: string; isAdmin: boolean };

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) {
    throw new Error("AUTH_SECRET must be set to a random string of at least 32 characters");
  }
  return s;
}

function hmac(value: string): string {
  return createHmac("sha256", secret()).update(value).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
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

/**
 * Sends a one-time sign-in code if the email is allowed and not rate limited.
 * Always resolves the same way so callers cannot learn which emails exist.
 */
export async function requestLoginCode(email: string): Promise<void> {
  // Opportunistic cleanup of stale rows.
  await query(`DELETE FROM login_codes WHERE expires_at < now() - interval '1 day'`);
  await query(`DELETE FROM sessions WHERE expires_at < now()`);

  if (!(await isAllowed(email))) return;

  const [recent] = await query<{ last15: number; last24h: number }>(
    `SELECT count(*) FILTER (WHERE created_at > now() - interval '15 minutes')::int AS last15,
            count(*)::int AS last24h
     FROM login_codes WHERE email = $1 AND created_at > now() - interval '24 hours'`,
    [email],
  );
  if (recent.last15 >= 3 || recent.last24h >= 15) return;

  const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
  // Any older unused code stops working once a new one is issued.
  await query(`UPDATE login_codes SET used = TRUE WHERE email = $1 AND NOT used`, [email]);
  await query(
    `INSERT INTO login_codes (email, code_hash, expires_at)
     VALUES ($1, $2, now() + make_interval(mins => $3))`,
    [email, hmac(`code:${email}:${code}`), CODE_TTL_MINUTES],
  );
  await sendLoginCode(email, code);
}

/** Checks a code; on success creates a session cookie. */
export async function verifyLoginCode(email: string, code: string): Promise<boolean> {
  if (!/^\d{6}$/.test(code)) return false;

  // Count the attempt atomically before comparing, so parallel guesses can't exceed the limit.
  const [row] = await query<{ id: string; code_hash: string }>(
    `UPDATE login_codes SET attempts = attempts + 1
     WHERE id = (SELECT id FROM login_codes
                 WHERE email = $1 AND NOT used AND expires_at > now()
                 ORDER BY created_at DESC LIMIT 1)
       AND attempts < $2
     RETURNING id, code_hash`,
    [email, MAX_CODE_ATTEMPTS],
  );
  if (!row || !safeEqual(row.code_hash, hmac(`code:${email}:${code}`))) return false;

  const claimed = await query(
    `UPDATE login_codes SET used = TRUE WHERE id = $1 AND NOT used RETURNING id`,
    [row.id],
  );
  if (claimed.length === 0 || !(await isAllowed(email))) return false;

  const token = randomBytes(32).toString("base64url");
  await query(
    `INSERT INTO sessions (token_hash, email, expires_at)
     VALUES ($1, $2, now() + make_interval(days => $3))`,
    [hmac(`session:${token}`), email, SESSION_DAYS],
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
    [hmac(`session:${token}`)],
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
  if (token) await query(`DELETE FROM sessions WHERE token_hash = $1`, [hmac(`session:${token}`)]);
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
