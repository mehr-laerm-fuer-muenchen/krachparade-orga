"use server";

import { AuthError } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { signIn, signOut } from "@/auth";
import { DEV_LOGIN_PATH, DEV_LOGIN_PROVIDER, devLoginEnvFromProcess, isDevLoginEnabled } from "@/lib/dev-login";

/** Starts the Google sign-in; refusals come back to /login?error=AccessDenied. */
export async function loginWithGoogle() {
  await signIn("google", { redirectTo: "/" });
}

export async function logout() {
  await signOut({ redirectTo: "/login" });
}

const devLoginInput = z.object({ memberId: z.uuid() });

/** Dev login (local and Vercel preview only): signs in a seeded test member. */
export async function devLogin(formData: FormData) {
  if (!isDevLoginEnabled(devLoginEnvFromProcess())) {
    notFound();
  }
  const parsed = devLoginInput.safeParse({ memberId: formData.get("memberId") });
  if (!parsed.success) {
    redirect(`${DEV_LOGIN_PATH}?fehler=1`);
  }
  try {
    await signIn(DEV_LOGIN_PROVIDER, { memberId: parsed.data.memberId, redirectTo: "/" });
  } catch (error) {
    // signIn redirects by throwing; only real sign-in failures land here.
    if (error instanceof AuthError) {
      redirect(`${DEV_LOGIN_PATH}?fehler=1`);
    }
    throw error;
  }
}
