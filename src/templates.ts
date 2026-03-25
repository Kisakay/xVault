import type { AppState } from './app-state';
import { splitEntryName } from './otpauth';
import type { Folder, TOTPEntry } from './types';

export interface RenderModel {
  state: AppState;
  visibleEntries: TOTPEntry[];
  foldersById: Map<string, Folder>;
}

const escapeHtml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const formatCode = (code: string): string => {
  if (!code || code === '------') {
    return '--- ---';
  }

  if (code.length === 6) {
    return `${code.slice(0, 3)} ${code.slice(3)}`;
  }

  if (code.length === 8) {
    return `${code.slice(0, 4)} ${code.slice(4)}`;
  }

  return code.replace(/(.{3})/g, '$1 ').trim();
};

const renderFolderOptionList = (folders: Folder[], selectedFolderId: string | null): string =>
  folders
    .slice()
    .sort((left, right) => left.name.localeCompare(right.name))
    .map(
      (folder) =>
        `<option value="${escapeHtml(folder.id)}" ${selectedFolderId === folder.id ? 'selected' : ''}>${escapeHtml(folder.name)}</option>`,
    )
    .join('');

const getEntryEditorValues = (state: AppState): {
  modeLabel: string;
  title: string;
  submitLabel: string;
  accountName: string;
  issuer: string;
  secret: string;
  digits: number;
  period: number;
  folderId: string | null;
  iconData: string;
} => {
  const entry = state.editingEntryId ? state.entries.find((item) => item.id === state.editingEntryId) ?? null : null;

  if (!entry) {
    return {
      modeLabel: 'New OTP account',
      title: 'Add a TOTP entry in the fastest possible way.',
      submitLabel: 'Store OTP entry',
      accountName: '',
      issuer: '',
      secret: '',
      digits: 6,
      period: 30,
      folderId: state.activeFolderId,
      iconData: '',
    };
  }

  const { title, subtitle } = splitEntryName(entry.name);

  return {
    modeLabel: 'Edit OTP account',
    title: 'Update the OTP entry and keep the vault organized.',
    submitLabel: 'Save changes',
    accountName: title,
    issuer: subtitle ?? '',
    secret: entry.secret,
    digits: entry.digits ?? 6,
    period: entry.period ?? 30,
    folderId: entry.folderId ?? null,
    iconData: entry.isCustomIcon && entry.icon.startsWith('data:image/') ? entry.icon : '',
  };
};

const renderEntryIconEditor = (iconData: string): string => `
  <div class="icon-editor">
    <div class="icon-editor__preview ${iconData ? 'has-image' : ''}">
      ${
        iconData
          ? `<img id="entry-icon-preview-image" class="icon-editor__image" src="${escapeHtml(iconData)}" alt="" />`
          : `<span id="entry-icon-preview-fallback" class="icon-editor__fallback">+</span>`
      }
    </div>
    <div class="icon-editor__controls">
      <label class="button button--secondary icon-editor__upload">
        <input id="entry-icon-file" name="iconFile" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden />
        Upload icon
      </label>
      <button class="button button--ghost" data-action="clear-entry-icon" type="button" ${iconData ? '' : 'disabled'}>
        Remove icon
      </button>
      <input id="entry-icon-data" name="iconData" type="hidden" value="${escapeHtml(iconData)}" />
      <p class="field-hint">Square logos work best. The image is stored with the OTP entry and shown on the card.</p>
    </div>
  </div>
`;

const getFolderEditorValues = (state: AppState): {
  modeLabel: string;
  title: string;
  submitLabel: string;
  name: string;
  icon: string;
  color: string;
} => {
  const folder = state.editingFolderId ? state.folders.find((item) => item.id === state.editingFolderId) ?? null : null;

  if (!folder) {
    return {
      modeLabel: 'New collection',
      title: 'Create a folder to keep OTP accounts grouped by context.',
      submitLabel: 'Create folder',
      name: '',
      icon: '•',
      color: '#62d7bb',
    };
  }

  return {
    modeLabel: 'Edit collection',
    title: 'Rename or restyle the current folder without losing entries.',
    submitLabel: 'Save folder',
    name: folder.name,
    icon: folder.icon,
    color: folder.color,
  };
};

