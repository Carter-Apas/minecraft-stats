import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { OverviewPage } from "./pages/OverviewPage";
import { PlayerDetailPage } from "./pages/PlayerDetailPage";
import { PlayersPage } from "./pages/PlayersPage";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("frontend pages", () => {
  it("shows a loading state for the overview page before data resolves", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => undefined)));

    render(
      <MemoryRouter>
        <OverviewPage />
      </MemoryRouter>,
    );

    expect(screen.getByText("Loading server summary")).toBeInTheDocument();
  });

  it("shows an empty state when the player list is empty", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({
        players: [],
        sort: { field: "playtimeHours", direction: "desc" },
      }),
    })));

    render(
      <MemoryRouter>
        <PlayersPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("No tracked players yet")).toBeInTheDocument();
    });
  });

  it("renders the player table from api data", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({
        players: [
          {
            uuid: "abc",
            name: "BuilderBee",
            isWhitelisted: true,
            playtimeHours: 10,
            deaths: 3,
            playerKills: 2,
            mobKills: 20,
            totalDistanceTravelledKm: 12.5,
            distanceWalkedKm: 10.4,
            distanceFlownKm: 1,
            distanceBoatedKm: 1.1,
            distanceMinecartKm: 0,
            jumps: 100,
            blocksMined: 40,
            blocksPlaced: 50,
            itemsCrafted: 5,
            itemsUsed: 9,
            advancementCount: 6,
            lastUpdated: "2026-04-15T08:00:00.000Z",
          },
        ],
        sort: { field: "playtimeHours", direction: "desc" },
      }),
    })));

    render(
      <MemoryRouter>
        <PlayersPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole("link", { name: "BuilderBee" })).toBeInTheDocument();
    });
    expect(screen.getByText("6")).toBeInTheDocument();
  });

  it("renders the player detail page", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({
        uuid: "abc",
        name: "BuilderBee",
        isWhitelisted: true,
        playtimeHours: 10,
        deaths: 3,
        playerKills: 2,
        mobKills: 20,
        totalDistanceTravelledKm: 12.5,
        distanceWalkedKm: 10.4,
        distanceFlownKm: 1,
        distanceBoatedKm: 1.1,
        distanceMinecartKm: 0,
        jumps: 100,
        blocksMined: 40,
        blocksPlaced: 50,
        itemsCrafted: 5,
        itemsUsed: 9,
        advancementCount: 1,
        lastUpdated: "2026-04-15T08:00:00.000Z",
        statBreakdown: {
          mobsKilledByType: [{ key: "minecraft:zombie", label: "Zombie", value: 12 }],
          blocksMinedByType: [{ key: "minecraft:stone", label: "Stone", value: 40 }],
          blocksPlacedByType: [{ key: "minecraft:torch", label: "Torch", value: 10 }],
          itemsCraftedByType: [{ key: "minecraft:bread", label: "Bread", value: 5 }],
          itemsUsedByType: [{ key: "minecraft:iron_pickaxe", label: "Iron Pickaxe", value: 9 }],
        },
        advancements: [
          {
            key: "minecraft:story/mine_stone",
            label: "Story Mine Stone",
            done: true,
            completedAt: "2026-04-10T08:00:00.000Z",
            criteriaCompleted: 1,
            criteriaTotal: 1,
          },
          {
            key: "minecraft:adventure/root",
            label: "Adventure Root",
            done: false,
            completedAt: null,
            criteriaCompleted: 0,
            criteriaTotal: 0,
          },
        ],
      }),
    })));

    render(
      <MemoryRouter initialEntries={["/players/abc"]}>
        <Routes>
          <Route element={<PlayerDetailPage />} path="/players/:uuid" />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("BuilderBee")).toBeInTheDocument();
    });
    expect(screen.getByText("Advancement progress")).toBeInTheDocument();
    expect(screen.getByText("Mobs killed")).toBeInTheDocument();
  });
});
