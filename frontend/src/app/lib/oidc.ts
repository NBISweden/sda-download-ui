import "server-only";
import * as jose from "jose";
import { getConfig } from "@/app/lib/config";

// Cache the issuer/JWKS across requests so verifying an access token costs
// at most one discovery fetch per process. createRemoteJWKSet caches the
// JWKS itself and refetches only when it sees an unknown `kid`.
let issuerJwks: {
  issuer: string;
  jwks: ReturnType<typeof jose.createRemoteJWKSet>;
} | null = null;

async function getIssuerAndJwks() {
  if (!issuerJwks) {
    const { oidcRoot } = await getConfig();
    const res = await fetch(`${oidcRoot}/.well-known/openid-configuration`);
    if (!res.ok) throw new Error("Failed to fetch OIDC discovery document.");
    const { issuer, jwks_uri } = await res.json();
    issuerJwks = { issuer, jwks: jose.createRemoteJWKSet(new URL(jwks_uri)) };
  }
  return issuerJwks;
}

// Verify the given access token against the provider's JWKS and issuer.
// Throws on signature failure, expiry, unknown kid, or provider I/O failure.
export async function verifyAccessToken(
  token: string,
): Promise<jose.JWTPayload> {
  const { issuer, jwks } = await getIssuerAndJwks();
  const { payload } = await jose.jwtVerify(token, jwks, { issuer });
  return payload;
}
