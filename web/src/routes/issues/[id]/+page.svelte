<script lang="ts">
  import { enhance } from '$app/forms'
  import { LEVEL, ago, datetime, isInternal, num } from '$lib/format.ts'
  import type { PageData } from './$types'

  let { data }: { data: PageData } = $props()
  let saving = $state(false)
  let showInternal = $state(false)
  let copied = $state('')

  const latest = $derived(data.events[0])
  const frames = $derived(latest?.frames ?? [])
  const userFrames = $derived(frames.filter((f) => !isInternal(f[0])))
  const internalFrames = $derived(frames.filter((f) => isInternal(f[0])))

  const onSubmit = () => {
    saving = true
    return async ({ update }: { update: () => Promise<void> }) => {
      await update()
      saving = false
    }
  }

  async function copy(text: string, what: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text)
      copied = what
      setTimeout(() => (copied = ''), 1500)
    } catch {
      /* no clipboard permission */
    }
  }

  const flatStack = $derived(frames.map((f) => `    at ${f[3]} (${f[0]}:${f[1]}:${f[2]})`).join('\n'))
</script>

<svelte:head><title>{data.issue.title} · MoeLog</title></svelte:head>

<nav class="flex flex-wrap items-center justify-between gap-space-sm">
  <a href="/issues" class="font-code text-label-md text-on-surface-variant hover:text-primary-fixed-dim"
    >← Back to issues</a
  >
  <span class="font-code text-code-sm text-outline">ISSUE-{data.issue.fingerprint}</span>
</nav>

