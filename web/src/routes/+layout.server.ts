import { apiGet } from '$lib/api.ts'
import { PUBLIC_API } from '$lib/server/config.ts'
import type { Alert } from '$lib/types.ts'
import type { LayoutServerLoad } from './$types'

/**
 * The nav counter, plus the API's public origin.
 *
 * The origin has to come from here rather than from `import.meta.env`, because
 * a value baked in at build time cannot be repointed at another domain without
 * rebuilding the image.
 */
export const load: LayoutServerLoad = async ({ fetch, locals, url }) => {
  if (!locals.token || url.pathname.startsWith('/login') || url.pathname.startsWith('/status')) {
    return { severeAlerts: 0, user: null, apiPublicUrl: PUBLIC_API }
  }

  try {
    const alerts = await apiGet<Alert[]>(fetch, locals.token, '/v1/alerts?limit=200')
    const since = Date.now() - 24 * 3600_000
    const severe = alerts.filter(
      (a) => a.t > since && a.kind !== 'app.recovered' && a.kind !== 'app.blocked',
    ).length
    const me = await apiGet<{ user: { username: string } | null }>(fetch, locals.token, '/v1/auth/me')
    return { severeAlerts: severe, user: me.user?.username ?? null, apiPublicUrl: PUBLIC_API }
  } catch {
    return { severeAlerts: 0, user: null, apiPublicUrl: PUBLIC_API }
  }
}
