# Build context is the REPOSITORY ROOT, not this directory: the lockfile that
# pins these dependencies lives there.
#   docker build -f web/Dockerfile .
#
# Pinned to 1.4.0 for the same reason the API is — see api/Dockerfile.
FROM oven/bun:1.4.0 AS build

WORKDIR /app

COPY package.json package.json
COPY bun.lock bun.lock
COPY api/package.json api/package.json
COPY web/package.json web/package.json

RUN bun install --filter './web'

COPY web ./web

RUN cd web && bunx vite build

FROM oven/bun:1.4.0-slim

WORKDIR /app

# adapter-node's output is self-contained: it bundles what it needs, so no
# node_modules travels to the runtime image.
COPY --from=build /app/web/build ./build

ENV NODE_ENV=production
ENV PORT=3000

CMD ["bun", "build/index.js"]

EXPOSE 3000
