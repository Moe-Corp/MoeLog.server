# Dokploy blueprint

The files next to this one are the MoeLog template, in the exact layout
[Dokploy/templates](https://github.com/Dokploy/templates) expects. To submit it, copy this
directory to `blueprints/moelog/` in a fork of that repository and open a pull request. Their
checker is `node build-scripts/generate-meta.js --check`.

| File | What it is |
|---|---|
| `docker-compose.yml` | The three services. No `ports`, no `container_name`, no `networks`: the platform owns all three |
| `template.toml` | The variables Dokploy generates on install, and which service answers on which domain |
| `meta.json` | Gallery entry. Its `version` must match the image tag in the compose file |
| `moelog.svg` | The Moe Corp isotype, white on the dashboard's own surface colour |

## It installs with two domains

One for the dashboard and one for the API, because they are two independent services. Dokploy
fills both in and derives everything else:

| Variable | Generated as | Why it exists |
|---|---|---|
| `MOELOG_ADMIN_PASSWORD` | `${password:24}` | The administrator never has the published default. This is the whole reason the server creates the user in code instead of seeding it in a migration |
| `MOELOG_INGEST_KEY` | `mlk_pub_${hash:32}` | The key the sidecars carry |
| `MOELOG_JWT_SECRET` | `${password:64}` | Shared, so sessions survive a redeploy and several replicas agree |
| `MOELOG_WEB_ORIGIN` | `https://${main_domain}` | adapter-node checks every form POST against it |
| `MOELOG_API_PUBLIC_URL` | `https://${api_domain}` | What the browser's WebSocket connects to, and what the first-run screen tells you to paste into `init({ server })` |

`MOELOG_API_URL` is not a variable: it is `http://moelog-api:3000`, fixed, because that is the
internal network and it never changes.

## Before it can work

The compose file pulls `ghcr.io/moe-corp/moelog-server-api` and `…-web`. Those images are built
and pushed by [`.github/workflows/publish-images.yml`](../../.github/workflows/publish-images.yml)
when a `v*` tag is pushed. So:

1. Push the repository to `github.com/Moe-Corp/MoeLog.server`.
2. Tag a release: `git tag v0.1.0 && git push --tags`.
3. Make both packages **public** in the organisation's package settings — GHCR packages are
   private by default, and a template nobody can pull is a template that does not work.
4. Then open the pull request against `Dokploy/templates`.

Bumping the version means three places at once: the image tags in `docker-compose.yml`, `version`
in `meta.json`, and the git tag.
