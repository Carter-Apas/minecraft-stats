import { NavLink, Outlet } from "react-router-dom";

export function AppShell() {
  return (
    <div className="app-shell">
      <aside className="side-rail">
        <div className="brand-block">
          <p className="brand-kicker">minecraft-survival.coder.kiwi</p>
          <h1>Minecraft Survival</h1>
          <p className="brand-copy">World stats, leaderboards, and per-player survival records.</p>
        </div>

        <nav className="nav-list" aria-label="Primary">
          <NavLink className="nav-link" to="/">
            Overview
          </NavLink>
          <NavLink className="nav-link" to="/players">
            Players
          </NavLink>
        </nav>
      </aside>

      <main className="main-pane">
        <Outlet />
      </main>
    </div>
  );
}

