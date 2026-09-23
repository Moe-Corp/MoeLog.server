# MoeLog server

Ingest API and dashboard for MoeLog. **It will become its own repository**; it lives here while it
is useful as a test environment for the SDK.

> **Status: alpha.** JWT sessions and manageable ingest keys. No projects, no multi-user. See
> *What is missing*.

```mermaid
flowchart LR
    SDK["@moecorp/moelog-node<br/>@moecorp/moelog-bun"] -->|unix socket| SIDE["sidecar"]
    SIDE -->|"POST /v1/ingest<br/>POST /v1/alerts"| API

    subgraph SRV["MoeLog server"]
        API["API · Elysia<br/>:3000"]
        DB[("Postgres<br/>or SQLite")]
        WEB["Dashboard · SvelteKit<br/>:5174"]
        API --> DB --> WEB
        API -.->|"WS /v1/live"| WEB
    end

    style API fill:#2563eb,color:#fff
    style WEB fill:#16a34a,color:#fff
```

## Getting started

Two ways in, and they differ only in which database answers.

**Deployed — Postgres, which is the default:**

```bash
docker compose up -d      # Postgres, then the API on :3000 and the dashboard on :5174
docker compose logs -f api
```

**Locally — SQLite, so nothing has to be installed:**

```bash
bun install
bun run dev               # API on :3000 and dashboard on :5174
```

`bun run dev` exports `DATABASE_URL=file:moelog.db`, so trying the project out needs no database
server. Everything else behaves identically: same schema, same migrations, same code path.

Either way the first boot creates the administrator and an ingest key, and prints them:

```
  -- first boot ----------------------------------------
  user:     admin
  password: moelog
  ingest:   mlk_pub_a04dcd12411341b2bf53772ed60d80cb
  ------------------------------------------------------
```

**The default password is `moelog`, and it is published right here.** That is the trade for a
panel that has to be usable the moment `docker compose up` finishes — and it is why the server
prints a warning on every boot until you export `MOELOG_ADMIN_PASSWORD`. Do that before anyone
else can reach the port. `MOELOG_INGEST_KEY` works the same way and is what `bun run dev` uses to
pin the key to `mlk_pub_dev`, the one the SDK READMEs show.

Before the port opens, the server runs a short sequence of checks and stops at the first one that
fails:

```
  ✓ database configured: postgres db:5432/moelog
  ✓ database connection successful
  ✓ database version check successful (Postgres 17.11)
  ✓ database is up to date
```

So `docker compose up` on an empty volume and on a five-month-old one are the same command, and a
server that did not come up says which of the four things was wrong. `SKIP_DB_CHECK` skips the lot
and `SKIP_DB_MIGRATION` just the last step, for setups where migrations are someone else's job.

To get some data in, the SDK repository has two sandboxes that produce every failure mode on
purpose. From another terminal:

```bash
git clone https://github.com/Moe-Corp/MoeLog.js
cd MoeLog.js && bun install && bun run build
cd sandbox/bun-app
MOELOG_SERVER=http://localhost:3000 MOELOG_KEY=mlk_pub_dev bun run e2e
```

Open <http://localhost:5174> while it runs: errors show up on their own, no reload.

| Command | What it does |
|---|---|
| `bun run dev` | API and dashboard in parallel, on SQLite |
| `bun run dev:api` / `dev:web` | Just one of them |
| `bun run build` | Builds the dashboard (adapter-node) |
| `bun run typecheck` | `tsc --noEmit` over the API |
| `bun run db:generate` | Regenerates the migrations for **both** dialects after a schema change |
| `bun run reset` | Wipes the local SQLite file and starts over |
| `bun run up` / `down` / `logs` | `docker compose` shortcuts |
| `bun run tunel` | `cloudflared tunnel --url http://localhost:5174` |

## Showing it to someone over a Cloudflare tunnel

For a quick demo, with nothing deployed:

