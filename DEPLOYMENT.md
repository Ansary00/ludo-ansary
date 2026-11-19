# Zero-cost deployment guide

**Live deployment:** <https://ludo-ansary.onrender.com> (Render Free, blueprint
`render.yaml`, repository <https://github.com/Ansary00/ludo-ansary>).

This project is designed to run as **one Node.js service** that serves the
built React client, the HTTP API, and Socket.IO from the same origin. That is
the simplest and cheapest deployment: no separate static host, no CORS
configuration, no database, and no paid APIs.

The recommended host is **Render's Free web service**. The facts below were
checked against Render's documentation on **November 19, 2026**.

## Why Render

- Free web services are available on a free account, with automatic HTTPS and a
  free `onrender.com` subdomain.
- WebSockets are supported, including on Free instances. Socket.IO works without
  a separate realtime service.
- A Free instance is 0.1 CPU / 512 MB RAM, which is comfortably enough for many
  private Ludo rooms.
- Each workspace gets **750 free instance hours per month**. A service that runs
  continuously for a whole month uses roughly 730 hours, so one always-on
  service fits, and spin-down periods use fewer hours.
- Free instances spin down after **15 minutes without inbound traffic** and take
  about **one minute** to wake. Inbound WebSocket messages count as traffic, so
  an actively connected game stays awake. An idle lobby can still spin down.
- The filesystem is ephemeral. Room state lives in memory and is **lost on
  restart, redeploy, or spin-down**. This is expected for a zero-cost,
  database-free game.

Sources:

- <https://render.com/docs/free>
- <https://render.com/docs/web-services>

### Important free-tier caveats

| Caveat                       | What it means for this game                                             |
| ---------------------------- | ----------------------------------------------------------------------- |
| Spin-down after 15 min idle  | First visitor after a quiet period waits about a minute.                |
| Ephemeral memory             | A restart or spin-down clears all rooms and games.                     |
| Single instance only         | No horizontal scaling. Room state cannot be shared across instances.   |
| 750 instance hours/month     | Enough for one service; multiple always-on free services are not.      |
| Bandwidth/build limits       | Extreme traffic can suspend Free services until the next month.        |
| No persistent disk           | Do not add SQLite or file uploads without a paid database/disk.         |

For a private game among friends, these tradeoffs are usually fine. Keep the
invite link active, and expect a short wake-up delay after long idle periods.

## Option A — Deploy with the included blueprint (recommended)

The repository includes `render.yaml`, which declares the service, build
command, start command, health check, and free plan.

### 1. Put the project on GitHub

Render deploys from a Git repository. If the project is not in one yet:

```bash
git init
git add .
git commit -m "Ludo ANSARY"
git branch -M main
git remote add origin https://github.com/<you>/<repo>.git
git push -u origin main
```

`node_modules`, `client/dist`, `server/dist`, and log files are already ignored.

If Git is not installed on your computer, install Git for Windows, use GitHub
Desktop, or upload the folder through the GitHub web interface. Render only
needs the repository; it does not need a local Git client.

> The game does not need a database or any environment secrets, so the whole
> repository can be public.

### 2. Create the Render service

1. Sign in at <https://dashboard.render.com> with GitHub.
2. Click **New → Blueprint**.
3. Connect the repository that contains this project.
4. Render detects `render.yaml`. Review the service and click **Apply**.
5. Wait for the build to finish. The first build installs dependencies and
   creates both bundles.
6. Open the generated `https://<service-name>.onrender.com` URL.

If the service name is already taken, change `name:` in `render.yaml` (for
example `ludo-ansary-yourname`) and apply again.

The blueprint uses:

```yaml
buildCommand: npm ci --include=dev && npm run build
startCommand: npm start
healthCheckPath: /api/health
plan: free
```

- `--include=dev` is required because Vite, TypeScript, and esbuild are
  devDependencies, even when `NODE_ENV=production` is set.
- `npm start` runs the bundled server at `server/dist/index.js`.
- The server serves `client/dist`, so there is no second deployment.
- `NODE_VERSION=24.22.1` pins Render's current documented Node 24 LTS default.
  If Render's supported versions change, use any current 22.x or 24.x release.

### 3. Verify the deployment

Open these URLs:

```text
https://<service>.onrender.com/api/health
https://<service>.onrender.com/
```

`/api/health` should return JSON similar to:

```json
{ "ok": true, "uptimeSeconds": 42, "rooms": 0, "players": 0, "now": 1795026793523 }
```

Then run a real two-browser check:

1. Create a 2-player room on the deployed URL.
2. Copy the invite link and open it in a private window or another device.
3. Join, ready up, and start.
4. Roll and move from both sides. The board should update immediately.
5. Refresh one browser. The player should return to the same seat, not join a
   new one.
6. In browser DevTools → **Network → WS**, confirm a `101 Switching Protocols`
   connection to `/socket.io/`.

If the board does not sync but the page loads, the host or a proxy is probably
blocking WebSocket upgrades. Render's Node runtime does not.

## Option B — Create the service manually

Use this if you prefer not to use a blueprint.

1. Push the project to GitHub.
2. In Render, click **New → Web Service** and connect the repository.
3. Set:
   - **Language / Runtime:** Node
   - **Build Command:** `npm ci --include=dev && npm run build`
   - **Start Command:** `npm start`
   - **Instance Type / Plan:** Free
   - **Health Check Path:** `/api/health`
