<script lang="ts">
  let { key, apiUrl }: { key: string | null; apiUrl: string } = $props()

  let runtime = $state<'node' | 'bun'>('bun')
  let copied = $state('')

  const installCmd = $derived(
    runtime === 'bun' ? 'bun add @moecorp/moelog-bun' : 'npm install @moecorp/moelog-node',
  )

  const code = $derived(`import { init, log, error } from '@moecorp/moelog-${runtime}'

init({
  app: 'my-api',
  release: '1.0.0',
  server: '${apiUrl}',
  key: '${key ?? 'mlk_pub_…'}',
})

log('info', 'server up')

try {
  await charge()
} catch (e) {
  error(e, { route: '/checkout' })
}`)

  async function copy(text: string, what: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text)
      copied = what
      setTimeout(() => (copied = ''), 1500)
    } catch {
      /* no clipboard permission */
    }
  }
</script>

<section class="flex flex-col gap-space-2xl">
  <header class="flex flex-col gap-space-sm">
    <span class="chip chip-ok self-start">waiting for the first event</span>
    <h1 class="font-body text-headline-xl text-on-surface">Nothing has arrived yet</h1>
    <p class="font-body text-body-md text-on-surface-variant max-w-3xl">
      The server is running and listening. What is missing is an app: three steps and fewer than
      ten lines of code. The moment the first event arrives, this screen turns into the dashboard.
    </p>
  </header>

  <div class="flex items-center gap-space-sm">
    {#each [['bun', 'Bun'], ['node', 'Node']] as [k, label] (k)}
      <button
        onclick={() => (runtime = k as typeof runtime)}
        class="font-code text-label-md px-space-lg py-space-sm rounded-sm border transition-colors
          {runtime === k
          ? 'bg-surface-container-high text-primary border-primary-container/60'
          : 'bg-surface-container text-on-surface-variant border-outline-variant/40 hover:text-on-surface'}"
        >{label}</button
      >
    {/each}
  </div>

  <ol class="flex flex-col gap-space-xl">
    <li class="panel p-space-lg flex flex-col gap-space-md">
      <div class="flex items-center gap-space-sm">
        <span class="chip chip-neutral">1</span>
        <h2 class="font-body text-headline-md text-on-surface">Install the package</h2>
      </div>
      <div class="flex items-center gap-space-sm">
        <code class="font-code text-code-lg text-primary-fixed-dim bg-surface-container-lowest rounded px-space-md py-space-sm flex-1 break-all"
          >{installCmd}</code
        >
        <button
          onclick={() => copy(installCmd, 'inst')}
          class="font-code text-label-md px-space-md py-space-sm rounded-sm border border-outline-variant/40 text-on-surface-variant hover:text-on-surface transition-colors"
          >{copied === 'inst' ? 'copied' : 'copy'}</button
        >
      </div>
      <p class="font-code text-code-sm text-outline">
        Zero third-party dependencies. It also installs the <span class="kbd">moelog</span> binary.
      </p>
    </li>

    <li class="panel p-space-lg flex flex-col gap-space-md">
      <div class="flex items-center justify-between gap-space-sm flex-wrap">
        <div class="flex items-center gap-space-sm">
          <span class="chip chip-neutral">2</span>
          <h2 class="font-body text-headline-md text-on-surface">Initialize it in your app</h2>
        </div>
        <button
          onclick={() => copy(code, 'code')}
          class="font-code text-label-md px-space-md py-1 rounded-sm border border-outline-variant/40 text-on-surface-variant hover:text-on-surface transition-colors"
          >{copied === 'code' ? 'copied' : 'copy code'}</button
        >
      </div>
      <pre class="font-code text-code-md text-on-surface bg-surface-container-lowest rounded p-space-lg overflow-x-auto">{code}</pre>
      {#if !key}
        <p class="font-code text-code-sm text-secondary">
          There is no active ingest key. Create one in <a href="/settings" class="underline">Settings</a>.
        </p>
      {:else}
        <p class="font-code text-code-sm text-outline">
          Your app never talks to that URL: it hands it to the sidecar and forgets.
        </p>
      {/if}
    </li>

    <li class="panel p-space-lg flex flex-col gap-space-md">
      <div class="flex items-center gap-space-sm">
        <span class="chip chip-neutral">3</span>
        <h2 class="font-body text-headline-md text-on-surface">Start it under supervision</h2>
      </div>
      <div class="flex items-center gap-space-sm">
        <code class="font-code text-code-lg text-primary-fixed-dim bg-surface-container-lowest rounded px-space-md py-space-sm flex-1 break-all"
          >moelog run -- {runtime} run index.ts</code
        >
        <button
          onclick={() => copy(`moelog run -- ${runtime} run index.ts`, 'run')}
          class="font-code text-label-md px-space-md py-space-sm rounded-sm border border-outline-variant/40 text-on-surface-variant hover:text-on-surface transition-colors"
          >{copied === 'run' ? 'copied' : 'copy'}</button
        >
      </div>
      <p class="font-body text-body-sm text-on-surface-variant">
        Optional but recommended: it is the only way to detect that your app <em>never started</em>.
        Without the supervisor everything else works the same — the sidecar starts itself on
        <span class="kbd">init()</span>.
      </p>
    </li>
  </ol>

  <div class="panel p-space-lg flex flex-col gap-space-sm">
    <h2 class="font-body text-headline-md text-on-surface">Meanwhile</h2>
    <p class="font-body text-body-sm text-on-surface-variant">
      This screen does not poll: it is subscribed to the WebSocket. When the first event arrives
      you will see it appear without touching anything. If you want to check the alert channel
      works before connecting a real app, there is a
      <a href="/settings" class="text-primary-fixed-dim hover:underline">simulator in Settings</a>.
    </p>
  </div>
</section>
