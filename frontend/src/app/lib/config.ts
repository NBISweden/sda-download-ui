import "server-only";
import { connection } from "next/server";
import fs from "fs";
import * as z from "zod";

const relaxedUrl = z.union([z.httpUrl(), z.url({ hostname: /^localhost$/ })]);

const Config = z.strictObject({
  sdaBaseUrl: relaxedUrl,
  nextAuthSecretPath: z.string(),
  nextAuthUrl: relaxedUrl,
  oidcClientSecretPath: z.string(),
  oidcClientIdPath: z.string(),
  oidcRoot: relaxedUrl,
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
    }
    return config;
  };
  return _getConfig;
})();
