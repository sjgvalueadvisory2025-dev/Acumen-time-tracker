"use server";

import { redirect } from "next/navigation";
import { isProjectMember, requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { isIsoDate, parseHours, parseId, str } from "@/lib/validate";

function readEntry(formData: FormData) {
  const projectId = parseId(formData.get("project_id"));
  const date = formData.get("work_date");
  const hours = parseHours(formData.get("hours"));
  const task = str(formData.get("task"), 200);
  const description = str(formData.get("description"), 2000);
  if (!projectId || !task || !isIsoDate(date) || hours === null) return null;
  return { projectId, date, hours, task, description };
}

export async function addEntryAction(formData: FormData) {
  const user = await requireUser();
  const entry = readEntry(formData);
  if (!entry) redirect("/?e=bad_entry");
  if (!(await isProjectMember(user.email, entry.projectId))) redirect("/?e=not_member");

  await query(
    `INSERT INTO time_entries (project_id, email, work_date, hours, task, description)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [entry.projectId, user.email, entry.date, entry.hours, entry.task, entry.description],
  );
  redirect("/?m=entry_added");
}

export async function updateEntryAction(formData: FormData) {
  const user = await requireUser();
  const id = parseId(formData.get("id"));
  const entry = readEntry(formData);
  if (!id || !entry) redirect("/?e=bad_entry");
  if (!(await isProjectMember(user.email, entry.projectId))) redirect("/?e=not_member");

  // People can only edit their own entries.
  const rows = await query(
    `UPDATE time_entries
     SET project_id = $3, work_date = $4, hours = $5, task = $6, description = $7, updated_at = now()
     WHERE id = $1 AND email = $2 RETURNING id`,
    [id, user.email, entry.projectId, entry.date, entry.hours, entry.task, entry.description],
  );
  redirect(rows.length ? "/?m=entry_updated" : "/?e=not_found");
}

export async function deleteEntryAction(formData: FormData) {
  const user = await requireUser();
  const id = parseId(formData.get("id"));
  if (!id) redirect("/?e=not_found");
  const rows = await query(`DELETE FROM time_entries WHERE id = $1 AND email = $2 RETURNING id`, [id, user.email]);
  redirect(rows.length ? "/?m=entry_deleted" : "/?e=not_found");
}
