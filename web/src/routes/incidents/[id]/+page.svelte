<script lang="ts">
  import { ALERT, LEVEL, shortFile, datetime, duration, time } from '$lib/format.ts'
  import type { PageData } from './$types'

  let { data }: { data: PageData } = $props()
  const i = $derived(data.incident)
  const meta = $derived(ALERT[i.kind])
  const err = $derived(i.detail?.error as { name?: string; message?: string; stack?: string } | undefined)

  /** The detail minus the fields already shown elsewhere. */
  const fields = $derived(
    Object.entries(i.detail ?? {}).filter(([k]) => !['error', 'hint', 'cwd'].includes(k)),
  )
  const before = $derived(data.context.filter((e) => e.t <= i.opened))
  const after = $derived(data.context.filter((e) => e.t > i.opened))
</script>

<svelte:head><title>Incident #{i.id} · MoeLog</title></svelte:head>

<nav class="flex flex-wrap items-center justify-between gap-space-sm">
  <a href="/incidents" class="font-code text-label-md text-on-surface-variant hover:text-primary-fixed-dim"
    >← Back to incidents</a
  >
  <span class="font-code text-code-sm text-outline">INC-{String(i.id).padStart(5, '0')}</span>
</nav>

<section class="panel p-space-lg flex flex-col gap-space-md {i.kind === 'app.fatal' || i.kind === 'app.crashed' ? 'border-error/40' : ''}">
  <div class="flex flex-wrap items-center gap-space-sm">
    <span class="chip {meta?.chip ?? 'chip-neutral'}">{i.kind}</span>
    <span class="chip {i.resolved ? 'chip-ok' : 'chip-warn'}">{i.resolved ? 'resolved' : 'unresolved'}</span>
    {#if i.detail?.simulated}
      <span class="chip chip-neutral">simulated alert — matches no real outage</span>
    {/if}
  </div>

  <h1 class="font-body text-headline-lg text-on-surface">
    {meta?.title ?? i.kind}{#if i.app} in <span class="font-code text-primary-fixed-dim">{i.app}</span>{/if}
  </h1>
  <p class="font-body text-body-md text-on-surface-variant">{meta?.explain ?? ''}</p>

  {#if err?.message}
    <p class="font-code text-code-lg text-error bg-error-container/15 border border-error/30 rounded px-space-md py-space-sm">
      {err.name}: {err.message}
    </p>
  {/if}
</section>

<section class="grid grid-cols-2 lg:grid-cols-4 gap-gutter">
  <div class="panel p-space-md">
    <span class="font-code text-label-sm uppercase tracking-wider text-on-surface-variant">Opened</span>
    <div class="font-body text-headline-md text-on-surface mt-space-sm">{datetime(i.opened)}</div>
  </div>
  <div class="panel p-space-md">
    <span class="font-code text-label-sm uppercase tracking-wider text-on-surface-variant">Closed</span>
    <div class="font-body text-headline-md text-on-surface mt-space-sm">
      {i.closed ? datetime(i.closed) : '—'}
    </div>
  </div>
  <div class="panel p-space-md">
    <span class="font-code text-label-sm uppercase tracking-wider text-on-surface-variant">Duration</span>
    <div class="tabular font-code text-headline-xl text-primary mt-space-sm">{duration(i.duration_ms)}</div>
  </div>
  <div class="panel p-space-md">
    <span class="font-code text-label-sm uppercase tracking-wider text-on-surface-variant">Process</span>
    <div class="tabular font-code text-headline-md text-on-surface mt-space-sm">pid {i.pid ?? '—'}</div>
  </div>
</section>

{#if fields.length > 0}
  <section class="panel p-space-lg flex flex-col gap-space-sm">
    <h2 class="font-body text-headline-md text-on-surface">What the sidecar recorded</h2>
    <div class="flex flex-wrap gap-space-lg font-code text-code-md">
      {#each fields as [k, v] (k)}
        <span class="text-outline"
          >{k}: <span class="tabular text-on-surface break-all">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</span></span
        >
      {/each}
    </div>
    {#if i.detail?.hint}
      <p class="font-code text-code-sm text-on-surface-variant">{i.detail.hint}</p>
    {/if}
    {#if i.closing}
      <p class="font-code text-code-sm text-primary-fixed-dim">closing: {JSON.stringify(i.closing)}</p>
    {/if}
  </section>
{/if}

{#if err?.stack}
  <section class="panel">
    <header class="px-space-lg py-space-md border-b border-outline-variant/20">
      <h2 class="font-body text-headline-md text-on-surface">Stack at the moment of death</h2>
      <p class="font-code text-code-sm text-outline mt-0.5">
        written synchronously by the SDK while the process was shutting down
      </p>
    </header>
    <pre class="font-code text-code-md text-on-surface-variant p-space-lg overflow-x-auto">{err.stack}</pre>
  </section>
{/if}

<!-- Autopsy: what was going on around it -->
<section class="flex flex-col gap-space-md">
  <div class="flex items-baseline gap-space-sm">
    <h2 class="font-body text-headline-md text-on-surface">Context</h2>
    <span class="chip chip-neutral"
      >±{Math.round(data.window_ms / 60000)} min · {data.context.length} events</span
    >
  </div>
  <p class="font-body text-body-sm text-on-surface-variant">
    What the app was doing just before and just after. This is what turns "it died" into "it died
    doing this".
  </p>

  <div class="panel divide-y divide-outline-variant/15">
    {#each after as e (e.id)}
      <div class="flex flex-wrap items-baseline gap-space-sm px-space-lg py-space-sm">
        <span class="tabular font-code text-code-sm text-outline w-24 shrink-0">{time(e.t)}</span>
        <span class="chip chip-{LEVEL[e.level]} shrink-0">{LEVEL[e.level]}</span>
        <span class="font-body text-body-md text-on-surface flex-1 min-w-0">{e.msg}</span>
        {#if e.frames?.[0]}
          <span class="font-code text-code-sm text-outline"
            >{shortFile(e.frames[0][0])}:{e.frames[0][1]}</span
          >
        {/if}
      </div>
    {/each}

    <div class="px-space-lg py-space-sm bg-error-container/10 border-y border-error/30">
      <span class="font-code text-label-md text-error"
        >▲ the incident happened here — {datetime(i.opened)}</span
      >
    </div>

    {#each before as e (e.id)}
      <div class="flex flex-wrap items-baseline gap-space-sm px-space-lg py-space-sm">
        <span class="tabular font-code text-code-sm text-outline w-24 shrink-0">{time(e.t)}</span>
        <span class="chip chip-{LEVEL[e.level]} shrink-0">{LEVEL[e.level]}</span>
        <span class="font-body text-body-md text-on-surface flex-1 min-w-0">{e.msg}</span>
        {#if e.issue_id}
          <a href="/issues/{e.issue_id}" class="font-code text-code-sm text-primary-fixed-dim hover:underline"
            >see issue →</a
          >
        {/if}
      </div>
    {:else}
      <p class="px-space-lg py-space-lg text-center font-body text-body-sm text-on-surface-variant">
        No events recorded in the preceding window. That is common when a process dies instantly:
        it has no time to send anything.
      </p>
    {/each}
  </div>
</section>