```bash
bun run dev      # terminal 1 — API :3000 and dashboard :5174
bun run tunel    # terminal 2 — cloudflared tunnel --url http://localhost:5174
```

`cloudflared` prints a `https://something.trycloudflare.com` URL. That is the one you share. The
whole dashboard works through it, live stream included.

**What it took to make that work**, in case you move this behind another proxy:

| Setting | Why |
|---|---|
| `server.allowedHosts: true` in `vite.config.ts` | Vite rejects unknown `Host` headers since 6.0.9. Without it the tunnel gets `403 Blocked request` |
| Proxying `/_api/v1/live` with `ws: true` | For a tunnel there is only ONE published origin, so the WebSocket cannot go straight to the API. Point `MOELOG_API_PUBLIC_URL` at `https://…trycloudflare.com/_api` and the dev server forwards it. A real deployment publishes both services and needs none of this |
| Server actions instead of `fetch` to the API | The token lives in an httpOnly cookie; the browser cannot sign API calls on its own |

Only the WebSocket route is forwarded. Everything else goes through SvelteKit's `load` functions,
so **ingestion is not exposed** through the tunnel: it stays local.

**Before you share the URL:**

- The development `admin/1234` is fine for a half-hour demo among people you know. For anything
  longer, boot with `MOELOG_ADMIN_PASSWORD`: anyone with the link reaches the login and there is
  **no rate limiting** yet.
- The session cookie does not carry `Secure` outside production. Cloudflare gives you HTTPS in
  front, but the dev server does not know that.
- This is a development server exposed to the internet. Fine for thirty minutes; not for leaving up.
- `cloudflared tunnel --url` gives a fresh URL every time and dies with the process. That is an
  advantage here: the demo closes itself.

If you ever serve it for real (`bun run build` plus adapter-node behind nginx or Caddy), export
`MOELOG_ORIGIN=https://your-domain` — in a production build SvelteKit does validate the form
`Origin` and without it the login returns 403. In the development server that check is off, which
is why the tunnel works without configuring it.

## Two services, two domains

