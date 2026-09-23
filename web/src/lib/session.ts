export const SESSION_COOKIE = 'moelog_session'

/** The only things visible without a session. */
export const PUBLIC_ROUTES = ['/login', '/status']

export const cookieOptions = (maxAge: number) =>
  ({
    path: '/',
    httpOnly: true,
    sameSite: 'lax' as const,
    // Behind HTTPS in production this must be true; locally it would break login.
    secure: process.env['NODE_ENV'] === 'production',
    maxAge,
  }) satisfies Record<string, unknown>
