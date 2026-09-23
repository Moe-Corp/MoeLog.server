import { error, redirect } from '@sveltejs/kit'
import { API } from './server/config.ts'

type Fetch = typeof globalThis.fetch

/**
 * API client for the server-side `load` functions.
 *
 * It centralizes two things that otherwise get repeated badly on every page:
 * attaching the token, and treating a 401 as "the session expired" by sending
 * the user to the login instead of blowing up with a generic error.
 */
async function request<T>(f: Fetch, token: string | null, route: string, init?: RequestInit): Promise<T> {
  const r = await f(`${API}${route}`, {
    ...init,
    headers: {
      ...(init?.headers as Record<string, string> | undefined),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  })

  if (r.status === 401) redirect(303, '/login?expired=1')
  if (r.status === 404) error(404, 'not found')
  if (!r.ok) error(r.status, `the API answered ${r.status}`)
  return (await r.json()) as T
}

export const apiGet = <T>(f: Fetch, token: string | null, route: string): Promise<T> =>
  request<T>(f, token, route)

export const apiPost = <T>(f: Fetch, token: string | null, route: string, body?: unknown): Promise<T> =>
  request<T>(f, token, route, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })

export const apiPut = <T>(f: Fetch, token: string | null, route: string, body: unknown): Promise<T> =>
  request<T>(f, token, route, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })

export const apiPatch = <T>(f: Fetch, token: string | null, route: string, body: unknown): Promise<T> =>
  request<T>(f, token, route, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })

export const apiDelete = <T>(f: Fetch, token: string | null, route: string): Promise<T> =>
  request<T>(f, token, route, { method: 'DELETE' })
