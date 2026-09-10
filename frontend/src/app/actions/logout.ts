"use server";

import { redirect, RedirectType } from "next/navigation";
import { clearServerToken } from "@/app/lib/serverToken";
import { getEndSessionEndpoint } from "@/app/lib/oidc";
import { getConfig } from "@/app/lib/config";
import { getAuthConfig } from "@/app/lib/auth";

// Sign out of the app only: clears our own session cookie and lands on /logout.
export async function logout() {
  await clearServerToken();
  redirect("/logout", RedirectType.replace);
}

// Redirect to the IdP's end-session endpoint. Called from the /logout
// page when the user opts into a fuller (federated) logout.
export async function signOutOfIdp() {
  await clearServerToken(); // idempotent; no-op if already cleared

  const endSessionEndpoint = await getEndSessionEndpoint();
  if (!endSessionEndpoint) {
    redirect("/", RedirectType.replace);
  }

  const config = await getConfig();
  const { oidcClientId } = getAuthConfig(config);

  const url = new URL(endSessionEndpoint);
  url.searchParams.set("client_id", oidcClientId);

  if (config.postLogoutRedirectUri) {
    url.searchParams.set(
      "post_logout_redirect_uri",
      config.postLogoutRedirectUri,
    );
  }

  redirect(url.toString(), RedirectType.replace);
}
