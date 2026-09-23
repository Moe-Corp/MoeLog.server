<script lang="ts">
  import { ALERT, ago, datetime, duration } from '$lib/format.ts'
  import type { PageData } from './$types'

  let { data }: { data: PageData } = $props()
  let filter = $state<'all' | 'open' | 'resolved'>('all')

  const list = $derived(
    data.incidents.filter((i) =>
      filter === 'all' ? true : filter === 'resolved' ? i.resolved : !i.resolved,
    ),
  )

  const isSimulated = (i: { detail: Record<string, unknown> }): boolean => i.detail['simulated'] === true
</script>

<svelte:head><title>Incidents · MoeLog</title></svelte:head>

<section class="flex flex-col gap-space-xs pb-space-sm border-b border-outline-variant/30">
  <div class="flex items-center gap-space-sm">
    <h1 class="font-body text-headline-xl text-primary">Incidents</h1>
    <span class="chip chip-neutral">grouped by occurrence</span>
  </div>
  <p class="font-body text-body-sm text-on-surface-variant max-w-4xl">
    A block and its recovery are <em>one</em> incident that lasted N milliseconds, not two things
    that happened. The grouping is done on the server so the dashboard and the API count the same.
  </p>
</section>

<section class="flex flex-wrap items-center gap-space-sm">
  {#each [['all', 'All'], ['open', 'Unresolved'], ['resolved', 'Resolved']] as [k, label] (k)}
    <button
      onclick={() => (filter = k as typeof filter)}
      class="font-code text-label-md px-space-md py-1 rounded-sm border transition-colors
        {filter === k
        ? 'bg-surface-container-high text-primary border-primary-container/60'
        : 'bg-surface-container text-on-surface-variant border-outline-variant/40 hover:text-on-surface'}"
      >{label}</button
    >
  {/each}
  <span class="tabular font-code text-code-sm text-outline ml-auto">{list.length} incidents</span>
</section>

<section class="panel overflow-x-auto">
  <table class="w-full text-left border-collapse">
    <thead>
      <tr class="font-code text-label-sm uppercase tracking-wider text-on-surface-variant">
        <th class="font-medium px-space-lg py-space-sm">Kind</th>
        <th class="font-medium px-space-lg py-space-sm">App</th>
        <th class="font-medium px-space-lg py-space-sm">Opened</th>
        <th class="font-medium px-space-lg py-space-sm text-right">Duration</th>
        <th class="font-medium px-space-lg py-space-sm">What happened</th>
        <th class="font-medium px-space-lg py-space-sm text-right">State</th>
      </tr>
    </thead>
    <tbody class="divide-y divide-outline-variant/20 border-t border-outline-variant/20">
      {#each list as i (i.id)}
        {@const meta = ALERT[i.kind]}
        <tr class="hover:bg-surface-container-low/60 transition-colors {isSimulated(i) ? 'opacity-70' : ''}">
          <td class="px-space-lg py-space-md whitespace-nowrap">
            <a href="/incidents/{i.id}" class="chip {meta?.chip ?? 'chip-neutral'}"
              >{i.kind.replace('app.', '')}</a
            >
            {#if isSimulated(i)}<span class="chip chip-neutral ml-space-xs">simulated</span>{/if}
          </td>
          <td class="px-space-lg py-space-md font-code text-code-md text-on-surface">
            {i.app ?? '—'}{#if i.pid}<span class="text-outline"> · {i.pid}</span>{/if}
          </td>
          <td class="px-space-lg py-space-md font-code text-code-sm text-on-surface-variant" title={datetime(i.opened)}
            >{ago(i.opened)}</td
          >
          <td class="tabular px-space-lg py-space-md text-right font-code text-code-md text-on-surface"
            >{duration(i.duration_ms)}</td
          >
          <td class="px-space-lg py-space-md font-body text-body-sm text-on-surface-variant max-w-md truncate">
            {(i.detail?.error as { message?: string })?.message ?? meta?.title ?? i.kind}
          </td>
          <td class="px-space-lg py-space-md text-right">
            <span class="chip {i.resolved ? 'chip-ok' : 'chip-warn'}"
              >{i.resolved ? 'resolved' : 'unresolved'}</span
            >
          </td>
        </tr>
      {:else}
        <tr
          ><td colspan="6" class="px-space-lg py-12 text-center font-body text-body-sm text-on-surface-variant"
            >No incidents recorded.</td
          ></tr
        >
      {/each}
    </tbody>
  </table>
</section>
