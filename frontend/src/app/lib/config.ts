import "server-only";
import { connection } from "next/server";
import fs from "fs";
import * as z from "zod";

const Config = z.strictObject({
  sdaBaseUrl: z.httpUrl(),
  sessionSecretPath: z.string(),
});

export type Config = z.infer<typeof Config>;

function parseConfig(data: string): Config {
  const obj = JSON.parse(data);
  return Config.parse(obj);
}

export const getConfig: () => Promise<Config> = (() => {
  let config: Config | undefined = undefined;

  const _getConfig = async () => {
    await connection();
    if (!config) {
      const configPath = process.env.SDAD_CONFIG_PATH || "./sdad-config.json";
      const configData = fs.readFileSync(configPath, "utf-8");
      config = parseConfig(configData);
    }
    return config;
  };
  return _getConfig;
})();
