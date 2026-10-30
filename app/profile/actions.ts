"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser, saveMyName } from "@/lib/auth";
import { str } from "@/lib/validate";

export async function saveDetailsAction(formData: FormData) {
  const user = await requireUser();
  const name = str(formData.get("name"), 100);
  if (!name) redirect("/profile?e=bad_name");
  await saveMyName(user.email, name);
  // The name appears in the header, which lives in the shared layout.
  revalidatePath("/", "layout");
  redirect("/profile?m=details_saved");
}
