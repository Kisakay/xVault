import type { Folder, TOTPEntry } from './types';
import type { User } from './utils/api';

export type Screen = 'booting' | 'auth' | 'locked' | 'vault';
export type NavPanel = 'codes' | 'backup' | 'security' | 'info';
export type AuthMode = 'login' | 'register';
export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';
export type ToastTone = 'success' | 'error' | 'info';
export type EntryModalMode = 'create' | 'edit' | null;

export interface PendingFlags {
  auth: boolean;
  unlock: boolean;
  export: boolean;
  import: boolean;
  profile: boolean;
  password: boolean;
  danger: boolean;
}

export interface ToastMessage {
  message: string;
  tone: ToastTone;
}

export interface OtpCacheEntry {
  code: string;
  remaining: number;
  bucket: number;
  period: number;
  digits: number;
  signature: string;
}

export interface AppState {
  isMobile: boolean;
  screen: Screen;
  authMode: AuthMode;
  activePanel: NavPanel;
  user: User | null;
  entries: TOTPEntry[];
  folders: Folder[];
  otpById: Record<string, OtpCacheEntry>;
  currentPassword: string | null;
  search: string;
  activeFolderId: string | null;
  entryModalMode: EntryModalMode;
  editingEntryId: string | null;
  qrScannerOpen: boolean;
  qrScannerMessage: string | null;
  folderModalOpen: boolean;
  editingFolderId: string | null;
  registerLoginId: string | null;
  authError: string | null;
  unlockError: string | null;
  unlockAttemptsLeft?: number;
  saveStatus: SaveStatus;
  saveMessage: string | null;
  copiedEntryId: string | null;
  toast: ToastMessage | null;
  pending: PendingFlags;
}

export const createInitialState = (): AppState => ({
  isMobile: false,
  screen: 'booting',
  authMode: 'login',
  activePanel: 'codes',
  user: null,
  entries: [],
  folders: [],
  otpById: {},
  currentPassword: null,
  search: '',
  activeFolderId: null,
  entryModalMode: null,
  editingEntryId: null,
  qrScannerOpen: false,
  qrScannerMessage: null,
  folderModalOpen: false,
  editingFolderId: null,
  registerLoginId: null,
  authError: null,
  unlockError: null,
  unlockAttemptsLeft: undefined,
  saveStatus: 'idle',
  saveMessage: null,
  copiedEntryId: null,
  toast: null,
  pending: {
    auth: false,
    unlock: false,
    export: false,
    import: false,
    profile: false,
    password: false,
    danger: false,
  },
});