const renderBootScreen = (): string => `
  <main class="screen screen--centered">
    <section class="boot card">
      <div class="brand-lockup">
        <div class="brand-mark" aria-hidden="true">
          <span>xV</span>
        </div>
        <div>
          <p class="eyebrow">xVault rebuild</p>
          <h1>Secure OTP access, without front-end noise.</h1>
        </div>
      </div>
      <div class="spinner" aria-hidden="true"></div>
      <p class="supporting-text">Checking the current session and preparing the encrypted vault shell.</p>
    </section>
  </main>
`;

const renderAuthScreen = ({ state }: RenderModel): string => `
  <main class="screen auth-screen auth-screen--compact">
    <section class="auth-panel card">
      ${
        state.registerLoginId
          ? `
            <div class="success-panel">
              <p class="eyebrow">Vault created</p>
              <h2>Keep this login ID.</h2>
              <p class="supporting-text">
                Your vault is ready. Store this identifier somewhere safe. It is required for future sign-ins.
              </p>
              <div class="secret-box">
                <code>${escapeHtml(state.registerLoginId)}</code>
                <button class="button button--secondary" data-action="copy-login-id" type="button">Copy</button>
              </div>
              <button class="button button--primary button--block" data-action="acknowledge-registration" type="button">
                Continue to encrypted vault
              </button>
            </div>
          `
          : `
            <div class="segmented-control" role="tablist" aria-label="Authentication mode">
              <button
                class="segmented-control__item ${state.authMode === 'login' ? 'is-active' : ''}"
                type="button"
                data-action="set-auth-mode"
                data-mode="login"
              >
                Sign in
              </button>
              <button
                class="segmented-control__item ${state.authMode === 'register' ? 'is-active' : ''}"
                type="button"
                data-action="set-auth-mode"
                data-mode="register"
              >
                Create vault
              </button>
            </div>

            <div class="panel-heading">
              <p class="eyebrow">${state.authMode === 'register' ? 'New secure vault' : 'Welcome back'}</p>
              <h2>${state.authMode === 'register' ? 'Create a vault built for 2FA hygiene.' : 'Access your encrypted OTP vault.'}</h2>
            </div>

            ${
              state.authError
                ? `<div class="notice notice--error" role="alert">${escapeHtml(state.authError)}</div>`
                : ''
            }

            <form data-form="auth" class="stack-lg">
              ${
                state.authMode === 'login'
                  ? `
                    <label class="field">
                      <span>Login ID</span>
                      <input id="auth-login-id" name="loginId" type="text" autocomplete="username" placeholder="e.g. A7cK2xQp" />
                    </label>
                  `
                  : ''
              }
              <label class="field">
                <span>${state.authMode === 'register' ? 'Encryption password' : 'Password'}</span>
                <input
                  id="auth-password"
                  name="password"
                  type="password"
                  autocomplete="${state.authMode === 'register' ? 'new-password' : 'current-password'}"
                  placeholder="${state.authMode === 'register' ? 'Use a strong passphrase' : 'Enter your password'}"
                />
              </label>
              ${
                state.authMode === 'register'
                  ? `<p class="field-hint">This password protects the vault data server-side. There is no magic recovery flow, so choose deliberately.</p>`
                  : ''
              }
              <button class="button button--primary button--block" type="submit" ${state.pending.auth ? 'disabled' : ''}>
                ${state.pending.auth ? 'Working...' : state.authMode === 'register' ? 'Create secure vault' : 'Sign in'}
              </button>
            </form>
          `
      }
    </section>
  </main>
`;

const renderLockedScreen = ({ state }: RenderModel): string => `
  <main class="screen screen--centered">
    <section class="lock-panel card">
      <div class="panel-heading">
        <p class="eyebrow">Vault locked</p>
        <h1>Enter your password to decrypt the current vault session.</h1>
        <p class="supporting-text">
          ${escapeHtml(state.user?.name ?? 'My Vault')}
          ${state.user?.loginId ? ` · ${escapeHtml(state.user.loginId)}` : ''}
        </p>
      </div>

      ${
        state.unlockError
          ? `
            <div class="notice notice--error" role="alert">
              <p>${escapeHtml(state.unlockError)}</p>
              ${
                state.unlockAttemptsLeft !== undefined
                  ? `<p class="supporting-text">Attempts left: ${state.unlockAttemptsLeft}</p>`
                  : ''
              }
            </div>
          `
          : ''
      }

      <form data-form="unlock" class="stack-lg">
        <label class="field">
          <span>Password</span>
          <input id="unlock-password" name="password" type="password" autocomplete="current-password" autofocus />
        </label>
        <button class="button button--primary button--block" type="submit" ${state.pending.unlock ? 'disabled' : ''}>
          ${state.pending.unlock ? 'Decrypting...' : 'Unlock vault'}
        </button>
      </form>

      <div class="inline-actions">
        <button class="button button--ghost" data-action="logout" type="button">Sign out</button>
      </div>
    </section>
  </main>
`;

