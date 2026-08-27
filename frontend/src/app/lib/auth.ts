import "server-only";
import type { NextAuthOptions } from "next-auth";
import type { OAuthConfig, Provider } from "next-auth/providers/index";
import { createOrUpdateSession } from "./session";
import { Config, getConfig } from "./config";
import fs from "fs";

type Profile = {
  sub: string;
  name?: string;
  email?: string;
};

export function LsaaiOidcProvider(
  root: string,
  p?: Partial<OAuthConfig<Profile>>,
): Provider {
  const defaults: OAuthConfig<Profile> = {
    id: "lsaai-oidc",
    name: "LSAAI",
    type: "oauth",
    wellKnown: `${root}/.well-known/openid-configuration`,
    authorization: {
      params: {
        scope: [
          "openid",
          "profile",
          "email",
          "ga4gh_passport_v1",
          "eduperson_entitlement",
        ].join(" "),
      },
    },
    idToken: true,
    checks: ["pkce", "state", "nonce"],
    profile: extractProfile,
  };
  return {
    ...defaults,
    ...(p || {}),
  };
}

export const getAuthConfig = (() => {
  let nextAuthSecret: string | null = null;
  let oidcClientSecret: string | null = null;
  let oidcClientId: string | null = null;

  return (
    config: Pick<
      Config,
      "nextAuthSecretPath" | "oidcClientSecretPath" | "oidcClientIdPath"
    >,
  ): Record<"nextAuthSecret" | "oidcClientSecret" | "oidcClientId", string> => {
    if (nextAuthSecret === null) {
      nextAuthSecret = fs
        .readFileSync(config.nextAuthSecretPath, "utf-8")
        .trim();
    }
    if (oidcClientSecret === null) {
      oidcClientSecret = fs
        .readFileSync(config.oidcClientSecretPath, "utf-8")
        .trim();
    }
    if (oidcClientId === null) {
      oidcClientId = fs.readFileSync(config.oidcClientIdPath, "utf-8").trim();
    }
    return {
      nextAuthSecret,
      oidcClientSecret,
      oidcClientId,
    };
  };
})();

export async function getAuthOptions(): Promise<NextAuthOptions> {
  const config = await getConfig();
  const {
    nextAuthSecret,
    oidcClientSecret: clientSecret,
    oidcClientId: clientId,
  } = getAuthConfig(config);
  const url = config.nextAuthUrl;

  const root = config.oidcRoot;
  if (!process.env.NEXTAUTH_URL && url) {
    process.env.NEXTAUTH_URL = url;
  }
  return {
    secret: nextAuthSecret,
    providers: [
      LsaaiOidcProvider(root, {
        clientId: clientId,
        clientSecret: clientSecret,
      }),
    ],
    session: { strategy: "jwt" },
    pages: { signIn: "/login" },
    callbacks: {
      jwt: extractJWT,
      session: extractSession,
    },
  };
}

export const extractJWT: NonNullable<
  NonNullable<NextAuthOptions["callbacks"]>["jwt"]
> = async (input) => {
  const { token, account, profile } = input;
  if (profile?.sub && profile?.email && account) {
    await createOrUpdateSession({ token: account.access_token });

    token.accessToken = account.access_token;
    token.refreshToken = account.refresh_token;
    token.expiresAt = account.expires_at; // seconds since epoch, per OAuth spec
    token.publicKey = null;
  }
  return token;
};

export const extractSession: NonNullable<
  NonNullable<NextAuthOptions["callbacks"]>["session"]
> = async (input) => {
  const { session, token } = input;
  // Security note: anything returned from this callback is reachable from
  // the browser via useSession() / GET /api/auth/session.
  return {
    ...session,
    ...(token?.expiresAt
      ? { expires: new Date(token.expiresAt * 1000).toISOString() }
      : {}),
    pemChecksum: token?.publicKey?.pemChecksum ?? null,
  };
};

export const extractProfile: OAuthConfig<Profile>["profile"] = (profile) => {
  return { id: profile.sub };
};
