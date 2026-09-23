<script lang="ts">
  import { live } from '$lib/live.svelte.ts'
  import { LEVEL, TYPE, shortFile, time } from '$lib/format.ts'
  import type { PageData } from './$types'

  let { data }: { data: PageData } = $props()

  // Live events are filtered exactly like the server-side ones: if you are
  // looking at errors only, an info log should not slip in through the socket.
  const liveOnes = $derived(
    live.events.filter(
      (e) =>
        (!data.level || e.level >= Number(data.level)) &&
        (!data.app || e.app === data.app) &&
        (!data.q || e.msg.toLowerCase().includes(data.q.toLowerCase())),
    ),
  )
  const list = $derived(live.merge(data.events, liveOnes))
  const fresh = $derived(new Set(liveOnes.map((e) => e.id)))
</script>

<svelte:head><title>Logs · MoeLog</title></svelte:head>

<section class="flex flex-col gap-space-xs pb-space-sm border-b border-outline-variant/30">
  <div class="flex items-center gap-space-sm">
    <h1 class="font-body text-headline-xl text-primary">Logs</h1>
    <span class="chip chip-neutral">raw stream</span>
  </div>
  <p class="font-body text-body-sm text-on-surface-variant">
    Events exactly as they arrive. New ones come in at the top without a reload; pause the stream
    from the top bar if you need to read calmly.
  </p>
</section>

<form class="flex flex-wrap items-center gap-space-sm" method="GET">
  <select
    name="level"
    value={data.level}
    class="font-code text-code-md bg-surface-container text-on-surface border border-outline-variant/40 rounded-sm px-space-sm py-1 focus:outline-none focus:border-primary-container"
  >
    <option value="">all levels</option>
    <option value="30">info and above</option>
    <option value="40">warn and above</option>
    <option value="50">errors only</option>
    <option value="60">fatals only</option>
  </select>
  <input
    name="app"
    placeholder="app"
    value={data.app}
    class="font-code text-code-md bg-surface-container text-on-surface placeholder:text-outline border border-outline-variant/40 rounded-sm px-space-sm py-1 w-32 focus:outline-none focus:border-primary-container"
  />
  <input
    name="q"
    placeholder="search in the message"
    value={data.q}
    class="font-code text-code-md bg-surface-container text-on-surface placeholder:text-outline border border-outline-variant/40 rounded-sm px-space-sm py-1 flex-1 min-w-48 focus:outline-none focus:border-primary-container"
  />
  <button
    type="submit"
    class="font-code text-label-md px-space-md py-1 rounded-sm bg-surface-container-high text-on-surface border border-outline-variant/50 hover:border-primary-container transition-colors"
    >Filter</button
  >
  <span class="tabular font-code text-code-sm text-outline">{list.length} events</span>
</form>

<section class="panel divide-y divide-outline-variant/15">
  {#each list as e (e.id)}
    <div
      class="flex flex-wrap md:flex-nowrap items-baseline gap-space-sm px-space-lg py-space-sm hover:bg-surface-container-low/60 transition-colors {fresh.has(
        e.id,
      )
        ? 'animate-[enter_180ms_ease-out]'
        : ''}"
    >
      <span class="tabular font-code text-code-sm text-outline w-24 shrink-0">{time(e.t)}</span>
      <span class="chip chip-{LEVEL[e.level]} shrink-0">{LEVEL[e.level]}</span>
      <span class="font-code text-code-md text-on-surface-variant w-32 shrink-0 truncate">{e.app}</span>
      <span class="font-body text-body-md text-on-surface flex-1 min-w-0 break-words">
        {#if e.issue_id}
          <a href="/issues/{e.issue_id}" class="hover:text-primary-fixed-dim underline decoration-outline-variant/50 decoration-dotted"
            >{e.msg}</a
          >
        {:else}{e.msg}{/if}
      </span>
      <span class="font-code text-code-sm text-outline shrink-0 hidden md:inline">
        {TYPE[e.type]}{#if e.frames?.[0]} · {shortFile(e.frames[0][0])}:{e.frames[0][1]}{/if}
      </span>
    </div>
  {:else}
    <p class="px-space-lg py-12 text-center font-body text-body-sm text-on-surface-variant">
      No events match the filter.
    </p>
  {/each}
</section>

<style>
  @keyframes enter {
    from {
      opacity: 0;
      transform: translateY(-4px);
    }
  }
</style>