const renderSaveBadge = (state: AppState): string => {
  const labels: Record<AppState['saveStatus'], string> = {
    idle: 'Ready',
    saving: 'Encrypting changes',
    saved: 'Encrypted backup synced',
    error: 'Save issue',
  };

  const tone =
    state.saveStatus === 'error'
      ? 'badge--danger'
      : state.saveStatus === 'saving'
        ? 'badge--accent'
        : 'badge--neutral';

  return `<span class="badge ${tone}" aria-live="polite">${labels[state.saveStatus]}</span>`;
};

const renderEntryAvatar = (entry: TOTPEntry): string => {
  if (entry.isCustomIcon && entry.icon.startsWith('data:image/')) {
    return `<img class="avatar__image" src="${escapeHtml(entry.icon)}" alt="" />`;
  }

  const icon = entry.icon?.trim();

  if (icon && icon.length <= 2) {
    return `<span class="avatar__glyph">${escapeHtml(icon)}</span>`;
  }

  return `<span class="avatar__fallback">${escapeHtml(entry.name.trim().slice(0, 1).toUpperCase() || 'X')}</span>`;
};

const renderEntryCard = (entry: TOTPEntry, state: AppState, foldersById: Map<string, Folder>): string => {
  const otp = state.otpById[entry.id];
  const folder = entry.folderId ? foldersById.get(entry.folderId) : null;
  const { title, subtitle } = splitEntryName(entry.name);
  const remaining = otp?.remaining ?? (entry.period ?? 30);
  const period = otp?.period ?? (entry.period ?? 30);
  const progress = Math.max(4, Math.round((remaining / period) * 100));
  const copyLabel = state.copiedEntryId === entry.id ? 'Copied' : 'Copy';

  return `
    <article class="otp-card card" data-entry-card="${escapeHtml(entry.id)}">
      <div class="otp-card__header">
        <div class="avatar" aria-hidden="true">${renderEntryAvatar(entry)}</div>
        <div class="otp-card__identity">
          ${subtitle ? `<p class="eyebrow">${escapeHtml(subtitle)}</p>` : '<p class="eyebrow">Stored account</p>'}
          <h3>${escapeHtml(title)}</h3>
        </div>
        ${
          folder
            ? `<span class="badge badge--neutral">${escapeHtml(folder.name)}</span>`
            : '<span class="badge badge--neutral">Ungrouped</span>'
        }
      </div>

      <div class="otp-card__body">
        <p class="meta-row">
          <span>Current code</span>
          <span>${entry.digits ?? 6} digits · ${entry.period ?? 30}s cycle</span>
        </p>
        <strong class="otp-card__code" data-code-for="${escapeHtml(entry.id)}">${formatCode(otp?.code ?? '------')}</strong>
      </div>

      <div class="otp-card__footer">
        <div class="otp-card__countdown-wrap">
          <div class="meta-row">
            <span>Refresh in</span>
            <span data-countdown-for="${escapeHtml(entry.id)}">${remaining}s</span>
          </div>
          <div class="progress-track" aria-hidden="true">
            <span data-progress-for="${escapeHtml(entry.id)}" style="width: ${progress}%"></span>
          </div>
        </div>

        <div class="inline-actions">
          <button class="button button--primary" data-action="copy-code" data-entry-id="${escapeHtml(entry.id)}" type="button">
            ${copyLabel}
          </button>
          <button class="button button--secondary" data-action="open-edit-entry" data-entry-id="${escapeHtml(entry.id)}" type="button">
            Edit
          </button>
          <button class="button button--ghost button--danger" data-action="delete-entry" data-entry-id="${escapeHtml(entry.id)}" type="button">
            Delete
          </button>
        </div>
      </div>
    </article>
  `;
};

