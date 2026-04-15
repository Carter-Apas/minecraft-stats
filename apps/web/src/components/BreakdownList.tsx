import { formatCompactNumber } from "../lib/format";

interface BreakdownListProps {
  title: string;
  entries: Array<{
    key: string;
    label: string;
    value: number;
  }>;
}

export function BreakdownList({ title, entries }: BreakdownListProps) {
  return (
    <section className="panel">
      <div className="panel-header">
        <h2>{title}</h2>
      </div>

      {entries.length === 0 ? (
        <p className="muted">No recorded events.</p>
      ) : (
        <ul className="breakdown-list">
          {entries.map((entry) => (
            <li className="breakdown-item" key={entry.key}>
              <span>{entry.label}</span>
              <strong>{formatCompactNumber(entry.value)}</strong>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

