import "server-only";
import { connection } from "next/server";
import fs from "fs";
import * as z from "zod";

const relaxedUrl = z.union([z.httpUrl(), z.url({ hostname: /^localhost$/ })]);

const oidcScope = z
  .string()
  .min(1)
  .regex(
    /^[\x21\x23-\x5B\x5D-\x7E]+$/,
    "Scope must be non-empty printable ASCII without spaces, quotes, or backslashes.",
  );

const Config = z.strictObject({
  sdaBaseUrl: relaxedUrl,
  nextAuthSecretPath: z.string(),
  nextAuthUrl: relaxedUrl,
  oidcClientSecretPath: z.string(),
  oidcClientIdPath: z.string(),
  oidcRoot: relaxedUrl,
  oidcExtraScopes: z.array(oidcScope).max(20).default([]),
  postLogoutRedirectUri: relaxedUrl.optional(),
  allowHttp: z.boolean().default(false),
});

export type Config = z.infer<typeof Config>;

export function parseConfig(data: string): Config {
  const obj = JSON.parse(data);
  return Config.parse(obj);
}

function requireHttps(value: string) {
  if (!value.startsWith("https://")) {
    throw new Error(`URL is not using HTTPS: '${value}'`);
  }
}

export const getConfig: () => Promise<Config> = (() => {
  let config: Config | undefined = undefined;

  const _getConfig = async () => {
    await connection();
    if (!config) {
      const configPath = "./sdad-config.json";
      const configData = fs.readFileSync(configPath, "utf-8");
      config = parseConfig(configData);
    }
    if (!config.allowHttp) {
      requireHttps(config.sdaBaseUrl);
      requireHttps(config.nextAuthUrl);
      requireHttps(config.oidcRoot);
      if (config.postLogoutRedirectUri) {
        requireHttps(config.postLogoutRedirectUri);
      }
    }
    return config;
  };
  return _getConfig;
})();
