import { apiGet } from '$lib/api.ts'
import type { Alert, Issue, Stats } from '$lib/types.ts'
import type { PageServerLoad } from './$types'

/**
 * SSR: the front page arrives from the server with its data in place.
 *
 * This is where SSR earns its keep: an error panel is opened to find out
 * whether something broke, and half a second of spinner on that question is
 * half a second of uncertainty. After the first paint, the WebSocket takes over.
 */
export const load: PageServerLoad = async ({ fetch, locals }) => {
  const t = locals.token
  const [stats, issues, alerts] = await Promise.all([
    apiGet<Stats>(fetch, t, '/v1/stats'),
    apiGet<Issue[]>(fetch, t, '/v1/issues?status=open&limit=6'),
    apiGet<Alert[]>(fetch, t, '/v1/alerts?limit=6'),
  ])

  // No apps yet: instead of a panel full of zeroes, the install guide with the
  // real ingest key already baked into the snippet.
  let key: string | null = null
  if (stats.apps.length === 0) {
    const keys = await apiGet<Array<{ key: string; revoked: number }>>(fetch, t, '/v1/keys')
    key = keys.find((k) => k.revoked === 0)?.key ?? null
  }

  return { stats, issues, alerts, key }
}
