"use server";

import { redirect, RedirectType } from "next/navigation";
import { clearServerToken } from "@/app/lib/serverToken";

export async function logout() {
  await clearServerToken();
  redirect("/", RedirectType.replace);
}