const renderCodesPanel = ({ state, visibleEntries, foldersById }: RenderModel): string => `
  <section class="panel stack-xl">
    <div class="hero-strip card">
      <div>
        <p class="eyebrow">Operations</p>
        <h2>Copy a code in one click, or add a new account without leaving the vault.</h2>
      </div>
      <div class="hero-strip__actions">
        ${state.isMobile ? '' : '<button class="button button--secondary" data-action="open-folder-modal" type="button">New folder</button>'}
        <button class="button button--primary" data-action="open-create-entry" type="button">New account</button>
        ${renderSaveBadge(state)}
      </div>
    </div>

    <section class="codes-layout">
      ${
        state.isMobile
          ? ''
          : `
            <article class="card panel-card folder-card stack-lg">
              <div class="panel-heading">
                <p class="eyebrow">Folders</p>
                <h2>Filter and maintain your collections.</h2>
                <p class="supporting-text">Folder actions stay close to the vault instead of hiding in a separate settings area.</p>
              </div>
              <div class="folder-list">
                <button
                  class="folder-row ${state.activeFolderId === null ? 'is-active' : ''}"
                  data-action="set-folder-filter"
                  data-folder-id=""
                  type="button"
                >
                  <span class="folder-row__main">
                    <span class="folder-row__icon">#</span>
                    <span>All accounts</span>
                  </span>
                  <span class="badge badge--neutral">${state.entries.length}</span>
                </button>
                ${
                  state.folders.length === 0
                    ? `
                      <div class="folder-state">
                        <p>No folders yet. Create one for workspaces, clients, or critical infra.</p>
                      </div>
                    `
                    : state.folders
                        .slice()
                        .sort((left, right) => left.name.localeCompare(right.name))
                        .map((folder) => {
                          const count = state.entries.filter((entry) => entry.folderId === folder.id).length;
                          return `
                            <div class="folder-row-shell">
                              <button
                                class="folder-row ${state.activeFolderId === folder.id ? 'is-active' : ''}"
                                data-action="set-folder-filter"
                                data-folder-id="${escapeHtml(folder.id)}"
                                type="button"
                              >
                                <span class="folder-row__main">
                                  <span class="folder-row__icon" style="color:${escapeHtml(folder.color)}">${escapeHtml(folder.icon || '•')}</span>
                                  <span>${escapeHtml(folder.name)}</span>
                                </span>
                                <span class="badge badge--neutral">${count}</span>
                              </button>
                              <div class="folder-row__actions">
                                <button class="button button--ghost button--sm" data-action="open-folder-edit" data-folder-id="${escapeHtml(folder.id)}" type="button">Edit</button>
                                <button class="button button--ghost button--danger button--sm" data-action="delete-folder" data-folder-id="${escapeHtml(folder.id)}" type="button">Delete</button>
                              </div>
                            </div>
                          `;
                        })
                        .join('')
                }
              </div>
              <button class="button button--secondary button--block" data-action="open-folder-modal" type="button">Create folder</button>
            </article>
          `
      }

      <div class="stack-xl">
    <div class="stats-grid">
      <article class="stat-card card">
        <span class="eyebrow">Accounts</span>
        <strong>${state.activeFolderId ? visibleEntries.length : state.entries.length}</strong>
        <p>OTP entries ready for quick access.</p>
      </article>
      <article class="stat-card card">
        <span class="eyebrow">${state.isMobile ? 'Mobile mode' : 'Collections'}</span>
        <strong>${state.isMobile ? 'Lite' : state.folders.length}</strong>
        <p>${state.isMobile ? 'Folder management is hidden on phone for a faster, cleaner UI.' : 'Existing groupings are preserved without adding UI noise.'}</p>
      </article>
      <article class="stat-card card">
        <span class="eyebrow">Shortcuts</span>
        <strong>${state.isMobile ? 'Tap first' : '/ · N · L'}</strong>
        <p>${state.isMobile ? 'Core actions stay visible without extra controls.' : 'Search, create, and lock without touching the mouse.'}</p>
      </article>
    </div>

    <section class="search-panel card">
      <label class="field field--search">
        <span>Search vault</span>
        <input
          id="vault-search"
          name="search"
          type="search"
          placeholder="Search by issuer, account, or collection"
          value="${escapeHtml(state.search)}"
        />
      </label>
      <p class="field-hint">
        ${
          state.search
            ? `${visibleEntries.length} result(s) for “${escapeHtml(state.search)}”.`
            : !state.isMobile && state.activeFolderId
              ? `Showing only ${escapeHtml(foldersById.get(state.activeFolderId)?.name ?? 'the selected folder')}.`
              : 'Search remains local to the current screen and never exposes secrets.'
        }
      </p>
    </section>

    ${
      state.entries.length === 0
        ? `
            <section class="empty-state card">
              <p class="eyebrow">Vault ready</p>
              <h2>No OTP accounts yet.</h2>
              <p class="supporting-text">Add a secret manually, paste an otpauth URI, or import an encrypted xVault backup.</p>
              <div class="inline-actions">
              <button class="button button--primary" data-action="open-create-entry" type="button">Add first account</button>
              ${state.isMobile ? '' : '<button class="button button--secondary" data-action="open-folder-modal" type="button">Create folder</button>'}
              <button class="button button--ghost" data-action="open-import" type="button">Import backup</button>
              </div>
            </section>
        `
        : visibleEntries.length === 0
          ? `
            <section class="empty-state card">
              <p class="eyebrow">No match</p>
              <h2>Your filters returned zero accounts.</h2>
              <p class="supporting-text">Try a broader search or clear the current query to return to all active OTP entries.</p>
            </section>
          `
          : `
            <section class="otp-grid">
              ${visibleEntries.map((entry) => renderEntryCard(entry, state, foldersById)).join('')}
            </section>
          `
    }
      </div>
    </section>
  </section>
`;

