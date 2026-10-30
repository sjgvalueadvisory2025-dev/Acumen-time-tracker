"use server";

import { redirect } from "next/navigation";
import { signIn, signOut } from "@/lib/auth";
import { normalizeEmail } from "@/lib/validate";

export async function signInAction(formData: FormData) {
  const email = normalizeEmail(formData.get("email"));
  if (!email) redirect("/login?e=bad_email");
  if (!(await signIn(email))) redirect("/login?e=no_access");
  redirect("/");
}

export async function signOutAction() {
  await signOut();
  redirect("/login");
}
