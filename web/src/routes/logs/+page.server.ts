import { apiGet } from '$lib/api.ts'
import type { MoeEvent } from '$lib/types.ts'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ fetch, locals, url }) => {
  const level = url.searchParams.get('level') ?? ''
  const q = url.searchParams.get('q') ?? ''
  const app = url.searchParams.get('app') ?? ''

  const params = new URLSearchParams({ limit: '150' })
  if (level) params.set('level', level)
  if (q) params.set('q', q)
  if (app) params.set('app', app)

  const events = await apiGet<MoeEvent[]>(fetch, locals.token, `/v1/events?${params}`)
  return { events, level, q, app }
}
