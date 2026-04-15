import type { ReactNode } from "react";

interface StatePanelProps {
  title: string;
  body: ReactNode;
}

export function StatePanel({ title, body }: StatePanelProps) {
  return (
    <section className="state-panel">
      <p className="state-label">{title}</p>
      <div className="state-body">{body}</div>
    </section>
  );
}

