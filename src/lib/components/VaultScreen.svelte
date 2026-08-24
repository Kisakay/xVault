<script lang="ts">
  import {
    app,
    importVaultFromFile,
    lockVault,
    openEntryDialog,
    openFolderDialog,
    signOut,
    theme,
    toggleTheme,
    type NavPanel,
  } from '../store.svelte';
  import BackupPanel from './BackupPanel.svelte';
  import CodesPanel from './CodesPanel.svelte';
  import ConfirmDialog from './ConfirmDialog.svelte';
  import EntryDialog from './EntryDialog.svelte';
  import FolderDialog from './FolderDialog.svelte';
  import InfoPanel from './InfoPanel.svelte';
  import SecurityPanel from './SecurityPanel.svelte';

  const panelLabels: Record<NavPanel, string> = {
    codes: 'Codes',
    backup: 'Backup',
    security: 'Security',
    info: 'Info',
  };

  const panelDescriptions: Record<NavPanel, string> = {
    codes: 'Daily use. Search and copy OTP codes immediately.',
    backup: 'Protect continuity before you need it.',
    security: 'Manage identity, session, and password hygiene.',
    info: 'See vault totals and the core actions available across the app.',
  };

  const panelIcons: Record<NavPanel, string> = {
    codes: 'pin',
    backup: 'database',
    security: 'security',
    info: 'info',
  };

  const panelOrder: NavPanel[] = ['codes', 'backup', 'security', 'info'];

  const goPanel = (panel: NavPanel): void => {
    app.activePanel = panel;
  };

  const navIndex = $derived.by(() => {
    const index = panelOrder.indexOf(app.activePanel);
    return index === -1 ? 0 : index;
  });

  const onNavChanged = (event: Event): void => {
    const detail = (event as CustomEvent<{ activeTabIndex: number }>).detail;
    const panel = panelOrder[detail.activeTabIndex];
    if (panel) {
      app.activePanel = panel;
    }
  };

  // Raccourcis clavier : S (recherche), N (nouveau compte), L (verrouiller).
  $effect(() => {
    const onKey = (event: KeyboardEvent): void => {
      const target = event.target as HTMLElement | null;
      const typing =
        !!target &&
        (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) ||
          target.isContentEditable);
      if (typing || app.entryDialogMode || app.qrScannerOpen || app.folderDialogOpen || app.confirm) {
        return;
      }
      const key = event.key.toLowerCase();
      if (event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }
      if (key === 's') {
        event.preventDefault();
        document.getElementById('vault-search')?.focus();
      } else if (key === 'n') {
        event.preventDefault();
        openEntryDialog('create');
      } else if (key === 'l') {
        event.preventDefault();
        lockVault();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const onImportChange = (event: Event): void => {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      void importVaultFromFile(file);
    }
    input.value = '';
  };

  const saveStatusLabel = $derived.by(() => {
    if (app.saveStatus === 'saving') return 'Encrypting changes…';
    if (app.saveStatus === 'error') return 'Save failed';
    if (app.saveStatus === 'saved') return 'Encrypted backup synced';
    return 'Vault ready';
  });

  const saveStatusIcon = $derived.by(() => {
    if (app.saveStatus === 'saving') return 'sync';
    if (app.saveStatus === 'error') return 'error';
    if (app.saveStatus === 'saved') return 'check_circle';
    return 'lock';
  });
</script>

<div class="shell">
  <!-- Sidebar desktop -->
  <aside class="sidebar">
    <div class="brand-lockup">
      <div class="brand-mark" aria-hidden="true">xV</div>
      <div>
        <p class="eyebrow">xVault</p>
        <h1>{app.user?.name ?? 'My Vault'}</h1>
      </div>
    </div>

    <div class="profile-chip">
      <md-icon>account_circle</md-icon>
      <div class="profile-chip__text">
        <span class="eyebrow">Authenticated as</span>
        <strong>{app.user?.loginId ?? 'Unknown'}</strong>
      </div>
    </div>

    <nav class="nav-list" aria-label="Primary">
      {#each panelOrder as panel (panel)}
        <button
          class="nav-item {app.activePanel === panel ? 'is-active' : ''}"
          class:is-active={app.activePanel === panel}
          onclick={() => goPanel(panel)}
          type="button"
        >
          <md-icon>{panelIcons[panel]}</md-icon>
          <span>{panelLabels[panel]}</span>
        </button>
      {/each}
    </nav>

    <div class="sidebar__spacer"></div>

    <div class="save-status" class:is-error={app.saveStatus === 'error'} title={app.saveMessage ?? ''}>
      <md-icon>{saveStatusIcon}</md-icon>
      <span>{saveStatusLabel}</span>
    </div>

    <div class="sidebar__actions">
      <md-filled-button style="width: 100%" onclick={() => openEntryDialog('create')}>
        <md-icon slot="icon">add</md-icon>
        Add account
      </md-filled-button>
      <md-filled-tonal-button style="width: 100%" onclick={() => openFolderDialog()}>
        <md-icon slot="icon">create_new_folder</md-icon>
        New folder
      </md-filled-tonal-button>
      <md-outlined-button style="width: 100%" onclick={lockVault}>
        <md-icon slot="icon">lock</md-icon>
        Lock
      </md-outlined-button>
      <md-text-button style="width: 100%" onclick={() => void signOut()}>
        Sign out
      </md-text-button>
    </div>
  </aside>

  <!-- Contenu principal -->
  <main class="main">
    <header class="topbar">
      <div class="topbar__title">
        <p class="eyebrow">{panelLabels[app.activePanel]}</p>
        <h2>{panelDescriptions[app.activePanel]}</h2>
      </div>
      <div class="topbar__actions">
        <md-icon-button
          aria-label={theme.mode === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          onclick={toggleTheme}
        >
          <md-icon>{theme.mode === 'dark' ? 'light_mode' : 'dark_mode'}</md-icon>
        </md-icon-button>
        <md-icon-button aria-label="Lock vault" onclick={lockVault}>
          <md-icon>lock</md-icon>
        </md-icon-button>
        <md-icon-button aria-label="Sign out" onclick={() => void signOut()}>
          <md-icon>logout</md-icon>
        </md-icon-button>
      </div>
    </header>

    <div class="content">
      {#if app.activePanel === 'codes'}
        <CodesPanel />
      {:else if app.activePanel === 'backup'}
        <BackupPanel />
      {:else if app.activePanel === 'security'}
        <SecurityPanel />
      {:else}
        <InfoPanel />
      {/if}
    </div>
  </main>

  <!-- Barre de navigation mobile -->
  <nav class="bottomnav" aria-label="Primary">
    <md-navigation-bar activeTabIndex={navIndex} onnavigationbaractivated={onNavChanged}>
      <md-navigation-tab label="Codes" icon="pin"></md-navigation-tab>
      <md-navigation-tab label="Backup" icon="database"></md-navigation-tab>
      <md-navigation-tab label="Security" icon="security"></md-navigation-tab>
      <md-navigation-tab label="Info" icon="info"></md-navigation-tab>
    </md-navigation-bar>
  </nav>

  <md-fab
    class="fab"
    variant="primary"
    label="Add account"
    aria-label="Add account"
    onclick={() => openEntryDialog('create')}
  >
    <md-icon slot="icon">add</md-icon>
  </md-fab>
</div>

<input
  hidden
  type="file"
  id="import-backup-file"
  accept=".json,application/json"
  onchange={onImportChange}
/>

<EntryDialog />
<FolderDialog />
<ConfirmDialog />

<style>
  .shell {
    min-height: 100vh;
    display: flex;
  }

  .sidebar {
    width: 264px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 20px;
    padding: 20px 16px;
    background: var(--md-sys-color-surface-container);
    border-right: 1px solid var(--md-sys-color-outline-variant);
    position: sticky;
    top: 0;
    height: 100vh;
  }

  .profile-chip {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border-radius: var(--xv-radius-sm);
    background: var(--md-sys-color-surface-container-high);
  }

  .profile-chip__text {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .profile-chip__text strong {
    font-size: 13px;
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .nav-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .nav-item {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    padding: 12px 14px;
    border: none;
    border-radius: 999px;
    background: transparent;
    color: var(--md-sys-color-on-surface-variant);
    font: inherit;
    font-size: 14px;
    font-weight: 500;
    text-align: left;
    cursor: pointer;
    transition: background 120ms ease, color 120ms ease;
  }

  .nav-item:hover {
    background: var(--md-sys-color-surface-container-high);
  }

  .nav-item.is-active {
    background: var(--md-sys-color-secondary-container);
    color: var(--md-sys-color-on-secondary-container);
  }

  .sidebar__spacer {
    flex: 1;
  }

  .save-status {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-radius: var(--xv-radius-sm);
    font-size: 12px;
    color: var(--md-sys-color-on-surface-variant);
    background: var(--md-sys-color-surface-container-low);
  }

  .save-status md-icon {
    font-size: 16px;
  }

  .save-status.is-error {
    color: var(--md-sys-color-error);
    background: var(--md-sys-color-error-container);
  }

  .sidebar__actions {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }

  .topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 20px 28px 8px;
  }

  .topbar__title h2 {
    margin: 4px 0 0;
    font-size: 16px;
    font-weight: 400;
    color: var(--md-sys-color-on-surface-variant);
  }

  .topbar__actions {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .content {
    padding: 16px 28px 96px;
    width: 100%;
    max-width: var(--xv-max-content);
  }

  .bottomnav {
    display: none;
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 20;
    background: var(--md-sys-color-surface-container);
    border-top: 1px solid var(--md-sys-color-outline-variant);
  }

  .fab {
    position: fixed;
    right: 24px;
    bottom: 24px;
    z-index: 21;
  }

  @media (max-width: 899px) {
    .shell {
      flex-direction: column;
      padding-bottom: 88px;
    }

    .sidebar {
      display: none;
    }

    .bottomnav {
      display: block;
    }

    .topbar {
      padding: 12px 16px 4px;
    }

    .topbar__title h2 {
      display: none;
    }

    .content {
      padding: 12px 16px 24px;
    }

    .fab {
      right: 20px;
      bottom: 96px;
    }
  }
</style>
