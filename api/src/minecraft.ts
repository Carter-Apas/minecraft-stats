import { promises as fs } from "node:fs";
import path from "node:path";
import { inflateRawSync } from "node:zlib";

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

interface CanonicalAdvancementTotals {
  availableAdvancementCount: number;
  availableRecipeCount: number;
}

const IGNORE_ADVANCEMENT_KEYS = new Set([
  "minecraft:recipes/root",
]);

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

async function findServerJarPath(dataDir: string): Promise<string | null> {
  try {
    const entries = await fs.readdir(dataDir, { withFileTypes: true });
    const serverJar = entries.find((entry) => entry.isFile() && /^minecraft_server\..+\.jar$/.test(entry.name));
    return serverJar ? path.join(dataDir, serverJar.name) : null;
  } catch {
    return null;
  }
}

function findZipEndOfCentralDirectory(buffer: Buffer): number {
  for (let offset = buffer.length - 22; offset >= Math.max(0, buffer.length - 65_557); offset -= 1) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) {
      return offset;
    }
  }

  return -1;
}

function listZipEntries(buffer: Buffer) {
  const eocdOffset = findZipEndOfCentralDirectory(buffer);
  if (eocdOffset === -1) {
    throw new Error("ZIP end of central directory not found");
  }

  const centralDirectorySize = buffer.readUInt32LE(eocdOffset + 12);
  const centralDirectoryOffset = buffer.readUInt32LE(eocdOffset + 16);
  const entries: Array<{
    fileName: string;
    compressionMethod: number;
    compressedSize: number;
    uncompressedSize: number;
    localHeaderOffset: number;
  }> = [];

  let offset = centralDirectoryOffset;
  const endOffset = centralDirectoryOffset + centralDirectorySize;

  while (offset < endOffset) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) {
      throw new Error("Invalid ZIP central directory entry");
    }

    const compressionMethod = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const uncompressedSize = buffer.readUInt32LE(offset + 24);
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraFieldLength = buffer.readUInt16LE(offset + 30);
    const fileCommentLength = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const fileName = buffer.toString("utf8", offset + 46, offset + 46 + fileNameLength);

    entries.push({
      fileName,
      compressionMethod,
      compressedSize,
      uncompressedSize,
      localHeaderOffset,
    });

    offset += 46 + fileNameLength + extraFieldLength + fileCommentLength;
  }

  return entries;
}

function extractZipEntry(buffer: Buffer, fileName: string): Buffer | null {
  const entry = listZipEntries(buffer).find((item) => item.fileName === fileName);
  if (!entry) {
    return null;
  }

  const localHeaderOffset = entry.localHeaderOffset;
  if (buffer.readUInt32LE(localHeaderOffset) !== 0x04034b50) {
    throw new Error(`Invalid ZIP local header for ${fileName}`);
  }

  const fileNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
  const extraFieldLength = buffer.readUInt16LE(localHeaderOffset + 28);
  const dataOffset = localHeaderOffset + 30 + fileNameLength + extraFieldLength;
  const fileBuffer = buffer.subarray(dataOffset, dataOffset + entry.compressedSize);

  if (entry.compressionMethod === 0) {
    return Buffer.from(fileBuffer);
  }

  if (entry.compressionMethod === 8) {
    return inflateRawSync(fileBuffer);
  }

  throw new Error(`Unsupported ZIP compression method ${entry.compressionMethod} for ${fileName}`);
}

