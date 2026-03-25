import { createInitialState, type AppState, type NavPanel, type OtpCacheEntry } from './app-state';
import jsQR from 'jsqr';
import { deriveEntryName, isValidBase32Secret, normalizeSecret, parseOtpAuthUri } from './otpauth';
import { renderAppTemplate, type RenderModel } from './templates';
import type { Folder, TOTPEntry } from './types';
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
} from './utils/api';
import type { ExportedVault } from './utils/api';
import { generateTOTP, getTimeRemaining } from './utils/totp';
import { clearVaultSession, saveVaultSession } from './utils/vault';

interface PreservedField {
  value?: string;
  checked?: boolean;
  selectionStart?: number | null;
  selectionEnd?: number | null;
}

interface InputSnapshot {
  fields: Map<string, PreservedField>;
  focusedKey: string | null;
}

const isTextControl = (target: EventTarget | null): target is HTMLInputElement | HTMLTextAreaElement =>
  target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;

const isFormField = (
  element: Element,
): element is HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement =>
  element instanceof HTMLInputElement ||
  element instanceof HTMLTextAreaElement ||
  element instanceof HTMLSelectElement;

const fieldKey = (element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement): string | null =>
  element.id || element.getAttribute('name') || element.getAttribute('data-preserve-key');

const readText = (formData: FormData, key: string): string => {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
};

const copyToClipboard = async (value: string): Promise<void> => {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const fallback = document.createElement('textarea');
  fallback.value = value;
  fallback.setAttribute('readonly', '');
  fallback.style.position = 'absolute';
  fallback.style.left = '-9999px';
  document.body.append(fallback);
  fallback.select();
  document.execCommand('copy');
  fallback.remove();
};

