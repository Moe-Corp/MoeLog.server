import { apiGet, apiPatch } from '$lib/api.ts'
import type { MoeEvent, Issue } from '$lib/types.ts'
import type { Actions, PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ fetch, locals, params }) =>
  apiGet<{ issue: Issue; events: MoeEvent[] }>(fetch, locals.token, `/v1/issues/${params.id}?limit=25`)

/**
 * Changing the status goes through a server action, not a browser `fetch`.
 * Two reasons: the token lives in an httpOnly cookie the client cannot read to
 * sign the call, and this way the browser never needs to reach the API
 * directly — which is what breaks behind a tunnel.
 */
export const actions: Actions = {
  status: async ({ request, fetch, locals, params }) => {
    const data = await request.formData()
    const status = String(data.get('status') ?? '')
    if (!['open', 'resolved', 'ignored'].includes(status)) return { error: 'invalid status' }
    await apiPatch(fetch, locals.token, `/v1/issues/${params.id}`, { status })
    return { ok: true }
  },
}
