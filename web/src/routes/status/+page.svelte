<script lang="ts">
  import { ago, datetime } from '$lib/format.ts'
  import type { PageData } from './$types'

  let { data }: { data: PageData } = $props()
  const s = $derived(data.status)
  const ok = $derived(s.global === 'operational')
</script>

<svelte:head><title>{s.title}</title></svelte:head>

<div class="min-h-screen bg-surface">
  <div class="max-w-[900px] mx-auto px-margin py-12 flex flex-col gap-space-2xl">
    <header class="flex flex-col gap-space-sm">
      <div class="flex items-center gap-space-sm">
        <span class="font-code text-code-lg text-primary font-bold">MoeLog</span>
        <span class="chip chip-neutral">status</span>
      </div>
      <h1 class="font-body text-headline-xl text-on-surface">{s.title}</h1>
      {#if s.description}
        <p class="font-body text-body-md text-on-surface-variant">{s.description}</p>
      {/if}
    </header>

    <section
      class="panel p-space-lg flex flex-wrap items-center justify-between gap-space-md {ok
        ? 'border-primary-container/40'
        : 'border-secondary/40'}"
    >
      <div class="flex items-center gap-space-md">
        <span class="relative flex h-3 w-3">
          <span class="absolute inline-flex h-full w-full rounded-full {ok ? 'bg-primary-container' : 'bg-secondary'} opacity-60 animate-ping"></span>
          <span class="relative inline-flex rounded-full h-3 w-3 {ok ? 'bg-primary-container' : 'bg-secondary'}"></span>
        </span>
        <span class="font-body text-headline-md {ok ? 'text-primary-fixed-dim' : 'text-secondary'}">
          {ok ? 'All services operational' : 'Some service has incidents'}
        </span>
      </div>
      <span class="font-code text-code-sm text-outline">updated {ago(s.generated)}</span>
    </section>

    <section class="flex flex-col gap-space-md">
      <h2 class="font-body text-headline-md text-on-surface">Services</h2>
      <div class="panel divide-y divide-outline-variant/20">
        {#each s.services as svc (svc.name)}
          <div class="flex flex-wrap items-center gap-space-md px-space-lg py-space-lg">
            <div class="flex-1 min-w-48">
              <div class="flex items-center gap-space-sm">
                <span class="w-2 h-2 rounded-full {svc.state === 'operational' ? 'bg-primary-container' : 'bg-outline'}"></span>
                <span class="font-code text-code-lg text-on-surface">{svc.name}</span>
              </div>
              <div class="font-code text-code-sm text-outline mt-space-xs">
                last signal {ago(svc.last_seen)}
              </div>
            </div>

            <div class="flex gap-space-2xl font-code text-code-sm">
              <div>
                <div class="text-outline">incidents 24 h</div>
                <div class="tabular text-headline-md {svc.incidents_24h > 0 ? 'text-secondary' : 'text-on-surface'}">{svc.incidents_24h}</div>
              </div>
              <div>
                <div class="text-outline">clean hours 24 h</div>
                <div class="tabular text-headline-md text-on-surface">{svc.clean_hours_24h}/24</div>
              </div>
              <div class="hidden sm:block">
                <div class="text-outline">clean hours 7 d</div>
                <div class="tabular text-headline-md text-on-surface">{svc.clean_hours_7d}/168</div>
              </div>
            </div>

            <span
              class="chip {svc.state === 'operational'
                ? 'chip-ok'
                : svc.state === 'degraded'
                  ? 'chip-warn'
                  : 'chip-neutral'}">{svc.state}</span
            >
          </div>
        {:else}
          <p class="px-space-lg py-12 text-center font-body text-body-md text-on-surface-variant">
            No app has reported yet.
          </p>
        {/each}
      </div>
    </section>

    <footer class="font-code text-code-sm text-outline flex flex-col gap-space-xs">
      <p>
        <strong class="text-on-surface-variant">Clean hours</strong>, not "uptime": MoeLog does not
        measure availability, it measures whether the process emitted failure signals. An hour
        counts as clean when there were no crashes, blocks or failed startups.
      </p>
      <p>Generated {datetime(s.generated)} · this page exposes no error messages or stacks.</p>
    </footer>
  </div>
</div>
