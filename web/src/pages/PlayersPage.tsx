import { useMemo, useState } from "react";

import { PlayersTable } from "../components/PlayersTable";
import { StatePanel } from "../components/StatePanel";
import { usePlayers } from "../lib/api";
import type { PlayerSummary } from "../lib/types";

const SORT_OPTIONS: Array<{ label: string; field: keyof PlayerSummary }> = [
  { label: "Most playtime", field: "playtimeHours" },
  { label: "Most deaths", field: "deaths" },
  { label: "Most kills", field: "mobKills" },
  { label: "Most gameplay advancements", field: "advancementCount" },
  { label: "Most recipe unlocks", field: "recipeCount" },
];

export function PlayersPage() {
  const { data, error, loading } = usePlayers();
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<keyof PlayerSummary>("playtimeHours");

  const players = useMemo(() => {
    const items = data?.players ?? [];
    const filtered = items.filter((player) => {
      const needle = search.trim().toLowerCase();
      if (!needle) {
        return true;
      }
      return player.name.toLowerCase().includes(needle) || player.uuid.includes(needle);
    });

    return [...filtered].sort((left, right) => {
      const leftValue = left[sortField];
      const rightValue = right[sortField];

      if (typeof leftValue === "number" && typeof rightValue === "number") {
        return rightValue - leftValue;
      }

      if (typeof leftValue === "boolean" && typeof rightValue === "boolean") {
        return Number(rightValue) - Number(leftValue);
      }

      if (typeof leftValue === "string" && typeof rightValue === "string") {
        return leftValue.localeCompare(rightValue);
      }

      return 0;
    });
  }, [data?.players, search, sortField]);

  if (loading) {
    return <StatePanel title="Loading players" body="Pulling the normalized leaderboard from the API." />;
  }

  if (error || !data) {
    return <StatePanel title="Players unavailable" body={error ?? "The API returned no player list."} />;
  }

  return (
    <div className="page">
      <section className="page-header">
        <div>
          <p className="eyebrow">Players</p>
          <h1>Leaderboard</h1>
        </div>
        <div className="toolbar">
          <input
            aria-label="Search players"
            className="control"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name or UUID"
            value={search}
          />
          <select
            aria-label="Sort players"
            className="control"
            onChange={(event) => setSortField(event.target.value as keyof PlayerSummary)}
            value={sortField}
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.field} value={option.field}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </section>

      {players.length === 0 ? (
        <StatePanel title="No tracked players yet" body="The world files are present, but no usable player stats were found." />
      ) : (
        <PlayersTable players={players} />
      )}
    </div>
  );
}
