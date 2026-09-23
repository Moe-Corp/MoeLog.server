<script lang="ts">
  import { live } from '$lib/live.svelte.ts'
  import { LEVEL, ago, num } from '$lib/format.ts'
  import type { PageData } from './$types'

  let { data }: { data: PageData } = $props()

  // Live issues are only merged into the "open" or "all" views: if you are
  // looking at resolved ones, a new arrival would be disorienting.
  const list = $derived(
    data.status === 'open' || data.status === 'all'
      ? live.merge(data.issues, live.issues)
      : data.issues,
  )
  const filters = ['open', 'resolved', 'ignored', 'all'] as const
</script>

<svelte:head><title>Issues · MoeLog</title></svelte:head>

<section class="flex flex-col gap-space-xs pb-space-sm border-b border-outline-variant/30">
  <div class="flex items-center gap-space-sm">
    <h1 class="font-body text-headline-xl text-primary">Issues</h1>
    <span class="chip chip-neutral">deduped by fingerprint</span>
  </div>
  <p class="font-body text-body-sm text-on-surface-variant">
    Errors grouped by fingerprint. An issue is <em>one</em> error, even if it happened a thousand
    times.
  </p>
</section>

<section class="flex flex-wrap items-center gap-space-sm">
  {#each filters as f (f)}
    <a
      href="/issues?status={f}"
      class="font-code text-label-md px-space-md py-1 rounded-sm border transition-colors
        {data.status === f
        ? 'bg-surface-container-high text-primary border-primary-container/60'
        : 'bg-surface-container text-on-surface-variant border-outline-variant/40 hover:text-on-surface'}"
      >{f}</a
    >
  {/each}
  <span class="tabular font-code text-code-sm text-outline ml-auto">{list.length} results</span>
</section>

<section class="panel overflow-x-auto">
  <table class="w-full text-left border-collapse">
    <thead>
      <tr class="font-code text-label-sm uppercase tracking-wider text-on-surface-variant">
        <th class="font-medium px-space-lg py-space-sm">Level</th>
        <th class="font-medium px-space-lg py-space-sm">Error / fingerprint</th>
        <th class="font-medium px-space-lg py-space-sm text-right">Occurrences</th>
        <th class="font-medium px-space-lg py-space-sm">App</th>
        <th class="font-medium px-space-lg py-space-sm">First</th>
        <th class="font-medium px-space-lg py-space-sm">Last</th>
        <th class="font-medium px-space-lg py-space-sm text-right">Status</th>
      </tr>
    </thead>
    <tbody class="divide-y divide-outline-variant/20 border-t border-outline-variant/20">
      {#each list as i (i.id)}
        <tr class="hover:bg-surface-container-low/60 transition-colors">
          <td class="px-space-lg py-space-md align-top"
            ><span class="chip chip-{LEVEL[i.level]}">{LEVEL[i.level]}</span></td
          >
          <td class="px-space-lg py-space-md max-w-md">
            <a
              href="/issues/{i.id}"
              class="font-body text-body-md text-on-surface hover:text-primary-fixed-dim block truncate"
              title={i.title}>{i.title}</a
            >
            <div class="font-code text-code-sm text-outline mt-0.5">
              fingerprint: {i.fingerprint}{#if i.release} · {i.release}{/if}
            </div>
          </td>
          <td class="tabular px-space-lg py-space-md text-right font-code text-code-lg text-on-surface"
            >{num(i.count)}</td
          >
          <td class="px-space-lg py-space-md font-code text-code-md text-on-surface-variant">{i.app}</td>
          <td class="px-space-lg py-space-md font-code text-code-sm text-on-surface-variant"
            >{ago(i.first_seen)}</td
          >
          <td class="px-space-lg py-space-md font-code text-code-sm text-on-surface-variant"
            >{ago(i.last_seen)}</td
          >
          <td class="px-space-lg py-space-md text-right">
            <span class="chip {i.status === 'open' ? 'chip-warn' : 'chip-neutral'}">{i.status}</span>
          </td>
        </tr>
      {:else}
        <tr
          ><td colspan="7" class="px-space-lg py-12 text-center font-body text-body-sm text-on-surface-variant"
            >Nothing here.</td
          ></tr
        >
      {/each}
    </tbody>
  </table>
</section>
