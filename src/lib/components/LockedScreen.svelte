<script lang="ts">
  import { app, signOut, submitUnlock } from '../store.svelte';

  let password = $state('');
  let showPassword = $state(false);
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
      <md-outlined-text-field
        label="Password"
        name="password"
        id="unlock-password"
        type={showPassword ? 'text' : 'password'}
        autocomplete="current-password"
        value={password}
        oninput={(event: Event) =>
          (password = (event.target as HTMLInputElement).value)}
        style="width: 100%"
      >
        <md-icon-button
          slot="trailingicon"
          aria-label={showPassword ? 'Hide password' : 'Show password'}
          onclick={() => (showPassword = !showPassword)}
        >
          <md-icon>{showPassword ? 'visibility_off' : 'visibility'}</md-icon>
        </md-icon-button>
      </md-outlined-text-field>

      <md-filled-button style="width: 100%" type="submit" disabled={busy}>
        {busy ? 'Decrypting...' : 'Unlock vault'}
      </md-filled-button>
    </form>

    <div class="inline-actions" style="justify-content: center">
      <md-text-button onclick={() => void signOut()}>Sign out</md-text-button>
    </div>
  </div>
</div>
