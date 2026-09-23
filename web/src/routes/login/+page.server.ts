import { fail, redirect } from '@sveltejs/kit'
import { API } from '$lib/server/config.ts'
import { SESSION_COOKIE, cookieOptions } from '$lib/session.ts'
import type { Actions, PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ locals, url }) => {
  // Already signed in: there is no point showing the form.
  if (locals.token && !url.searchParams.has('expired')) redirect(303, '/')
  return {
    next: url.searchParams.get('next') ?? '/',
    expired: url.searchParams.has('expired'),
  }
}

export const actions: Actions = {
  default: async ({ request, cookies, fetch }) => {
    const data = await request.formData()
    const username = String(data.get('username') ?? '').trim()
    const password = String(data.get('password') ?? '')
    const next = String(data.get('next') ?? '/')

    if (!username || !password) {
      return fail(400, { username, error: 'Enter a username and a password.' })
    }

    const r = await fetch(`${API}/v1/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })

    if (!r.ok) {
      // The same message for a missing user and a wrong password: saying which
      // one failed gives away half the credential.
      return fail(401, { username, error: 'Wrong username or password.' })
    }

    const { token, expires_in } = (await r.json()) as { token: string; expires_in: number }
    cookies.set(SESSION_COOKIE, token, cookieOptions(expires_in))

    // `next` may only be an internal route: otherwise this is an open redirect.
    redirect(303, next.startsWith('/') && !next.startsWith('//') ? next : '/')
  },
}
