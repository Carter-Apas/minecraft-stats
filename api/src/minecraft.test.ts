import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";

import { createApp } from "./app.js";
import { loadMinecraftDataset } from "./minecraft.js";

const tempDirs: string[] = [];

async function makeTempDir() {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "mc-stats-"));
  tempDirs.push(tempDir);
  return tempDir;
}

async function seedWorld(rootPath: string) {
  const worldPath = path.join(rootPath, "world");
  await fs.mkdir(path.join(worldPath, "stats"), { recursive: true });
  await fs.mkdir(path.join(worldPath, "advancements"), { recursive: true });

  const uuid = "11111111-1111-1111-1111-111111111111";

  await fs.writeFile(
    path.join(rootPath, "usercache.json"),
    JSON.stringify([{ uuid, name: "BuilderBee" }], null, 2),
  );
  await fs.writeFile(
    path.join(rootPath, "whitelist.json"),
    JSON.stringify([{ uuid, name: "BuilderBee" }], null, 2),
  );
  await fs.writeFile(
    path.join(worldPath, "stats", `${uuid}.json`),
    JSON.stringify({
      stats: {
        "minecraft:custom": {
          "minecraft:play_time": 144_000,
          "minecraft:deaths": 3,
          "minecraft:player_kills": 2,
          "minecraft:mob_kills": 17,
          "minecraft:walk_one_cm": 123_400,
          "minecraft:boat_one_cm": 50_000,
          "minecraft:aviate_one_cm": 25_000,
          "minecraft:jump": 91,
        },
        "minecraft:mined": {
          "minecraft:stone": 42,
          "minecraft:diamond_ore": 3,
        },
        "minecraft:crafted": {
          "minecraft:crafting_table": 1,
          "minecraft:bread": 5,
        },
        "minecraft:used": {
          "minecraft:iron_pickaxe": 40,
          "minecraft:bread": 12,
          "minecraft:torch": 18,
          "minecraft:cobblestone": 25,
        },
        "minecraft:killed": {
          "minecraft:zombie": 9,
          "minecraft:skeleton": 4,
        },
      },
    }, null, 2),
  );
  await fs.writeFile(
    path.join(worldPath, "advancements", `${uuid}.json`),
    JSON.stringify({
      "minecraft:story/mine_stone": {
        done: true,
        criteria: {
          stone: "2026-04-01 10:00:00 +0000",
        },
      },
      "minecraft:story/root": {
        done: true,
        criteria: {
          root: "2026-03-31 10:00:00 +0000",
        },
      },
      "minecraft:adventure/kill_a_mob": {
        done: false,
        criteria: {},
      },
    }, null, 2),
  );

  return { uuid };
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe("loadMinecraftDataset", () => {
  it("parses stats, mappings, and advancements into normalized models", async () => {
    const tempDir = await makeTempDir();
    const { uuid } = await seedWorld(tempDir);

    const dataset = await loadMinecraftDataset(tempDir);
    expect(dataset.summary.playerCount).toBe(1);
    expect(dataset.summary.totalPlaytimeHours).toBe(2);
    expect(dataset.summary.totalDeaths).toBe(3);

    const player = dataset.players[0];
    expect(player.uuid).toBe(uuid);
    expect(player.name).toBe("BuilderBee");
    expect(player.isWhitelisted).toBe(true);
    expect(player.totalDistanceTravelledKm).toBe(1.98);
    expect(player.blocksMined).toBe(45);
    expect(player.blocksPlaced).toBe(43);
    expect(player.itemsCrafted).toBe(6);
    expect(player.itemsUsed).toBe(95);
    expect(player.advancementCount).toBe(2);
    expect(player.statBreakdown.mobsKilledByType[0]).toMatchObject({
      key: "minecraft:zombie",
      value: 9,
    });
  });

  it("handles empty or missing worlds without crashing", async () => {
    const tempDir = await makeTempDir();
    const dataset = await loadMinecraftDataset(tempDir);

    expect(dataset.summary.playerCount).toBe(0);
    expect(dataset.players).toEqual([]);
    expect(dataset.warnings.length).toBeGreaterThanOrEqual(0);
  });

  it("records malformed json warnings and still returns the remaining dataset", async () => {
    const tempDir = await makeTempDir();
    await seedWorld(tempDir);
    const statsDir = path.join(tempDir, "world", "stats");
    await fs.writeFile(path.join(statsDir, "broken.json"), "{not-json");

    const dataset = await loadMinecraftDataset(tempDir);
    expect(dataset.summary.playerCount).toBe(1);
    expect(dataset.warnings.some((warning) => warning.includes("broken.json"))).toBe(true);
    expect(dataset.players.find((player) => player.uuid === "broken")).toBeUndefined();
  });
});

describe("api routes", () => {
  it("serves summary, players, and player detail", async () => {
    const tempDir = await makeTempDir();
    const { uuid } = await seedWorld(tempDir);
    const app = createApp({
      port: 0,
      dataDir: tempDir,
      cacheTtlMs: 1_000,
    });

    const summaryResponse = await request(app).get("/api/summary");
    expect(summaryResponse.status).toBe(200);
    expect(summaryResponse.body.playerCount).toBe(1);

    const playersResponse = await request(app).get("/api/players?sort=deaths&direction=desc");
    expect(playersResponse.status).toBe(200);
    expect(playersResponse.body.players[0].name).toBe("BuilderBee");

    const detailResponse = await request(app).get(`/api/players/${uuid}`);
    expect(detailResponse.status).toBe(200);
    expect(detailResponse.body.uuid).toBe(uuid);

    const missingResponse = await request(app).get("/api/players/missing");
    expect(missingResponse.status).toBe(404);
  });
});
