<script lang="ts">
  import Onboarding from '$lib/Onboarding.svelte'
  import { live } from '$lib/live.svelte.ts'
  import { ALERT, LEVEL, ago, change, hourLabel, isOnline, num } from '$lib/format.ts'
  import type { PageData } from './$types'

  let { data }: { data: PageData } = $props()
  const s = $derived(data.stats)

  const issues = $derived(live.merge(data.issues, live.issues).slice(0, 6))
  const alerts = $derived(live.merge(data.alerts, live.alerts).slice(0, 6))

  // SSR counters plus whatever arrived live: the number does not go stale while
  // you are looking at the screen.
  const events = $derived(s.events_24h + live.events.length)
  const errors = $derived(s.errors_24h + live.events.filter((e) => e.level >= 50).length)
  const alerts24 = $derived(s.alerts_24h + live.alerts.length)

  const delta = $derived(change(s.events_24h, s.events_prev_24h))
  const peak = $derived(Math.max(1, s.peak_hour))
  const errorPct = $derived(events > 0 ? ((errors / events) * 100).toFixed(2) : '0.00')
  const fatals = $derived(s.by_level.find((n) => n.level === 60)?.n ?? 0)
</script>

<svelte:head><title>Overview · MoeLog</title></svelte:head>

{#if s.apps.length === 0 && live.events.length === 0}
  <Onboarding key={data.key} apiUrl={data.apiPublicUrl} />
{:else}
<!-- Header -->
<section
  class="flex flex-col sm:flex-row sm:items-end justify-between gap-space-md pb-space-sm border-b border-outline-variant/30"
>
  <div class="flex flex-col gap-space-xs">
    <h1 class="font-body text-headline-xl text-primary">Overview</h1>
    <p class="font-body text-body-sm text-on-surface-variant flex flex-wrap items-center gap-space-xs">
      <span>Last 24 hours · {s.apps.length} app{s.apps.length === 1 ? '' : 's'} reporting</span>
      <span class="text-outline">•</span>
      <span class="font-code text-code-sm"
        >Window: <span class="text-on-surface">24 h (1 h buckets)</span></span
      >
    </p>
  </div>
</section>

<!-- Metric cards -->
<section class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-gutter">
  <div class="panel p-space-md flex flex-col justify-between">
    <span class="font-code text-label-sm uppercase tracking-wider text-on-surface-variant"
      >Events 24 h</span
    >
    <div class="mt-space-sm flex items-baseline justify-between gap-space-xs">
      <span class="tabular font-code text-headline-xl text-primary">{num(events)}</span>
      {#if delta}
        <span class="font-code text-label-sm {delta.up ? 'text-primary-fixed-dim' : 'text-on-surface-variant'}">
          {delta.up ? '↑' : '↓'} {delta.pct}% vs yesterday
        </span>
      {/if}
    </div>
    <span class="font-code text-code-sm text-on-surface-variant mt-space-xs">
      Peak per hour: <span class="tabular text-on-surface">{num(s.peak_hour)}</span>
    </span>
  </div>

  <div class="panel p-space-md flex flex-col justify-between">
    <span class="font-code text-label-sm uppercase tracking-wider text-on-surface-variant"
      >Open issues</span
    >
    <div class="mt-space-sm flex items-baseline justify-between gap-space-xs">
      <span class="tabular font-code text-headline-xl text-primary">{s.open_issues}</span>
      {#if s.critical_issues > 0}
        <span class="chip chip-fatal">{s.critical_issues} critical</span>
      {/if}
    </div>
    <span class="font-code text-code-sm text-on-surface-variant mt-space-xs">Grouped by fingerprint</span>
  </div>

  <div
    class="panel p-space-md flex flex-col justify-between {s.severe_alerts_24h > 0
      ? 'border-error/50 bg-error-container/10'
      : ''}"
  >
    <span class="font-code text-label-sm uppercase tracking-wider text-on-surface-variant"
      >Alerts 24 h</span
    >
    <div class="mt-space-sm flex items-baseline justify-between gap-space-xs">
      <span class="tabular font-code text-headline-xl {s.severe_alerts_24h > 0 ? 'text-error' : 'text-primary'}"
        >{alerts24}</span
      >
      {#if s.severe_alerts_24h > 0}
        <span class="chip chip-error">{s.severe_alerts_24h} severe</span>
      {/if}
    </div>
    <span class="font-code text-code-sm text-on-surface-variant mt-space-xs"
      >Signals from the sidecar, not the app</span
    >
  </div>

  <div class="panel p-space-md flex flex-col justify-between">
    <span class="font-code text-label-sm uppercase tracking-wider text-on-surface-variant"
      >Level ≥ error</span
    >
    <div class="mt-space-sm flex items-baseline justify-between gap-space-xs">
      <span class="tabular font-code text-headline-xl text-primary">{num(errors)}</span>
      <span class="tabular font-code text-label-sm text-on-surface-variant">{errorPct}% of total</span>
    </div>
    <span class="font-code text-code-sm text-on-surface-variant mt-space-xs">
      <span class="tabular">{fatals}</span> fatal ·
      <span class="tabular">{errors - fatals}</span> error
    </span>
  </div>
</section>

<!-- Hourly activity -->
{#if s.series.length > 0}
  <section class="panel p-space-lg">
    <div class="flex flex-wrap items-center justify-between gap-space-sm mb-space-lg">
      <h2 class="font-body text-headline-md text-on-surface">Throughput and errors</h2>
      <div class="flex items-center gap-space-md font-code text-code-sm text-on-surface-variant">
        <span class="flex items-center gap-space-xs"
          ><span class="w-2.5 h-2.5 rounded-sm bg-surface-container-highest"></span>total</span
        >
        <span class="flex items-center gap-space-xs"
          ><span class="w-2.5 h-2.5 rounded-sm bg-error"></span>errors</span
        >
      </div>
    </div>
    <div class="flex items-end gap-1 h-32">
      {#each s.series as b (b.hour)}
        <div
          class="flex-1 flex flex-col justify-end min-w-0 group"
          title="{hourLabel(b.hour)}:00 — {b.total} events, {b.errors} errors"
        >
          <div
            class="w-full bg-surface-container-highest group-hover:bg-surface-bright transition-colors rounded-t-sm"
            style="height: {((b.total - b.errors) / peak) * 100}%"
          ></div>
          <div class="w-full bg-error" style="height: {(b.errors / peak) * 100}%"></div>
        </div>
      {/each}
    </div>
    <div class="flex gap-1 mt-space-xs">
      {#each s.series as b (b.hour)}
        <span class="tabular flex-1 text-center font-code text-code-sm text-outline min-w-0"
          >{hourLabel(b.hour)}</span
        >
      {/each}
    </div>
  </section>
{/if}

<!-- Recent alerts -->
<section class="flex flex-col gap-space-md">
  <div class="flex flex-wrap items-baseline justify-between gap-space-sm">
    <div class="flex items-center gap-space-sm">
      <h2 class="font-body text-headline-md text-on-surface">Recent alerts</h2>
      <span class="chip chip-neutral">sidecar health signals</span>
    </div>
    <a href="/alerts" class="font-code text-label-md text-primary-fixed-dim hover:underline"
      >See all →</a
    >
  </div>
  <div class="panel divide-y divide-outline-variant/20">
    {#each alerts as a (a.id)}
      {@const meta = ALERT[a.kind]}
      <div class="flex flex-wrap items-baseline gap-space-sm px-space-lg py-space-md">
        <span class="tabular font-code text-code-sm text-on-surface-variant w-20 shrink-0">{ago(a.t)}</span>
        <span class="chip {meta?.chip ?? 'chip-neutral'}">{a.kind.replace('app.', '')}</span>
        <span class="font-code text-code-md text-on-surface">{a.app ?? '—'}</span>
        {#if a.pid}
          <span class="font-code text-code-sm text-outline">(pid {a.pid})</span>
        {/if}
        <span class="font-body text-body-sm text-on-surface-variant flex-1 min-w-0">
          {(a.detail?.error as { message?: string })?.message ??
            (a.detail?.hint as string) ??
            meta?.explain ??
            ''}
        </span>
      </div>
    {:else}
      <p class="px-space-lg py-10 text-center font-body text-body-sm text-on-surface-variant">
        No app has crashed, blocked or failed to start.
      </p>
    {/each}
  </div>
</section>

<!-- Open issues -->
<section class="flex flex-col gap-space-md">
  <div class="flex flex-wrap items-baseline justify-between gap-space-sm">
    <h2 class="font-body text-headline-md text-on-surface">Open issues</h2>
    <a href="/issues" class="font-code text-label-md text-primary-fixed-dim hover:underline">See all →</a>
  </div>
  <div class="panel overflow-x-auto">
    <table class="w-full text-left border-collapse">
      <thead>
        <tr class="font-code text-label-sm uppercase tracking-wider text-on-surface-variant">
          <th class="font-medium px-space-lg py-space-sm">Level</th>
          <th class="font-medium px-space-lg py-space-sm">Error / fingerprint</th>
          <th class="font-medium px-space-lg py-space-sm text-right">Occurrences</th>
          <th class="font-medium px-space-lg py-space-sm">App</th>
          <th class="font-medium px-space-lg py-space-sm">Last seen</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-outline-variant/20 border-t border-outline-variant/20">
        {#each issues as i (i.id)}
          <tr class="hover:bg-surface-container-low/60 transition-colors">
            <td class="px-space-lg py-space-md align-top"
              ><span class="chip chip-{LEVEL[i.level]}">{LEVEL[i.level]}</span></td
            >
            <td class="px-space-lg py-space-md">
              <a href="/issues/{i.id}" class="font-body text-body-md text-on-surface hover:text-primary-fixed-dim"
                >{i.title}</a
              >
              <div class="font-code text-code-sm text-outline mt-0.5">fingerprint: {i.fingerprint}</div>
            </td>
            <td class="tabular px-space-lg py-space-md text-right font-code text-code-lg text-on-surface"
              >{num(i.count)}</td
            >
            <td class="px-space-lg py-space-md font-code text-code-md text-on-surface-variant">{i.app}</td>
            <td class="px-space-lg py-space-md font-code text-code-sm text-on-surface-variant"
              >{ago(i.last_seen)}</td
            >
          </tr>
        {:else}
          <tr
            ><td colspan="5" class="px-space-lg py-10 text-center font-body text-body-sm text-on-surface-variant"
              >No errors recorded.</td
            ></tr
          >
        {/each}
      </tbody>
    </table>
  </div>
</section>

<!-- Apps -->
<section class="flex flex-col gap-space-md">
  <div class="flex items-center gap-space-sm">
    <h2 class="font-body text-headline-md text-on-surface">Connected apps</h2>
    <span class="chip chip-neutral">sidecar active</span>
  </div>
  <div class="panel overflow-x-auto">
    <table class="w-full text-left border-collapse">
      <thead>
        <tr class="font-code text-label-sm uppercase tracking-wider text-on-surface-variant">
          <th class="font-medium px-space-lg py-space-sm">Application</th>
          <th class="font-medium px-space-lg py-space-sm">Runtime</th>
          <th class="font-medium px-space-lg py-space-sm">Release</th>
          <th class="font-medium px-space-lg py-space-sm">Environment</th>
          <th class="font-medium px-space-lg py-space-sm">Last signal</th>
          <th class="font-medium px-space-lg py-space-sm text-right">State</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-outline-variant/20 border-t border-outline-variant/20">
        {#each s.apps as a (a.name)}
          <tr class="hover:bg-surface-container-low/60 transition-colors">
            <td class="px-space-lg py-space-md font-code text-code-md text-on-surface">
              <span
                class="inline-block w-1.5 h-1.5 rounded-full mr-space-xs {isOnline(a.last_seen)
                  ? 'bg-primary-container'
                  : 'bg-outline'}"
              ></span><a href="/apps/{encodeURIComponent(a.name)}" class="hover:text-primary-fixed-dim"
                >{a.name}</a
              >
            </td>
            <td class="px-space-lg py-space-md font-code text-code-md text-on-surface-variant"
              >{a.runtime ?? '?'}</td
            >
            <td class="px-space-lg py-space-md font-code text-code-md text-on-surface-variant"
              >{a.release ?? '—'}</td
            >
            <td class="px-space-lg py-space-md font-code text-code-md text-tertiary-fixed-dim"
              >{a.env ?? '—'}</td
            >
            <td class="px-space-lg py-space-md font-code text-code-sm text-on-surface-variant"
              >{ago(a.last_seen)}</td
            >
            <td class="px-space-lg py-space-md text-right">
              <span class="chip {isOnline(a.last_seen) ? 'chip-ok' : 'chip-neutral'}"
                >{isOnline(a.last_seen) ? 'online' : 'idle'}</span
              >
            </td>
          </tr>
        {:else}
          <tr
            ><td colspan="6" class="px-space-lg py-10 text-center font-body text-body-sm text-on-surface-variant"
              >No app has reported yet.</td
            ></tr
          >
        {/each}
      </tbody>
    </table>
  </div>
</section>
{/if}
