import { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt"
import { getConfig } from "../../lib/config";
import { getAuthConfig } from "@/app/lib/auth";

export async function getSDADToken(
  request: NextRequest,
) {
  const config = await getConfig();
  const authConfig = getAuthConfig(config);
  const token = await getToken({
    req: request,
    secret: authConfig.nextAuthSecret,
  })

  return token;
}