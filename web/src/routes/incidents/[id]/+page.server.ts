import { apiGet } from '$lib/api.ts'
import type { MoeEvent, Incident } from '$lib/types.ts'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ fetch, locals, params }) =>
  apiGet<{ incident: Incident; context: MoeEvent[]; window_ms: number }>(
    fetch,
    locals.token,
    `/v1/incidents/${params.id}`,
  )
