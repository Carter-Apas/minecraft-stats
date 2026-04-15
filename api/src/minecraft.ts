import { promises as fs } from "node:fs";
import path from "node:path";

import type { MinecraftDataset, PlayerDetail, PlayerSummary, SummaryResponse } from "./types.js";

interface WorldPaths {
  dataDir: string;
  worldDir: string | null;
  statsDir: string | null;
  advancementsDir: string | null;
  usercachePath: string | null;
  whitelistPath: string | null;
  latestLogPath: string | null;
}

interface RawStatsFile {
  stats?: Record<string, Record<string, number>>;
}

interface RawAdvancementFile {
  done?: boolean;
  criteria?: Record<string, string>;
}

interface RawUsercacheEntry {
  uuid?: string;
  name?: string;
}

interface RawWhitelistEntry {
  uuid?: string;
  name?: string;
}

const IGNORE_ADVANCEMENT_KEYS = new Set([
  "minecraft:recipes/root",
]);

const BLOCK_PLACEMENT_PREFIXES = [
  "minecraft:placed_block",
];

const DISTANCE_KEYS = {
  walked: [
    "minecraft:walk_one_cm",
    "minecraft:sprint_one_cm",
    "minecraft:crouch_one_cm",
    "minecraft:walk_under_water_one_cm",
    "minecraft:walk_on_water_one_cm",
    "minecraft:swim_one_cm",
    "minecraft:climb_one_cm",
    "minecraft:fall_one_cm",
  ],
  flown: ["minecraft:aviate_one_cm"],
  boated: ["minecraft:boat_one_cm"],
  minecart: ["minecraft:minecart_one_cm"],
};

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function safeReadJson<T>(filePath: string, warnings: string[]): Promise<T | null> {
  try {
    const content = await fs.readFile(filePath, "utf8");
    return JSON.parse(content) as T;
  } catch (error) {
    warnings.push(`Failed to read ${filePath}: ${error instanceof Error ? error.message : "unknown error"}`);
    return null;
  }
}

