<script lang="ts">
  import { ALERT, LEVEL, ago, datetime, hourLabel, isOnline, num } from '$lib/format.ts'
  import type { PageData } from './$types'

  let { data }: { data: PageData } = $props()

  const app = $derived(data.app as { name: string; runtime: string | null; release: string | null; env: string | null; first_seen: number; last_seen: number })
  const summary = $derived(data.summary as { events: number; errors: number; processes: number })
  const releases = $derived(data.releases as Array<{ release: string; events: number; errors: number; last: number }>)
  const issues = $derived(data.issues as Array<{ id: number; title: string; level: number; count: number; last_seen: number }>)
  const alerts = $derived(data.alerts as Array<{ id: number; kind: string; pid: number | null; detail: Record<string, unknown>; t: number }>)
  const series = $derived(data.series as Array<{ hour: number; errors: number; total: number }>)

  const peak = $derived(Math.max(1, ...series.map((s) => s.total)))
  const online = $derived(isOnline(app.last_seen))
</script>

<svelte:head><title>{app.name} · MoeLog</title></svelte:head>

<nav><a href="/" class="font-code text-label-md text-on-surface-variant hover:text-primary-fixed-dim">← Back to overview</a></nav>

<section class="flex flex-col gap-space-sm pb-space-sm border-b border-outline-variant/30">
  <div class="flex flex-wrap items-center gap-space-sm">
    <h1 class="font-code text-headline-xl text-primary">{app.name}</h1>
    <span class="chip {online ? 'chip-ok' : 'chip-neutral'}">{online ? 'online' : 'no signal'}</span>
  </div>
  <p class="font-code text-code-md text-on-surface-variant flex flex-wrap gap-space-lg">
    <span>runtime: <span class="text-on-surface">{app.runtime ?? '?'}</span></span>
    <span>release: <span class="text-on-surface">{app.release ?? '—'}</span></span>
    <span>environment: <span class="text-tertiary-fixed-dim">{app.env ?? '—'}</span></span>
    <span>first signal: <span class="text-on-surface">{ago(app.first_seen)}</span></span>
    <span title={datetime(app.last_seen)}>last: <span class="text-on-surface">{ago(app.last_seen)}</span></span>
  </p>
</section>

<section class="grid grid-cols-2 lg:grid-cols-4 gap-gutter">
  {#each [['Events', num(summary.events ?? 0)], ['Errors', num(summary.errors ?? 0)], ['Processes seen', num(summary.processes ?? 0)], ['Open issues', String(issues.length)]] as [label, value] (label)}
    <div class="panel p-space-md">
      <span class="font-code text-label-sm uppercase tracking-wider text-on-surface-variant">{label}</span>
      <div class="tabular font-code text-headline-xl text-primary mt-space-sm">{value}</div>
    </div>
  {/each}
</section>

{#if series.length > 0}
  <section class="panel p-space-lg">
    <h2 class="font-body text-headline-md text-on-surface mb-space-lg">Activity, last 24 h</h2>
    <div class="flex items-end gap-1 h-24">
      {#each series as b (b.hour)}
        <div class="flex-1 flex flex-col justify-end min-w-0" title="{hourLabel(b.hour)}:00 — {b.total} events, {b.errors} errors">
          <div class="w-full bg-surface-container-highest rounded-t-sm" style="height: {((b.total - b.errors) / peak) * 100}%"></div>
          <div class="w-full bg-error" style="height: {(b.errors / peak) * 100}%"></div>
        </div>
      {/each}
    </div>
  </section>
{/if}

<section class="grid lg:grid-cols-2 gap-gutter items-start">
  <div class="flex flex-col gap-space-md">
    <h2 class="font-body text-headline-md text-on-surface">Releases</h2>
    <div class="panel overflow-x-auto">
      <table class="w-full text-left border-collapse">
        <thead>
          <tr class="font-code text-label-sm uppercase tracking-wider text-on-surface-variant">
            <th class="font-medium px-space-lg py-space-sm">Release</th>
            <th class="font-medium px-space-lg py-space-sm text-right">Events</th>
            <th class="font-medium px-space-lg py-space-sm text-right">Errors</th>
            <th class="font-medium px-space-lg py-space-sm">Last</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-outline-variant/20 border-t border-outline-variant/20">
          {#each releases as r (r.release)}
            <tr>
              <td class="px-space-lg py-space-sm font-code text-code-md text-on-surface">{r.release}</td>
              <td class="tabular px-space-lg py-space-sm text-right font-code text-code-md">{num(r.events)}</td>
              <td class="tabular px-space-lg py-space-sm text-right font-code text-code-md {r.errors > 0 ? 'text-error' : 'text-on-surface-variant'}">{num(r.errors)}</td>
              <td class="px-space-lg py-space-sm font-code text-code-sm text-on-surface-variant">{ago(r.last)}</td>
            </tr>
          {:else}
            <tr><td colspan="4" class="px-space-lg py-8 text-center font-body text-body-sm text-on-surface-variant">No releases declared.</td></tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>

  <div class="flex flex-col gap-space-md">
    <h2 class="font-body text-headline-md text-on-surface">Open issues</h2>
    <div class="panel divide-y divide-outline-variant/20">
      {#each issues as i (i.id)}
        <a href="/issues/{i.id}" class="flex items-baseline gap-space-sm px-space-lg py-space-md hover:bg-surface-container-low/60 transition-colors">
          <span class="chip chip-{LEVEL[i.level]} shrink-0">{LEVEL[i.level]}</span>
          <span class="font-body text-body-md text-on-surface flex-1 min-w-0 truncate">{i.title}</span>
          <span class="tabular font-code text-code-md text-on-surface-variant">{num(i.count)}</span>
        </a>
      {:else}
        <p class="px-space-lg py-8 text-center font-body text-body-sm text-on-surface-variant">No open issues.</p>
      {/each}
    </div>
  </div>
</section>

<section class="flex flex-col gap-space-md">
  <h2 class="font-body text-headline-md text-on-surface">Alert history</h2>
  <div class="panel divide-y divide-outline-variant/20">
    {#each alerts as a (a.id)}
      {@const meta = ALERT[a.kind]}
      <a href="/incidents/{a.id}" class="flex flex-wrap items-baseline gap-space-sm px-space-lg py-space-md hover:bg-surface-container-low/60 transition-colors">
        <span class="tabular font-code text-code-sm text-on-surface-variant w-20 shrink-0" title={datetime(a.t)}>{ago(a.t)}</span>
        <span class="chip {meta?.chip ?? 'chip-neutral'}">{a.kind.replace('app.', '')}</span>
        {#if a.pid}<span class="font-code text-code-sm text-outline">pid {a.pid}</span>{/if}
        <span class="font-body text-body-sm text-on-surface-variant flex-1 min-w-0">
          {(a.detail?.error as { message?: string })?.message ?? (a.detail?.hint as string) ?? meta?.title ?? ''}
        </span>
      </a>
    {:else}
      <p class="px-space-lg py-8 text-center font-body text-body-sm text-on-surface-variant">This app has never crashed or blocked.</p>
    {/each}
  </div>
</section>
