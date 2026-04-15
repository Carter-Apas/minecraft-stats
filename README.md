# Minecraft Survival Dashboard

Standalone read-only dashboard for `minecraft-survival.coder.kiwi`.

## What is included

- A file-backed API in [apps/api](/home/carter/Projects/personal/minecraft-stats/apps/api) that discovers the mounted Minecraft world, reads `stats`, `advancements`, `usercache.json`, and `whitelist.json`, normalizes the data, and serves JSON endpoints.
- A frontend in [apps/web](/home/carter/Projects/personal/minecraft-stats/apps/web) that renders an overview dashboard, player leaderboard, and per-player detail pages.
- Tests for API parsing and frontend loading/empty/detail rendering.
- Container and Kubernetes examples for running the API with a read-only world mount and exposing both apps on `minecraft-survival.coder.kiwi`.

## Expected data layout

The API mounts the Minecraft survival files read-only at `DATA_DIR` and discovers a world directory containing:

- `world/stats/*.json`
- `world/advancements/*.json`
- `usercache.json`
- `whitelist.json`
- optional `logs/latest.log`

`DATA_DIR` defaults to `/data`.

## API endpoints

- `GET /api/health`
- `GET /api/summary`
- `GET /api/players`
- `GET /api/players/:uuid`
- `GET /api/players/:uuid/advancements`

`/api/players` accepts:

- `sort=name|playtimeHours|deaths|playerKills|mobKills|advancementCount|totalDistanceTravelledKm|lastUpdated|isWhitelisted`
- `direction=asc|desc`
- `search=<player name or uuid fragment>`

## Normalized model notes

The API converts raw Minecraft stats into dashboard-facing fields:

- ticks to hours using `72,000 ticks = 1 hour`
- centimeters to kilometers for travel metrics
- `blocksMined`, `blocksPlaced`, `itemsCrafted`, and `itemsUsed` are aggregated totals
- `recentlySeenPlayers` is derived from stat and advancement file modification times

Raw Minecraft stat keys do not leak into the frontend contract.

## Local development

Install dependencies:

```bash
pnpm install
```

Run the API:

```bash
pnpm --filter @minecraft-stats/api dev
```

Run the frontend:

```bash
pnpm --filter @minecraft-stats/web dev
```

Set `VITE_API_BASE_URL` in [apps/web/.env.example](/home/carter/Projects/personal/minecraft-stats/apps/web/.env.example) if the frontend is not reverse-proxied to `/api`.

## Verification

```bash
pnpm test
pnpm build
```

## Deployment requirements

- Mount the Minecraft survival data into the API container as read-only at `/data`.
- Keep the API scheduled on the same node as the Minecraft server if the source data is still exposed through `hostPath`.
- The example manifest in [deploy/k8s/minecraft-survival-dashboard.yaml](/home/carter/Projects/personal/minecraft-stats/deploy/k8s/minecraft-survival-dashboard.yaml) assumes:
  - node label `minecraft-data=survival`
  - host path `/srv/minecraft/survival`
  - ingress host `minecraft-survival.coder.kiwi`

Adjust those values to match the actual cluster and host filesystem.
# minecraft-stats
