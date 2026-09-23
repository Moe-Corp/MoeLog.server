<script lang="ts">
  import { onMount } from 'svelte'
  import { page } from '$app/state'
  import { live } from '$lib/live.svelte.ts'
  import type { LayoutData } from './$types'
  import '../app.css'

  let { children, data }: { children: import('svelte').Snippet; data: LayoutData } = $props()

  const routes = [
    { href: '/', label: 'Overview' },
    { href: '/issues', label: 'Issues' },
    { href: '/logs', label: 'Logs' },
    { href: '/alerts', label: 'Alerts' },
    { href: '/incidents', label: 'Incidents' },
  ]

  /**
   * The login and the public status page do not carry the dashboard nav: one
   * has no session yet and the other is for people outside.
   */
  const bare = $derived(
    page.url.pathname.startsWith('/login') || page.url.pathname.startsWith('/status'),
  )

  // The live channel only opens inside the dashboard. On /login and /status
  // there is no session to request a ticket with, and asking anyway was what
  // left the login page reloading in a loop.
  onMount(() => {
    if (!bare) void live.connect(data.apiPublicUrl)
  })

  const isActive = (href: string): boolean =>
    href === '/' ? page.url.pathname === '/' : page.url.pathname.startsWith(href)

  // The nav counter adds whatever arrived live since the page loaded.
  const severe = $derived(
    data.severeAlerts +
      live.alerts.filter((a) => a.kind !== 'app.recovered' && a.kind !== 'app.blocked').length,
  )
</script>

{#if bare}
  {@render children()}
{:else}
<div class="min-h-screen flex flex-col bg-surface">
  <header class="sticky top-0 z-50 bg-surface-container-low border-b border-outline-variant/30">
    <div
      class="h-12 max-w-[1200px] mx-auto px-margin md:px-margin-desktop flex items-center justify-between gap-space-md"
    >
      <div class="flex items-center gap-space-xl min-w-0">
        <a href="/" class="flex items-center gap-space-sm select-none shrink-0">
          <span class="font-code text-code-lg text-primary font-bold tracking-tight">MoeLog</span>
          <span
            class="hidden sm:inline font-code text-label-sm uppercase px-space-xs py-0.5 bg-surface-container-highest text-on-surface-variant rounded-sm border border-outline-variant/40"
            >sidecar engine</span
          >
        </a>
        <nav class="flex items-center gap-space-lg h-12 overflow-x-auto">
          {#each routes as r (r.href)}
            <a
              href={r.href}
              aria-current={isActive(r.href) ? 'page' : undefined}
              class="h-full inline-flex items-center gap-space-xs px-space-xs font-code text-label-md transition-colors whitespace-nowrap
                {isActive(r.href)
                ? 'text-primary font-semibold border-b-2 border-primary-container'
                : 'text-on-surface-variant hover:text-on-surface'}"
            >
              {r.label}
              {#if r.href === '/alerts' && severe > 0}
                <span
                  class="tabular font-code text-label-sm px-1.5 py-px bg-secondary-container text-on-secondary-container rounded-sm font-bold"
                  >{severe}</span
                >
              {/if}
            </a>
          {/each}
        </nav>
      </div>

      <div class="flex items-center gap-space-sm shrink-0">
        {#if data.user}
          <a
            href="/settings"
            class="hidden md:inline font-code text-label-md text-on-surface-variant hover:text-on-surface"
            title="Settings and ingest keys">{data.user}</a
          >
        {/if}
        <div
          class="flex items-center gap-space-xs px-space-sm py-1 rounded-sm bg-surface-container border border-outline-variant/30"
          title={live.connected ? 'WebSocket connected' : 'Disconnected: this data may be stale'}
        >
          <span class="relative flex h-2 w-2">
            {#if live.connected && !live.paused}
              <span
                class="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-container opacity-75"
              ></span>
            {/if}
            <span
              class="relative inline-flex rounded-full h-2 w-2 {live.connected
                ? 'bg-primary-container'
                : 'bg-outline'}"
            ></span>
          </span>
          <span class="font-code text-label-sm uppercase tracking-wider text-on-surface">
            {live.connected ? (live.paused ? 'paused' : 'live') : 'offline'}
          </span>
          {#if live.held > 0}
            <span class="tabular font-code text-label-sm text-secondary">+{live.held}</span>
          {/if}
        </div>
        <button
          type="button"
          onclick={() => live.togglePause()}
          title={live.paused ? 'Resume the live stream' : 'Pause the live stream'}
          class="font-code text-label-md px-space-sm py-1 rounded-sm bg-surface-container hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface border border-outline-variant/40 transition-colors"
        >
          {live.paused ? 'Resume' : 'Pause'}
        </button>
        <form method="POST" action="/logout">
          <button
            type="submit"
            title="Sign out"
            class="font-code text-label-md px-space-sm py-1 rounded-sm text-on-surface-variant hover:text-error transition-colors"
            >sign out</button
          >
        </form>
      </div>
    </div>
  </header>

  <main class="flex-1 w-full">
    <div class="max-w-[1200px] mx-auto px-margin md:px-margin-desktop pt-space-xl pb-12 flex flex-col gap-space-2xl">
      {@render children()}
    </div>
  </main>

  <footer class="border-t border-outline-variant/20 mt-auto">
    <div
      class="max-w-[1200px] mx-auto px-margin md:px-margin-desktop py-space-lg flex flex-wrap gap-space-md justify-between font-code text-code-sm text-outline"
    >
      <span>MoeLog OSS — alpha · the sidecar runs outside your app</span>
      <span class="flex gap-space-lg">
        <a href="/status" class="hover:text-on-surface-variant">public status</a>
        <a href="/settings" class="hover:text-on-surface-variant">settings</a>
      </span>
    </div>
  </footer>
</div>
{/if}
