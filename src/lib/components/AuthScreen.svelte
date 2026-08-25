<script lang="ts">
  import {
    acknowledgeRegistration,
    app,
    setAuthMode,
    submitAuth,
  } from '../store.svelte';
  import NativeField from './NativeField.svelte';

  let loginId = $state('');
  let password = $state('');
  let busy = $derived(app.pending.auth);

  const onTabsChange = (event: Event): void => {
    const target = event.target as HTMLElement & { activeTabIndex: number };
    setAuthMode(target.activeTabIndex === 1 ? 'register' : 'login');
  };
</script>

<div class="auth-shell">
  <div class="auth-panel">
    <div class="brand-lockup" style="justify-content: center">
      <div class="brand-mark" aria-hidden="true">xV</div>
      <div>
        <p class="eyebrow">xVault</p>
        <h1>Encrypted 2FA vault</h1>
      </div>
    </div>

    {#if app.registerLoginId}
      <div class="notice notice--success" role="status">
        <p style="margin: 0 0 6px; font-weight: 500">Vault created</p>
        <p style="margin: 0">
          Store this login ID somewhere safe. It is required for future
          sign-ins. There is no recovery flow.
        </p>
      </div>

      <div class="secret-box">
        <code>{app.registerLoginId}</code>
        <md-icon-button
          aria-label="Copy login ID"
          onclick={() => navigator.clipboard.writeText(app.registerLoginId ?? '')}
        >
          <md-icon>content_copy</md-icon>
        </md-icon-button>
      </div>

      <md-filled-button
        style="width: 100%"
        onclick={acknowledgeRegistration}
      >
        Continue to encrypted vault
      </md-filled-button>
    {:else}
      <div class="auth-panel__heading">
        <p class="eyebrow">
          {app.authMode === 'register' ? 'New secure vault' : 'Welcome back'}
        </p>
        <h2>
          {app.authMode === 'register'
            ? 'Create a vault built for 2FA hygiene.'
            : 'Access your encrypted OTP vault.'}
        </h2>
      </div>

      <md-tabs
        activeTabIndex={app.authMode === 'register' ? 1 : 0}
        onchange={onTabsChange}
      >
        <md-primary-tab>Sign in</md-primary-tab>
        <md-primary-tab>Create vault</md-primary-tab>
      </md-tabs>

      <form
        class="stack-md"
        novalidate
        onsubmit={(event) => {
          event.preventDefault();
          void submitAuth(loginId, password);
        }}
      >
        {#if app.authMode === 'login'}
          <NativeField
            label="Login ID"
            type="email"
            name="loginId"
            id="auth-login-id"
            autocomplete="username"
            placeholder="e.g. A7cK2xQp"
            bind:value={loginId}
          />
        {/if}

        <NativeField
          label={app.authMode === 'register' ? 'Encryption password' : 'Password'}
          type="password"
          name="password"
          id="auth-password"
          autocomplete={app.authMode === 'register' ? 'new-password' : 'current-password'}
          placeholder={app.authMode === 'register' ? 'At least 8 characters' : 'Enter your password'}
          bind:value={password}
        />

        {#if app.authError}
          <div class="notice" role="alert">{app.authError}</div>
        {/if}

        {#if app.authMode === 'register'}
          <p class="supporting-text">
            This password protects the vault data server-side. There is no
            magic recovery flow, so choose deliberately.
          </p>
        {/if}

        <md-filled-button
          style="width: 100%"
          type="submit"
          disabled={busy}
        >
          {#if busy}
            Working...
          {:else if app.authMode === 'register'}
            Create secure vault
          {:else}
            Sign in
          {/if}
        </md-filled-button>
      </form>
    {/if}
  </div>
</div>