<!-- Issue header -->
<section class="panel p-space-lg flex flex-col gap-space-md">
  <div class="flex flex-wrap items-center gap-space-sm">
    <span class="chip chip-{LEVEL[data.issue.level]}">{LEVEL[data.issue.level]} {data.issue.level}</span>
    <span class="chip {data.issue.status === 'open' ? 'chip-warn' : 'chip-neutral'}">{data.issue.status}</span>
    <span class="font-code text-code-sm text-on-surface-variant"
      >fingerprint: <span class="text-tertiary-fixed-dim">{data.issue.fingerprint}</span></span
    >
    <div class="ml-auto flex flex-wrap gap-space-xs">
      <form method="POST" action="?/status" use:enhance={onSubmit}>
        <input type="hidden" name="status" value="resolved" />
        <button
          disabled={saving}
          class="font-code text-label-md px-space-md py-1 rounded-sm border border-outline-variant/50 text-on-surface hover:border-primary-container hover:text-primary-fixed-dim disabled:opacity-40 transition-colors"
          >Resolve</button
        >
      </form>
      <form method="POST" action="?/status" use:enhance={onSubmit}>
        <input type="hidden" name="status" value="ignored" />
        <button
          disabled={saving}
          class="font-code text-label-md px-space-md py-1 rounded-sm border border-outline-variant/50 text-on-surface-variant hover:text-on-surface disabled:opacity-40 transition-colors"
          >Ignore</button
        >
      </form>
      {#if data.issue.status !== 'open'}
        <form method="POST" action="?/status" use:enhance={onSubmit}>
          <input type="hidden" name="status" value="open" />
          <button
            disabled={saving}
            class="font-code text-label-md px-space-md py-1 rounded-sm border border-outline-variant/50 text-on-surface hover:border-secondary disabled:opacity-40 transition-colors"
            >Reopen</button
          >
        </form>
      {/if}
    </div>
  </div>

  <h1 class="font-code text-headline-lg text-on-surface break-words">{data.issue.title}</h1>

  <p class="font-code text-code-sm text-on-surface-variant flex flex-wrap gap-space-md">
    <span>app: <span class="text-on-surface">{data.issue.app}</span></span>
    <span>occurrences: <span class="tabular text-on-surface">{num(data.issue.count)}</span></span>
    {#if data.issue.release}<span>release: <span class="text-on-surface">{data.issue.release}</span></span>{/if}
    {#if latest?.runtime}<span>runtime: <span class="text-on-surface">{latest.runtime}</span></span>{/if}
  </p>
</section>

<!-- Metrics -->
<section class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-gutter">
  <div class="panel p-space-md">
    <span class="font-code text-label-sm uppercase tracking-wider text-on-surface-variant"
      >Total occurrences</span
    >
    <div class="tabular font-code text-headline-xl text-primary mt-space-sm">{num(data.issue.count)}</div>
  </div>
  <div class="panel p-space-md">
    <span class="font-code text-label-sm uppercase tracking-wider text-on-surface-variant"
      >First seen</span
    >
    <div class="font-body text-headline-md text-on-surface mt-space-sm">{ago(data.issue.first_seen)}</div>
    <div class="font-code text-code-sm text-outline mt-space-xs">{datetime(data.issue.first_seen)}</div>
  </div>
  <div class="panel p-space-md">
    <span class="font-code text-label-sm uppercase tracking-wider text-on-surface-variant"
      >Last seen</span
    >
    <div class="font-body text-headline-md text-error mt-space-sm">{ago(data.issue.last_seen)}</div>
    <div class="font-code text-code-sm text-outline mt-space-xs">{datetime(data.issue.last_seen)}</div>
  </div>
  <div class="panel p-space-md">
    <span class="font-code text-label-sm uppercase tracking-wider text-on-surface-variant">Release</span>
    <div class="font-code text-headline-md text-on-surface mt-space-sm">{data.issue.release ?? '—'}</div>
    <div class="font-code text-code-sm text-outline mt-space-xs">
      {latest?.pid ? `pid ${latest.pid}` : 'no pid'}
    </div>
  </div>
</section>

<!-- Stack -->
{#if frames.length > 0}
  <section class="panel">
    <header
      class="flex flex-wrap items-center justify-between gap-space-sm px-space-lg py-space-md border-b border-outline-variant/20"
    >
      <div>
        <h2 class="font-body text-headline-md text-on-surface">Stack trace</h2>
        <p class="font-code text-code-sm text-outline mt-0.5">
          latest occurrence{#if latest?.pid} in pid {latest.pid}{/if} · {frames.length} frames
        </p>
      </div>
      <button
        onclick={() => copy(flatStack, 'stack')}
        class="font-code text-label-md px-space-sm py-1 rounded-sm border border-outline-variant/40 text-on-surface-variant hover:text-on-surface transition-colors"
        >{copied === 'stack' ? 'copied' : 'copy stack'}</button
      >
    </header>

    <div class="p-space-lg flex flex-col gap-space-xs">
      {#each userFrames as f, idx (idx)}
        <div
          class="flex flex-wrap items-baseline gap-space-sm px-space-md py-space-sm rounded-sm bg-surface-container-lowest border-l-2 border-primary-container"
        >
          <span class="chip chip-ok shrink-0">frame #{idx + 1}</span>
          <span class="font-code text-code-lg text-on-surface">{f[3]}</span>
          <span class="font-code text-code-md text-on-surface-variant break-all" title={f[0]}
            >{f[0]}:{f[1]}:{f[2]}</span
          >
          <span class="chip chip-neutral ml-auto shrink-0">your code</span>
        </div>
      {/each}

      {#if internalFrames.length > 0}
        <button
          onclick={() => (showInternal = !showInternal)}
          class="text-left font-code text-code-md text-outline hover:text-on-surface-variant px-space-md py-space-sm rounded-sm border border-dashed border-outline-variant/40 transition-colors"
        >
          {showInternal ? '▾ hide' : '▸ show'}
          {internalFrames.length} internal frames (runtime and node_modules)
        </button>
        {#if showInternal}
          {#each internalFrames as f, idx (idx)}
            <div
              class="flex flex-wrap items-baseline gap-space-sm px-space-md py-1 font-code text-code-sm text-outline"
            >
              <span class="text-on-surface-variant">{f[3]}</span>
              <span class="break-all">{f[0]}:{f[1]}:{f[2]}</span>
            </div>
          {/each}
        {/if}
      {/if}
    </div>
  </section>
{/if}

<!-- Context -->
{#if latest?.ctx}
  <section class="panel">
    <header
      class="flex items-center justify-between gap-space-sm px-space-lg py-space-md border-b border-outline-variant/20"
    >
      <h2 class="font-body text-headline-md text-on-surface">
        Context <span class="font-code text-code-md text-primary-fixed-dim">ctx</span>
      </h2>
      <button
        onclick={() => copy(JSON.stringify(latest.ctx, null, 2), 'ctx')}
        class="font-code text-label-md px-space-sm py-1 rounded-sm border border-outline-variant/40 text-on-surface-variant hover:text-on-surface transition-colors"
        >{copied === 'ctx' ? 'copied' : 'copy JSON'}</button
      >
    </header>
    <pre
      class="font-code text-code-md text-on-surface-variant p-space-lg overflow-x-auto">{JSON.stringify(
        latest.ctx,
        null,
        2,
      )}</pre>
  </section>
{/if}

<!-- Occurrences -->
<section class="flex flex-col gap-space-md">
  <div class="flex items-baseline gap-space-sm">
    <h2 class="font-body text-headline-md text-on-surface">Recent occurrences</h2>
    <span class="tabular chip chip-neutral">{data.events.length} of {num(data.issue.count)}</span>
  </div>
  <div class="panel overflow-x-auto">
    <table class="w-full text-left border-collapse">
      <thead>
        <tr class="font-code text-label-sm uppercase tracking-wider text-on-surface-variant">
          <th class="font-medium px-space-lg py-space-sm">When</th>
          <th class="font-medium px-space-lg py-space-sm">Message</th>
          <th class="font-medium px-space-lg py-space-sm">Runtime</th>
          <th class="font-medium px-space-lg py-space-sm">PID</th>
          <th class="font-medium px-space-lg py-space-sm">File:line</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-outline-variant/20 border-t border-outline-variant/20">
        {#each data.events as e (e.id)}
          <tr class="hover:bg-surface-container-low/60 transition-colors">
            <td class="px-space-lg py-space-sm font-code text-code-sm text-on-surface-variant" title={datetime(e.t)}
              >{ago(e.t)}</td
            >
            <td class="px-space-lg py-space-sm font-body text-body-md text-on-surface">{e.msg}</td>
            <td class="px-space-lg py-space-sm font-code text-code-sm text-tertiary-fixed-dim">{e.runtime ?? '—'}</td>
            <td class="tabular px-space-lg py-space-sm font-code text-code-sm text-outline">{e.pid ?? '—'}</td>
            <td class="px-space-lg py-space-sm font-code text-code-sm text-on-surface-variant">
              {#if e.frames?.[0]}{e.frames[0][0].split('/').slice(-1)[0]}:{e.frames[0][1]}{:else}—{/if}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</section>