const renderBackupPanel = ({ state }: RenderModel): string => `
  <section class="panel split-panel">
    <article class="card panel-card stack-lg">
      <div class="panel-heading">
        <p class="eyebrow">Encrypted export</p>
        <h2>Produce a portable vault backup.</h2>
        <p class="supporting-text">Exports use the existing backend format. The UI never renders the raw secret material during this flow.</p>
      </div>
      <button class="button button--primary" data-action="export-vault" type="button" ${state.pending.export ? 'disabled' : ''}>
        ${state.pending.export ? 'Preparing export...' : 'Export xVault backup'}
      </button>
    </article>

    <article class="card panel-card stack-lg">
      <div class="panel-heading">
        <p class="eyebrow">Import</p>
        <h2>Restore from a trusted xVault file.</h2>
        <p class="supporting-text">
          Imports replace the current vault payload after password verification. Only import files you trust.
        </p>
      </div>
      <button class="button button--secondary" data-action="open-import" type="button" ${state.pending.import ? 'disabled' : ''}>
        ${state.pending.import ? 'Importing...' : 'Import encrypted backup'}
      </button>
    </article>

    <article class="card panel-card stack-md">
      <p class="eyebrow">Backup discipline</p>
      <ul class="clean-list">
        <li>Keep at least one offline copy of your encrypted export.</li>
        <li>Test restore on a secondary environment before relying on it.</li>
        <li>Do not store backup files in the same place as your main credentials.</li>
      </ul>
    </article>
  </section>
`;

