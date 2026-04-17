import "server-only";

import * as jose from "jose";
import { getSessionManager, SessionData } from "./SessionManager";

export async function createOrUpdateSession(data: SessionData) {
  const sessionManager = await getSessionManager();
  return await sessionManager.createOrUpdateSession(data);
}

export async function getSession(): Promise<SessionData | null> {
  const sessionManager = await getSessionManager();
  return await sessionManager.getSession();
}

export async function getClaims(token: string) {
  const claims = await jose.decodeJwt(token);
  return claims;
}
