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

  const advancementProgress = data.advancements.length
    ? data.advancementCount / data.advancements.length
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
      </section>

      <section className="advancement-strip panel">
        <div className="panel-header">
          <h2>Advancement progress</h2>
          <p>{formatPercent(advancementProgress)}</p>
        </div>
        <div className="progress-track" aria-label="Advancement progress">
          <div className="progress-fill" style={{ width: `${Math.round(advancementProgress * 100)}%` }} />
        </div>
        <p className="muted">
          {formatNumber(data.advancementCount)} complete of {formatNumber(data.advancements.length)} tracked advancements.
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

