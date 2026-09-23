<script lang="ts">
  import { live } from '$lib/live.svelte.ts'
  import { ALERT, ago, datetime } from '$lib/format.ts'
  import type { Alert } from '$lib/types.ts'
  import type { PageData } from './$types'

  let { data }: { data: PageData } = $props()
  let filter = $state<'all' | 'critical' | 'blocks' | 'exits'>('all')

  const everything = $derived(live.merge(data.alerts, live.alerts))
  const since24 = Date.now() - 24 * 3600_000
  const countOf = (k: string): number => everything.filter((a) => a.kind === k && a.t > since24).length

  const GROUPS = {
    all: () => true,
    critical: (a: Alert) => a.kind === 'app.fatal' || a.kind === 'app.crashed',
    blocks: (a: Alert) => a.kind === 'app.blocked' || a.kind === 'app.recovered',
    exits: (a: Alert) => a.kind === 'app.exited_error' || a.kind === 'app.failed_to_start',
  } as const

  const visible = $derived(everything.filter(GROUPS[filter]))

  /**
   * A block and its recovery are the same occurrence counted twice. Grouping
   * them into an "incident" keeps the list from lying about how many things
   * happened — and shows how long it lasted at a glance.
   */
  type Row = { kind: 'single'; a: Alert } | { kind: 'incident'; end: Alert; start: Alert }
  const rows = $derived.by((): Row[] => {
    const out: Row[] = []
    const list = visible
    for (let i = 0; i < list.length; i++) {
      const a = list[i]
      const next = list[i + 1]
      if (
        a.kind === 'app.recovered' &&
        next?.kind === 'app.blocked' &&
        next.app === a.app &&
        next.pid === a.pid
      ) {
        out.push({ kind: 'incident', end: a, start: next })
        i++
        continue
      }
      out.push({ kind: 'single', a })
    }
    return out
  })

  /** The detail fields that are not noise, on one line of metadata. */
  const metadata = (a: Alert): Array<[string, string]> =>
    Object.entries(a.detail ?? {})
      .filter(([k]) => k !== 'hint' && k !== 'error' && k !== 'cwd')
      .map(([k, v]) => [k, typeof v === 'object' ? JSON.stringify(v) : String(v)])
</script>

<svelte:head><title>Alerts · MoeLog</title></svelte:head>

<section class="flex flex-col gap-space-sm pb-space-sm border-b border-outline-variant/30">
  <div class="flex flex-wrap items-center gap-space-sm">
    <h1 class="font-body text-headline-xl text-primary">Sidecar alerts</h1>
    <span class="chip chip-ok">host watchdog active</span>
  </div>
  <p class="font-body text-body-md text-on-surface-variant max-w-4xl">
    What the sidecar saw from outside the process. An SDK inside the app can report none of these:
    warning you about a blocked event loop would need the very event loop that is blocked, and
    warning you about a <span class="kbd">SIGKILL</span> would need to be alive.
  </p>
</section>

