# Minecraft Survival Dashboard

Standalone read-only dashboard for `minecraft-survival.coder.kiwi`.

## What is included

- A file-backed API in [apps/api](/home/carter/Projects/personal/minecraft-stats/apps/api) that discovers the mounted Minecraft world, reads `stats`, `advancements`, `usercache.json`, and `whitelist.json`, normalizes the data, and serves JSON endpoints.
- A frontend in [apps/web](/home/carter/Projects/personal/minecraft-stats/apps/web) that renders an overview dashboard, player leaderboard, and per-player detail pages.
- Tests for API parsing and frontend loading/empty/detail rendering.
- Dockerfiles for the API and frontend images.

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

Install API dependencies:

```bash
cd apps/api
npm install
```

Run the API:

```bash
cd apps/api
npm run dev
```

Install frontend dependencies:

```bash
cd apps/web
npm install
```

Run the frontend:

```bash
cd apps/web
npm run dev
```

Set `VITE_API_BASE_URL` in [apps/web/.env.example](/home/carter/Projects/personal/minecraft-stats/apps/web/.env.example) if the frontend is not reverse-proxied to `/api`.

## Verification

```bash
cd apps/api && npm test && npm run build
cd apps/web && npm test && npm run build
```

## Deployment

The app has no database and is intended to stay read-only against the Minecraft data directory.

The API container or process must be able to read a directory containing:

- `world/stats/*.json`
- `world/advancements/*.json`
- `usercache.json`
- `whitelist.json`
- optional `logs/latest.log`

Set `DATA_DIR` to that directory. In production, mount it read-only.

### If you deploy with containers

- Mount the Minecraft survival data into the API container as read-only at `/data`.
- Keep the API scheduled on the same node as the Minecraft server if the source data is still exposed through `hostPath`.
- Publish the API image from [Dockerfile.api](/home/carter/Projects/personal/minecraft-stats/Dockerfile.api).
- Publish the frontend image from [Dockerfile.web](/home/carter/Projects/personal/minecraft-stats/Dockerfile.web).
- If you are using Kubernetes with `hostPath`, the API pod needs node affinity or some equivalent scheduling rule so it lands on the same node that has the Minecraft files.
- If you expose the app on `minecraft-survival.coder.kiwi`, route `/api` to the API service and `/` to the frontend service.

### If you deploy without containers

- Run the API with `node apps/api/dist/index.js`.
- Serve `apps/web/dist` from nginx or Caddy.
- Reverse-proxy `/api` to the API process.
