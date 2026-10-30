// Fixed messages referenced by short codes in the URL (?m=... / ?e=...), so no
// arbitrary text from the query string is ever shown on a page.
const MESSAGES: Record<string, string> = {
  bad_email: "Please enter a valid email address.",
  no_access: "This email does not have access. Ask your admin to add you to a project.",
  entry_added: "Time entry saved.",
  entry_updated: "Time entry updated.",
  entry_deleted: "Time entry deleted.",
  bad_entry: "Please choose a project, enter a task, a valid date and hours between 0.01 and 24.",
  not_member: "You are not a member of that project.",
  project_created: "Project created.",
  project_updated: "Project updated.",
  project_deleted: "Project deleted.",
  bad_project: "Please enter a project name.",
  members_added: "Members added.",
  member_removed: "Member removed.",
  invalid_emails: "Some email addresses were invalid and were skipped.",
  no_emails: "Please enter at least one valid email address.",
  confirm_delete: "Type the project name exactly to confirm deletion.",
  details_saved: "Your details were saved.",
  bad_name: "Please enter your name (up to 100 characters).",
  not_found: "Not found.",
};

export function message(code: string | string[] | undefined): string | null {
  if (typeof code !== "string") return null;
  return MESSAGES[code] ?? null;
}
