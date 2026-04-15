import { Link } from "react-router-dom";

import { formatCompactNumber, formatDistance, formatDuration, formatNumber } from "../lib/format";
import type { PlayerSummary } from "../lib/types";

interface LeaderboardListProps {
  title: string;
  players: PlayerSummary[];
  metric: "playtime" | "kills" | "distance" | "advancements" | "recipes" | "blocksMined" | "blocksPlaced" | "itemsCrafted" | "mobKills";
}

export function LeaderboardList({ title, players, metric }: LeaderboardListProps) {
  function renderMetric(player: PlayerSummary) {
    if (metric === "playtime") {
      return formatDuration(player.playtimeHours);
    }
    if (metric === "distance") {
      return formatDistance(player.totalDistanceTravelledKm);
    }
    if (metric === "blocksMined") {
      return `${formatNumber(player.blocksMined)} mined`;
    }
    if (metric === "blocksPlaced") {
      return `${formatNumber(player.blocksPlaced)} placed`;
    }
    if (metric === "itemsCrafted") {
      return `${formatNumber(player.itemsCrafted)} crafted`;
    }
    if (metric === "mobKills") {
      return `${formatNumber(player.mobKills)} killed`;
    }
    if (metric === "advancements") {
      return `${formatNumber(player.advancementCount)} complete`;
    }
    if (metric === "recipes") {
      return `${formatNumber(player.recipeCount)} unlocked`;
    }
    return `${formatCompactNumber(player.mobKills + player.playerKills)} total`;
  }

  return (
    <section className="panel">
      <div className="panel-header">
        <h2>{title}</h2>
      </div>

      {players.length === 0 ? (
        <p className="muted">No data yet.</p>
      ) : (
        <ol className="leaderboard-list">
          {players.map((player, index) => (
            <li className="leaderboard-item" key={player.uuid}>
              <div>
                <p className="leaderboard-rank">#{formatNumber(index + 1)}</p>
                <Link className="leaderboard-name" to={`/players/${player.uuid}`}>
                  {player.name}
                </Link>
              </div>
              <p className="leaderboard-metric">{renderMetric(player)}</p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
