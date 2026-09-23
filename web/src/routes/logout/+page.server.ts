import { redirect } from '@sveltejs/kit'
import { SESSION_COOKIE } from '$lib/session.ts'
import type { Actions } from './$types'

export const actions: Actions = {
  default: async ({ cookies }) => {
    cookies.delete(SESSION_COOKIE, { path: '/' })
    redirect(303, '/login')
  },
}