<!-- Summary by kind -->
<section class="grid grid-cols-2 lg:grid-cols-4 gap-gutter">
  {#each [['app.blocked', 'Event loop', 'blocks detected'], ['app.crashed', 'Catastrophic crashes', 'SIGKILL / kernel OOM'], ['app.fatal', 'Uncaught exception', 'the app died with a stack'], ['app.failed_to_start', 'Failed startup', 'never beat once']] as [kind, title, sub] (kind)}
    <div class="panel p-space-md flex flex-col gap-space-xs">
      <span class="font-code text-label-sm uppercase tracking-wider text-on-surface-variant">{title}</span>
      <div class="flex items-baseline gap-space-xs">
        <span class="tabular font-code text-headline-lg {countOf(kind) > 0 ? 'text-error' : 'text-on-surface-variant'}"
          >{countOf(kind)}</span
        >
        <span class="font-code text-code-sm text-outline">last 24 h</span>
      </div>
      <span class="font-code text-code-sm text-outline">{sub}</span>
    </div>
  {/each}
</section>

<!-- Filters -->
<section class="flex flex-wrap items-center gap-space-sm">
  {#each [['all', 'All'], ['critical', 'Critical'], ['blocks', 'Blocks'], ['exits', 'Failed exits']] as [k, label] (k)}
    <button
      onclick={() => (filter = k as typeof filter)}
      class="font-code text-label-md px-space-md py-1 rounded-sm border transition-colors
        {filter === k
        ? 'bg-surface-container-high text-primary border-primary-container/60'
        : 'bg-surface-container text-on-surface-variant border-outline-variant/40 hover:text-on-surface'}"
    >
      {label} <span class="tabular">({everything.filter(GROUPS[k as keyof typeof GROUPS]).length})</span>
    </button>
  {/each}
</section>

<!-- List -->
<section class="flex flex-col gap-space-md">
  {#each rows as row, idx (idx)}
    {#if row.kind === 'incident'}
      <!-- Block + recovery: one single occurrence -->
      <article class="panel border-secondary/30">
        <header
          class="flex flex-wrap items-center justify-between gap-space-sm px-space-lg py-space-sm border-b border-outline-variant/20 bg-surface-container-lowest"
        >
          <span class="font-code text-label-md text-secondary">
            INCIDENT — event loop blocked in {row.start.app}
          </span>
          <span class="font-code text-label-sm text-primary-fixed-dim">resolved automatically</span>
        </header>
        <div class="p-space-lg flex flex-col gap-space-md">
          {#each [row.end, row.start] as a (a.id)}
            <div class="flex flex-col gap-space-xs border-l-2 pl-space-md {a.kind === 'app.recovered' ? 'border-primary-container' : 'border-secondary'}">
              <div class="flex flex-wrap items-baseline gap-space-sm">
                <span class="chip {ALERT[a.kind]?.chip}">{a.kind}</span>
                <span class="font-code text-code-sm text-on-surface-variant" title={datetime(a.t)}>{ago(a.t)}</span>
                <span class="font-code text-code-md text-on-surface">{a.app}</span>
                <span class="font-code text-code-sm text-outline">(pid {a.pid})</span>
              </div>
              <p class="font-body text-body-md text-on-surface">
                <strong class="font-semibold">{ALERT[a.kind]?.title}:</strong>
                {ALERT[a.kind]?.explain}
              </p>
              <div
                class="flex flex-wrap gap-space-md font-code text-code-sm bg-surface-container-lowest rounded-sm px-space-md py-space-sm"
              >
                {#each metadata(a) as [k, v] (k)}
                  <span class="text-outline">{k}: <span class="tabular text-on-surface">{v}</span></span>
                {/each}
              </div>
            </div>
          {/each}
        </div>
      </article>
    {:else}
      {@const a = row.a}
      {@const meta = ALERT[a.kind]}
      <article class="panel {a.kind === 'app.fatal' || a.kind === 'app.crashed' ? 'border-error/40' : ''}">
        <div class="p-space-lg flex flex-col gap-space-sm">
          <div class="flex flex-wrap items-baseline gap-space-sm">
            <span class="chip {meta?.chip ?? 'chip-neutral'}">{a.kind}</span>
            <span class="font-code text-code-sm text-on-surface-variant" title={datetime(a.t)}>{ago(a.t)}</span>
            {#if a.app}<span class="font-code text-code-md text-on-surface">{a.app}</span>{/if}
            {#if a.pid}<span class="font-code text-code-sm text-outline">(pid {a.pid})</span>{/if}
          </div>

          <p class="font-body text-body-md text-on-surface">
            {#if meta}<strong class="font-semibold">{meta.title}:</strong> {meta.explain}{/if}
          </p>

          {#if (a.detail?.error as { message?: string } | undefined)?.message}
            <p class="font-code text-code-md text-error bg-error-container/15 border border-error/30 rounded-sm px-space-md py-space-sm">
              {(a.detail.error as { name?: string }).name}: {(a.detail.error as { message: string }).message}
            </p>
          {/if}

          <!-- The sidecar's hint only when it adds something the generic explanation does not. -->
          {#if a.detail?.hint && !(a.detail?.error as unknown)}
            <p class="font-code text-code-sm text-on-surface-variant">{a.detail.hint}</p>
          {/if}

          {#if metadata(a).length > 0}
            <div
              class="flex flex-wrap gap-space-md font-code text-code-sm bg-surface-container-lowest rounded-sm px-space-md py-space-sm"
            >
              {#each metadata(a) as [k, v] (k)}
                <span class="text-outline">{k}: <span class="tabular text-on-surface break-all">{v}</span></span>
              {/each}
            </div>
          {/if}

          {#if (a.detail?.error as { stack?: string } | undefined)?.stack}
            <pre
              class="font-code text-code-sm text-on-surface-variant bg-surface-container-lowest rounded-sm p-space-md overflow-x-auto">{(
                a.detail.error as { stack: string }
              ).stack}</pre>
          {/if}
        </div>
      </article>
    {/if}
  {:else}
    <div class="panel py-16 text-center">
      <p class="font-body text-headline-md text-on-surface-variant">
        No app has crashed, blocked or failed to start.
      </p>
      <p class="font-code text-code-md text-outline mt-space-sm">
        The sidecar is watching. If something dies, it shows up here in under a second.
      </p>
    </div>
  {/each}
</section>

<!-- How the mechanism works -->
<section class="panel p-space-lg flex flex-col md:flex-row gap-space-lg items-start">
  <div class="flex-1">
    <h2 class="font-body text-headline-md text-on-surface mb-space-xs">How does the sidecar see this?</h2>
    <p class="font-body text-body-sm text-on-surface-variant max-w-3xl">
      The SDK writes to a local unix socket and forgets. A separate Node process, launched
      <span class="kbd">detached</span>, listens on that socket and receives a heartbeat every two
      seconds. If the socket drops without a goodbye, the app died instantly. If the heartbeat stops
      but the socket stays open, the event loop is blocked. And if the process dies from an
      exception, the SDK still manages to write a synchronous marker to disk that the sidecar picks
      up afterwards.
    </p>
  </div>
  <div class="flex flex-col gap-space-xs font-code text-code-sm text-outline shrink-0">
    <span>transport: <span class="text-tertiary-fixed-dim">unix socket + NDJSON</span></span>
    <span>heartbeat: <span class="text-tertiary-fixed-dim">2 s, 3 misses = blocked</span></span>
    <span>cost in the app: <span class="text-primary-fixed-dim">~0.12 ms per error</span></span>
  </div>
</section>