const renderSecurityPanel = ({ state }: RenderModel): string => `
  <section class="panel split-panel">
    <article class="card panel-card stack-lg">
      <div class="panel-heading">
        <p class="eyebrow">Vault identity</p>
        <h2>Update the name shown in the vault shell.</h2>
      </div>
      <form data-form="profile" class="stack-md">
        <label class="field">
          <span>Vault name</span>
          <input id="profile-name" name="name" type="text" value="${escapeHtml(state.user?.name ?? 'My Vault')}" />
        </label>
        <button class="button button--primary" type="submit" ${state.pending.profile ? 'disabled' : ''}>
          ${state.pending.profile ? 'Saving...' : 'Save profile'}
        </button>
      </form>
    </article>

    <article class="card panel-card stack-lg">
      <div class="panel-heading">
        <p class="eyebrow">Password rotation</p>
        <h2>Re-encrypt the vault with a new password.</h2>
        <p class="supporting-text">The backend decrypts the current vault and immediately re-encrypts it with your new password.</p>
      </div>
      <form data-form="password" class="stack-md">
        <label class="field">
          <span>Current password</span>
          <input id="current-password" name="currentPassword" type="password" autocomplete="current-password" />
        </label>
        <label class="field">
          <span>New password</span>
          <input id="new-password" name="newPassword" type="password" autocomplete="new-password" />
        </label>
        <label class="field">
          <span>Confirm new password</span>
          <input id="confirm-password" name="confirmPassword" type="password" autocomplete="new-password" />
        </label>
        <button class="button button--primary" type="submit" ${state.pending.password ? 'disabled' : ''}>
          ${state.pending.password ? 'Updating...' : 'Change password'}
        </button>
      </form>
    </article>

    <article class="card panel-card stack-lg">
      <div class="panel-heading">
        <p class="eyebrow">Session controls</p>
        <h2>Lock fast or leave the session entirely.</h2>
      </div>
      <div class="inline-actions">
        <button class="button button--secondary" data-action="lock-vault" type="button">Lock vault</button>
        <button class="button button--ghost" data-action="logout" type="button">Sign out</button>
      </div>
    </article>

    <article class="card panel-card stack-lg danger-panel">
      <div class="panel-heading">
        <p class="eyebrow">Destructive action</p>
        <h2>Delete this account and all encrypted data.</h2>
        <p class="supporting-text">This permanently removes the user record and the stored vault payload from the server database.</p>
      </div>
      <form data-form="delete-account" class="stack-md">
        <label class="field">
          <span>Password confirmation</span>
          <input id="delete-password" name="password" type="password" autocomplete="current-password" />
        </label>
        <button class="button button--danger button--block" type="submit" ${state.pending.danger ? 'disabled' : ''}>
          ${state.pending.danger ? 'Deleting account...' : 'Delete account'}
        </button>
      </form>
    </article>
  </section>
`;

