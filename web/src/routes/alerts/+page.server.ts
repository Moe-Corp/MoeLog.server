import { apiGet } from '$lib/api.ts'
import type { Alert } from '$lib/types.ts'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ fetch, locals }) => ({
  alerts: await apiGet<Alert[]>(fetch, locals.token, '/v1/alerts?limit=150'),
})
