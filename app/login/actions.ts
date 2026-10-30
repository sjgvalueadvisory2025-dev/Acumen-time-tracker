"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PENDING_COOKIE, requestLoginCode, signOut, verifyLoginCode } from "@/lib/auth";
import { normalizeEmail } from "@/lib/validate";

export async function requestCodeAction(formData: FormData) {
  const email = normalizeEmail(formData.get("email"));
  if (!email) redirect("/login?e=bad_email");

  try {
    await requestLoginCode(email);
  } catch (err) {
    console.error("Failed to send login code", err);
    redirect("/login?e=send_failed");
  }

  const jar = await cookies();
  jar.set(PENDING_COOKIE, email, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 15 * 60,
  });
  redirect("/login/verify?m=code_sent");
}

export async function verifyCodeAction(formData: FormData) {
  const jar = await cookies();
  const email = normalizeEmail(jar.get(PENDING_COOKIE)?.value);
  if (!email) redirect("/login?e=no_pending");

  const code = String(formData.get("code") ?? "").replace(/\s/g, "");
  if (!(await verifyLoginCode(email, code))) redirect("/login/verify?e=bad_code");

  jar.delete(PENDING_COOKIE);
  redirect("/");
}

export async function signOutAction() {
  await signOut();
  redirect("/login");
}
