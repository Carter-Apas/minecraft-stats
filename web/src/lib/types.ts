export interface PlayerSummary {
  uuid: string;
  name: string;
  isWhitelisted: boolean;
  playtimeHours: number;
  deaths: number;
  playerKills: number;
  mobKills: number;
  totalDistanceTravelledKm: number;
  distanceWalkedKm: number;
  distanceFlownKm: number;
  distanceBoatedKm: number;
  distanceMinecartKm: number;
  jumps: number;
  blocksMined: number;
  blocksPlaced: number;
  itemsCrafted: number;
  itemsUsed: number;
  advancementCount: number;
  recipeCount: number;
  availableAdvancementCount: number;
  availableRecipeCount: number;
  lastUpdated: string | null;
}

export interface PlayerDetail extends PlayerSummary {
  statBreakdown: {
    mobsKilledByType: Array<{ key: string; label: string; value: number }>;
    blocksMinedByType: Array<{ key: string; label: string; value: number }>;
    blocksPlacedByType: Array<{ key: string; label: string; value: number }>;
    itemsCraftedByType: Array<{ key: string; label: string; value: number }>;
    itemsUsedByType: Array<{ key: string; label: string; value: number }>;
  };
  advancements: Array<{
    key: string;
    label: string;
    isRecipe: boolean;
    done: boolean;
    completedAt: string | null;
    criteriaCompleted: number;
    criteriaTotal: number;
  }>;
}

export interface SummaryResponse {
  title: string;
  playerCount: number;
  totalPlaytimeHours: number;
  totalDeaths: number;
  totalMobKills: number;
  totalPlayerKills: number;
  totalBlocksMined: number;
  totalBlocksPlaced: number;
  totalDistanceTravelledKm: number;
  topPlayers: PlayerSummary[];
  topKillers: PlayerSummary[];
  topTravellers: PlayerSummary[];
  topBlockMiners: PlayerSummary[];
  topBlockPlacers: PlayerSummary[];
  topCrafters: PlayerSummary[];
  topMobKillers: PlayerSummary[];
  topAdvancementPlayers: PlayerSummary[];
  topRecipePlayers: PlayerSummary[];
  recentlySeenPlayers: PlayerSummary[];
  paths: {
    dataDir: string;
    worldDir: string | null;
    statsDir: string | null;
    advancementsDir: string | null;
    usercachePath: string | null;
    whitelistPath: string | null;
    latestLogPath: string | null;
  };
}

export interface PlayersResponse {
  players: PlayerSummary[];
  sort: {
    field: string;
    direction: "asc" | "desc";
  };
}
