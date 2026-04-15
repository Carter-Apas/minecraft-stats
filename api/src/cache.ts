import type { MinecraftDataset } from "./types.js";

export function createCache<T>(
  ttlMs: number,
  loader: () => Promise<T>,
) {
  let cachedValue: T | null = null;
  let cachedAt = 0;
  let inflight: Promise<T> | null = null;

  async function get(forceRefresh = false): Promise<{ value: T; ageMs: number }> {
    const ageMs = Date.now() - cachedAt;
    if (!forceRefresh && cachedValue && ageMs < ttlMs) {
      return { value: cachedValue, ageMs };
    }

    if (inflight) {
      const value = await inflight;
      return { value, ageMs: Date.now() - cachedAt };
    }

    inflight = loader()
      .then((value) => {
        cachedValue = value;
        cachedAt = Date.now();
        return value;
      })
      .finally(() => {
        inflight = null;
      });

    const value = await inflight;
    return { value, ageMs: 0 };
  }

  function inspect(): { ageMs: number; value: T | null } {
    return {
      ageMs: cachedAt ? Date.now() - cachedAt : Number.POSITIVE_INFINITY,
      value: cachedValue,
    };
  }

  return { get, inspect };
}

export type DatasetCache = ReturnType<typeof createCache<MinecraftDataset>>;

