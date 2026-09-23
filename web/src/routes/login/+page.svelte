<script lang="ts">
  import { enhance } from '$app/forms'
  import type { ActionData, PageData } from './$types'

  let { data, form }: { data: PageData; form: ActionData } = $props()
  let submitting = $state(false)
</script>

<svelte:head><title>Sign in · MoeLog</title></svelte:head>

<div class="min-h-screen grid lg:grid-cols-2 gap-0">
  <!-- Left panel: what this is. Everything here is true. -->
  <section class="hidden lg:flex flex-col justify-center gap-space-2xl p-12 xl:p-16 bg-surface">
    <div class="flex items-center gap-space-md">
      <span class="font-code text-headline-lg text-primary font-bold">MoeLog</span>
      <span class="chip chip-neutral">telemetry engine · alpha</span>
    </div>

    <div>
      <h1 class="font-body text-[2.5rem] leading-tight font-semibold tracking-tight text-on-surface">
        Observability <span class="text-primary-container">outside the process</span>, over unix
        sockets.
      </h1>
      <p class="font-body text-body-md text-on-surface-variant mt-space-lg max-w-xl">
        Your app writes to a local socket and forgets. A separate process persists, retries and
        outlives it — which is what lets it tell you how you died.
      </p>
    </div>

    <div class="grid sm:grid-cols-3 gap-gutter">
      {#each [['Near-zero cost', 'Emitting five errors with the server down cost the app 0.62 ms.'], ['Sees the invisible', 'SIGKILL, OOM and a blocked event loop: no in-process SDK can report them.'], ['Zero dependencies', 'Not one third-party dependency anywhere in the SDK chain.']] as [title, text] (title)}
        <div class="panel p-space-md">
          <div class="font-code text-label-sm uppercase tracking-wider text-primary-fixed-dim">
            {title}
          </div>
          <p class="font-body text-body-sm text-on-surface-variant mt-space-xs">{text}</p>
        </div>
      {/each}
    </div>

    <p class="font-code text-code-sm text-outline">
      self-hosted · your data never leaves your infrastructure
    </p>
  </section>

  <!-- Right panel: the form -->
  <section class="flex items-center justify-center p-space-xl bg-surface-container-lowest">
    <div class="w-full max-w-md flex flex-col gap-space-lg">
      <div class="lg:hidden flex items-center gap-space-sm">
        <span class="font-code text-headline-md text-primary font-bold">MoeLog</span>
        <span class="chip chip-neutral">alpha</span>
      </div>

      <div>
        <span class="chip chip-ok">local access</span>
        <h2 class="font-body text-headline-lg text-on-surface mt-space-md">Sign in</h2>
        <p class="font-body text-body-sm text-on-surface-variant mt-space-xs">
          The administrator credentials are printed to the server console the first time it boots.
        </p>
      </div>

      {#if data.expired}
        <p class="font-code text-code-md text-secondary bg-secondary-container/15 border border-secondary/30 rounded-sm px-space-md py-space-sm">
          Your session expired. Sign in again.
        </p>
      {/if}

      {#if form?.error}
        <p
          class="font-code text-code-md text-error bg-error-container/20 border border-error/40 rounded-sm px-space-md py-space-sm"
          role="alert"
        >
          {form.error}
        </p>
      {/if}

      <form
        method="POST"
        use:enhance={() => {
          submitting = true
          return async ({ update }) => {
            await update()
            submitting = false
          }
        }}
        class="flex flex-col gap-space-md"
      >
        <input type="hidden" name="next" value={data.next} />

        <label class="flex flex-col gap-space-xs">
          <span class="font-code text-label-md text-on-surface-variant">Username</span>
          <input
            name="username"
            autocomplete="username"
            required
            value={form?.username ?? ''}
            class="font-code text-code-lg bg-surface-container text-on-surface border border-outline-variant/50 rounded px-space-md py-space-sm focus:outline-none focus:border-primary-container"
          />
        </label>

        <label class="flex flex-col gap-space-xs">
          <span class="font-code text-label-md text-on-surface-variant">Password</span>
          <input
            name="password"
            type="password"
            autocomplete="current-password"
            required
            class="font-code text-code-lg bg-surface-container text-on-surface border border-outline-variant/50 rounded px-space-md py-space-sm focus:outline-none focus:border-primary-container"
          />
        </label>

        <button
          type="submit"
          disabled={submitting}
          class="mt-space-sm font-body text-headline-md font-semibold bg-primary-container text-on-primary rounded px-space-lg py-space-md hover:brightness-110 disabled:opacity-50 transition-all flex items-center justify-center gap-space-sm"
        >
          {submitting ? 'Signing in…' : 'Enter the dashboard'}
          {#if !submitting}<span aria-hidden="true">→</span>{/if}
        </button>
      </form>

      <div class="panel p-space-md flex flex-col gap-space-xs">
        <span class="font-code text-label-sm uppercase tracking-wider text-on-surface-variant"
          >First time?</span
        >
        <p class="font-body text-body-sm text-on-surface-variant">
          Check the server output: on its first boot it prints the username, the generated password
          and the initial ingest key. They are shown only once.
        </p>
        <a href="/status" class="font-code text-code-md text-primary-fixed-dim hover:underline"
          >See the public status page →</a
        >
      </div>
    </div>
  </section>
</div>
