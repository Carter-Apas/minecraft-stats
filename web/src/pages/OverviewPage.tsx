import { LeaderboardList } from "../components/LeaderboardList";
import { MetricCard } from "../components/MetricCard";
import { StatePanel } from "../components/StatePanel";
import { useSummary } from "../lib/api";
import { formatDistance, formatDuration, formatNumber } from "../lib/format";

export function OverviewPage() {
  const { data, error, loading } = useSummary();

  if (loading) {
    return <StatePanel title="Loading server summary" body="Reading Minecraft world files and building the latest snapshot." />;
  }

  if (error || !data) {
    return <StatePanel title="Summary unavailable" body={error ?? "The API returned no summary payload."} />;
  }

  return (
    <div className="page">
      <section className="hero-panel">
        <div>
          <p className="eyebrow">Server overview</p>
          <h1>{data.title}</h1>
          <p className="hero-copy">
            File-backed, read-only dashboard data normalized from the survival world on disk.
          </p>
        </div>
      </section>

      <section className="metric-grid">
        <MetricCard label="Tracked players" value={formatNumber(data.playerCount)} />
        <MetricCard label="Total playtime" value={formatDuration(data.totalPlaytimeHours)} />
        <MetricCard label="Total distance travelled" value={formatDistance(data.totalDistanceTravelledKm)} />
        <MetricCard label="Total blocks mined" value={formatNumber(data.totalBlocksMined)} />
        <MetricCard label="Total blocks placed" value={formatNumber(data.totalBlocksPlaced)} />
        <MetricCard label="Total mobs killed" value={formatNumber(data.totalMobKills)} />
        <MetricCard label="Total deaths" value={formatNumber(data.totalDeaths)} />
      </section>

      <section className="feature-grid">
        <LeaderboardList title="Top 5 by playtime" players={data.topPlayers} metric="playtime" />
        <LeaderboardList title="Top 5 by gameplay advancements" players={data.topAdvancementPlayers} metric="advancements" />
        <LeaderboardList title="Top 5 by recipe unlocks" players={data.topRecipePlayers} metric="recipes" />
        <LeaderboardList title="Top 5 by distance travelled" players={data.topTravellers} metric="distance" />
        <LeaderboardList title="Top 5 by blocks mined" players={data.topBlockMiners} metric="blocksMined" />
        <LeaderboardList title="Top 5 by blocks placed" players={data.topBlockPlacers} metric="blocksPlaced" />
        <LeaderboardList title="Top 5 by mobs killed" players={data.topMobKillers} metric="mobKills" />
        <LeaderboardList title="Top 5 by items crafted" players={data.topCrafters} metric="itemsCrafted" />
      </section>

      <section className="panel recent-panel">
        <div className="panel-header">
          <h2>Recently seen</h2>
        </div>
        {data.recentlySeenPlayers.length === 0 ? (
          <p className="muted">Recent activity is not derivable from the current files yet.</p>
        ) : (
          <ul className="recent-list">
            {data.recentlySeenPlayers.map((player) => (
              <li key={player.uuid}>
                <span>{player.name}</span>
                <span>{player.lastUpdated ? new Date(player.lastUpdated).toLocaleDateString("en-NZ") : "Unknown"}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
