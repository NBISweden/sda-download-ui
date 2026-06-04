import NextAuth from "next-auth";
import { getAuthOptions } from "@/app/lib/auth";

async function authHandler(req: Request, ctx: unknown) {
  const authOptions = await getAuthOptions();
  const handler = NextAuth(authOptions);
  return handler(req, ctx);
}

export { authHandler as GET, authHandler as POST };
