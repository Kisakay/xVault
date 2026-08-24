import {
  changePassword,
  checkAuthStatus,
  deleteAccount,
  exportVault,
  getUserProfile,
  importVault,
  loadVaultData,
  loginUser,
  logoutUser,
  registerUser,
  saveVaultData,
  updateUserProfile,
} from './api';
import { deriveEntryName, parseOtpAuthUri } from './otpauth';
import type { ExportedVault, Folder, TOTPEntry, User } from './types';

export type Screen = 'booting' | 'auth' | 'locked' | 'vault';
export type NavPanel = 'codes' | 'backup' | 'security' | 'info';
export type AuthMode = 'login' | 'register';
export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';
export type ToastTone = 'success' | 'error' | 'info';
export type EntryDialogMode = 'create' | 'edit' | null;
export type ThemeMode = 'light' | 'dark';

interface ToastMessage {
  message: string;
  tone: ToastTone;
}

export interface ConfirmRequest {
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  action: () => void | Promise<void>;
}

export interface PendingFlags {
  auth: boolean;
  unlock: boolean;
  export: boolean;
  import: boolean;
  profile: boolean;
  password: boolean;
  danger: boolean;
}

export const app = $state({
  screen: 'booting' as Screen,
  authMode: 'login' as AuthMode,
  activePanel: 'codes' as NavPanel,
  user: null as User | null,
  entries: [] as TOTPEntry[],
  folders: [] as Folder[],
  currentPassword: null as string | null,
  search: '',
  activeFolderId: null as string | null,
  entryDialogMode: null as EntryDialogMode,
  editingEntryId: null as string | null,
  folderDialogOpen: false,
  editingFolderId: null as string | null,
  qrScannerOpen: false,
  qrScannerMessage: null as string | null,
  registerLoginId: null as string | null,
  authError: null as string | null,
  unlockError: null as string | null,
  unlockAttemptsLeft: undefined as number | undefined,
  saveStatus: 'idle' as SaveStatus,
  saveMessage: null as string | null,
  copiedEntryId: null as string | null,
  toast: null as ToastMessage | null,
  confirm: null as ConfirmRequest | null,
  pending: {
    auth: false,
    unlock: false,
    export: false,
    import: false,
    profile: false,
    password: false,
    danger: false,
  } as PendingFlags,
});

export const getVisibleEntries = (): TOTPEntry[] => {
  const query = app.search.trim().toLowerCase();
  const foldersById = new Map(app.folders.map((folder) => [folder.id, folder]));

  return app.entries.filter((entry) => {
    if (app.activeFolderId && entry.folderId !== app.activeFolderId) {
      return false;
    }
    if (!query) {
      return true;
    }
    const folderName = entry.folderId
      ? (foldersById.get(entry.folderId)?.name ?? '')
      : '';
    const haystack = `${entry.name} ${folderName}`.toLowerCase();
    return haystack.includes(query);
  });
};

const THEME_KEY = 'xvault-theme';

const resolveTheme = (): ThemeMode => {
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === 'light' || stored === 'dark') {
    return stored;
  }
  return window.matchMedia('(prefers-color-scheme: light)').matches
    ? 'light'
    : 'dark';
};

export const theme = $state<{ mode: ThemeMode }>({ mode: resolveTheme() });

export const toggleTheme = (): void => {
  theme.mode = theme.mode === 'dark' ? 'light' : 'dark';
  localStorage.setItem(THEME_KEY, theme.mode);
};

// ---------------------------------------------------------------------------
// Toasts & confirmations
// ---------------------------------------------------------------------------

let toastTimer: ReturnType<typeof setTimeout> | null = null;

export const showToast = (
  message: string,
  tone: ToastTone = 'info',
): void => {
  app.toast = { message, tone };
  if (toastTimer) {
    clearTimeout(toastTimer);
  }
  toastTimer = setTimeout(() => {
    app.toast = null;
  }, 3200);
};

export const clearToast = (): void => {
  app.toast = null;
};

export const askConfirm = (request: ConfirmRequest): void => {
  app.confirm = request;
};

export const closeConfirm = (): void => {
  app.confirm = null;
};

// ---------------------------------------------------------------------------
// Boot & authentication
// ---------------------------------------------------------------------------

export const boot = async (): Promise<void> => {
  app.screen = 'booting';
  try {
    const status = await checkAuthStatus();
    if (status.authenticated) {
      const profile = await getUserProfile();
      if (profile.user) {
        app.user = profile.user;
      }
      app.screen = 'locked';
      return;
    }
  } catch (error) {
    console.error('Boot failed:', error);
  }
  app.screen = 'auth';
};

export const setAuthMode = (mode: AuthMode): void => {
  app.authMode = mode;
  app.authError = null;
};