const renderVaultScreen = (model: RenderModel): string => {
  const { state } = model;
  const entryEditor = getEntryEditorValues(state);
  const folderEditor = getFolderEditorValues(state);
  const activePanelLabel =
    state.activePanel === 'codes'
      ? 'Vault'
      : state.activePanel === 'backup'
        ? 'Backup'
        : 'Security';

  const activePanelDescription =
    state.activePanel === 'codes'
      ? 'Keep OTP access fast and intentional.'
      : state.activePanel === 'backup'
        ? 'Protect continuity before you need it.'
        : 'Manage identity, session, and password hygiene.';

  return `
    <main class="screen vault-screen">
      <div class="app-shell ${state.isMobile ? 'app-shell--mobile' : ''}">
        <aside class="sidebar card ${state.isMobile ? 'sidebar--mobile' : ''}">
          <div class="brand-lockup">
            <div class="brand-mark" aria-hidden="true">
              <span>xV</span>
            </div>
            <div>
              <p class="eyebrow">xVault</p>
              <h1>${escapeHtml(state.user?.name ?? 'My Vault')}</h1>
            </div>
          </div>

          <div class="sidebar__profile">
            <p class="eyebrow">Authenticated as</p>
            <strong>${escapeHtml(state.user?.loginId ?? 'Unknown')}</strong>
          </div>

          <nav class="nav-list" aria-label="Primary">
            <button class="nav-item ${state.activePanel === 'codes' ? 'is-active' : ''}" data-action="go-panel" data-panel="codes" type="button">
              Codes
            </button>
            <button class="nav-item ${state.activePanel === 'backup' ? 'is-active' : ''}" data-action="go-panel" data-panel="backup" type="button">
              Backup
            </button>
            <button class="nav-item ${state.activePanel === 'security' ? 'is-active' : ''}" data-action="go-panel" data-panel="security" type="button">
              Security
            </button>
          </nav>

          <div class="sidebar__actions">
            <button class="button button--primary button--block" data-action="open-create-entry" type="button">Add account</button>
            ${
              state.isMobile
                ? ''
                : `
                  <button class="button button--secondary button--block" data-action="open-folder-modal" type="button">New folder</button>
                  <button class="button button--secondary button--block" data-action="lock-vault" type="button">Lock</button>
                  <button class="button button--ghost button--block" data-action="logout" type="button">Sign out</button>
                `
            }
          </div>
        </aside>

        <section class="workspace">
          <header class="workspace__header card">
            <div>
              <p class="eyebrow">${activePanelLabel}</p>
              <h2>${activePanelDescription}</h2>
            </div>
            <div class="workspace__header-actions">
              ${renderSaveBadge(state)}
              <button class="button button--ghost" data-action="focus-search" type="button" ${state.activePanel !== 'codes' ? 'disabled' : ''}>
                Focus search
              </button>
            </div>
          </header>

          ${
            state.activePanel === 'codes'
              ? renderCodesPanel(model)
              : state.activePanel === 'backup'
                ? renderBackupPanel(model)
                : renderSecurityPanel(model)
          }

          <input id="import-backup-file" data-import-file="true" class="hidden-input" type="file" accept=".json,application/json" />
        </section>
      </div>

      ${
        state.entryModalMode
          ? `
            <div class="modal-overlay" role="presentation">
              <section class="modal card" role="dialog" aria-modal="true" aria-labelledby="add-account-title">
                <div class="modal__header">
                  <div>
                    <p class="eyebrow">${entryEditor.modeLabel}</p>
                    <h2 id="add-account-title">${entryEditor.title}</h2>
                  </div>
                  <button class="button button--ghost" data-action="close-entry-modal" type="button">Close</button>
                </div>
                <form data-form="save-entry" class="stack-lg">
                  ${
                    state.entryModalMode === 'create'
                      ? `
                        <label class="field">
                          <span>Account name</span>
                          <input id="entry-account-name" name="accountName" type="text" placeholder="GitHub, Google, AWS" value="${escapeHtml(entryEditor.accountName)}" />
                        </label>
                        <label class="field">
                          <span>Secret key</span>
                          <input id="entry-secret" name="secret" type="text" placeholder="JBSWY3DPEHPK3PXP" value="${escapeHtml(entryEditor.secret)}" />
                        </label>
                        <div class="inline-actions">
                          <button class="button button--secondary" data-action="open-qr-scanner" type="button">Scan QR code</button>
                        </div>
                        ${renderEntryIconEditor(entryEditor.iconData)}
                        ${
                          state.isMobile
                            ? ''
                            : `
                              <label class="field">
                                <span>Collection</span>
                                <select id="entry-folder" name="folderId">
                                  <option value="" ${entryEditor.folderId === null ? 'selected' : ''}>Ungrouped</option>
                                  ${renderFolderOptionList(state.folders, entryEditor.folderId)}
                                </select>
                              </label>
                            `
                        }
                        <p class="field-hint">
                          ${state.isMobile ? 'Mobile mode keeps creation intentionally minimal: name, secret, scan, done.' : 'Keep creation fast: just a name and a secret. If you paste a full <code>otpauth://</code> URI in the secret field, xVault will parse it automatically.'}
                        </p>
                      `
                      : `
                        <label class="field">
                          <span>Secret or otpauth URI</span>
                          <textarea
                            id="entry-source"
                            name="source"
                            rows="3"
                            placeholder="Paste a Base32 secret or a full otpauth://totp/... URI"
                          ></textarea>
                        </label>
                        <div class="field-grid field-grid--two">
                          <label class="field">
                            <span>Account label</span>
                            <input id="entry-account-name" name="accountName" type="text" placeholder="alice@company.com" value="${escapeHtml(entryEditor.accountName)}" />
                          </label>
                          <label class="field">
                            <span>Issuer</span>
                            <input id="entry-issuer" name="issuer" type="text" placeholder="GitHub, Google, AWS" value="${escapeHtml(entryEditor.issuer)}" />
                          </label>
                        </div>
                        <label class="field">
                          <span>Base32 secret</span>
                          <input id="entry-secret" name="secret" type="text" placeholder="JBSWY3DPEHPK3PXP" value="${escapeHtml(entryEditor.secret)}" />
                        </label>
                        ${renderEntryIconEditor(entryEditor.iconData)}
                        <div class="field-grid ${state.isMobile ? 'field-grid--two' : ''}">
                          <label class="field">
                            <span>Digits</span>
                            <select id="entry-digits" name="digits">
                              <option value="6" ${entryEditor.digits === 6 ? 'selected' : ''}>6</option>
                              <option value="8" ${entryEditor.digits === 8 ? 'selected' : ''}>8</option>
                            </select>
                          </label>
                          <label class="field">
                            <span>Refresh period</span>
                            <select id="entry-period" name="period">
                              <option value="30" ${entryEditor.period === 30 ? 'selected' : ''}>30 seconds</option>
                              <option value="60" ${entryEditor.period === 60 ? 'selected' : ''}>60 seconds</option>
                            </select>
                          </label>
                          ${
                            state.isMobile
                              ? ''
                              : `
                                <label class="field">
                                  <span>Collection</span>
                                  <select id="entry-folder" name="folderId">
                                    <option value="" ${entryEditor.folderId === null ? 'selected' : ''}>Ungrouped</option>
                                    ${renderFolderOptionList(state.folders, entryEditor.folderId)}
                                  </select>
                                </label>
                              `
                          }
                        </div>
                        <p class="field-hint">
                          ${state.isMobile ? 'Mobile mode keeps editing focused on the OTP itself.' : 'Use edit mode when you need to correct issuer, digits, refresh period, or reclassify an existing OTP entry.'}
                        </p>
                      `
                  }
                  <div class="inline-actions inline-actions--end">
                    <button class="button button--ghost" data-action="close-entry-modal" type="button">Cancel</button>
                    <button class="button button--primary" type="submit">${entryEditor.submitLabel}</button>
                  </div>
                </form>
              </section>
            </div>
          `
          : ''
      }

      ${
        !state.isMobile && state.folderModalOpen
          ? `
            <div class="modal-overlay" role="presentation">
              <section class="modal modal--narrow card" role="dialog" aria-modal="true" aria-labelledby="folder-modal-title">
                <div class="modal__header">
                  <div>
                    <p class="eyebrow">${folderEditor.modeLabel}</p>
                    <h2 id="folder-modal-title">${folderEditor.title}</h2>
                  </div>
                  <button class="button button--ghost" data-action="close-folder-modal" type="button">Close</button>
                </div>
                <form data-form="save-folder" class="stack-lg">
                  <label class="field">
                    <span>Folder name</span>
                    <input id="folder-name" name="name" type="text" placeholder="Work, Personal, Critical" value="${escapeHtml(folderEditor.name)}" />
                  </label>
                  <div class="field-grid field-grid--two">
                    <label class="field">
                      <span>Marker</span>
                      <input id="folder-icon" name="icon" type="text" maxlength="2" placeholder="•" value="${escapeHtml(folderEditor.icon)}" />
                    </label>
                    <label class="field">
                      <span>Accent color</span>
                      <input id="folder-color" name="color" type="color" value="${escapeHtml(folderEditor.color)}" />
                    </label>
                  </div>
                  <div class="inline-actions inline-actions--end">
                    <button class="button button--ghost" data-action="close-folder-modal" type="button">Cancel</button>
                    <button class="button button--primary" type="submit">${folderEditor.submitLabel}</button>
                  </div>
                </form>
              </section>
            </div>
          `
          : ''
      }

      ${
        state.qrScannerOpen
          ? `
            <div class="modal-overlay modal-overlay--scanner" role="presentation">
              <section class="scanner-modal card" role="dialog" aria-modal="true" aria-labelledby="qr-scanner-title">
                <div class="modal__header">
                  <div>
                    <p class="eyebrow">QR scanner</p>
                    <h2 id="qr-scanner-title">Scan a TOTP QR code to prefill the form.</h2>
                  </div>
                  <button class="button button--ghost" data-action="close-qr-scanner" type="button">Close</button>
                </div>
                <div class="scanner-surface">
                  <video id="qr-scanner-video" class="scanner-video" autoplay playsinline muted></video>
                  <div class="scanner-frame" aria-hidden="true"></div>
                </div>
                <p class="field-hint">
                  ${escapeHtml(state.qrScannerMessage ?? 'Allow camera access, then align the QR code inside the frame.')}
                </p>
              </section>
            </div>
          `
          : ''
      }
    </main>
  `;
};

const renderToast = (state: AppState): string =>
  state.toast
    ? `<div class="toast toast--${state.toast.tone}" role="status" aria-live="polite">${escapeHtml(state.toast.message)}</div>`
    : '';

export const renderAppTemplate = (model: RenderModel): string => {
  const screen =
    model.state.screen === 'booting'
      ? renderBootScreen()
      : model.state.screen === 'auth'
        ? renderAuthScreen(model)
        : model.state.screen === 'locked'
          ? renderLockedScreen(model)
          : renderVaultScreen(model);

  return `
    <div class="app-frame">
      ${screen}
      ${renderToast(model.state)}
    </div>
  `;
};
