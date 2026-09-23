import { fail } from '@sveltejs/kit'
import { apiDelete, apiGet, apiPost, apiPut } from '$lib/api.ts'
import type { Actions, PageServerLoad } from './$types'

export interface Key {
  key: string
  label: string
  created: number
  last_used: number | null
  uses: number
  revoked: number
}

export const load: PageServerLoad = async ({ fetch, locals }) => {
  const [keys, settings, apps] = await Promise.all([
    apiGet<Key[]>(fetch, locals.token, '/v1/keys'),
    apiGet<Record<string, string | null>>(fetch, locals.token, '/v1/settings'),
    apiGet<Array<{ name: string }>>(fetch, locals.token, '/v1/apps'),
  ])
  return { keys, settings, apps }
}

export const actions: Actions = {
  create: async ({ request, fetch, locals }) => {
    const d = await request.formData()
    const key = await apiPost<Key>(fetch, locals.token, '/v1/keys', {
      label: String(d.get('label') ?? ''),
    })
    // Returned so it can be highlighted once, right after creation.
    return { created: key.key }
  },

  revoke: async ({ request, fetch, locals }) => {
    const d = await request.formData()
    await apiPost(fetch, locals.token, `/v1/keys/${String(d.get('key'))}/revoke`)
    return { ok: true }
  },

  remove: async ({ request, fetch, locals }) => {
    const d = await request.formData()
    await apiDelete(fetch, locals.token, `/v1/keys/${String(d.get('key'))}`)
    return { ok: true }
  },

  settings: async ({ request, fetch, locals }) => {
    const d = await request.formData()
    await apiPut(fetch, locals.token, '/v1/settings', {
      status_title: String(d.get('status_title') ?? ''),
      status_description: String(d.get('status_description') ?? ''),
      status_published: d.get('status_published') ? '1' : '0',
    })
    return { saved: true }
  },

  simulate: async ({ request, fetch, locals }) => {
    const d = await request.formData()
    const app = String(d.get('app') ?? '').trim()
    if (!app) return fail(400, { error: 'pick an app' })
    await apiPost(fetch, locals.token, '/v1/settings/simulate-alert', {
      kind: String(d.get('kind') ?? 'app.blocked'),
      app,
    })
    return { simulated: true }
  },
}