export const submitAuth = async (
  loginId: string,
  password: string,
): Promise<void> => {
  if (app.authMode === 'login' && !loginId) {
    app.authError = 'Login ID is required.';
    return;
  }
  if (!password) {
    app.authError = 'Password is required.';
    return;
  }
  if (app.authMode === 'register' && password.length < 8) {
    app.authError = 'Use at least 8 characters for the vault password.';
    return;
  }

  app.authError = null;
  app.pending.auth = true;

  try {
    if (app.authMode === 'register') {
      const result = await registerUser(password);
      if (!result.success || !result.loginId) {
        app.authError = result.error ?? 'Unable to create the vault.';
        return;
      }
      const profile = await getUserProfile();
      if (profile.user) {
        app.user = profile.user;
      }
      app.registerLoginId = result.loginId;
      return;
    }

    const result = await loginUser(loginId, password);
    if (!result.success || !result.user) {
      app.authError = result.error ?? 'Unable to sign in.';
      return;
    }
    app.user = result.user;
    app.screen = 'locked';
  } catch (error) {
    console.error('Authentication error:', error);
    app.authError = 'The authentication request failed.';
  } finally {
    app.pending.auth = false;
  }
};

export const acknowledgeRegistration = (): void => {
  app.registerLoginId = null;
  app.screen = 'locked';
};

// ---------------------------------------------------------------------------
// Unlock / lock / sign out
// ---------------------------------------------------------------------------

export const submitUnlock = async (password: string): Promise<void> => {
  if (!password) {
    app.unlockError = 'Password is required.';
    return;
  }

  app.unlockError = null;
  app.unlockAttemptsLeft = undefined;
  app.pending.unlock = true;

  try {
    const vaultData = await loadVaultData(password);
    app.entries = vaultData.entries;
    app.folders = vaultData.folders;
    if (
      app.activeFolderId &&
      !app.folders.some((folder) => folder.id === app.activeFolderId)
    ) {
      app.activeFolderId = null;
    }
    app.currentPassword = password;
    app.screen = 'vault';
    app.activePanel = 'codes';
    app.saveStatus = 'saved';
    app.saveMessage = 'Encrypted backup synced';
    showToast('Vault unlocked', 'success');
  } catch (error) {
    const apiError = error as Error & { attemptsLeft?: number };
    app.unlockError = apiError.message || 'Unable to unlock the vault.';
    app.unlockAttemptsLeft = apiError.attemptsLeft;
  } finally {
    app.pending.unlock = false;
  }
};

export const lockVault = (): void => {
  app.screen = 'locked';
  app.entries = [];
  app.folders = [];
  app.currentPassword = null;
  app.search = '';
  app.activeFolderId = null;
  app.entryDialogMode = null;
  app.editingEntryId = null;
  app.qrScannerOpen = false;
  app.qrScannerMessage = null;
  app.folderDialogOpen = false;
  app.editingFolderId = null;
  app.copiedEntryId = null;
  app.unlockError = null;
  app.unlockAttemptsLeft = undefined;
  app.confirm = null;
  app.saveStatus = 'idle';
  app.saveMessage = null;
};

export const signOut = async (): Promise<void> => {
  try {
    await logoutUser();
  } catch (error) {
    console.error('Failed to sign out cleanly:', error);
  }
  app.screen = 'auth';
  app.user = null;
  app.entries = [];
  app.folders = [];
  app.currentPassword = null;
  app.search = '';
  app.activeFolderId = null;
  app.entryDialogMode = null;
  app.editingEntryId = null;
  app.qrScannerOpen = false;
  app.qrScannerMessage = null;
  app.folderDialogOpen = false;
  app.editingFolderId = null;
  app.registerLoginId = null;
  app.authError = null;
  app.unlockError = null;
  app.unlockAttemptsLeft = undefined;
  app.confirm = null;
  app.saveStatus = 'idle';
  app.saveMessage = null;
};

// ---------------------------------------------------------------------------
// Persistance du vault (autosave debounced)
// ---------------------------------------------------------------------------

let saveTimer: ReturnType<typeof setTimeout> | null = null;

export const queueSave = (): void => {
  if (!app.currentPassword || app.screen !== 'vault') {
    return;
  }
  if (saveTimer) {
    clearTimeout(saveTimer);
  }
  app.saveStatus = 'saving';
  app.saveMessage = 'Encrypting changes';

  saveTimer = setTimeout(async () => {
    try {
      await saveVaultData(
        { entries: app.entries, folders: app.folders },
        app.currentPassword as string,
      );
      app.saveStatus = 'saved';
      app.saveMessage = 'Encrypted backup synced';
    } catch (error) {
      console.error('Failed to save encrypted vault:', error);
      app.saveStatus = 'error';
      app.saveMessage = 'Unable to save encrypted data';
      showToast(
        'Encrypted vault save failed. Your latest changes are still in memory.',
        'error',
      );
    }
  }, 280);
};

