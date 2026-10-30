"use server";

import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { query } from "@/lib/db";
import { parseEmailList, parseId, str } from "@/lib/validate";

async function addMembers(projectId: number, emails: string[]) {
  if (emails.length === 0) return;
  await query(
    `INSERT INTO project_members (project_id, email)
     SELECT $1, unnest($2::text[]) ON CONFLICT DO NOTHING`,
    [projectId, emails],
  );
}

export async function createProjectAction(formData: FormData) {
  const admin = await requireAdmin();
  const name = str(formData.get("name"), 200);
  const description = str(formData.get("description"), 2000);
  if (!name) redirect("/projects?e=bad_project");

  const { valid, invalid } = parseEmailList(formData.get("emails"));
  if (formData.get("add_me") === "on" && !valid.includes(admin.email)) valid.push(admin.email);
  if (valid.length === 0) redirect("/projects?e=no_emails");

  const [project] = await query<{ id: number }>(
    `INSERT INTO projects (name, description, created_by) VALUES ($1, $2, $3) RETURNING id`,
    [name, description, admin.email],
  );
  await addMembers(project.id, valid);
  redirect(`/projects/${project.id}?m=project_created${invalid.length ? "&e=invalid_emails" : ""}`);
}

export async function updateProjectAction(formData: FormData) {
  await requireAdmin();
  const id = parseId(formData.get("id"));
  const name = str(formData.get("name"), 200);
  const description = str(formData.get("description"), 2000);
  if (!id) redirect("/projects?e=not_found");
  if (!name) redirect(`/projects/${id}?e=bad_project`);
  await query(`UPDATE projects SET name = $2, description = $3 WHERE id = $1`, [id, name, description]);
  redirect(`/projects/${id}?m=project_updated`);
}

export async function setArchivedAction(formData: FormData) {
  await requireAdmin();
  const id = parseId(formData.get("id"));
  if (!id) redirect("/projects?e=not_found");
  const archived = formData.get("archived") === "true";
  await query(`UPDATE projects SET archived = $2 WHERE id = $1`, [id, archived]);
  redirect(`/projects/${id}?m=project_updated`);
}

export async function deleteProjectAction(formData: FormData) {
  await requireAdmin();
  const id = parseId(formData.get("id"));
  if (!id) redirect("/projects?e=not_found");
  const confirmName = str(formData.get("confirm_name"), 200);
  const rows = await query(`DELETE FROM projects WHERE id = $1 AND name = $2 RETURNING id`, [id, confirmName]);
  redirect(rows.length ? "/projects?m=project_deleted" : `/projects/${id}?e=confirm_delete`);
}

export async function addMembersAction(formData: FormData) {
  await requireAdmin();
  const id = parseId(formData.get("id"));
  if (!id) redirect("/projects?e=not_found");
  const { valid, invalid } = parseEmailList(formData.get("emails"));
  if (valid.length === 0) redirect(`/projects/${id}?e=no_emails`);
  await addMembers(id, valid);
  redirect(`/projects/${id}?m=members_added${invalid.length ? "&e=invalid_emails" : ""}`);
}

export async function removeMemberAction(formData: FormData) {
  await requireAdmin();
  const id = parseId(formData.get("id"));
  const email = str(formData.get("email"), 254).toLowerCase();
  if (!id) redirect("/projects?e=not_found");
  // Their past time entries are kept for reporting; they just can't log new time.
  await query(`DELETE FROM project_members WHERE project_id = $1 AND email = $2`, [id, email]);
  redirect(`/projects/${id}?m=member_removed`);
}
