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
  picture?: string;
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
    profile(profile) {
      return { id: profile.sub };
    },
  };
  return {
    ...defaults,
    ...(p || {}),
  };
}

function getAuthConfig(
  config: Config,
): Record<"nextAuthSecret" | "oidcClientSecret" | "oidcClientId", string> {
  let nextAuthSecret: string | null = null;
  if (nextAuthSecret === null) {
    nextAuthSecret = fs.readFileSync(config.nextAuthSecretPath, "utf-8");
  }

  let oidcClientSecret: string | null = null;
  if (oidcClientSecret === null) {
    oidcClientSecret = fs.readFileSync(config.oidcClientSecretPath, "utf-8");
  }
  let oidcClientId: string | null = null;
  if (oidcClientId === null) {
    oidcClientId = fs.readFileSync(config.oidcClientIdPath, "utf-8");
  }
  return {
    nextAuthSecret,
    oidcClientSecret,
    oidcClientId,
  };
}

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
    callbacks: {
      jwt: async (input) => {
        const { token, account, profile } = input;
        if (profile?.sub && profile?.email) {
          if (account) {
            await createOrUpdateSession({ token: account.access_token });
          }
          return {
            sub: profile.sub,
            name: profile.name,
            email: profile.email,
            picture: profile.image,
          };
        }

        return token;
      },
      session: async (input) => {
        const { session } = input;
        return {
          ...session,
        };
      },
    },
  };
}
