const EMAIL_RE = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;

/** Lower-cases and trims an email; returns null if it is not a valid address. */
export function normalizeEmail(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const email = input.trim().toLowerCase();
  if (email.length > 254 || !EMAIL_RE.test(email)) return null;
  return email;
}

/** Splits a free-form list (commas, semicolons, spaces, new lines) into unique valid emails. */
export function parseEmailList(input: unknown): { valid: string[]; invalid: string[] } {
  if (typeof input !== "string") return { valid: [], invalid: [] };
  const valid = new Set<string>();
  const invalid: string[] = [];
  for (const part of input.split(/[\s,;]+/)) {
    if (!part) continue;
    const email = normalizeEmail(part);
    if (email) valid.add(email);
    else invalid.push(part.slice(0, 100));
  }
  return { valid: [...valid], invalid };
}

export function str(input: unknown, maxLen: number): string {
  return typeof input === "string" ? input.trim().slice(0, maxLen) : "";
}

export function isIsoDate(input: unknown): input is string {
  if (typeof input !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(input)) return false;
  const d = new Date(input + "T00:00:00Z");
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(input);
}

export function parseId(input: unknown): number | null {
  const s = typeof input === "string" ? input : String(input ?? "");
  if (!/^\d{1,10}$/.test(s)) return null;
  const n = Number(s);
  return n > 0 && n <= 2147483647 ? n : null;
}

/** Hours between 0.25 and 24, rounded to 2 decimals. */
export function parseHours(input: unknown): number | null {
  if (typeof input !== "string" || !/^\d{1,2}(\.\d{1,2})?$/.test(input.trim())) return null;
  const n = Math.round(Number(input) * 100) / 100;
  return n > 0 && n <= 24 ? n : null;
}

export function todayIn(timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

export function appTimeZone() {
  return process.env.APP_TIMEZONE || "UTC";
}
