import "server-only";
import { cookies } from "next/headers";
import { getConfig } from "./config";
import { getServerToken } from "./serverToken";

const LOGOUT_COMPLETE_COOKIE = "sdad-logout-complete";
const COOKIE_MAX_AGE_SECONDS = 2 * 60;

// /logout renders whenever the user is signed out, signed-in users who
// type the URL directly still have the session cookie and get redirected away.
export async function isSignedOut(): Promise<boolean> {
  return (await getServerToken()) === null;
}

export async function markLogoutComplete() {
  const { nextAuthUrl } = await getConfig();
  const store = await cookies();
  store.set(LOGOUT_COMPLETE_COOKIE, "1", {
    httpOnly: true,
    secure: nextAuthUrl.startsWith("https://"),
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE_SECONDS,
  });
}

// /logout-complete needs an explicit flag since we do not control the IdP side.
export async function isFromLogoutCompleteFlow(): Promise<boolean> {
  const store = await cookies();
  return store.has(LOGOUT_COMPLETE_COOKIE);
}
