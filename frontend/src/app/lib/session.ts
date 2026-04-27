import "server-only";
import { connection } from "next/server";
import * as jose from "jose";
import { getSessionManager, SessionData } from "./SessionManager";

export async function createOrUpdateSession(data: SessionData) {
  const sessionManager = await getSessionManager();
  const tokenInfo = await getClaims(data.token);
  const now = new Date().getTime() / 1000;
  const sessionLength = Math.max(_getOrDefault(tokenInfo.exp, now) - now, 0);
  return await sessionManager.createOrUpdateSession(data, sessionLength * 1000);
}

function _getOrDefault<T>(value: T | undefined, defaultValue: T): T {
  return value === undefined ? defaultValue : value;
}

export async function getSession(): Promise<SessionData | null> {
  await connection();
  const sessionManager = await getSessionManager();
  return await sessionManager.getSession();
}

export async function getClaims(token: string) {
  const claims = await jose.decodeJwt(token);
  return claims;
}
