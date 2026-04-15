import { Link } from "react-router-dom";

import { formatDistance, formatDuration, formatNumber } from "../lib/format";
import type { PlayerSummary } from "../lib/types";

interface PlayersTableProps {
  players: PlayerSummary[];
}

export function PlayersTable({ players }: PlayersTableProps) {
  return (
    <div className="table-wrap">
      <table className="players-table">
        <thead>
          <tr>
            <th>Player</th>
            <th>Playtime</th>
            <th>Deaths</th>
            <th>Kills</th>
            <th>Distance</th>
            <th>Gameplay Adv.</th>
            <th>Recipes</th>
            <th>Whitelist</th>
          </tr>
        </thead>
        <tbody>
          {players.map((player) => (
            <tr key={player.uuid}>
              <td>
                <Link className="table-link" to={`/players/${player.uuid}`}>
                  {player.name}
                </Link>
              </td>
              <td>{formatDuration(player.playtimeHours)}</td>
              <td>{formatNumber(player.deaths)}</td>
              <td>{formatNumber(player.mobKills + player.playerKills)}</td>
              <td>{formatDistance(player.totalDistanceTravelledKm)}</td>
              <td>{formatNumber(player.advancementCount)}</td>
              <td>{formatNumber(player.recipeCount)}</td>
              <td>{player.isWhitelisted ? "Yes" : "No"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