The API and the dashboard are independent services and deploy as such — which is
how every self-hosted template wires a front end to its API, from
[Typebot's](https://github.com/Dokploy/templates/blob/main/blueprints/typebot/template.toml)
one domain per service to
[Hoppscotch's](https://github.com/Dokploy/templates/blob/main/blueprints/hoppscotch/template.toml)
explicit `VITE_BACKEND_WS_URL`. **There is no reverse proxy in the compose file**, and none is
needed: on a platform like Dokploy or Coolify the edge proxy is the platform's job, and everything
that has to be configured here fits in two variables.

| | Answers the question | Compose | Behind a platform |
|---|---|---|---|
| `MOELOG_API_URL` | how does the **dashboard server** reach the API? | `http://api:3000` | `http://api:3000` |
| `MOELOG_API_PUBLIC_URL` | how does the **browser** reach it? | `http://localhost:3000` | `https://api.your-domain` |

The split exists because almost nothing goes from the browser to the API directly: the session
token lives in an httpOnly cookie, so every read leaves from the SvelteKit server over the
internal network and never touches the wire.

The one exception is the live WebSocket, which the browser has to open itself. It goes straight to
`MOELOG_API_PUBLIC_URL`, and that costs nothing in exposure: the API is publicly reachable by
definition — it is where the sidecars POST their events, and its URL is what the first-run screen
tells you to paste into `init({ server })`. The WebSocket authenticates with a 60-second ticket in
the query string rather than the cookie, so crossing origins does not matter to it.

Both values are read at **runtime** and handed to the browser by the layout's `load`. A
`VITE_`-style variable would be baked in at build time, and an image that cannot be pointed at a
different domain without rebuilding is not an image anyone can deploy twice.

### One-click install

[`deploy/dokploy/`](deploy/dokploy) is the same arrangement packaged as a
[Dokploy](https://dokploy.com) template: two domains to fill in, and everything else generated —
including the administrator's password, so an installed instance never has the default one. Its
README says how to submit it and what has to be published first.

## Decisions

**Authentication down two separate paths.** **Ingest keys** (`mlk_pub_…`) are write-only: the
sidecar carries them, they live on the disk of whoever deploys the app, and they grant no read
access. The **dashboard session** is an HS256 JWT in an `httpOnly` cookie the browser's JavaScript
never touches. A leaked ingest key not being able to read anyone's logs is the reason they are
separate.

The JWT is signed with `node:crypto` rather than a library, and the verifier handles the three
known traps explicitly: it rejects any `alg` other than HS256 (including `none`), compares the
signature with `timingSafeEqual`, and requires `exp`. Verification is synchronous because the
guard runs in `onRequest`, before routing.

The WebSocket cannot use the cookie (it is `httpOnly` and cross-origin in development), so the
SvelteKit server requests a **60-second ticket** and hands it to the client, which renews it on
every reconnection. It is short-lived because it travels in the query string, which ends up in
proxy logs.

**Design system: "MoeLog Telemetry Engine".** It came out of the Google Stitch prototype living in
[`design/stitch-prototype/`](design/stitch-prototype) — its `moelog_telemetry_engine/DESIGN.md` is
the source of the tokens, translated into Tailwind 4's CSS-first configuration in
[`web/src/app.css`](web/src/app.css). The thesis: an instrumentation console. Solid greyscale
surfaces, thin borders instead of shadows, monospace for everything technical, and colour reserved
for conveying severity — never for decoration.

It is **dark theme only** for now: the prototype delivered no light palette and inventing half of
one seemed worse than not having it.

**SSR yes, but not for SEO.** An error panel is opened to answer "did something break?", and half a
second of spinner on that question is half a second of uncertainty. Pages arrive from the server
with their data in place; from there the WebSocket pushes the updates. **There is no polling
anywhere**: if nothing happens, nothing travels.

**Postgres by default, SQLite by choice — one codebase for both.** Postgres is what a deployment
runs and what `docker compose up` brings with it. But asking for a database server just to try
things locally is an absurd barrier, so `DATABASE_URL=file:moelog.db` switches the whole server
to `bun:sqlite`, which needs nothing installed.

**Drizzle**, and the schema is written twice — `shared/schema/pg.ts` and `shared/schema/sqlite.ts`,
identical in shape, column for column. Drizzle types its tables by dialect, so a single definition
serving both does not exist. What does exist is a single *query* layer: the runtime picks a schema
and the types describe the Postgres one, which holds because every query stays inside the subset
both engines share. The three places they genuinely disagree — `MAX` versus `GREATEST`,
case-sensitive `LIKE`, and aggregates coming back as strings from Postgres — are not papered over;
they live in `shared/sql.ts`, named and explained.

**Migrations run at boot, not with `drizzle-kit push`.** The deployed artefact is a single compiled
binary in a distroless image: no shell, no Bun, no `node_modules`. What ships is the generated SQL
in `api/drizzle/<dialect>/`, which drizzle-orm's migrator applies in order and records. After
changing a schema file, run `bun run db:generate` — it regenerates both dialects, and both are
committed.

**Epoch milliseconds in a `bigint`, never a `timestamp`.** The SDK sends `Date.now()` and the
dashboard does its own arithmetic; converting at both ends would only add two places to get the
timezone wrong.

**The deployment story is Umami's, with one deliberate exception.** `DATABASE_URL` decides the
engine by its scheme, the checks and the migration run before anything listens, and the compose
file gives both services a health check so nothing starts against a database that is still
initialising. That is the shape `scripts/check-db.js` and `docker-compose.yml` have in
[umami-software/umami](https://github.com/umami-software/umami), and there is no reason to invent a
different one for the same job.

The exception is the first user. Umami seeds `admin` / `umami` as a literal `INSERT` with a
hard-coded bcrypt hash inside its initial migration, which means the credentials cannot be
configured at all — the request to allow it
([issue #4083](https://github.com/umami-software/umami/issues/4083)) was closed as not planned.
Here the administrator is created by the server on first boot instead, so `MOELOG_ADMIN_PASSWORD`
is honoured from the very first start and there is never a window where the published password is
the only one that works. The default is still `admin` / `moelog`, for the same reason theirs is.

Umami also dropped MySQL in v3 and is Postgres-only now. MoeLog keeps two engines because SQLite
here is not a second deployment target — it is how the project runs with nothing installed.

**CQRS + VSA.** The read/write split is not an imposed abstraction: ingestion is append-only and only has to accept fast and lose nothing; the dashboard
is read-only with a different access pattern and different indexes.

**TypeBox** for validation, which is what Elysia already compiles. Ingestion is a trust boundary
exposed to the network and is validated in full.

## Structure

```
api/
  Dockerfile            bun build --compile, then distroless
  drizzle/pg/           generated Postgres migrations, applied at boot
  drizzle/sqlite/       the same schema, generated for SQLite
  src/
  index.ts              migrates, bootstraps, mounts the features, opens the port
  shared/
    dialect.ts          which engine, resolved once from the environment
    db.ts               connection, transactions and the boot-time migrator
    schema/pg.ts        Postgres tables
    schema/sqlite.ts    the same tables, mirrored
    schema/index.ts     picks the active one
    sql.ts              the three places the two dialects disagree
    mlwp.ts             the contract with the SDKs: TypeBox schemas and positional expansion
    jwt.ts              HS256 on node:crypto, with the three traps handled
    guard.ts            authentication boundary, in onRequest
    auth.ts             passwords, ingest keys, bootstrap
    bus.ts              live channel publisher
  features/
    auth/               login · me · ws-ticket
    ingest/             WRITE  POST /v1/ingest · POST /v1/alerts
    issues/             read   GET/PATCH /v1/issues
    events/             read   GET /v1/events
    alerts/             read   GET /v1/alerts
    incidents/          read   GET /v1/incidents (groups block + recovery)
    apps/               read   GET /v1/apps/:name
    keys/               ingest keys
    settings/           settings and simulated alert
    stats/              read   GET /v1/stats
    status/             PUBLIC GET /v1/status
    live/               WS /v1/live (ticket)

web/src/
  app.css               design system tokens (Tailwind 4, CSS-first)
  hooks.server.ts       session cookie and route guard
  lib/api.ts            API client; a 401 sends you to the login
  lib/live.svelte.ts    live channel with pause (Svelte 5 runes)
  lib/format.ts         levels, relative time, wording for each alert kind
  routes/               / · /issues · /issues/[id] · /logs · /alerts
                        /incidents · /incidents/[id] · /apps/[name]
                        /settings · /login · /status (public)

design/stitch-prototype/   15 generated screens and DESIGN.md (reference, not executed)
```

### What was applied from the prototype, and what was not

The screens with real data behind them were applied. The ones the prototype invented and the API
cannot yet back — public status page, forensic autopsy modal, heartbeat simulator, incident
history, app detail, key settings and first-run — were built where data existed and left in
`design/stitch-prototype/` otherwise.

Fields the prototype fabricated and MoeLog does not collect were dropped: memory at death, cgroup
limits, kernel `dmesg`, per-thread CPU sampling and instance variables. An observability panel
that invents numbers is worse than no panel.

## API

| Method | Route | Auth | What it does |
|---|---|---|---|
| POST | `/v1/auth/login` | — | `{ username, password }` → 7-day JWT |
| GET | `/v1/auth/me` | session | Who am I |
| POST | `/v1/auth/ws-ticket` | session | 60-second WebSocket ticket |
| POST | `/v1/ingest` | key | Receives an MLWP v1 envelope. Answers `202`, then processes |
| POST | `/v1/alerts` | key | Receives an alert from the sidecar |
| GET | `/v1/issues` | session | `?app=&status=open\|resolved\|ignored&limit=` |
| GET | `/v1/issues/:id` | session | Issue and its latest occurrences |
| PATCH | `/v1/issues/:id` | session | `{ status }` |
| GET | `/v1/events` | session | `?app=&level=&q=&limit=` |
| GET | `/v1/alerts` | session | `?app=&limit=` |
| GET | `/v1/incidents` | session | Alerts grouped by occurrence, with duration |
| GET | `/v1/incidents/:id` | session | Incident plus events ±5 min around it |
| GET | `/v1/apps` · `/v1/apps/:name` | session | App detail: releases, issues, alerts |
| GET/POST/DELETE | `/v1/keys` | session | Ingest keys |
| GET/PUT | `/v1/settings` | session | Status page settings |
| POST | `/v1/settings/simulate-alert` | session | Test alert, flagged `simulated` |
| GET | `/v1/stats` | session | Last 24 h counters |
| **GET** | **`/v1/status`** | **—** | **Public.** Per-service state, no errors or stacks |
| WS | `/v1/live` | ticket | `{ kind: 'event'\|'alert'\|'issue', data }` |

All authentication runs in `onRequest`, before routing and before body validation: in
`beforeHandle`, an unauthenticated caller could probe the schemas through `422` responses.

### Environment

| Variable | Default | What it does |
|---|---|---|
| `PORT` | `3000` | |
| `DATABASE_URL` | `postgres://moelog:moelog@localhost:5432/moelog` | `postgres://…` or `file:…`. The scheme picks the engine |
| `MOELOG_DB_URL` | — | The same thing, for when something else in the environment already owns `DATABASE_URL`. Wins if both are set |
| `DIRECT_DATABASE_URL` | = `DATABASE_URL` | Where migrations connect. Behind a pooler (pgBouncer, Neon) DDL has to bypass it |
| `MOELOG_DB` | — | A path, kept so older SQLite setups still boot |
| `MOELOG_DB_POOL` | `10` | Postgres connections |
| `MOELOG_MIGRATIONS` | `drizzle/<dialect>` | Where the generated SQL lives |
| `SKIP_DB_CHECK` | — | Skips the whole preflight |
| `SKIP_DB_MIGRATION` | — | Runs the checks but does not migrate |
| `MOELOG_ADMIN_USER` | `admin` | |
| `MOELOG_ADMIN_PASSWORD` | `moelog` | **Set this.** Applied on the first boot only |
| `MOELOG_INGEST_KEY` | generated | First boot only |
| `MOELOG_JWT_SECRET` | generated and persisted | Set it to share one secret across replicas |
| `MOELOG_API_URL` | `http://localhost:3000` | Dashboard → API, **server side**. In compose, the service name on the internal network |
| `MOELOG_API_PUBLIC_URL` | = `MOELOG_API_URL` | Dashboard → API, **from the browser**: the API's own public origin |
| `ORIGIN` | `http://localhost:5174` | The dashboard's public URL. adapter-node checks every form POST against it |

An unrecognised scheme in `DATABASE_URL` is a startup error rather than a silent fallback:
quietly using a different database than the one someone configured is the worse failure.

## What is missing before this leaves your machine

1. **Mandatory HTTPS.** The session cookie only carries `Secure` when `NODE_ENV=production`; over
   plain HTTP the token travels in the clear.
2. **Multi-user and projects.** There is one user and one global space. No user creation and no
   password change from the dashboard: it is done in the database.
3. **Login rate limiting.** There is a fixed 300 ms delay, which is not the same thing.
4. **Retention.** Nothing deletes old events; the database grows without bound.
5. **A published default password.** `admin` / `moelog` is created on the first boot and is in
   this README. Export `MOELOG_ADMIN_PASSWORD` before the port is reachable by anyone else; the
   server warns on every boot until you do.
6. **Source maps**: stacks are shown exactly as they arrive, unresolved.
7. **Ingestion rate limiting.**

## License

[AGPL-3.0-only](LICENSE).