const downloadJson = (filename: string, payload: string): void => {
  const blob = new Blob([payload], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

export class XVaultApp {
  private readonly root: HTMLElement;
  private readonly state: AppState;
  private readonly mobileMediaQuery = window.matchMedia('(max-width: 720px)');
  private saveTimer: number | null = null;
  private toastTimer: number | null = null;
  private otpRefreshToken = 0;
  private qrScannerStream: MediaStream | null = null;
  private qrScannerFrame: number | null = null;
  private readonly qrScannerCanvas = document.createElement('canvas');

  constructor(root: HTMLElement) {
    this.root = root;
    this.state = createInitialState();
    this.state.isMobile = this.mobileMediaQuery.matches;

    this.root.addEventListener('click', (event) => {
      void this.handleClick(event);
    });
    this.root.addEventListener('submit', (event) => {
      void this.handleSubmit(event);
    });
    this.root.addEventListener('input', (event) => {
      this.handleInput(event);
    });
    this.root.addEventListener('change', (event) => {
      void this.handleChange(event);
    });
    window.addEventListener('keydown', (event) => {
      this.handleKeydown(event);
    });
    this.mobileMediaQuery.addEventListener('change', (event) => {
      this.handleMobileModeChange(event.matches);
    });

    window.setInterval(() => {
      void this.handleTick();
    }, 1000);

    this.render(false);
    void this.boot();
  }

  private handleMobileModeChange(isMobile: boolean): void {
    this.state.isMobile = isMobile;

    if (isMobile) {
      this.state.activeFolderId = null;
      this.state.folderModalOpen = false;
      this.state.editingFolderId = null;
    }

    this.render(false);
  }

  private async boot(): Promise<void> {
    try {
      const authStatus = await checkAuthStatus();

      if (!authStatus.authenticated) {
        this.state.screen = 'auth';
        this.render(false);
        return;
      }

      const profileResult = await getUserProfile();
      if (profileResult.success && profileResult.user) {
        this.state.user = profileResult.user;
      }

      this.state.screen = 'locked';
      this.render(false);
    } catch (error) {
      console.error('Unable to initialize xVault:', error);
      this.state.screen = 'auth';
      this.state.authError = 'The server could not confirm the current session. You can still try to sign in.';
      this.render(false);
    }
  }

  private getRenderModel(): RenderModel {
    const foldersById = new Map<string, Folder>(this.state.folders.map((folder) => [folder.id, folder]));
    const query = this.state.search.toLowerCase().trim();

    const visibleEntries = [...this.state.entries]
      .filter((entry) => {
        const matchesFolder =
          this.state.isMobile || this.state.activeFolderId === null || entry.folderId === this.state.activeFolderId;

        if (!matchesFolder) {
          return false;
        }

        if (!query) {
          return true;
        }

        const folderName = entry.folderId ? foldersById.get(entry.folderId)?.name ?? '' : '';
        const haystack = `${entry.name} ${folderName}`.toLowerCase();
        return haystack.includes(query);
      })
      .sort((left, right) => left.name.localeCompare(right.name));

    return {
      state: this.state,
      visibleEntries,
      foldersById,
    };
  }

  private captureSnapshot(): InputSnapshot {
    const snapshot: InputSnapshot = {
      fields: new Map<string, PreservedField>(),
      focusedKey: null,
    };

    this.root.querySelectorAll('input, textarea, select').forEach((node) => {
      if (!isFormField(node)) {
        return;
      }

      if (node instanceof HTMLInputElement && node.type === 'file') {
        return;
      }

      const key = fieldKey(node);
      if (!key) {
        return;
      }

      snapshot.fields.set(key, {
        value: 'value' in node ? node.value : undefined,
        checked: node instanceof HTMLInputElement ? node.checked : undefined,
        selectionStart: isTextControl(node) ? node.selectionStart : undefined,
        selectionEnd: isTextControl(node) ? node.selectionEnd : undefined,
      });

      if (document.activeElement === node) {
        snapshot.focusedKey = key;
      }
    });

    return snapshot;
  }

  private restoreSnapshot(snapshot: InputSnapshot): void {
    snapshot.fields.forEach((value, key) => {
      const selector = `#${CSS.escape(key)}, [name="${CSS.escape(key)}"], [data-preserve-key="${CSS.escape(key)}"]`;
      const node = this.root.querySelector(selector);

      if (!node || !isFormField(node)) {
        return;
      }

      if (typeof value.value === 'string' && 'value' in node) {
        node.value = value.value;
      }

      if (node instanceof HTMLInputElement && typeof value.checked === 'boolean') {
        node.checked = value.checked;
      }

      if (snapshot.focusedKey === key) {
        node.focus();
        if (
          isTextControl(node) &&
          value.selectionStart !== undefined &&
          value.selectionStart !== null &&
          value.selectionEnd !== undefined &&
          value.selectionEnd !== null
        ) {
          node.setSelectionRange(value.selectionStart, value.selectionEnd);
        }
      }
    });
  }

  private render(preserveInputs = true): void {
    const snapshot = preserveInputs ? this.captureSnapshot() : null;
    this.root.innerHTML = renderAppTemplate(this.getRenderModel());

    if (snapshot) {
      this.restoreSnapshot(snapshot);
    }

    if (this.state.screen === 'vault') {
      this.paintOtpNodes();
    }

    if (this.state.qrScannerOpen) {
      const video = this.root.querySelector<HTMLVideoElement>('#qr-scanner-video');
      if (video && this.qrScannerStream && video.srcObject !== this.qrScannerStream) {
        video.srcObject = this.qrScannerStream;
        void video.play().catch(() => { });
      }

      if (this.qrScannerStream) {
        if (this.qrScannerFrame === null) {
          this.scanQrFrameLoop();
        }
      } else {
        void this.ensureQrScanner();
      }
    } else {
      this.stopQrScanner();
    }

    document.title =
      this.state.screen === 'vault'
        ? 'xVault | Vault'
        : this.state.screen === 'locked'
          ? 'xVault | Unlock'
          : 'xVault';
  }

  private setPending(key: keyof AppState['pending'], value: boolean, preserveInputs = true): void {
    this.state.pending[key] = value;
    this.render(preserveInputs);
  }

  private showToast(message: string, tone: 'success' | 'error' | 'info' = 'info'): void {
    this.state.toast = { message, tone };

    if (this.toastTimer !== null) {
      window.clearTimeout(this.toastTimer);
    }

    this.toastTimer = window.setTimeout(() => {
      this.state.toast = null;
      this.render();
    }, 3200);

    this.render();
  }

  private async handleTick(): Promise<void> {
    if (this.state.screen !== 'vault') {
      return;
    }

    await this.refreshOtpCache();
  }

  private async refreshOtpCache(force = false): Promise<void> {
    if (this.state.screen !== 'vault') {
      return;
    }

    const token = ++this.otpRefreshToken;
    const nextCache: Record<string, OtpCacheEntry> = {};
    const now = Date.now();

    await Promise.all(
      this.state.entries.map(async (entry) => {
        const period = entry.period ?? 30;
        const digits = entry.digits ?? 6;
        const signature = `${entry.secret}|${digits}|${period}`;
        const bucket = Math.floor(now / 1000 / period);
        const remaining = getTimeRemaining(period);
        const cached = this.state.otpById[entry.id];

        if (!force && cached && cached.signature === signature && cached.bucket === bucket) {
          nextCache[entry.id] = { ...cached, remaining };
          return;
        }

        const code = await generateTOTP(entry.secret, period, digits);
        nextCache[entry.id] = {
          code,
          remaining,
          bucket,
          period,
          digits,
          signature,
        };
      }),
    );

    if (token !== this.otpRefreshToken) {
      return;
    }

    this.state.otpById = nextCache;
    this.paintOtpNodes();
  }

  private paintOtpNodes(): void {
    Object.entries(this.state.otpById).forEach(([entryId, otp]) => {
      const codeNode = this.root.querySelector<HTMLElement>(`[data-code-for="${CSS.escape(entryId)}"]`);
      const countdownNode = this.root.querySelector<HTMLElement>(`[data-countdown-for="${CSS.escape(entryId)}"]`);
      const progressNode = this.root.querySelector<HTMLElement>(`[data-progress-for="${CSS.escape(entryId)}"]`);

      if (codeNode) {
        codeNode.textContent =
          otp.code.length === 6
            ? `${otp.code.slice(0, 3)} ${otp.code.slice(3)}`
            : otp.code.length === 8
              ? `${otp.code.slice(0, 4)} ${otp.code.slice(4)}`
              : otp.code;
      }

      if (countdownNode) {
        countdownNode.textContent = `${otp.remaining}s`;
      }

      if (progressNode) {
        progressNode.setAttribute('style', `width: ${Math.max(4, Math.round((otp.remaining / otp.period) * 100))}%`);
      }
    });
  }

  private queueVaultSave(): void {
    if (!this.state.currentPassword || this.state.screen !== 'vault') {
      return;
    }

    if (this.saveTimer !== null) {
      window.clearTimeout(this.saveTimer);
    }

    this.state.saveStatus = 'saving';
    this.state.saveMessage = 'Encrypting changes';
    this.render();

    this.saveTimer = window.setTimeout(async () => {
      try {
        await saveVaultData(
          {
            entries: this.state.entries,
            folders: this.state.folders,
          },
          this.state.currentPassword!,
        );
        this.state.saveStatus = 'saved';
        this.state.saveMessage = 'Encrypted backup synced';
        this.render();
      } catch (error) {
        console.error('Failed to save encrypted vault:', error);
        this.state.saveStatus = 'error';
        this.state.saveMessage = 'Unable to save encrypted data';
        this.render();
        this.showToast('Encrypted vault save failed. Your latest changes are still in memory.', 'error');
      }
    }, 280);
  }

  private async loadVault(password: string): Promise<void> {
    const vaultData = await loadVaultData(password);
    this.state.entries = vaultData.entries ?? [];
    this.state.folders = vaultData.folders ?? [];
    if (this.state.activeFolderId && !this.state.folders.some((folder) => folder.id === this.state.activeFolderId)) {
      this.state.activeFolderId = null;
    }
    this.state.currentPassword = password;
    this.state.screen = 'vault';
    this.state.activePanel = 'codes';
    this.state.unlockError = null;
    this.state.unlockAttemptsLeft = undefined;
    this.state.saveStatus = 'saved';
    this.state.saveMessage = 'Encrypted backup synced';
    saveVaultSession();
    this.render(false);
    await this.refreshOtpCache(true);
  }

  private lockVault(): void {
    this.stopQrScanner();
    this.state.screen = 'locked';
    this.state.entries = [];
    this.state.folders = [];
    this.state.otpById = {};
    this.state.currentPassword = null;
    this.state.search = '';
    this.state.activeFolderId = null;
    this.state.entryModalMode = null;
    this.state.editingEntryId = null;
    this.state.qrScannerOpen = false;
    this.state.qrScannerMessage = null;
    this.state.folderModalOpen = false;
    this.state.editingFolderId = null;
    this.state.copiedEntryId = null;
    this.state.unlockError = null;
    this.state.unlockAttemptsLeft = undefined;
    clearVaultSession();
    this.render(false);
  }

  private async signOut(): Promise<void> {
    this.stopQrScanner();
    try {
      await logoutUser();
    } catch (error) {
      console.error('Failed to sign out cleanly:', error);
    }

    clearVaultSession();
    this.state.screen = 'auth';
    this.state.user = null;
    this.state.entries = [];
    this.state.folders = [];
    this.state.otpById = {};
    this.state.currentPassword = null;
    this.state.search = '';
    this.state.activeFolderId = null;
    this.state.entryModalMode = null;
    this.state.editingEntryId = null;
    this.state.qrScannerOpen = false;
    this.state.qrScannerMessage = null;
    this.state.folderModalOpen = false;
    this.state.editingFolderId = null;
    this.state.registerLoginId = null;
    this.state.authError = null;
    this.state.unlockError = null;
    this.render(false);
  }

  private openEntryModal(mode: 'create' | 'edit', entryId: string | null = null): void {
    this.state.entryModalMode = mode;
    this.state.editingEntryId = entryId;
    this.state.qrScannerOpen = false;
    this.state.qrScannerMessage = null;
    this.render(false);
  }

  private closeEntryModal(): void {
    this.stopQrScanner();
    this.state.entryModalMode = null;
    this.state.editingEntryId = null;
    this.state.qrScannerOpen = false;
    this.state.qrScannerMessage = null;
    this.render(false);
  }

  private openFolderModal(folderId: string | null = null): void {
    if (this.state.isMobile) {
      return;
    }

    this.state.folderModalOpen = true;
    this.state.editingFolderId = folderId;
    this.render(false);
  }

  private closeFolderModal(): void {
    this.state.folderModalOpen = false;
    this.state.editingFolderId = null;
    this.render(false);
  }

  private openQrScanner(): void {
    this.state.qrScannerOpen = true;
    this.state.qrScannerMessage = 'Allow camera access, then align the QR code inside the frame.';
    this.render();
  }

  private closeQrScanner(showRender = true): void {
    this.stopQrScanner();
    this.state.qrScannerOpen = false;
    this.state.qrScannerMessage = null;
    if (showRender) {
      this.render();
    }
  }

  private stopQrScanner(): void {
    if (this.qrScannerFrame !== null) {
      window.cancelAnimationFrame(this.qrScannerFrame);
      this.qrScannerFrame = null;
    }

    if (this.qrScannerStream) {
      this.qrScannerStream.getTracks().forEach((track) => track.stop());
      this.qrScannerStream = null;
    }

    const video = this.root.querySelector<HTMLVideoElement>('#qr-scanner-video');
    if (video) {
      video.srcObject = null;
    }
  }

  private async ensureQrScanner(): Promise<void> {
    if (!this.state.qrScannerOpen || this.qrScannerStream) {
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      this.state.qrScannerMessage = 'Camera access is not supported in this browser.';
      this.render();
      return;
    }

    const video = this.root.querySelector<HTMLVideoElement>('#qr-scanner-video');
    if (!video) {
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: 'environment' },
        },
      });

      if (!this.state.qrScannerOpen) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      this.qrScannerStream = stream;
      video.srcObject = stream;
      await video.play();
      this.state.qrScannerMessage = 'Point the camera at a TOTP QR code.';
      this.render();
      this.scanQrFrameLoop();
    } catch (error) {
      console.error('Unable to start QR scanner:', error);
      this.state.qrScannerMessage = 'Camera access failed. Check browser permissions and try again.';
      this.render();
    }
  }

  private scanQrFrameLoop(): void {
    if (!this.state.qrScannerOpen) {
      return;
    }

    const video = this.root.querySelector<HTMLVideoElement>('#qr-scanner-video');
    if (!video || video.readyState < HTMLMediaElement.HAVE_ENOUGH_DATA || video.videoWidth === 0 || video.videoHeight === 0) {
      this.qrScannerFrame = window.requestAnimationFrame(() => this.scanQrFrameLoop());
      return;
    }

    this.qrScannerCanvas.width = video.videoWidth;
    this.qrScannerCanvas.height = video.videoHeight;
    const context = this.qrScannerCanvas.getContext('2d');

    if (!context) {
      this.state.qrScannerMessage = 'Unable to initialize the QR scanner canvas.';
      this.render();
      return;
    }

    context.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
    const imageData = context.getImageData(0, 0, video.videoWidth, video.videoHeight);
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: 'dontInvert',
    });

    if (code?.data) {
      this.applyQrScanResult(code.data);
      return;
    }

    this.qrScannerFrame = window.requestAnimationFrame(() => this.scanQrFrameLoop());
  }

  private applyQrScanResult(payload: string): void {
    const trimmed = payload.trim();
    const accountField = this.root.querySelector<HTMLInputElement>('#entry-account-name');
    const secretField = this.root.querySelector<HTMLInputElement>('#entry-secret');

    try {
      const parsed = parseOtpAuthUri(trimmed);

      if (parsed) {
        if (accountField) {
          accountField.value = deriveEntryName(parsed.accountName, parsed.issuer);
        }

        if (secretField) {
          secretField.value = parsed.secret;
        }

        this.closeQrScanner();
        this.showToast('QR code scanned. The TOTP form has been prefilled.', 'success');
        return;
      }

      if (isValidBase32Secret(trimmed)) {
        if (secretField) {
          secretField.value = normalizeSecret(trimmed);
        }

        this.closeQrScanner();
        this.showToast('Secret key scanned from QR code.', 'success');
        return;
      }

      this.state.qrScannerMessage = 'QR code detected, but it does not look like a supported TOTP payload.';
      this.render();
      this.qrScannerFrame = window.requestAnimationFrame(() => this.scanQrFrameLoop());
    } catch (error) {
      console.error('Invalid QR scan result:', error);
      this.state.qrScannerMessage = error instanceof Error ? error.message : 'Unable to read the scanned QR code.';
      this.render();
      this.qrScannerFrame = window.requestAnimationFrame(() => this.scanQrFrameLoop());
    }
  }

  private async handleClick(event: Event): Promise<void> {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    const actionNode = target.closest<HTMLElement>('[data-action]');
    if (!actionNode) {
      return;
    }

    const action = actionNode.dataset.action;

    switch (action) {
      case 'set-auth-mode': {
        const mode = actionNode.dataset.mode === 'register' ? 'register' : 'login';
        this.state.authMode = mode;
        this.state.authError = null;
        this.render(false);
        break;
      }
      case 'acknowledge-registration':
        this.state.registerLoginId = null;
        this.state.screen = 'locked';
        this.state.authError = null;
        this.render(false);
        break;
      case 'copy-login-id':
        if (this.state.registerLoginId) {
          await copyToClipboard(this.state.registerLoginId);
          this.showToast('Login ID copied to clipboard.', 'success');
        }
        break;
      case 'go-panel':
        if (actionNode.dataset.panel) {
          this.state.activePanel = actionNode.dataset.panel as NavPanel;
          this.render(false);
        }
        break;
      case 'set-folder-filter': {
        const folderId = actionNode.dataset.folderId;
        this.state.activeFolderId = folderId ? folderId : null;
        this.render(false);
        break;
      }
      case 'focus-search':
        this.root.querySelector<HTMLInputElement>('#vault-search')?.focus();
        break;
      case 'open-create-entry':
        this.state.activePanel = 'codes';
        this.openEntryModal('create');
        this.root.querySelector<HTMLInputElement>('#entry-account-name')?.focus();
        break;
      case 'open-edit-entry': {
        const entryId = actionNode.dataset.entryId;
        if (!entryId) {
          break;
        }

        this.state.activePanel = 'codes';
        this.openEntryModal('edit', entryId);
        this.root.querySelector<HTMLInputElement>('#entry-account-name')?.focus();
        break;
      }
      case 'close-entry-modal':
        this.closeEntryModal();
        break;
      case 'clear-entry-icon': {
        const hiddenInput = this.root.querySelector<HTMLInputElement>('#entry-icon-data');
        const preview = this.root.querySelector<HTMLElement>('.icon-editor__preview');
        if (hiddenInput) {
          hiddenInput.value = '';
        }
        if (preview) {
          preview.classList.remove('has-image');
          preview.innerHTML = '<span id="entry-icon-preview-fallback" class="icon-editor__fallback">+</span>';
        }
        const clearButton = actionNode as HTMLButtonElement;
        clearButton.disabled = true;
        break;
      }
      case 'open-qr-scanner':
        this.openQrScanner();
        break;
      case 'close-qr-scanner':
        this.closeQrScanner();
        break;
      case 'open-folder-modal':
        this.state.activePanel = 'codes';
        this.openFolderModal(null);
        this.root.querySelector<HTMLInputElement>('#folder-name')?.focus();
        break;
      case 'open-folder-edit': {
        const folderId = actionNode.dataset.folderId;
        if (!folderId) {
          break;
        }

        this.state.activePanel = 'codes';
        this.openFolderModal(folderId);
        this.root.querySelector<HTMLInputElement>('#folder-name')?.focus();
        break;
      }
      case 'close-folder-modal':
        this.closeFolderModal();
        break;
      case 'delete-folder': {
        const folderId = actionNode.dataset.folderId;
        if (!folderId) {
          break;
        }

        const folder = this.state.folders.find((item) => item.id === folderId);
        if (!folder) {
          break;
        }

        const confirmed = window.confirm(`Delete the folder "${folder.name}"? Entries will move back to Ungrouped.`);
        if (!confirmed) {
          break;
        }

        this.state.folders = this.state.folders
          .filter((item) => item.id !== folderId)
          .map((item) => (item.parentId === folderId ? { ...item, parentId: undefined } : item));
        this.state.entries = this.state.entries.map((entry) =>
          entry.folderId === folderId ? { ...entry, folderId: undefined } : entry,
        );

        if (this.state.activeFolderId === folderId) {
          this.state.activeFolderId = null;
        }

        if (this.state.editingFolderId === folderId) {
          this.state.folderModalOpen = false;
          this.state.editingFolderId = null;
        }

        this.render(false);
        this.queueVaultSave();
        this.showToast(`Folder ${folder.name} removed.`, 'info');
        break;
      }
      case 'copy-code': {
        const entryId = actionNode.dataset.entryId;
        if (!entryId) {
          break;
        }

        const entry = this.state.entries.find((item) => item.id === entryId);
        if (!entry) {
          break;
        }

        const code = this.state.otpById[entryId]?.code ?? (await generateTOTP(entry.secret, entry.period ?? 30, entry.digits ?? 6));
        await copyToClipboard(code);
        this.state.copiedEntryId = entryId;
        this.render();
        window.setTimeout(() => {
          if (this.state.copiedEntryId === entryId) {
            this.state.copiedEntryId = null;
            this.render();
          }
        }, 1800);
        break;
      }
      case 'delete-entry': {
        const entryId = actionNode.dataset.entryId;
        if (!entryId) {
          break;
        }

        const entry = this.state.entries.find((item) => item.id === entryId);
        if (!entry) {
          break;
        }

        const confirmed = window.confirm(`Delete the OTP entry "${entry.name}"?`);
        if (!confirmed) {
          break;
        }

        this.state.entries = this.state.entries.filter((item) => item.id !== entryId);
        delete this.state.otpById[entryId];
        if (this.state.editingEntryId === entryId) {
          this.state.entryModalMode = null;
          this.state.editingEntryId = null;
        }
        this.render(false);
        this.queueVaultSave();
        this.showToast(`Removed ${entry.name}.`, 'info');
        break;
      }
      case 'lock-vault':
        this.lockVault();
        break;
      case 'logout':
        await this.signOut();
        break;
      case 'export-vault':
        await this.handleExport();
        break;
      case 'open-import':
        this.root.querySelector<HTMLInputElement>('#import-backup-file')?.click();
        break;
      default:
        break;
    }
  }

  private handleInput(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    if (target.id === 'vault-search' && target instanceof HTMLInputElement) {
      this.state.search = target.value;
      this.render();
    }
  }

  private async handleChange(event: Event): Promise<void> {
    const target = event.target;

    if (target instanceof HTMLInputElement && target.id === 'entry-icon-file') {
      const file = target.files?.[0];
      if (!file) {
        return;
      }

      if (!file.type.startsWith('image/')) {
        this.showToast('Only image files can be used as TOTP icons.', 'error');
        target.value = '';
        return;
      }

      try {
        const imageData = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            if (typeof reader.result === 'string') {
              resolve(reader.result);
              return;
            }
            reject(new Error('Invalid file content.'));
          };
          reader.onerror = () => reject(new Error('Unable to read the selected image.'));
          reader.readAsDataURL(file);
        });

        const hiddenInput = this.root.querySelector<HTMLInputElement>('#entry-icon-data');
        const preview = this.root.querySelector<HTMLElement>('.icon-editor__preview');
        const clearButton = this.root.querySelector<HTMLButtonElement>('[data-action="clear-entry-icon"]');

        if (hiddenInput) {
          hiddenInput.value = imageData;
        }

        if (preview) {
          preview.classList.add('has-image');
          preview.innerHTML = `<img id="entry-icon-preview-image" class="icon-editor__image" src="${imageData}" alt="" />`;
        }

        if (clearButton) {
          clearButton.disabled = false;
        }

        target.value = '';
      } catch (error) {
        console.error('Failed to load icon file:', error);
        this.showToast(error instanceof Error ? error.message : 'Unable to load the icon file.', 'error');
      }

      return;
    }

    if (!(target instanceof HTMLInputElement) || !target.dataset.importFile) {
      return;
    }

    const file = target.files?.[0];
    if (!file) {
      return;
    }

    if (!this.state.currentPassword) {
      this.showToast('Unlock the vault before importing a backup.', 'error');
      target.value = '';
      return;
    }

    this.setPending('import', true, true);

    try {
      const content = await file.text();
      const payload = JSON.parse(content) as ExportedVault;

      if (!payload || typeof payload.data !== 'string' || typeof payload.format !== 'string') {
        throw new Error('This file is not a valid xVault export.');
      }

      await importVault(payload, this.state.currentPassword);
      await this.loadVault(this.state.currentPassword);
      this.showToast('Encrypted backup imported successfully.', 'success');
    } catch (error) {
      console.error('Failed to import backup:', error);
      this.showToast(error instanceof Error ? error.message : 'Unable to import the selected backup.', 'error');
    } finally {
      target.value = '';
      this.setPending('import', false, true);
    }
  }

  private async handleSubmit(event: Event): Promise<void> {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) {
      return;
    }

    event.preventDefault();

    const mode = form.dataset.form;

    switch (mode) {
      case 'auth':
        await this.handleAuthSubmit(form);
        break;
      case 'unlock':
        await this.handleUnlockSubmit(form);
        break;
      case 'save-entry':
        await this.handleSaveEntrySubmit(form);
        break;
      case 'save-folder':
        await this.handleSaveFolderSubmit(form);
        break;
      case 'profile':
        await this.handleProfileSubmit(form);
        break;
      case 'password':
        await this.handlePasswordSubmit(form);
        break;
      case 'delete-account':
        await this.handleDeleteAccountSubmit(form);
        break;
      default:
        break;
    }
  }

  private async handleAuthSubmit(form: HTMLFormElement): Promise<void> {
    const formData = new FormData(form);
    const loginId = readText(formData, 'loginId');
    const password = readText(formData, 'password');

    if (this.state.authMode === 'login' && !loginId) {
      this.state.authError = 'Login ID is required.';
      this.render();
      return;
    }

    if (!password) {
      this.state.authError = 'Password is required.';
      this.render();
      return;
    }

    if (this.state.authMode === 'register' && password.length < 8) {
      this.state.authError = 'Use at least 8 characters for the vault password.';
      this.render();
      return;
    }

    this.state.authError = null;
    this.setPending('auth', true, true);

    try {
      if (this.state.authMode === 'register') {
        const result = await registerUser(password);

        if (!result.success || !result.loginId) {
          this.state.authError = result.error ?? 'Unable to create the vault.';
          this.render();
          return;
        }

        const profile = await getUserProfile();
        if (profile.success && profile.user) {
          this.state.user = profile.user;
        }

        this.state.registerLoginId = result.loginId;
        this.render(false);
        return;
      }

      const result = await loginUser(loginId, password);

      if (!result.success || !result.user) {
        this.state.authError = result.error ?? 'Unable to sign in.';
        this.render();
        return;
      }

      this.state.user = result.user;
      this.state.authError = null;
      this.state.screen = 'locked';
      this.render(false);
    } catch (error) {
      console.error('Authentication error:', error);
      this.state.authError = 'The authentication request failed.';
      this.render();
    } finally {
      this.setPending('auth', false, true);
    }
  }

  private async handleUnlockSubmit(form: HTMLFormElement): Promise<void> {
    const password = readText(new FormData(form), 'password');

    if (!password) {
      this.state.unlockError = 'Password is required.';
      this.render();
      return;
    }

    this.state.unlockError = null;
    this.state.unlockAttemptsLeft = undefined;
    this.setPending('unlock', true, true);

    try {
      await this.loadVault(password);
    } catch (error) {
      console.error('Unlock error:', error);
      const authError = error as Error & { attemptsLeft?: number };
      this.state.unlockError = authError.message || 'Unable to unlock the vault.';
      this.state.unlockAttemptsLeft = authError.attemptsLeft;
      this.render(true);
    } finally {
      this.setPending('unlock', false, true);
    }
  }

  private async handleSaveEntrySubmit(form: HTMLFormElement): Promise<void> {
    const formData = new FormData(form);
    const source = readText(formData, 'source') || readText(formData, 'secret');
    const rawAccountName = readText(formData, 'accountName');
    const rawIssuer = readText(formData, 'issuer');
    const rawSecret = readText(formData, 'secret');
    const digits = Number(readText(formData, 'digits') || '6');
    const period = Number(readText(formData, 'period') || '30');
    const folderId = this.state.isMobile ? '' : readText(formData, 'folderId');
    const iconData = readText(formData, 'iconData');

    try {
      const parsed = source ? parseOtpAuthUri(source) : null;
      const accountName = rawAccountName || parsed?.accountName || '';
      const issuer = rawIssuer || parsed?.issuer || '';
      const secret = normalizeSecret(parsed?.secret || rawSecret || source);

      if (!accountName && !issuer) {
        throw new Error('Provide an account label or issuer for the OTP entry.');
      }

      if (!secret || !isValidBase32Secret(secret)) {
        throw new Error('The secret must be a valid Base32 value.');
      }

      const isCustomIcon = iconData.startsWith('data:image/');
      const nextEntry: TOTPEntry = {
        id: this.state.editingEntryId ?? crypto.randomUUID(),
        name: deriveEntryName(accountName, issuer),
        secret,
        icon: isCustomIcon ? iconData : issuer ? issuer.slice(0, 1).toUpperCase() : '•',
        digits: parsed?.digits ?? digits,
        period: parsed?.period ?? period,
        folderId: folderId || undefined,
        isCustomIcon,
      };

      const isEditing = this.state.entryModalMode === 'edit' && this.state.editingEntryId !== null;

      this.state.entries = isEditing
        ? this.state.entries.map((entry) => (entry.id === nextEntry.id ? { ...entry, ...nextEntry } : entry))
        : [...this.state.entries, nextEntry];

      this.state.activePanel = 'codes';
      this.state.entryModalMode = null;
      this.state.editingEntryId = null;
      this.render(false);
      await this.refreshOtpCache(true);
      this.queueVaultSave();
      this.showToast(isEditing ? `Updated ${nextEntry.name}.` : `Stored ${nextEntry.name}.`, 'success');
    } catch (error) {
      console.error('Save entry error:', error);
      this.showToast(error instanceof Error ? error.message : 'Unable to save the OTP entry.', 'error');
    }
  }

  private async handleSaveFolderSubmit(form: HTMLFormElement): Promise<void> {
    const formData = new FormData(form);
    const name = readText(formData, 'name');
    const icon = readText(formData, 'icon') || '•';
    const color = readText(formData, 'color') || '#62d7bb';

    if (!name) {
      this.showToast('Folder name is required.', 'error');
      return;
    }

    const isEditing = this.state.editingFolderId !== null;
    const folderId = this.state.editingFolderId ?? crypto.randomUUID();
    const nextFolder: Folder = {
      id: folderId,
      name,
      icon: icon.slice(0, 2),
      color,
      isExpanded: true,
    };

    this.state.folders = isEditing
      ? this.state.folders.map((folder) => (folder.id === folderId ? { ...folder, ...nextFolder } : folder))
      : [...this.state.folders, nextFolder];

    if (!isEditing) {
      this.state.activeFolderId = folderId;
    }

    this.state.folderModalOpen = false;
    this.state.editingFolderId = null;
    this.render(false);
    this.queueVaultSave();
    this.showToast(isEditing ? `Updated folder ${name}.` : `Created folder ${name}.`, 'success');
  }

  private async handleProfileSubmit(form: HTMLFormElement): Promise<void> {
    const name = readText(new FormData(form), 'name');

    if (!name) {
      this.showToast('Vault name cannot be empty.', 'error');
      return;
    }

    this.setPending('profile', true, true);

    try {
      const result = await updateUserProfile({ name });
      if (!result.success) {
        throw new Error(result.error ?? 'Unable to update the vault profile.');
      }

      if (this.state.user) {
        this.state.user = { ...this.state.user, name };
      }

      this.render(false);
      this.showToast('Vault profile updated.', 'success');
    } catch (error) {
      console.error('Profile update error:', error);
      this.showToast(error instanceof Error ? error.message : 'Unable to update the vault profile.', 'error');
    } finally {
      this.setPending('profile', false, true);
    }
  }

  private async handlePasswordSubmit(form: HTMLFormElement): Promise<void> {
    const formData = new FormData(form);
    const currentPassword = readText(formData, 'currentPassword');
    const newPassword = readText(formData, 'newPassword');
    const confirmPassword = readText(formData, 'confirmPassword');

    if (!currentPassword || !newPassword) {
      this.showToast('Current and new password are required.', 'error');
      return;
    }

    if (newPassword.length < 8) {
      this.showToast('The new password must be at least 8 characters long.', 'error');
      return;
    }

    if (newPassword !== confirmPassword) {
      this.showToast('The new password confirmation does not match.', 'error');
      return;
    }

    this.setPending('password', true, true);

    try {
      const result = await changePassword(currentPassword, newPassword);
      if (!result.success) {
        throw new Error(result.error ?? 'Unable to rotate the vault password.');
      }

      this.state.currentPassword = newPassword;
      form.reset();
      this.render(false);
      this.showToast('Vault password updated and re-encrypted.', 'success');
    } catch (error) {
      console.error('Password rotation error:', error);
      this.showToast(error instanceof Error ? error.message : 'Unable to rotate the vault password.', 'error');
    } finally {
      this.setPending('password', false, true);
    }
  }

  private async handleDeleteAccountSubmit(form: HTMLFormElement): Promise<void> {
    const password = readText(new FormData(form), 'password');

    if (!password) {
      this.showToast('Enter the password to confirm account deletion.', 'error');
      return;
    }

    const confirmed = window.confirm('Delete this account and all encrypted vault data permanently?');
    if (!confirmed) {
      return;
    }

    this.setPending('danger', true, true);

    try {
      const result = await deleteAccount(password);
      if (!result.success) {
        throw new Error(result.error ?? 'Unable to delete the account.');
      }

      form.reset();
      await this.signOut();
      this.showToast('Account deleted permanently.', 'success');
    } catch (error) {
      console.error('Delete account error:', error);
      this.showToast(error instanceof Error ? error.message : 'Unable to delete the account.', 'error');
    } finally {
      this.setPending('danger', false, true);
    }
  }

  private async handleExport(): Promise<void> {
    if (!this.state.currentPassword) {
      this.showToast('Unlock the vault before exporting a backup.', 'error');
      return;
    }

    this.setPending('export', true, true);

    try {
      const payload = await exportVault(this.state.currentPassword);
      const timestamp = new Date().toISOString().replaceAll(':', '-');
      downloadJson(`xvault-backup-${timestamp}.json`, JSON.stringify(payload, null, 2));
      this.showToast('Encrypted backup exported.', 'success');
    } catch (error) {
      console.error('Export error:', error);
      this.showToast('Unable to export the encrypted backup.', 'error');
    } finally {
      this.setPending('export', false, true);
    }
  }

  private handleKeydown(event: KeyboardEvent): void {
    if (this.state.screen !== 'vault') {
      if (event.key === 'Escape' && this.state.qrScannerOpen) {
        this.closeQrScanner();
      }
      if (event.key === 'Escape' && this.state.entryModalMode) {
        this.closeEntryModal();
      }
      if (event.key === 'Escape' && this.state.folderModalOpen) {
        this.closeFolderModal();
      }
      return;
    }

    const target = event.target;
    const typing = isTextControl(target) || target instanceof HTMLSelectElement;

    if (event.key === 'Escape' && this.state.qrScannerOpen) {
      this.closeQrScanner();
      return;
    }

    if (event.key === 'Escape' && this.state.entryModalMode) {
      this.closeEntryModal();
      return;
    }

    if (event.key === 'Escape' && this.state.folderModalOpen) {
      this.closeFolderModal();
      return;
    }

    if (typing || event.metaKey || event.ctrlKey || event.altKey) {
      return;
    }

    if (event.key.toLowerCase() === 's') {
      event.preventDefault();
      this.root.querySelector<HTMLInputElement>('#vault-search')?.focus();
      return;
    }

    if (event.key.toLowerCase() === 'n') {
      event.preventDefault();
      this.state.activePanel = 'codes';
      this.openEntryModal('create');
      this.root.querySelector<HTMLInputElement>('#entry-account-name')?.focus();
      return;
    }

    if (event.key.toLowerCase() === 'l') {
      event.preventDefault();
      this.lockVault();
    }
  }
}
