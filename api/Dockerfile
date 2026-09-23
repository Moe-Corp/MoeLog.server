# Build context is the REPOSITORY ROOT, not this directory: the lockfile that
# pins these dependencies lives there.
#   docker build -f api/Dockerfile .
# Pinned, and not out of habit: Bun 1.4.1 compiles a binary that dies at startup
# with "Cannot declare a var variable that shadows a let/const/class variable:
# 'Check2'" — a bundler regression on the TypeBox symbol Elysia validates with.
# 1.4.0 is the last version that produces a working binary. Check before bumping.
FROM oven/bun:1.4.0 AS build

WORKDIR /app

# Cache packages installation. The root manifest and both workspace manifests
# are needed for Bun to resolve the workspace; --filter keeps the dashboard's
# toolchain out of this image.
COPY package.json package.json
COPY bun.lock bun.lock
COPY api/package.json api/package.json
COPY web/package.json web/package.json

RUN bun install --filter './api'

COPY api/src ./api/src

ENV NODE_ENV=production

RUN cd api && bun build \
	--compile \
	--minify-whitespace \
	--minify-syntax \
	--outfile /app/server \
	src/index.ts

FROM gcr.io/distroless/base

WORKDIR /app

COPY --from=build /app/server server

# The schema. `drizzle-kit push` is not an option here: this image has no shell,
# no Bun and no node_modules — only the binary. What ships is the generated SQL,
# which the server applies at boot with drizzle-orm's migrator.
COPY api/drizzle ./drizzle

ENV NODE_ENV=production

CMD ["./server"]

EXPOSE 3000
