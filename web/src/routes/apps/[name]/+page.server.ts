import { apiGet } from '$lib/api.ts'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ fetch, locals, params }) =>
  apiGet<Record<string, unknown>>(fetch, locals.token, `/v1/apps/${encodeURIComponent(params.name)}`)