4. Add environment variables:
   - `NODE_VERSION=24.22.1`
   - `NODE_ENV=production`
5. Deploy and open the generated URL.

Render supplies `PORT`; the server reads it automatically. Do not hard-code a
port in the start command.

## Option C — Docker on any container host

A multi-stage `Dockerfile` is included. It builds the client and server, then
runs only production dependencies.

```bash
docker build -t ludo-ansary .
docker run --rm -p 8080:8080 ludo-ansary
```

Open <http://localhost:8080>. The container listens on `PORT=8080` by default;
override it with `-e PORT=<port>` and publish the same port.

The image works on any free container host that supports long-lived WebSocket
connections. Check that host's free plan before relying on it.

## Other free hosts checked

| Host    | Status (November 2026)                                                                                                                       | Recommendation |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| Render  | Free web services, WebSockets, 750 instance hours/month, spin-down after 15 min.                                                              | **Recommended** |
| Railway | Free plan with **$1 of usage credit per month**; services sleep after 5–10 minutes; 1 project, 0.5 GB RAM.                                   | Possible for very light use, but the credit is easy to exhaust. |
| Koyeb   | No free compute tier on the current pricing page; Pro starts at $29/month plus compute.                                                       | Not suitable for zero cost. |

Railway pricing source: <https://railway.com/pricing>

Koyeb pricing source: <https://www.koyeb.com/pricing>

## Optional: custom domain

Render provides free TLS certificates and supports custom domains on Free web
services. The domain registration itself is not free, but the setup is. Add the
domain in the Render dashboard and follow the DNS instructions; no application
change is needed.

If you do not want to pay for a domain, use the free
`https://<service>.onrender.com` address.

## Optional: split client and server

The default single-service setup is strongly recommended. If you deliberately
want the client on a static host and the server on Render:

1. Deploy the server with `CLIENT_ORIGINS=https://your-client.example`.
2. Build the client with `VITE_SERVER_URL=https://your-server.onrender.com`.
3. Deploy `client/dist` to the static host.

Notes:

- `VITE_SERVER_URL` is read at **build time**, not runtime. Changing it requires
  a rebuild.
- Use the exact client origin in `CLIENT_ORIGINS` (scheme + host, no trailing
  slash). Multiple origins are comma-separated.
- The server's Socket.IO CORS settings use the same allow-list.
- This adds a second free service, a second cold-start surface, and more moving
  parts. There is no benefit for this app unless you specifically need it.

## Operations and limits

- **No database.** Rooms are in memory. There is nothing to back up, and nothing
  survives a restart. This is intentional.
- **Room codes are private but not secret-grade.** A six-character code is
  unlisted; the invite link is the access mechanism. Do not use this for
  competitive gambling or anything requiring strong access control.
- **Rate limits.** Socket actions are limited to 120 per 10 seconds per
  connection. Room creation is limited to 12 per minute per IP; joins to 60 per
  minute per IP. Behind Render's proxy, `trust proxy` is enabled so the client
  IP is read correctly.
- **Timers.** Disconnected players are auto-played after 12 seconds (roll) or
  2.6 seconds (move). A turn with no legal move passes after 1.4 seconds. An
  absent lobby host is replaced after 60 seconds.
- **Room cleanup.** A disconnected lobby seat is released after 2 minutes.
  Empty idle lobbies expire after 30 minutes; idle games expire after 2 hours
  once nobody is connected; every room has a hard 12-hour lifetime.

## Troubleshooting

| Symptom                                      | Likely cause / fix                                                                 |
| -------------------------------------------- | ---------------------------------------------------------------------------------- |
| Page takes ~1 minute to load                 | Free instance was asleep. This is normal after 15 idle minutes.                    |
| Invite link says "That room does not exist"  | The service restarted/spun down, clearing memory. Create a new room.               |
| "This game has already started"              | The room left the lobby. Reopen the game in the browser that owns the seat secret. |
| Board loads but never updates                | WebSocket upgrade blocked. Check DevTools → Network → WS; avoid proxies that buffer. |
| Build fails on `vite: not found`             | Dev dependencies were skipped. Use `npm ci --include=dev && npm run build`.         |
| Build fails on Node version                  | Set `NODE_VERSION` to a current 22.x or 24.x release.                              |
| Service crashes on boot                      | Check that the start command is `npm start` and that the build completed.          |
| Health check keeps failing                    | Confirm `/api/health` responds locally with `npm start`, then inspect Render logs.  |
| Rooms disappear after a deploy               | Expected: in-memory state is not persisted.                                        |

## Post-deploy checklist

Verified against the live deployment on **November 19, 2026**:

- [x] `/api/health` returns `ok: true`.
- [x] The home page loads over HTTPS with the Ludo ANSARY title and metadata.
- [x] A 4-player room can be created and `/room/CODE` opens the board.
- [x] Two independent clients join, ready up, and start a game.
- [x] Dice rolls and moves sync in both directions.
- [x] A dropped client rejoins with its seat secret and keeps the same colour.
- [x] A complete game reaches the result overlay with rankings for both clients.
- [x] The host can start a rematch (`moveCount` back to 0).
- [x] The mobile layout works at a 390–423 px viewport with no horizontal scroll.
- [x] The browser connects over a real WebSocket upgrade with no console errors.
- [x] Compressed HTML/JS and the SPA fallback for deep links work on the host.
