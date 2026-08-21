import "server-only";
import * as jose from "jose";
import { getConfig } from "@/app/lib/config";

export async function verifyAccessToken(token: string) {
  const { oidcRoot } = await getConfig();

  const response = await fetch(`${oidcRoot}/.well-known/openid-configuration`);

  if (!response.ok) {
    throw new Error("Failed to fetch OIDC discovery document.");
  }

  const { issuer, jwks_uri } = await response.json();

  const jwks = jose.createRemoteJWKSet(new URL(jwks_uri));

  const { payload } = await jose.jwtVerify(token, jwks, {
    issuer,
  });

  return payload;
}
