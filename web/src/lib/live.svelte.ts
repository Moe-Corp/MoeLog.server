import { wsUrl } from './config.ts'
import type { Alert, MoeEvent, Issue } from './types.ts'

type Message =
  | { kind: 'event'; data: MoeEvent }
  | { kind: 'alert'; data: Alert }
  | { kind: 'issue'; data: Issue }
  | { kind: 'hello'; data: unknown }
  | { kind: 'error'; data: { reason: string } }

/**
 * Live channel.
 *
 * The first render is done by the server (SSR): the page arrives with data, no
 * spinner. From then on this pushes the updates. There is no polling anywhere —
 * if nothing happens, nothing travels.
 */
class Live {
  connected = $state(false)
  paused = $state(false)
  events = $state<MoeEvent[]>([])
  alerts = $state<Alert[]>([])
  issues = $state<Issue[]>([])
  /** What arrived while paused, so it can be released in one go. */
  held = $state(0)

  #origin = ''
  #buffer: Message[] = []
  #ws: WebSocket | null = null
  #stopped = false
  #retry = 0
  #cap = 200

  /**
   * Opens the channel. It asks for a fresh ticket every time: they last 60
   * seconds, so reusing the one from the initial load would fail on any late
   * reconnection.
   */
  async connect(apiOrigin: string): Promise<void> {
    if (typeof window === 'undefined' || this.#ws || this.#stopped) return
    this.#origin = apiOrigin
    try {
      const r = await fetch('/api/ws-ticket')
      if (!r.ok) {
        // No session: give up and stay "disconnected".
        //
        // This does NOT reload the page. Reloading looks reasonable — let the
        // server send us to the login — but if the reload mounts this again and
        // the ticket fails again, the loop has no exit and the page spins
        // forever. Redirecting is `hooks.server.ts`'s job, on the next navigation.
        if (r.status === 401) this.#stopped = true
        this.connected = false
        return
      }
      const { ticket } = (await r.json()) as { ticket: string }

      const ws = new WebSocket(`${wsUrl(this.#origin)}?t=${encodeURIComponent(ticket)}`)
      this.#ws = ws

      ws.onopen = () => {
        this.connected = true
        this.#retry = 0
      }
      ws.onclose = () => {
        this.connected = false
        this.#ws = null
        if (this.#stopped) return
        // Reconnect with backoff: the server may just be restarting.
        this.#retry++
        setTimeout(() => void this.connect(this.#origin), Math.min(500 * 2 ** Math.min(this.#retry, 5), 15000))
      }
      ws.onerror = () => ws.close()
      ws.onmessage = (ev) => this.#receive(JSON.parse(ev.data as string) as Message)
    } catch {
      this.connected = false
    }
  }

  togglePause(): void {
    this.paused = !this.paused
    if (this.paused) return
    const pending = this.#buffer.splice(0)
    this.held = 0
    for (const m of pending) this.#apply(m)
  }

  #receive(m: Message): void {
    if (this.paused) {
      this.#buffer.push(m)
      // Bounded: pausing must not turn into a memory leak.
      if (this.#buffer.length > 500) this.#buffer.shift()
      this.held = this.#buffer.length
      return
    }
    this.#apply(m)
  }

  #apply(m: Message): void {
    if (m.kind === 'error') {
      this.connected = false
      return
    }
    if (m.kind === 'event') {
      this.events = [m.data, ...this.events].slice(0, this.#cap)
    } else if (m.kind === 'alert') {
      this.alerts = [m.data, ...this.alerts].slice(0, this.#cap)
    } else if (m.kind === 'issue') {
      // An issue that comes back moves to the top instead of duplicating.
      const rest = this.issues.filter((i) => i.id !== m.data.id)
      this.issues = [m.data, ...rest].slice(0, this.#cap)
    }
  }

  /** Merges what SSR brought with what arrived afterwards, without duplicates. */
  merge<T extends { id: number }>(base: T[], live: T[]): T[] {
    const seen = new Set(live.map((v) => v.id))
    return [...live, ...base.filter((b) => !seen.has(b.id))]
  }
}

export const live = new Live()