async function listJsonFiles(directoryPath: string | null, warnings: string[]): Promise<string[]> {
  if (!directoryPath) {
    return [];
  }

  try {
    const entries = await fs.readdir(directoryPath, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .map((entry) => path.join(directoryPath, entry.name))
      .sort();
  } catch (error) {
    warnings.push(`Failed to scan ${directoryPath}: ${error instanceof Error ? error.message : "unknown error"}`);
    return [];
  }
}

function extractUuidFromFilename(filePath: string): string {
  return path.basename(filePath, ".json");
}

function formatMinecraftKey(rawKey: string): string {
  const withoutNamespace = rawKey.replace(/^minecraft:/, "");
  return withoutNamespace
    .split(/[/:_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function cmToKm(value: number): number {
  return Number((value / 100_000).toFixed(2));
}

function ticksToHours(value: number): number {
  return Number((value / 72_000).toFixed(2));
}

function sumValues(record: Record<string, number> | undefined): number {
  return Object.values(record ?? {}).reduce((total, value) => total + value, 0);
}

function getCustomStat(stats: RawStatsFile["stats"], key: string): number {
  return stats?.["minecraft:custom"]?.[key] ?? 0;
}

function getCategory(stats: RawStatsFile["stats"], category: string): Record<string, number> {
  return stats?.[category] ?? {};
}

function sumCustomStats(stats: RawStatsFile["stats"], keys: string[]): number {
  return keys.reduce((total, key) => total + getCustomStat(stats, key), 0);
}

function topEntries(stats: Record<string, number>, limit = 8) {
  return Object.entries(stats)
    .filter(([, value]) => value > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([key, value]) => ({
      key,
      label: formatMinecraftKey(key),
      value,
    }));
}

function buildAdvancements(raw: Record<string, RawAdvancementFile> | null) {
  return Object.entries(raw ?? {})
    .filter(([key]) => !IGNORE_ADVANCEMENT_KEYS.has(key))
    .map(([key, value]) => {
      const completedCriteria = Object.values(value.criteria ?? {});
      const completedAt = completedCriteria.length
        ? completedCriteria.sort((left, right) => left.localeCompare(right)).at(-1) ?? null
        : null;

      return {
        key,
        label: formatMinecraftKey(key),
        done: Boolean(value.done),
        completedAt,
        criteriaCompleted: completedCriteria.length,
        criteriaTotal: Math.max(completedCriteria.length, value.done ? completedCriteria.length : 0),
      };
    })
    .sort((left, right) => {
      if (left.done === right.done) {
        return left.label.localeCompare(right.label);
      }
      return Number(right.done) - Number(left.done);
    });
}

async function findWorldDirectory(rootPath: string): Promise<string | null> {
  const queue = [{ dir: rootPath, depth: 0 }];
  const maxDepth = 4;

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      continue;
    }

    if (current.depth > maxDepth) {
      continue;
    }

    try {
      const entries = await fs.readdir(current.dir, { withFileTypes: true });
      const directoryNames = new Set(entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name));
      if (directoryNames.has("stats") && directoryNames.has("advancements")) {
        return current.dir;
      }

      for (const entry of entries) {
        if (entry.isDirectory()) {
          queue.push({ dir: path.join(current.dir, entry.name), depth: current.depth + 1 });
        }
      }
    } catch {
      continue;
    }
  }

  return null;
}

export async function discoverWorldPaths(dataDir: string): Promise<WorldPaths> {
  const worldDir = await findWorldDirectory(dataDir);

  const candidates = {
    usercachePath: [path.join(dataDir, "usercache.json"), worldDir ? path.join(path.dirname(worldDir), "usercache.json") : null],
    whitelistPath: [path.join(dataDir, "whitelist.json"), worldDir ? path.join(path.dirname(worldDir), "whitelist.json") : null],
    latestLogPath: [path.join(dataDir, "logs", "latest.log"), worldDir ? path.join(path.dirname(worldDir), "logs", "latest.log") : null],
  };

  async function firstExisting(paths: Array<string | null>): Promise<string | null> {
    for (const maybePath of paths) {
      if (maybePath && await pathExists(maybePath)) {
        return maybePath;
      }
    }
    return null;
  }

  return {
    dataDir,
    worldDir,
    statsDir: worldDir ? path.join(worldDir, "stats") : null,
    advancementsDir: worldDir ? path.join(worldDir, "advancements") : null,
    usercachePath: await firstExisting(candidates.usercachePath),
    whitelistPath: await firstExisting(candidates.whitelistPath),
    latestLogPath: await firstExisting(candidates.latestLogPath),
  };
}

async function loadNameMap(paths: WorldPaths, warnings: string[]) {
  const nameMap = new Map<string, string>();

  const usercache = paths.usercachePath
    ? await safeReadJson<RawUsercacheEntry[]>(paths.usercachePath, warnings)
    : null;
  for (const entry of usercache ?? []) {
    if (entry.uuid && entry.name) {
      nameMap.set(entry.uuid, entry.name);
    }
  }

  return nameMap;
}

async function loadWhitelist(paths: WorldPaths, warnings: string[]) {
  const whitelist = new Set<string>();
  const rawWhitelist = paths.whitelistPath
    ? await safeReadJson<RawWhitelistEntry[]>(paths.whitelistPath, warnings)
    : null;

  for (const entry of rawWhitelist ?? []) {
    if (entry.uuid) {
      whitelist.add(entry.uuid);
    }
  }

  return whitelist;
}

async function getLastUpdated(statsPath: string | null, advancementsPath: string | null): Promise<string | null> {
  const times: number[] = [];

  for (const filePath of [statsPath, advancementsPath]) {
    if (!filePath) {
      continue;
    }
    try {
      const info = await fs.stat(filePath);
      times.push(info.mtimeMs);
    } catch {
      continue;
    }
  }

  if (times.length === 0) {
    return null;
  }

  return new Date(Math.max(...times)).toISOString();
}

function toSummary(player: PlayerDetail): PlayerSummary {
  return {
    uuid: player.uuid,
    name: player.name,
    isWhitelisted: player.isWhitelisted,
    playtimeHours: player.playtimeHours,
    deaths: player.deaths,
    playerKills: player.playerKills,
    mobKills: player.mobKills,
    totalDistanceTravelledKm: player.totalDistanceTravelledKm,
    distanceWalkedKm: player.distanceWalkedKm,
    distanceFlownKm: player.distanceFlownKm,
    distanceBoatedKm: player.distanceBoatedKm,
    distanceMinecartKm: player.distanceMinecartKm,
    jumps: player.jumps,
    blocksMined: player.blocksMined,
    blocksPlaced: player.blocksPlaced,
    itemsCrafted: player.itemsCrafted,
    itemsUsed: player.itemsUsed,
    advancementCount: player.advancementCount,
    lastUpdated: player.lastUpdated,
  };
}

export async function loadMinecraftDataset(dataDir: string): Promise<MinecraftDataset> {
  const warnings: string[] = [];
  const paths = await discoverWorldPaths(dataDir);
  const [nameMap, whitelist] = await Promise.all([
    loadNameMap(paths, warnings),
    loadWhitelist(paths, warnings),
  ]);

  const statsFiles = await listJsonFiles(paths.statsDir, warnings);
  const advancementFiles = await listJsonFiles(paths.advancementsDir, warnings);
  const advancementFileMap = new Map(advancementFiles.map((filePath) => [extractUuidFromFilename(filePath), filePath]));

  const players = await Promise.all(
    statsFiles.map(async (statsPath) => {
      const uuid = extractUuidFromFilename(statsPath);
      const advancementPath = advancementFileMap.get(uuid) ?? null;

      const [statsJson, advancementJson, lastUpdated] = await Promise.all([
        safeReadJson<RawStatsFile>(statsPath, warnings),
        advancementPath ? safeReadJson<Record<string, RawAdvancementFile>>(advancementPath, warnings) : Promise.resolve(null),
        getLastUpdated(statsPath, advancementPath),
      ]);

      if (!statsJson) {
        return null;
      }

      const stats = statsJson?.stats;
      const advancements = buildAdvancements(advancementJson);
      const blocksPlacedByType = BLOCK_PLACEMENT_PREFIXES.flatMap((category) => topEntries(getCategory(stats, category), 12));
      const blocksPlaced = BLOCK_PLACEMENT_PREFIXES.reduce(
        (total, category) => total + sumValues(getCategory(stats, category)),
        0,
      );

      const player: PlayerDetail = {
        uuid,
        name: nameMap.get(uuid) ?? `Unknown (${uuid.slice(0, 8)})`,
        isWhitelisted: whitelist.has(uuid),
        playtimeHours: ticksToHours(getCustomStat(stats, "minecraft:play_time")),
        deaths: getCustomStat(stats, "minecraft:deaths"),
        playerKills: getCustomStat(stats, "minecraft:player_kills"),
        mobKills: getCustomStat(stats, "minecraft:mob_kills"),
        totalDistanceTravelledKm: cmToKm(
          sumCustomStats(stats, [
            ...DISTANCE_KEYS.walked,
            ...DISTANCE_KEYS.flown,
            ...DISTANCE_KEYS.boated,
            ...DISTANCE_KEYS.minecart,
          ]),
        ),
        distanceWalkedKm: cmToKm(sumCustomStats(stats, DISTANCE_KEYS.walked)),
        distanceFlownKm: cmToKm(sumCustomStats(stats, DISTANCE_KEYS.flown)),
        distanceBoatedKm: cmToKm(sumCustomStats(stats, DISTANCE_KEYS.boated)),
        distanceMinecartKm: cmToKm(sumCustomStats(stats, DISTANCE_KEYS.minecart)),
        jumps: getCustomStat(stats, "minecraft:jump"),
        blocksMined: sumValues(getCategory(stats, "minecraft:mined")),
        blocksPlaced,
        itemsCrafted: sumValues(getCategory(stats, "minecraft:crafted")),
        itemsUsed: sumValues(getCategory(stats, "minecraft:used")),
        advancementCount: advancements.filter((advancement) => advancement.done).length,
        lastUpdated,
        statBreakdown: {
          mobsKilledByType: topEntries(getCategory(stats, "minecraft:killed")),
          blocksMinedByType: topEntries(getCategory(stats, "minecraft:mined"), 12),
          blocksPlacedByType,
          itemsCraftedByType: topEntries(getCategory(stats, "minecraft:crafted"), 12),
          itemsUsedByType: topEntries(getCategory(stats, "minecraft:used"), 12),
        },
        advancements,
      };

      return player;
    }),
  );

  const normalizedPlayers = players.filter((player): player is PlayerDetail => player !== null);

  normalizedPlayers.sort((left, right) => right.playtimeHours - left.playtimeHours || left.name.localeCompare(right.name));

  const summary: SummaryResponse = {
    title: "Minecraft Survival",
    playerCount: normalizedPlayers.length,
    totalPlaytimeHours: Number(normalizedPlayers.reduce((total, player) => total + player.playtimeHours, 0).toFixed(2)),
    totalDeaths: normalizedPlayers.reduce((total, player) => total + player.deaths, 0),
    totalMobKills: normalizedPlayers.reduce((total, player) => total + player.mobKills, 0),
    totalPlayerKills: normalizedPlayers.reduce((total, player) => total + player.playerKills, 0),
    totalDistanceTravelledKm: Number(normalizedPlayers.reduce((total, player) => total + player.totalDistanceTravelledKm, 0).toFixed(2)),
    topPlayers: normalizedPlayers.slice(0, 5).map(toSummary),
    topKillers: [...normalizedPlayers].sort((left, right) => right.mobKills - left.mobKills || right.playerKills - left.playerKills).slice(0, 5).map(toSummary),
    topTravellers: [...normalizedPlayers].sort((left, right) => right.totalDistanceTravelledKm - left.totalDistanceTravelledKm).slice(0, 5).map(toSummary),
    recentlySeenPlayers: [...normalizedPlayers]
      .filter((player) => player.lastUpdated)
      .sort((left, right) => new Date(right.lastUpdated ?? 0).getTime() - new Date(left.lastUpdated ?? 0).getTime())
      .slice(0, 5)
      .map(toSummary),
    paths,
  };

  return {
    players: normalizedPlayers,
    summary,
    warnings,
    loadedAt: Date.now(),
  };
}

export function sortPlayers(players: PlayerSummary[], field: string, direction: "asc" | "desc"): PlayerSummary[] {
  const multiplier = direction === "asc" ? 1 : -1;
  return [...players].sort((left, right) => {
    const key = field as keyof PlayerSummary;
    const leftValue = left[key];
    const rightValue = right[key];

    if (typeof leftValue === "string" && typeof rightValue === "string") {
      return multiplier * leftValue.localeCompare(rightValue);
    }

    if (typeof leftValue === "boolean" && typeof rightValue === "boolean") {
      return multiplier * (Number(leftValue) - Number(rightValue));
    }

    if (typeof leftValue === "number" && typeof rightValue === "number") {
      return multiplier * (leftValue - rightValue);
    }

    return 0;
  });
}
