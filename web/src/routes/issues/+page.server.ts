import { apiGet } from '$lib/api.ts'
import type { Issue } from '$lib/types.ts'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ fetch, locals, url }) => {
  const status = url.searchParams.get('status') ?? 'open'
  const q = status === 'all' ? '' : `status=${status}&`
  const issues = await apiGet<Issue[]>(fetch, locals.token, `/v1/issues?${q}limit=100`)
  return { issues, status }
}
