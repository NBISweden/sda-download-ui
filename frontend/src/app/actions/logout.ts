"use server";

import { redirect, RedirectType } from "next/navigation";
import { clearSession } from "../lib/session";

export async function logout() {
  await clearSession();
  redirect("/", RedirectType.replace);
}
