import "server-only";
import * as jose from "jose";
import { getSessionManager, SessionData } from "./SessionManager";

export async function createOrUpdateSession(data: Partial<SessionData>) {
  const sessionManager = await getSessionManager();
  const session = await sessionManager.getSession();
  const token = data.token || session?.token;
  if (!token) {
    throw new Error("No token available for session.");
  }
  const tokenInfo = await getClaims(token);
  const now = new Date().getTime() / 1000;
  const sessionLength = Math.max(_getOrDefault(tokenInfo.exp, now) - now, 0);
  return await sessionManager.createOrUpdateSession(
    {
      ...(session || {}),
      token: token,
      ...data,
    },
    sessionLength * 1000,
  );
}

function _getOrDefault<T>(value: T | undefined, defaultValue: T): T {
  return value === undefined ? defaultValue : value;
}

export async function getSession(): Promise<SessionData | null> {
  const sessionManager = await getSessionManager();
  return await sessionManager.getSession();
}

export async function getClaims(token: string) {
  const claims = await jose.decodeJwt(token);
  return claims;
}
