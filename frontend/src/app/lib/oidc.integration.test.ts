import { describe, expect, test, vi } from "vitest";
import * as jose from "jose";
import { testConfig } from "@/test/testConfig";
import { verifyAccessToken } from "./oidc";

vi.mock(import("server-only"), () => ({}));

vi.mock(import("@/app/lib/config"), () => ({
  getConfig: async () => testConfig,
}));

const discovery = {
  issuer: `${testConfig.oidcRoot}/`,
  jwks_uri: `${testConfig.oidcRoot}/jwk`,
};

function mockOidcEndpoints(jwk: jose.JWK) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL | Request) => {
      const url = input.toString();

      if (url.endsWith("/.well-known/openid-configuration")) {
        return new Response(JSON.stringify(discovery), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        });
      }

      if (url === discovery.jwks_uri) {
        return new Response(
          JSON.stringify({
            keys: [jwk],
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
            },
          },
        );
      }

      return new Response(null, { status: 404 });
    }),
  );
}

async function createToken(privateKey: CryptoKey) {
  return await new jose.SignJWT({
    sub: "test-user",
  })
    .setProtectedHeader({
      alg: "RS256",
      kid: "rsa1",
      typ: "at+jwt",
    })
    .setIssuer(discovery.issuer)
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(privateKey);
}

describe("verifyAccessToken integration", () => {
  test("accepts a token signed with the trusted key", async () => {
    const trustedKeys = await jose.generateKeyPair("RS256");

    const trustedJwk = await jose.exportJWK(trustedKeys.publicKey);

    trustedJwk.kid = "rsa1";
    trustedJwk.alg = "RS256";
    trustedJwk.use = "sig";

    mockOidcEndpoints(trustedJwk);

    const token = await createToken(trustedKeys.privateKey);

    const result = await verifyAccessToken(token);

    expect(result.sub).toBe("test-user");
    expect(result.iss).toBe(discovery.issuer);
  });

  test("rejects a token signed with an untrusted key", async () => {
    const trustedKeys = await jose.generateKeyPair("RS256");
    const untrustedKeys = await jose.generateKeyPair("RS256");

    const trustedJwk = await jose.exportJWK(trustedKeys.publicKey);

    trustedJwk.kid = "rsa1";
    trustedJwk.alg = "RS256";
    trustedJwk.use = "sig";

    mockOidcEndpoints(trustedJwk);

    const token = await createToken(untrustedKeys.privateKey);

    await expect(verifyAccessToken(token)).rejects.toThrow();
  });
});
