<script lang="ts">
  import { app, boot, theme } from './lib/store.svelte';
  import AuthScreen from './lib/components/AuthScreen.svelte';
  import BootScreen from './lib/components/BootScreen.svelte';
  import LockedScreen from './lib/components/LockedScreen.svelte';
  import Snackbar from './lib/components/Snackbar.svelte';
  import VaultScreen from './lib/components/VaultScreen.svelte';

  $effect(() => {
    document.documentElement.dataset.theme = theme.mode;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute(
        'content',
        theme.mode === 'dark' ? '#0d1419' : '#fafdfb',
      );
    }
  });

  $effect(() => {
    void boot();
  });
</script>

{#if app.screen === 'booting'}
  <BootScreen />
{:else if app.screen === 'auth'}
  <AuthScreen />
{:else if app.screen === 'locked'}
  <LockedScreen />
{:else}
  <VaultScreen />
{/if}

<Snackbar />
