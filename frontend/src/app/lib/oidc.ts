import "server-only";
import * as jose from "jose";
import { getConfig } from "@/app/lib/config";

// Cache useful discovery info across requests so verifying an access
// token (or resolving the IdP end-session endpoint) costs at most one
// discovery fetch per process. createRemoteJWKSet caches the JWKS itself
// and refetches only when it sees an unknown `kid`.
let discovery: {
  issuer: string;
  jwks: ReturnType<typeof jose.createRemoteJWKSet>;
  endSessionEndpoint: string | null;
} | null = null;

async function getDiscovery() {
  if (!discovery) {
    const { oidcRoot } = await getConfig();
    const res = await fetch(`${oidcRoot}/.well-known/openid-configuration`);
    if (!res.ok) throw new Error("Failed to fetch OIDC discovery document.");
    const { issuer, jwks_uri, end_session_endpoint } = await res.json();
    discovery = {
      issuer,
      jwks: jose.createRemoteJWKSet(new URL(jwks_uri)),
      endSessionEndpoint:
        typeof end_session_endpoint === "string" ? end_session_endpoint : null,
    };
  }
  return discovery;
}

// Verify the given access token against the provider's JWKS and issuer.
// Throws on signature failure, expiry, unknown kid, or provider I/O failure.
export async function verifyAccessToken(
  token: string,
): Promise<jose.JWTPayload> {
  const { issuer, jwks } = await getDiscovery();
  const { payload } = await jose.jwtVerify(token, jwks, { issuer });
  return payload;
}

// The IdP's Relying Party-initiated logout endpoint, if advertised. Returns null when
// the provider doesn't support RP-initiated logout.
export async function getEndSessionEndpoint(): Promise<string | null> {
  const { endSessionEndpoint } = await getDiscovery();
  return endSessionEndpoint;
}
