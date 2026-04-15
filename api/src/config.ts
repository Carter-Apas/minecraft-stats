export interface ApiConfig {
  port: number;
  dataDir: string;
  cacheTtlMs: number;
}

export function getConfig(env: NodeJS.ProcessEnv = process.env): ApiConfig {
  return {
    port: Number.parseInt(env.PORT ?? "3001", 10),
    dataDir: env.DATA_DIR ?? "/data",
    cacheTtlMs: Number.parseInt(env.CACHE_TTL_MS ?? "30000", 10),
  };
}

