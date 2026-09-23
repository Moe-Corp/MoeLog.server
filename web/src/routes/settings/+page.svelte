<script lang="ts">
  import { enhance } from '$app/forms'
  import { ago, num } from '$lib/format.ts'
  import type { ActionData, PageData } from './$types'

  let { data, form }: { data: PageData; form: ActionData } = $props()
  let creating = $state(false)
  let revealed = $state<Record<string, boolean>>({})
  let copied = $state('')

  const active = $derived(data.keys.filter((k) => k.revoked === 0))

  const mask = (k: string): string => `${k.slice(0, 12)}${'•'.repeat(16)}${k.slice(-4)}`

  async function copy(k: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(k)
      copied = k
      setTimeout(() => (copied = ''), 1500)
    } catch {
      /* no clipboard */
    }
  }
</script>

<svelte:head><title>Settings · MoeLog</title></svelte:head>

<section class="flex flex-col gap-space-xs pb-space-sm border-b border-outline-variant/30">
  <h1 class="font-body text-headline-xl text-primary">Settings</h1>
  <p class="font-body text-body-sm text-on-surface-variant">
    Ingest keys, status page and testing tools.
  </p>
</section>

<!-- Keys -->
<section class="flex flex-col gap-space-md">
  <div class="flex flex-wrap items-baseline justify-between gap-space-sm">
    <div class="flex items-center gap-space-sm">
      <h2 class="font-body text-headline-md text-on-surface">Ingest keys</h2>
      <span class="chip chip-neutral">{active.length} active</span>
    </div>
  </div>

  <p class="font-body text-body-sm text-on-surface-variant max-w-3xl">
    They are <strong class="text-on-surface">write only</strong>: they send events, they do not read
    them. You can paste one into a <span class="kbd">docker-compose</span> without granting access
    to this dashboard. If one leaks, revoke it: nobody gets signed out.
  </p>

  {#if form?.created}
    <div class="panel border-primary-container/50 bg-primary-container/5 p-space-lg flex flex-col gap-space-sm">
      <span class="font-code text-label-md text-primary-fixed-dim">key created</span>
      <code class="font-code text-code-lg text-on-surface break-all">{form.created}</code>
      <button
        onclick={() => copy(form.created as string)}
        class="self-start font-code text-label-md px-space-md py-1 rounded-sm border border-outline-variant/50 text-on-surface hover:border-primary-container transition-colors"
        >{copied === form.created ? 'copied' : 'copy'}</button
      >
    </div>
  {/if}

  <form
    method="POST"
    action="?/create"
    use:enhance={() => {
      creating = true
      return async ({ update }) => {
        await update()
        creating = false
      }
    }}
    class="flex flex-wrap gap-space-sm"
  >
    <input
      name="label"
      placeholder="label, e.g. production payments-api"
      required
      class="font-code text-code-md bg-surface-container text-on-surface placeholder:text-outline border border-outline-variant/40 rounded-sm px-space-md py-space-sm flex-1 min-w-64 focus:outline-none focus:border-primary-container"
    />
    <button
      type="submit"
      disabled={creating}
      class="font-code text-label-md px-space-lg py-space-sm rounded-sm bg-primary-container text-on-primary font-semibold hover:brightness-110 disabled:opacity-50 transition-all"
      >{creating ? 'creating…' : 'Create key'}</button
    >
  </form>

  <div class="panel overflow-x-auto">
    <table class="w-full text-left border-collapse">
      <thead>
        <tr class="font-code text-label-sm uppercase tracking-wider text-on-surface-variant">
          <th class="font-medium px-space-lg py-space-sm">Label</th>
          <th class="font-medium px-space-lg py-space-sm">Key</th>
          <th class="font-medium px-space-lg py-space-sm text-right">Uses</th>
          <th class="font-medium px-space-lg py-space-sm">Last used</th>
          <th class="font-medium px-space-lg py-space-sm text-right">Actions</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-outline-variant/20 border-t border-outline-variant/20">
        {#each data.keys as k (k.key)}
          <tr class={k.revoked ? 'opacity-50' : ''}>
            <td class="px-space-lg py-space-md font-body text-body-md text-on-surface">
              {k.label}
              {#if k.revoked}<span class="chip chip-error ml-space-xs">revoked</span>{/if}
            </td>
            <td class="px-space-lg py-space-md">
              <button
                onclick={() => (revealed[k.key] = !revealed[k.key])}
                class="font-code text-code-md text-on-surface-variant hover:text-on-surface text-left break-all"
                title="show or hide">{revealed[k.key] ? k.key : mask(k.key)}</button
              >
              {#if revealed[k.key]}
                <button
                  onclick={() => copy(k.key)}
                  class="ml-space-sm font-code text-label-sm text-primary-fixed-dim hover:underline"
                  >{copied === k.key ? 'copied' : 'copy'}</button
                >
              {/if}
            </td>
            <td class="tabular px-space-lg py-space-md text-right font-code text-code-md text-on-surface"
              >{num(k.uses)}</td
            >
            <td class="px-space-lg py-space-md font-code text-code-sm text-on-surface-variant">
              {k.last_used ? ago(k.last_used) : 'never'}
            </td>
            <td class="px-space-lg py-space-md text-right whitespace-nowrap">
              {#if !k.revoked}
                <form method="POST" action="?/revoke" use:enhance class="inline">
                  <input type="hidden" name="key" value={k.key} />
                  <button
                    class="font-code text-label-md text-on-surface-variant hover:text-secondary transition-colors"
                    >revoke</button
                  >
                </form>
              {:else}
                <form method="POST" action="?/remove" use:enhance class="inline">
                  <input type="hidden" name="key" value={k.key} />
                  <button class="font-code text-label-md text-outline hover:text-error transition-colors"
                    >delete</button
                  >
                </form>
              {/if}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</section>

<!-- Status page -->
<section class="flex flex-col gap-space-md">
  <div class="flex items-center gap-space-sm">
    <h2 class="font-body text-headline-md text-on-surface">Status page</h2>
    <a href="/status" class="font-code text-label-md text-primary-fixed-dim hover:underline">view →</a>
  </div>
  <p class="font-body text-body-sm text-on-surface-variant max-w-3xl">
    The only view without a session. It shows which apps exist, whether they are reporting and how
    many incidents they had. <strong class="text-on-surface">Never</strong> error messages, stacks
    or file paths.
  </p>

  {#if form?.saved}
    <p class="font-code text-code-md text-primary-fixed-dim">Settings saved.</p>
  {/if}

  <form method="POST" action="?/settings" use:enhance class="panel p-space-lg flex flex-col gap-space-md">
    <label class="flex flex-col gap-space-xs">
      <span class="font-code text-label-md text-on-surface-variant">Title</span>
      <input
        name="status_title"
        value={data.settings['status_title'] ?? ''}
        placeholder="Service status"
        class="font-code text-code-md bg-surface-container text-on-surface placeholder:text-outline border border-outline-variant/40 rounded-sm px-space-md py-space-sm focus:outline-none focus:border-primary-container"
      />
    </label>
    <label class="flex flex-col gap-space-xs">
      <span class="font-code text-label-md text-on-surface-variant">Description</span>
      <input
        name="status_description"
        value={data.settings['status_description'] ?? ''}
        placeholder="One line for whoever arrives from outside"
        class="font-code text-code-md bg-surface-container text-on-surface placeholder:text-outline border border-outline-variant/40 rounded-sm px-space-md py-space-sm focus:outline-none focus:border-primary-container"
      />
    </label>
    <label class="flex items-center gap-space-sm">
      <input
        type="checkbox"
        name="status_published"
        checked={data.settings['status_published'] !== '0'}
        class="accent-[#bef500] w-4 h-4"
      />
      <span class="font-body text-body-md text-on-surface">Page reachable without a session</span>
    </label>
    <button
      type="submit"
      class="self-start font-code text-label-md px-space-lg py-space-sm rounded-sm bg-surface-container-high text-on-surface border border-outline-variant/50 hover:border-primary-container transition-colors"
      >Save</button
    >
  </form>
</section>

<!-- Test alert -->
<section class="flex flex-col gap-space-md">
  <div class="flex items-center gap-space-sm">
    <h2 class="font-body text-headline-md text-on-surface">Test alert</h2>
    <span class="chip chip-warn">flagged as simulated</span>
  </div>
  <p class="font-body text-body-sm text-on-surface-variant max-w-3xl">
    Generates an alert so you can check that the dashboard and your webhook react, without killing
    a real app. It is flagged with <span class="kbd">simulated: true</span> and rendered
    differently: a monitoring system that mistakes a drill for a real outage is worse than no
    monitoring at all.
  </p>

  {#if form?.simulated}
    <p class="font-code text-code-md text-secondary">
      Simulated alert generated. See it in <a href="/alerts" class="underline">Alerts</a>.
    </p>
  {/if}
  {#if form?.error}
    <p class="font-code text-code-md text-error">{form.error}</p>
  {/if}

  <form method="POST" action="?/simulate" use:enhance class="flex flex-wrap gap-space-sm items-end">
    <label class="flex flex-col gap-space-xs">
      <span class="font-code text-label-md text-on-surface-variant">Kind</span>
      <select
        name="kind"
        class="font-code text-code-md bg-surface-container text-on-surface border border-outline-variant/40 rounded-sm px-space-md py-space-sm focus:outline-none focus:border-primary-container"
      >
        <option value="app.blocked">app.blocked — event loop blocked</option>
        <option value="app.crashed">app.crashed — abrupt death</option>
        <option value="app.fatal">app.fatal — uncaught exception</option>
        <option value="app.failed_to_start">app.failed_to_start — never started</option>
      </select>
    </label>
    <label class="flex flex-col gap-space-xs">
      <span class="font-code text-label-md text-on-surface-variant">App</span>
      <select
        name="app"
        class="font-code text-code-md bg-surface-container text-on-surface border border-outline-variant/40 rounded-sm px-space-md py-space-sm focus:outline-none focus:border-primary-container"
      >
        {#each data.apps as a (a.name)}
          <option value={a.name}>{a.name}</option>
        {:else}
          <option value="">no apps yet</option>
        {/each}
      </select>
    </label>
    <button
      type="submit"
      class="font-code text-label-md px-space-lg py-space-sm rounded-sm bg-secondary-container/30 text-secondary border border-secondary/40 hover:bg-secondary-container/50 transition-colors"
      >Simulate</button
    >
  </form>
</section>

<!-- Session -->
<section class="flex flex-col gap-space-md">
  <h2 class="font-body text-headline-md text-on-surface">Session</h2>
  <div class="panel p-space-lg flex flex-wrap items-center justify-between gap-space-md">
    <p class="font-body text-body-sm text-on-surface-variant">
      The session lives in a 7-day <span class="kbd">httpOnly</span> cookie. The browser's
      JavaScript cannot read it.
    </p>
    <form method="POST" action="/logout">
      <button
        class="font-code text-label-md px-space-lg py-space-sm rounded-sm border border-outline-variant/50 text-on-surface hover:border-error hover:text-error transition-colors"
        >Sign out</button
      >
    </form>
  </div>
</section>