// ---------------------------------------------------------------------------
// Entrées TOTP
// ---------------------------------------------------------------------------

export interface EntryDraft {
  accountName: string;
  issuer: string;
  secret: string;
  digits: number;
  period: number;
  folderId: string | null;
  icon: string;
  isCustomIcon: boolean;
}

export const openEntryDialog = (mode: 'create' | 'edit', entryId: string | null = null): void => {
  app.entryDialogMode = mode;
  app.editingEntryId = entryId;
  app.qrScannerOpen = false;
  app.qrScannerMessage = null;
};

export const closeEntryDialog = (): void => {
  app.entryDialogMode = null;
  app.editingEntryId = null;
};

export const saveEntry = (draft: EntryDraft): void => {
  let accountName = draft.accountName.trim();
  let issuer = draft.issuer.trim();
  let secret = draft.secret.trim();
  let digits = draft.digits;
  let period = draft.period;

  // Parser un éventuel URI otpauth:// collé dans le champ secret.
  const parsed = parseOtpAuthUri(secret);
  if (parsed) {
    accountName = parsed.accountName || accountName;
    issuer = parsed.issuer || issuer;
    secret = parsed.secret;
    digits = parsed.digits;
    period = parsed.period;
  }

  if (!secret) {
    showToast('A secret key is required.', 'error');
    return;
  }
  if (!accountName && !issuer) {
    showToast('An account name is required.', 'error');
    return;
  }

  const name = deriveEntryName(accountName, issuer);
  const isEditing = app.entryDialogMode === 'edit' && app.editingEntryId;

  if (isEditing) {
    const id = app.editingEntryId as string;
    app.entries = app.entries.map((entry) =>
      entry.id === id
        ? {
            ...entry,
            name,
            secret,
            digits,
            period,
            folderId: draft.folderId ?? undefined,
            icon: draft.icon,
            isCustomIcon: draft.isCustomIcon,
          }
        : entry,
    );
    showToast('Entry updated', 'success');
  } else {
    const nextEntry: TOTPEntry = {
      id: crypto.randomUUID(),
      name,
      secret,
      icon: draft.icon,
      isCustomIcon: draft.isCustomIcon,
      digits,
      period,
      folderId: draft.folderId ?? undefined,
    };
    app.entries = [...app.entries, nextEntry];
    showToast('Account added', 'success');
  }

  closeEntryDialog();
  queueSave();
};

export const deleteEntry = (entryId: string): void => {
  const entry = app.entries.find((item) => item.id === entryId);
  if (!entry) {
    return;
  }
  askConfirm({
    title: 'Delete account',
    message: `Remove "${entry.name}" and its stored secret from this vault? This cannot be undone.`,
    confirmLabel: 'Delete',
    danger: true,
    action: () => {
      app.entries = app.entries.filter((item) => item.id !== entryId);
      if (app.copiedEntryId === entryId) {
        app.copiedEntryId = null;
      }
      queueSave();
      showToast('Account deleted', 'info');
    },
  });
};

// ---------------------------------------------------------------------------
// Dossiers
// ---------------------------------------------------------------------------

export const openFolderDialog = (folderId: string | null = null): void => {
  app.editingFolderId = folderId;
  app.folderDialogOpen = true;
};

export const closeFolderDialog = (): void => {
  app.folderDialogOpen = false;
  app.editingFolderId = null;
};

export const saveFolder = (name: string, icon: string, color: string): void => {
  const trimmedName = name.trim();
  if (!trimmedName) {
    showToast('A folder name is required.', 'error');
    return;
  }

  const isEditing = app.editingFolderId !== null;

  if (isEditing) {
    const id = app.editingFolderId as string;
    app.folders = app.folders.map((folder) =>
      folder.id === id ? { ...folder, name: trimmedName, icon, color } : folder,
    );
    showToast('Folder updated', 'success');
  } else {
    const nextFolder: Folder = {
      id: crypto.randomUUID(),
      name: trimmedName,
      icon,
      color,
    };
    app.folders = [...app.folders, nextFolder];
    showToast('Folder created', 'success');
  }

  closeFolderDialog();
  queueSave();
};

