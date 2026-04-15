import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { AppShell } from "./components/AppShell";
import { OverviewPage } from "./pages/OverviewPage";
import { PlayerDetailPage } from "./pages/PlayerDetailPage";
import { PlayersPage } from "./pages/PlayersPage";

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppShell />} path="/">
        <Route element={<OverviewPage />} index />
        <Route element={<PlayersPage />} path="players" />
        <Route element={<PlayerDetailPage />} path="players/:uuid" />
        <Route element={<Navigate replace to="/" />} path="*" />
      </Route>
    </Routes>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}

