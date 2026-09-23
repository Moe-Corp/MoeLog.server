import { apiGet } from '$lib/api.ts'
import type { Incident } from '$lib/types.ts'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ fetch, locals }) => ({
  incidents: await apiGet<Incident[]>(fetch, locals.token, '/v1/incidents?limit=150'),
})
