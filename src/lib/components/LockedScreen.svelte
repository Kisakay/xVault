<script lang="ts">
  import { app, signOut, submitUnlock } from '../store.svelte';
  import NativeField from './NativeField.svelte';

  let password = $state('');
  let busy = $derived(app.pending.unlock);
</script>

<div class="auth-shell">
  <div class="auth-panel">
    <div class="brand-lockup" style="justify-content: center">
      <div class="brand-mark" aria-hidden="true">xV</div>
      <div>
        <p class="eyebrow">Vault locked</p>
        <h1>{app.user?.name ?? 'My Vault'}</h1>
      </div>
    </div>

    <div class="auth-panel__heading">
      <p class="eyebrow">Authenticated as {app.user?.loginId ?? 'Unknown'}</p>
      <h2>Enter your password to decrypt the vault.</h2>
    </div>

    {#if app.unlockError}
      <div class="notice" role="alert">
        {app.unlockError}
        {#if app.unlockAttemptsLeft !== undefined}
          <p style="margin: 6px 0 0">
            Attempts left: {app.unlockAttemptsLeft}
          </p>
        {/if}
      </div>
    {/if}

    <form
      class="stack-md"
      onsubmit={(event) => {
        event.preventDefault();
        void submitUnlock(password);
      }}
    >
      <NativeField
        label="Password"
        type="password"
        name="password"
        id="unlock-password"
        autocomplete="current-password"
        bind:value={password}
      />

      <md-filled-button style="width: 100%" type="submit" disabled={busy}>
        {busy ? 'Decrypting...' : 'Unlock vault'}
      </md-filled-button>
    </form>

    <div class="inline-actions" style="justify-content: center">
      <md-text-button onclick={() => void signOut()}>Sign out</md-text-button>
    </div>
  </div>
</div>