async function loadCanonicalAdvancementTotals(dataDir: string, warnings: string[]): Promise<CanonicalAdvancementTotals | null> {
  const serverJarPath = await findServerJarPath(dataDir);
  if (!serverJarPath) {
    return null;
  }

  try {
    const outerJar = await fs.readFile(serverJarPath);
    const outerEntryNames = listZipEntries(outerJar).map((entry) => entry.fileName);
    const embeddedServerJar = outerEntryNames.find((entryName) => /^META-INF\/versions\/[^/]+\/server-[^/]+\.jar$/.test(entryName));
    const innerJar = embeddedServerJar ? (extractZipEntry(outerJar, embeddedServerJar) ?? outerJar) : outerJar;
    const entryNames = listZipEntries(innerJar).map((entry) => entry.fileName);

    const availableRecipeCount = entryNames.filter((entryName) => /^data\/minecraft\/advancement\/recipes\/.+\.json$/.test(entryName)).length;
    const availableAdvancementCount = entryNames.filter((entryName) => /^data\/minecraft\/advancement\/(story|nether|end|adventure|husbandry)\/.+\.json$/.test(entryName)).length;

    if (availableRecipeCount === 0 && availableAdvancementCount === 0) {
      return null;
    }

    return {
      availableAdvancementCount,
      availableRecipeCount,
    };
  } catch (error) {
    warnings.push(`Failed to inspect server jar for advancement totals: ${error instanceof Error ? error.message : "unknown error"}`);
    return null;
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

const PLACEABLE_KEYWORDS = [
  "block",
  "stone",
  "dirt",
  "grass",
  "sand",
  "gravel",
  "clay",
  "ore",
  "deepslate",
  "netherrack",
  "obsidian",
  "glass",
  "pane",
  "wool",
  "terracotta",
  "concrete",
  "powder",
  "planks",
  "log",
  "wood",
  "stem",
  "hyphae",
  "leaves",
  "sapling",
  "slab",
  "stairs",
  "wall",
  "fence",
  "fence_gate",
  "door",
  "trapdoor",
  "button",
  "pressure_plate",
  "torch",
  "lantern",
  "scaffolding",
  "ladder",
  "rail",
  "sign",
  "banner",
  "carpet",
  "bed",
  "chest",
  "barrel",
  "shelf",
  "bookshelf",
  "crafting_table",
  "furnace",
  "anvil",
  "beacon",
  "campfire",
  "cauldron",
  "hopper",
  "dispenser",
  "dropper",
  "comparator",
  "repeater",
  "lever",
  "lectern",
  "item_frame",
  "painting",
  "flower",
  "bush",
  "mushroom",
  "cactus",
  "vine",
];

const NON_BLOCK_EXACT_KEYS = new Set([
  "minecraft:bone_meal",
  "minecraft:book",
  "minecraft:bow",
  "minecraft:bucket",
  "minecraft:carrot",
  "minecraft:cod_bucket",
  "minecraft:egg",
  "minecraft:firework_rocket",
  "minecraft:flint_and_steel",
  "minecraft:glass_bottle",
  "minecraft:iron_pickaxe",
  "minecraft:lava_bucket",
  "minecraft:milk_bucket",
  "minecraft:netherite_axe",
  "minecraft:netherite_pickaxe",
  "minecraft:shears",
  "minecraft:snowball",
  "minecraft:stone_axe",
  "minecraft:water_bucket",
  "minecraft:wheat_seeds",
]);

const NON_BLOCK_SUFFIXES = [
  "_axe",
  "_pickaxe",
  "_shovel",
  "_hoe",
  "_sword",
  "_helmet",
  "_chestplate",
  "_leggings",
  "_boots",
  "_bucket",
];

function isLikelyPlaceableBlock(itemKey: string): boolean {
  if (NON_BLOCK_EXACT_KEYS.has(itemKey)) {
    return false;
  }

  const raw = itemKey.replace(/^minecraft:/, "");

  if (NON_BLOCK_SUFFIXES.some((suffix) => raw.endsWith(suffix))) {
    return false;
  }

  return PLACEABLE_KEYWORDS.some((keyword) => raw.includes(keyword));
}

function getPlacedBlockEntries(stats: RawStatsFile["stats"]) {
  const used = getCategory(stats, "minecraft:used");
  return Object.entries(used)
    .filter(([key, value]) => value > 0 && isLikelyPlaceableBlock(key))
    .sort((a, b) => b[1] - a[1]);
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
        isRecipe: key.startsWith("minecraft:recipes/"),
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
    recipeCount: player.recipeCount,
    availableAdvancementCount: player.availableAdvancementCount,
    availableRecipeCount: player.availableRecipeCount,
    lastUpdated: player.lastUpdated,
  };
}

export async function loadMinecraftDataset(dataDir: string): Promise<MinecraftDataset> {
  const warnings: string[] = [];
  const paths = await discoverWorldPaths(dataDir);
  const canonicalTotals = await loadCanonicalAdvancementTotals(dataDir, warnings);
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
      const placedBlockEntries = getPlacedBlockEntries(stats);
      const blocksPlacedByType = placedBlockEntries.slice(0, 12).map(([key, value]) => ({
        key,
        label: formatMinecraftKey(key),
        value,
      }));
      const blocksPlaced = placedBlockEntries.reduce((total, [, value]) => total + value, 0);
      const completedGameplayAdvancements = advancements.filter((advancement) => advancement.done && !advancement.isRecipe);
      const completedRecipeUnlocks = advancements.filter((advancement) => advancement.done && advancement.isRecipe);

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
        advancementCount: completedGameplayAdvancements.length,
        recipeCount: completedRecipeUnlocks.length,
        availableAdvancementCount: canonicalTotals?.availableAdvancementCount ?? 0,
        availableRecipeCount: canonicalTotals?.availableRecipeCount ?? 0,
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
  const fallbackAdvancementTotal = normalizedPlayers.reduce(
    (max, player) => Math.max(max, player.advancements.filter((advancement) => !advancement.isRecipe).length),
    0,
  );
  const fallbackRecipeTotal = normalizedPlayers.reduce(
    (max, player) => Math.max(max, player.advancements.filter((advancement) => advancement.isRecipe).length),
    0,
  );

  for (const player of normalizedPlayers) {
    if (player.availableAdvancementCount === 0) {
      player.availableAdvancementCount = fallbackAdvancementTotal;
    }
    if (player.availableRecipeCount === 0) {
      player.availableRecipeCount = fallbackRecipeTotal;
    }
  }

  normalizedPlayers.sort((left, right) => right.playtimeHours - left.playtimeHours || left.name.localeCompare(right.name));

  const summary: SummaryResponse = {
    title: "Minecraft Survival",
    playerCount: normalizedPlayers.length,
    totalPlaytimeHours: Number(normalizedPlayers.reduce((total, player) => total + player.playtimeHours, 0).toFixed(2)),
    totalDeaths: normalizedPlayers.reduce((total, player) => total + player.deaths, 0),
    totalMobKills: normalizedPlayers.reduce((total, player) => total + player.mobKills, 0),
    totalPlayerKills: normalizedPlayers.reduce((total, player) => total + player.playerKills, 0),
    totalBlocksMined: normalizedPlayers.reduce((total, player) => total + player.blocksMined, 0),
    totalBlocksPlaced: normalizedPlayers.reduce((total, player) => total + player.blocksPlaced, 0),
    totalDistanceTravelledKm: Number(normalizedPlayers.reduce((total, player) => total + player.totalDistanceTravelledKm, 0).toFixed(2)),
    topPlayers: normalizedPlayers.slice(0, 5).map(toSummary),
    topKillers: [...normalizedPlayers].sort((left, right) => right.mobKills - left.mobKills || right.playerKills - left.playerKills).slice(0, 5).map(toSummary),
    topTravellers: [...normalizedPlayers].sort((left, right) => right.totalDistanceTravelledKm - left.totalDistanceTravelledKm).slice(0, 5).map(toSummary),
    topBlockMiners: [...normalizedPlayers].sort((left, right) => right.blocksMined - left.blocksMined).slice(0, 5).map(toSummary),
    topBlockPlacers: [...normalizedPlayers].sort((left, right) => right.blocksPlaced - left.blocksPlaced).slice(0, 5).map(toSummary),
    topCrafters: [...normalizedPlayers].sort((left, right) => right.itemsCrafted - left.itemsCrafted).slice(0, 5).map(toSummary),
    topMobKillers: [...normalizedPlayers].sort((left, right) => right.mobKills - left.mobKills).slice(0, 5).map(toSummary),
    topAdvancementPlayers: [...normalizedPlayers].sort((left, right) => right.advancementCount - left.advancementCount).slice(0, 5).map(toSummary),
    topRecipePlayers: [...normalizedPlayers].sort((left, right) => right.recipeCount - left.recipeCount).slice(0, 5).map(toSummary),
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
