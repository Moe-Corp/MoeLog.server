import { env } from '$env/dynamic/private'

/**
 * Where the API is — the server's half of the answer.
 *
 * Two variables, because there are two different questions and confusing them
 * is what breaks the moment the dashboard stops being viewed on `localhost`:
 *
 *  - `MOELOG_API_URL` is how **this server** reaches the API. In a compose
 *    deployment that is a service name on the internal network, `http://api:3000`,
 *    and the traffic never leaves the host.
 *  - `MOELOG_API_PUBLIC_URL` is how the **browser** reaches it: the API's own
 *    public origin. It is what the live WebSocket connects to, and what the
 *    first-run screen tells you to paste into your app's `init({ server })`.
 *
 * They are two independent services with a domain each, which is how every
 * self-hosted template wires a front end to its API. No reverse proxy is
 * involved: the only thing the browser asks the API directly is the WebSocket,
 * and the API has to be publicly reachable anyway — that is where the sidecars
 * send their events.
 *
 * `$env/dynamic/private` and not `import.meta.env`: the latter is baked in at
 * build time, so a prebuilt image could never be pointed at a different domain.
 */
export const API = env['MOELOG_API_URL'] ?? env['VITE_API'] ?? 'http://localhost:3000'

/**
 * Defaults to the internal URL, which is correct on a developer's machine —
 * there the API is on `localhost:3000` for both the server and the browser.
 */
export const PUBLIC_API = env['MOELOG_API_PUBLIC_URL'] ?? API
