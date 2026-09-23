declare global {
  namespace App {
    interface Locals {
      /** Session JWT read from the httpOnly cookie. */
      token: string | null
      user: string | null
    }
  }
}

export {}
