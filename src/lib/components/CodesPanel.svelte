<script lang="ts">
  import {
    app,
    deleteFolder,
    getVisibleEntries,
    openEntryDialog,
    openFolderDialog,
  } from '../store.svelte';
  import EntryCard from './EntryCard.svelte';

  const visibleEntries = $derived(getVisibleEntries());

  const sortedFolders = $derived(
    app.folders.slice().sort((left, right) => left.name.localeCompare(right.name)),
  );

  const entryCountByFolder = $derived.by(() => {
    const counts = new Map<string, number>();
    for (const entry of app.entries) {
      if (entry.folderId) {
        counts.set(entry.folderId, (counts.get(entry.folderId) ?? 0) + 1);
      }
    }
    return counts;
  });
</script>

<section class="codes-layout">
  <!-- Liste des dossiers (desktop) -->
  <aside class="folder-card">
    <div class="folder-card__heading">
      <p class="eyebrow">Folders</p>
      <md-icon-button
        aria-label="New folder"
        onclick={() => openFolderDialog()}
      >
        <md-icon>create_new_folder</md-icon>
      </md-icon-button>
    </div>

    <div class="folder-list">
      <button
        class="folder-row {app.activeFolderId === null ? 'is-active' : ''}"
        class:is-active={app.activeFolderId === null}
        onclick={() => (app.activeFolderId = null)}
        type="button"
      >
        <span class="folder-row__main">
          <md-icon class="folder-row__icon">apps</md-icon>
          <span>All accounts</span>
        </span>
        <span class="badge">{app.entries.length}</span>
      </button>

      {#each sortedFolders as folder (folder.id)}
        <div class="folder-row-shell">
          <button
            class="folder-row {app.activeFolderId === folder.id ? 'is-active' : ''}"
            class:is-active={app.activeFolderId === folder.id}
            onclick={() => (app.activeFolderId = folder.id)}
            type="button"
          >
            <span class="folder-row__main">
              <span class="folder-row__icon" style="color: {folder.color}">
                {folder.icon || '•'}
              </span>
              <span>{folder.name}</span>
            </span>
            <span class="badge">{entryCountByFolder.get(folder.id) ?? 0}</span>
          </button>
          <div class="folder-row__actions">
            <md-icon-button
              aria-label={`Edit folder ${folder.name}`}
              onclick={() => openFolderDialog(folder.id)}
            >
              <md-icon>edit</md-icon>
            </md-icon-button>
            <md-icon-button
              aria-label={`Delete folder ${folder.name}`}
              onclick={() => deleteFolder(folder.id)}
            >
              <md-icon>delete</md-icon>
            </md-icon-button>
          </div>
        </div>
      {/each}

      {#if app.folders.length === 0}
        <p class="supporting-text folder-empty">
          No folders yet. Create one for workspaces, clients, or critical infra.
        </p>
      {/if}
    </div>
  </aside>

  <!-- Recherche + grille d'entrées -->
  <div class="codes-main">
    <md-outlined-text-field
      id="vault-search"
      label="Quick search"
      placeholder="Search by issuer, account, or collection"
      value={app.search}
      oninput={(event: Event) =>
        (app.search = (event.target as HTMLInputElement).value)}
      style="width: 100%"
    >
      <md-icon slot="leadingicon">search</md-icon>
      {#if app.search}
        <md-icon-button
          slot="trailingicon"
          aria-label="Clear search"
          onclick={() => (app.search = '')}
        >
          <md-icon>close</md-icon>
        </md-icon-button>
      {/if}
    </md-outlined-text-field>

    {#if app.entries.length === 0}
      <div class="empty-state">
        <md-icon class="empty-state__icon">key</md-icon>
        <p class="eyebrow">Vault ready</p>
        <h2>No OTP accounts yet.</h2>
        <p class="supporting-text">
          Add a secret manually, paste an otpauth URI, or import an encrypted
          xVault backup.
        </p>
        <div class="inline-actions" style="margin-top: 12px">
          <md-filled-button onclick={() => openEntryDialog('create')}>
            Add first account
          </md-filled-button>
        </div>
      </div>
    {:else if visibleEntries.length === 0}
      <div class="empty-state">
        <md-icon class="empty-state__icon">search_off</md-icon>
        <p class="eyebrow">No match</p>
        <h2>Your filters returned zero accounts.</h2>
        <p class="supporting-text">
          Try a broader search or clear the current query to return to all
          active OTP entries.
        </p>
      </div>
    {:else}
      <div class="otp-grid">
        {#each visibleEntries as entry (entry.id)}
          <EntryCard {entry} />
        {/each}
      </div>
    {/if}
  </div>
</section>

<style>
  .codes-layout {
    display: grid;
    grid-template-columns: 264px 1fr;
    gap: 20px;
    align-items: start;
  }

  .folder-card {
    background: var(--md-sys-color-surface-container);
    border: 1px solid var(--md-sys-color-outline-variant);
    border-radius: var(--xv-radius-md);
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    position: sticky;
    top: 88px;
  }

  .folder-card__heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .folder-empty {
    padding: 8px 4px;
  }

  .folder-row__actions {
    display: flex;
    gap: 0;
  }

  .codes-main {
    display: flex;
    flex-direction: column;
    gap: 16px;
    min-width: 0;
  }

  .empty-state__icon {
    font-size: 40px;
    color: var(--md-sys-color-on-surface-variant);
  }

  @media (max-width: 899px) {
    .codes-layout {
      grid-template-columns: 1fr;
    }

    .folder-card {
      display: none;
    }
  }
</style>
