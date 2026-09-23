import { error } from '@sveltejs/kit'
import { API } from '$lib/server/config.ts'
import type { Service } from '$lib/types.ts'
import type { PageServerLoad } from './$types'

export interface PublicStatus {
  title: string
  description: string
  published: boolean
  generated: number
  global: string
  services: Service[]
}

/** The only page without a session: it deliberately skips the authenticated helper. */
export const load: PageServerLoad = async ({ fetch }) => {
  const r = await fetch(`${API}/v1/status`)
  if (!r.ok) error(503, 'could not read the status')
  const status = (await r.json()) as PublicStatus
  if (!status.published) error(404, 'the status page is not published')
  return { status }
}
