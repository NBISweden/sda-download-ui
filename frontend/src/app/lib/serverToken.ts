import "server-only";
import { cookies } from "next/headers";
import { decode, encode, type JWT } from "next-auth/jwt";
import { getConfig } from "./config";
import { getAuthConfig } from "./auth";

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

  let decoded: JWT | null;
  try {
    decoded = await decode({ token: raw, secret: await getSecret() });
  } catch {
    return null;
  }
  if (!decoded) return null;

  // Session expiry is bound to the access token TTL.
  const remaining = remainingSecondsFor(decoded);
  if (remaining !== null && remaining === 0) return null;

  return decoded;
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
  if (!current) return;

  const merged: JWT = { ...current, ...patch };
  const remaining = remainingSecondsFor(merged);
  if (remaining === null || remaining === 0) return;

  const encoded = await encode({ token: merged, secret, maxAge: remaining });

  store.set(name, encoded, {
    httpOnly: true,
    secure: name.startsWith("__Secure-"),
    sameSite: "lax", // NextAuth default, using "strict" will break the login flow when the user is redirected back from the OIDC provider.
    path: "/",
    maxAge: remaining,
  });
}

// Delete the NextAuth session cookie.
export async function clearServerToken(): Promise<void> {
  const store = await cookies();
  const name = await getCookieName();
  if (store.get(name)) store.delete(name);
}