export const deleteFolder = (folderId: string): void => {
  const folder = app.folders.find((item) => item.id === folderId);
  if (!folder) {
    return;
  }
  askConfirm({
    title: 'Delete folder',
    message: `Delete "${folder.name}"? Entries inside it become ungrouped and are kept.`,
    confirmLabel: 'Delete',
    danger: true,
    action: () => {
      app.folders = app.folders
        .filter((item) => item.id !== folderId)
        .map((item) =>
          item.parentId === folderId ? { ...item, parentId: undefined } : item,
        );
      app.entries = app.entries.map((entry) =>
        entry.folderId === folderId ? { ...entry, folderId: undefined } : entry,
      );
      if (app.activeFolderId === folderId) {
        app.activeFolderId = null;
      }
      queueSave();
      showToast('Folder deleted', 'info');
    },
  });
};

// ---------------------------------------------------------------------------
// Copie du code
// ---------------------------------------------------------------------------

export const copyCode = async (
  entry: TOTPEntry,
  code: string,
): Promise<void> => {
  try {
    await navigator.clipboard.writeText(code);
  } catch {
    const textarea = document.createElement('textarea');
    textarea.value = code;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
  }
  app.copiedEntryId = entry.id;
  showToast(`Code copied for ${entry.name}`, 'success');
  setTimeout(() => {
    if (app.copiedEntryId === entry.id) {
      app.copiedEntryId = null;
    }
  }, 1500);
};

// ---------------------------------------------------------------------------
// Export / import
// ---------------------------------------------------------------------------

const downloadJson = (payload: ExportedVault, filename: string): void => {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
};

export const exportVaultAction = async (): Promise<void> => {
  if (!app.currentPassword) {
    return;
  }
  app.pending.export = true;
  try {
    const payload = await exportVault(app.currentPassword);
    const date = new Date().toISOString().slice(0, 10);
    downloadJson(payload, `xvault-backup-${date}.json`);
    showToast('Encrypted backup downloaded', 'success');
  } catch (error) {
    console.error('Export failed:', error);
    showToast('Failed to export the vault.', 'error');
  } finally {
    app.pending.export = false;
  }
};

export const importVaultFromFile = async (file: File): Promise<void> => {
  app.pending.import = true;
  try {
    const content = await file.text();
    const importData = JSON.parse(content) as ExportedVault;

    if (importData.format !== 'xVault-V2' || typeof importData.data !== 'string') {
      throw new Error('Unsupported vault format. Only xVault-V2 format is supported.');
    }
    if (!app.currentPassword) {
      throw new Error('The vault is not unlocked.');
    }

    await importVault(importData, app.currentPassword);
    const vaultData = await loadVaultData(app.currentPassword);
    app.entries = vaultData.entries;
    app.folders = vaultData.folders;
    app.activeFolderId = null;
    showToast('Vault restored from backup', 'success');
  } catch (error) {
    console.error('Import failed:', error);
    showToast(
      (error as Error).message ?? 'Failed to import the backup file.',
      'error',
    );
  } finally {
    app.pending.import = false;
  }
};

// ---------------------------------------------------------------------------
// Profil & sécurité
// ---------------------------------------------------------------------------

export const saveProfile = async (name: string): Promise<void> => {
  app.pending.profile = true;
  try {
    const result = await updateUserProfile({ name });
    if (!result.success) {
      showToast(result.error ?? 'Failed to update the profile.', 'error');
      return;
    }
    if (app.user) {
      app.user = { ...app.user, name };
    }
    showToast('Profile updated', 'success');
  } finally {
    app.pending.profile = false;
  }
};

export const changeVaultPassword = async (
  currentPassword: string,
  newPassword: string,
  confirmPassword: string,
): Promise<void> => {
  if (!currentPassword || !newPassword) {
    showToast('Current and new passwords are required.', 'error');
    return;
  }
  if (newPassword.length < 8) {
    showToast('Use at least 8 characters for the new password.', 'error');
    return;
  }
  if (newPassword !== confirmPassword) {
    showToast('The new passwords do not match.', 'error');
    return;
  }

  app.pending.password = true;
  try {
    const result = await changePassword(currentPassword, newPassword);
    if (!result.success) {
      showToast(result.error ?? 'Failed to change the password.', 'error');
      return;
    }
    app.currentPassword = newPassword;
    showToast('Password changed and vault re-encrypted', 'success');
  } finally {
    app.pending.password = false;
  }
};

export const deleteAccountAction = async (password: string): Promise<void> => {
  if (!password) {
    showToast('Password confirmation is required.', 'error');
    return;
  }
  askConfirm({
    title: 'Delete account',
    message:
      'This permanently removes the user record and the stored vault payload from the server database. There is no recovery.',
    confirmLabel: 'Delete everything',
    danger: true,
    action: async () => {
      app.pending.danger = true;
      try {
        const result = await deleteAccount(password);
        if (!result.success) {
          showToast(result.error ?? 'Failed to delete the account.', 'error');
          return;
        }
        await signOut();
      } finally {
        app.pending.danger = false;
      }
    },
  });
};
