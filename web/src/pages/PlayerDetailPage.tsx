import { useParams } from "react-router-dom";

import { BreakdownList } from "../components/BreakdownList";
import { MetricCard } from "../components/MetricCard";
import { StatePanel } from "../components/StatePanel";
import { usePlayer } from "../lib/api";
import { formatDate, formatDistance, formatDuration, formatNumber, formatPercent } from "../lib/format";

export function PlayerDetailPage() {
  const { uuid } = useParams();
  const { data, error, loading } = usePlayer(uuid);

  if (loading) {
    return <StatePanel title="Loading player record" body="Reading the latest stat and advancement snapshot for this player." />;
  }

  if (error || !data) {
    return <StatePanel title="Player unavailable" body={error ?? "The API returned no player detail."} />;
  }

  const advancementProgress = data.availableAdvancementCount
    ? data.advancementCount / data.availableAdvancementCount
    : 0;
  const recipeProgress = data.availableRecipeCount
    ? data.recipeCount / data.availableRecipeCount
    : 0;

  return (
    <div className="page">
      <section className="hero-panel detail-hero">
        <div>
          <p className="eyebrow">Player record</p>
          <h1>{data.name}</h1>
          <p className="hero-copy">
            UUID <code>{data.uuid}</code>
          </p>
        </div>
        <div className="player-badge-stack">
          <span className={`player-chip ${data.isWhitelisted ? "is-on" : "is-off"}`}>
            {data.isWhitelisted ? "Whitelisted" : "Not whitelisted"}
          </span>
          <span className="player-chip neutral">Updated {formatDate(data.lastUpdated)}</span>
        </div>
      </section>

      <section className="metric-grid">
        <MetricCard label="Playtime" value={formatDuration(data.playtimeHours)} />
        <MetricCard label="Deaths" value={formatNumber(data.deaths)} />
        <MetricCard label="Kills" value={formatNumber(data.mobKills + data.playerKills)} hint={`${formatNumber(data.playerKills)} player / ${formatNumber(data.mobKills)} mob`} />
        <MetricCard label="Distance" value={formatDistance(data.totalDistanceTravelledKm)} />
        <MetricCard label="Gameplay advancements" value={formatNumber(data.advancementCount)} />
        <MetricCard label="Recipe unlocks" value={formatNumber(data.recipeCount)} />
        <MetricCard label="Blocks mined" value={formatNumber(data.blocksMined)} />
        <MetricCard label="Blocks placed" value={formatNumber(data.blocksPlaced)} />
      </section>

      <section className="advancement-strip panel">
        <div className="panel-header">
          <h2>Gameplay advancement progress</h2>
          <p>{formatPercent(advancementProgress)}</p>
        </div>
        <div className="progress-track" aria-label="Advancement progress">
          <div className="progress-fill" style={{ width: `${Math.round(advancementProgress * 100)}%` }} />
        </div>
        <p className="muted">
          {formatNumber(data.advancementCount)} gameplay advancements complete of {formatNumber(data.availableAdvancementCount)}.
        </p>
        <div className="panel-header secondary-progress">
          <h2>Recipe unlock progress</h2>
          <p>{formatPercent(recipeProgress)}</p>
        </div>
        <div className="progress-track recipe-track" aria-label="Recipe unlock progress">
          <div className="progress-fill recipe-fill" style={{ width: `${Math.round(recipeProgress * 100)}%` }} />
        </div>
        <p className="muted">
          {formatNumber(data.recipeCount)} recipe unlocks complete of {formatNumber(data.availableRecipeCount)}.
        </p>
      </section>

      <section className="feature-grid detail-grid">
        <BreakdownList title="Mobs killed" entries={data.statBreakdown.mobsKilledByType} />
        <BreakdownList title="Blocks mined" entries={data.statBreakdown.blocksMinedByType} />
        <BreakdownList title="Blocks placed" entries={data.statBreakdown.blocksPlacedByType} />
        <BreakdownList title="Items crafted" entries={data.statBreakdown.itemsCraftedByType} />
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>Movement breakdown</h2>
        </div>
        <dl className="stats-grid">
          <div>
            <dt>Walked</dt>
            <dd>{formatDistance(data.distanceWalkedKm)}</dd>
          </div>
          <div>
            <dt>Flown</dt>
            <dd>{formatDistance(data.distanceFlownKm)}</dd>
          </div>
          <div>
            <dt>Boated</dt>
            <dd>{formatDistance(data.distanceBoatedKm)}</dd>
          </div>
          <div>
            <dt>Minecart</dt>
            <dd>{formatDistance(data.distanceMinecartKm)}</dd>
          </div>
          <div>
            <dt>Jumps</dt>
            <dd>{formatNumber(data.jumps)}</dd>
          </div>
          <div>
            <dt>Items used</dt>
            <dd>{formatNumber(data.itemsUsed)}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
