import "server-only";
import { getServerSession, Session } from "next-auth"
import { getAuthOptions } from "@/app/lib/auth";


export async function getSession(): Promise<Session | null> {
  const authOptions = await getAuthOptions();
  return await getServerSession(authOptions);
}
