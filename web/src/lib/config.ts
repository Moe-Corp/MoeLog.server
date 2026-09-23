/**
 * Client-safe API configuration.
 *
 * The server decides where the API is (`lib/server/config.ts`) and hands the
 * public origin to the browser through the layout's `load`. Nothing here reads
 * the environment: this module ends up in the browser bundle, where there is no
 * environment to read.
 */

/** Prefix the Vite dev proxy forwards to the API. Only used behind a tunnel. */
export const API_PREFIX = '/_api'

/**
 * Live channel URL, derived from the API's public origin.
 *
 * Deriving it instead of configuring it separately means one variable fewer to
 * get wrong — and a WebSocket pointing somewhere other than the API it belongs
 * to is not a configuration anyone wants.
 */
export function wsUrl(apiOrigin: string): string {
  const url = new URL('/v1/live', apiOrigin)
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  return url.toString()
}
