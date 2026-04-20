import "server-only";

import { cookies } from "next/headers";
import * as jose from "jose";
import fs from "fs";

export type SessionData = {
  token: string;
};

class SessionManager<ST extends Record<string, unknown>> {
  private _secret: Uint8Array<ArrayBufferLike>;
  private _issuer: string;
  private _audience: string;
  private _sessionId: string;
  private _parsePayload: (payload: jose.JWTPayload) => ST;

  constructor(
    secret: Uint8Array<ArrayBufferLike>,
    issuer: string,
    audience: string,
    sessionId: string,
    parsePayload: (payload: jose.JWTPayload) => ST,
  ) {
    this._secret = secret;
    this._issuer = issuer;
    this._audience = audience;
    this._sessionId = sessionId;
    this._parsePayload = parsePayload;
  }

  async createSessionJWT(payload: ST, expirationTime: string | Date | number) {
    return await new jose.EncryptJWT(payload)
      .setProtectedHeader({ alg: "dir", enc: "A128CBC-HS256" })
      .setIssuedAt()
      .setIssuer(this._issuer)
      .setAudience(this._audience)
      .setExpirationTime(expirationTime)
      .encrypt(this._secret);
  }

  async createOrUpdateSession(
    data: ST,
    expirationTime: number = 7 * 24 * 60 * 60 * 1000,
  ) {
    const expiresAt = new Date(Date.now() + expirationTime);
    const session = await this.createSessionJWT(data, expiresAt);
    const cookieStore = await cookies();

    cookieStore.set(this._sessionId, session, {
      httpOnly: true,
      secure: true,
      expires: expiresAt,
      sameSite: "strict",
      path: "/",
    });
  }

  async getSession(): Promise<ST | null> {
    const session = (await cookies()).get(this._sessionId)?.value;
    if (!session) {
      return null;
    }
    try {
      const { payload } = await jose.jwtDecrypt(session, this._secret, {
        issuer: this._issuer,
        audience: this._audience,
      });

      return this._parsePayload(payload);
    } catch {
      // Ignore improperly formed cookie data
      return null;
    }
  }
}

export const getSessionManager: () => SessionManager<SessionData> = (() => {
  let sessionManager: SessionManager<SessionData> | undefined = undefined;

  const _getSessionManager = () => {
    if (!sessionManager) {
      const secretPath = process.env.SESSION_TOKEN_SECRET_PATH;
      if (!secretPath) {
        throw new Error("No session token secret path defined.");
      }
      const secret = fs.readFileSync(secretPath, "utf-8");
      sessionManager = createSDADSessionManager(secret);
    }
    return sessionManager;
  };
  return _getSessionManager;
})();

export function createSDADSessionManager(secret: string) {
  const secretBytes = jose.base64url.decode(secret);
  return new SessionManager<SessionData>(
    secretBytes,
    "sda:download-ui:issuer",
    "sda:download-ui:audience",
    "sdad-session",
    (payload) => ({
      token: payload["token"] as string,
    }),
  );
}
