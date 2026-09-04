import "server-only";
import { cookies } from "next/headers";
import { decode, encode, type JWT } from "next-auth/jwt";
import { getConfig } from "./config";
import { getAuthConfig } from "./auth";
import * as jose from "jose";
import { verifyAccessToken } from "./oidc";

export class SessionInvalidError extends Error {
  constructor(message = "Session invalid.") {
    super(message);
    this.name = "SessionInvalidError";
  }
}

async function getSecret(): Promise<string> {
  const config = await getConfig();
  const { nextAuthSecret } = getAuthConfig(config);
  return nextAuthSecret;
}

async function getCookieName(): Promise<string> {
  const { nextAuthUrl } = await getConfig();
  const useSecure = nextAuthUrl.startsWith("https://");
  return `${useSecure ? "__Secure-" : ""}next-auth.session-token`;
}

// Seconds between now and the OAuth access token's expiry, used when re-encrypting the cookie.
function remainingSecondsFor(token: JWT): number | null {
  if (typeof token.expiresAt !== "number") return null;
  const now = Math.floor(Date.now() / 1000);
  return Math.max(token.expiresAt - now, 0);
}

// Decrypt the NextAuth session cookie and return the JWT payload.
export async function getServerToken(): Promise<JWT | null> {
  const store = await cookies();
  const raw = store.get(await getCookieName())?.value;
  if (!raw) return null;
  try {
    // decode verifies `exp` (bound to access-token TTL by auth.ts);
    return await decode({ token: raw, secret: await getSecret() });
  } catch {
    return null;
  }
}

// In case we need to modify the c4gh pub key and re-encrypt the cookie.
export async function updateServerToken(patch: Partial<JWT>): Promise<void> {
  const store = await cookies();
  const name = await getCookieName();
  const raw = store.get(name)?.value;
  if (!raw) return;

  const secret = await getSecret();
  let current: JWT | null;
  try {
    current = await decode({ token: raw, secret });
  } catch {
    return;
  }
  if (!current?.accessToken) return;

  // Re-verify the access token against the provider before we re-encrypt.
  // This catches revocation and key rotation between sign-in and now.
  try {
    await verifyAccessToken(current.accessToken);
  } catch (e) {
    if (e instanceof jose.errors.JOSEError) {
      // Token is probably invalid: clear the session and let the caller
      // surface a "please sign in again" message.
      if (store.get(name)) store.delete(name);
      throw new SessionInvalidError();
    }
    // Verification unavailable, don't touch the session, let caller retry.
    throw e;
  }

  const merged: JWT = { ...current, ...patch };
  const remaining = remainingSecondsFor(merged);
  if (remaining === null || remaining === 0) return;

  const encoded = await encode({ token: merged, secret, maxAge: remaining });

  store.set(name, encoded, {
    httpOnly: true,
    secure: name.startsWith("__Secure-"),
    sameSite: "lax",
    path: "/",
    maxAge: remaining,
  });
}

// Delete the NextAuth session cookie. Also cleanup any other same-origin cookies NextAuth manages (not required).
export async function clearServerToken(): Promise<void> {
  const store = await cookies();
  const sessionCookieName = await getCookieName();

  // Same-origin cookies NextAuth manages that we can clean up too.
  const otherNames = [
    "next-auth.csrf-token",
    "__Host-next-auth.csrf-token",
    "next-auth.callback-url",
    "__Secure-next-auth.callback-url",
  ];

  for (const name of [sessionCookieName, ...otherNames]) {
    if (store.get(name)) store.delete(name);
  }
}

// Session-shaped view over the JWT for the rest of the app. Mostly used as a drop-in
// replacement for the old session cookie logic and also provides the public key if present.
export type SessionData = {
  token: string;
  publicKey?: { key: string; pemChecksum: string } | null;
};

export async function getSession(): Promise<SessionData | null> {
  const jwt = await getServerToken();
  if (!jwt?.accessToken) return null;
  return {
    token: jwt.accessToken,
    publicKey: jwt.publicKey ?? null,
  };
}
