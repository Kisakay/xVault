<script lang="ts">
  import {
    app,
    changeVaultPassword,
    deleteAccountAction,
    saveProfile,
  } from '../store.svelte';

  let name = $state('');
  let currentPassword = $state('');
  let newPassword = $state('');
  let confirmPassword = $state('');
  let deletePassword = $state('');

  $effect(() => {
    name = app.user?.name ?? 'My Vault';
  });

  const onProfileSubmit = (event: SubmitEvent): void => {
    event.preventDefault();
    void saveProfile(name.trim());
  };

  const onPasswordSubmit = (event: SubmitEvent): void => {
    event.preventDefault();
    void changeVaultPassword(currentPassword, newPassword, confirmPassword);
    currentPassword = '';
    newPassword = '';
    confirmPassword = '';
  };

  const onDeleteSubmit = (event: SubmitEvent): void => {
    event.preventDefault();
    void deleteAccountAction(deletePassword);
  };

  const setField = (setter: (value: string) => void) => (event: Event) =>
    setter((event.target as HTMLInputElement).value);
</script>

<section class="split-panel">
  <article class="md-card stack-lg">
    <div>
      <p class="eyebrow">Vault identity</p>
      <h3 class="panel-title">Update the name shown in the vault shell.</h3>
    </div>
    <form class="stack-md" onsubmit={onProfileSubmit}>
      <md-outlined-text-field
        label="Vault name"
        value={name}
        oninput={setField((value) => (name = value))}
        style="width: 100%"
      ></md-outlined-text-field>
      <div class="inline-actions">
        <md-filled-button type="submit" disabled={app.pending.profile}>
          {app.pending.profile ? 'Saving...' : 'Save profile'}
        </md-filled-button>
        <span class="supporting-text">
          Login ID: <span class="mono">{app.user?.loginId ?? 'Unknown'}</span>
        </span>
      </div>
    </form>
  </article>

  <article class="md-card stack-lg">
    <div>
      <p class="eyebrow">Password rotation</p>
      <h3 class="panel-title">Re-encrypt the vault with a new password.</h3>
      <p class="supporting-text">
        The backend decrypts the current vault and immediately re-encrypts it
        with your new password.
      </p>
    </div>
    <form class="stack-md" onsubmit={onPasswordSubmit}>
      <md-outlined-text-field
        label="Current password"
        type="password"
        autocomplete="current-password"
        value={currentPassword}
        oninput={setField((value) => (currentPassword = value))}
        style="width: 100%"
      ></md-outlined-text-field>
      <md-outlined-text-field
        label="New password"
        type="password"
        autocomplete="new-password"
        value={newPassword}
        oninput={setField((value) => (newPassword = value))}
        style="width: 100%"
      ></md-outlined-text-field>
      <md-outlined-text-field
        label="Confirm new password"
        type="password"
        autocomplete="new-password"
        value={confirmPassword}
        oninput={setField((value) => (confirmPassword = value))}
        style="width: 100%"
      ></md-outlined-text-field>
      <div class="inline-actions">
        <md-filled-button type="submit" disabled={app.pending.password}>
          {app.pending.password ? 'Updating...' : 'Change password'}
        </md-filled-button>
      </div>
    </form>
  </article>

  <article class="md-card stack-lg danger-card">
    <div>
      <p class="eyebrow">Destructive action</p>
      <h3 class="panel-title">Delete this account and all encrypted data.</h3>
      <p class="supporting-text">
        This permanently removes the user record and the stored vault payload
        from the server database.
      </p>
    </div>
    <form class="stack-md" onsubmit={onDeleteSubmit}>
      <md-outlined-text-field
        label="Password confirmation"
        type="password"
        autocomplete="current-password"
        value={deletePassword}
        oninput={setField((value) => (deletePassword = value))}
        style="width: 100%"
      ></md-outlined-text-field>
      <md-filled-button
        type="submit"
        class="danger-button"
        disabled={app.pending.danger}
      >
        {app.pending.danger ? 'Deleting account...' : 'Delete account'}
      </md-filled-button>
    </form>
  </article>
</section>

<style>
  .panel-title {
    margin: 6px 0 8px;
    font-size: 17px;
    font-weight: 500;
  }

  .danger-card {
    border-color: var(--md-sys-color-error-container);
  }

  .danger-button {
    --md-filled-button-container-color: var(--md-sys-color-error);
    --md-filled-button-label-text-color: var(--md-sys-color-on-error);
  }
</style>
