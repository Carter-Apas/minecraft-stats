import cors from "cors";
import express from "express";

import { createCache } from "./cache.js";
import type { ApiConfig } from "./config.js";
import { loadMinecraftDataset, sortPlayers } from "./minecraft.js";

const ALLOWED_SORT_FIELDS = new Set([
  "name",
  "playtimeHours",
  "deaths",
  "playerKills",
  "mobKills",
  "advancementCount",
  "totalDistanceTravelledKm",
  "lastUpdated",
  "isWhitelisted",
]);

export function createApp(config: ApiConfig) {
  const app = express();
  const cache = createCache(config.cacheTtlMs, () => loadMinecraftDataset(config.dataDir));

  app.use(cors());

  app.get("/api/health", async (_request, response) => {
    const { value, ageMs } = await cache.get();
    response.json({
      ok: true,
      cacheAgeMs: ageMs,
      playerCount: value.players.length,
      warnings: value.warnings,
      paths: value.summary.paths,
    });
  });

  app.get("/api/summary", async (_request, response) => {
    const { value } = await cache.get();
    response.json(value.summary);
  });

  app.get("/api/players", async (request, response) => {
    const sortField = typeof request.query.sort === "string" && ALLOWED_SORT_FIELDS.has(request.query.sort)
      ? request.query.sort
      : "playtimeHours";
    const sortDirection = request.query.direction === "asc" ? "asc" : "desc";
    const search = typeof request.query.search === "string" ? request.query.search.trim().toLowerCase() : "";

    const { value } = await cache.get();
    const filteredPlayers = value.players
      .map((player) => ({
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
      }))
      .filter((player) => !search || player.name.toLowerCase().includes(search) || player.uuid.includes(search));

    response.json({
      players: sortPlayers(filteredPlayers, sortField, sortDirection),
      sort: {
        field: sortField,
        direction: sortDirection,
      },
    });
  });

  app.get("/api/players/:uuid", async (request, response) => {
    const { value } = await cache.get();
    const player = value.players.find((entry) => entry.uuid === request.params.uuid);
    if (!player) {
      response.status(404).json({ error: "Player not found" });
      return;
    }
    response.json(player);
  });

  app.get("/api/players/:uuid/advancements", async (request, response) => {
    const { value } = await cache.get();
    const player = value.players.find((entry) => entry.uuid === request.params.uuid);
    if (!player) {
      response.status(404).json({ error: "Player not found" });
      return;
    }
    response.json({
      uuid: player.uuid,
      name: player.name,
      advancementCount: player.advancementCount,
      advancements: player.advancements,
    });
  });

  return app;
}

