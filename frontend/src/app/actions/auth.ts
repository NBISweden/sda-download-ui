"use server";
import { redirect } from "next/navigation";
import { createOrUpdateSession } from "@/app/lib/session";

export default async function mockAuth(data: FormData) {
  let token: string | undefined = undefined;
  try {
    token = await fetchMockToken();
  } catch (error) {
    throw new Error(`Failed to fetch token: ${error}`);
  }
  if (token) {
    await createOrUpdateSession({ token });
  }
  const target = data.get("target");
  redirect(typeof target === "string" ? target : "/");
}

export async function fetchMockToken() {
  const tokenUrl = process.env.MOCK_TOKEN_URL || "http://mockauth:8000/tokens";
  const data: string[] = await (await fetch(tokenUrl)).json();
  const token = data[0];
  return token;
}
