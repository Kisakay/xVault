<script lang="ts">
  import { isValidBase32Secret, parseOtpAuthUri, splitEntryName } from '../otpauth';
  import { app, closeEntryDialog, saveEntry, showToast } from '../store.svelte';
  import QrScanner from './QrScanner.svelte';

  const isEditing = $derived(app.entryDialogMode === 'edit');

  let accountName = $state('');
  let issuer = $state('');
  let secret = $state('');
  let digits = $state('6');
  let period = $state('30');
  let folderId = $state('');
  let icon = $state('');
  let isCustomIcon = $state(false);
  let iconFileInput: HTMLInputElement | undefined = $state();

  const closeQrScanner = (): void => {
    app.qrScannerOpen = false;
    app.qrScannerMessage = null;
  };

  const openQrScanner = (): void => {
    app.qrScannerOpen = true;
    app.qrScannerMessage = null;
  };

  const applyQrResult = (text: string): void => {
    try {
      const parsed = parseOtpAuthUri(text);
      if (parsed) {
        accountName = parsed.accountName || accountName;
        issuer = parsed.issuer || issuer;
        secret = parsed.secret;
        digits = String(parsed.digits);
        period = String(parsed.period);
        closeQrScanner();
        showToast('QR code captured — review and save', 'success');
        return;
      }
    } catch (error) {
      app.qrScannerMessage = (error as Error).message;
      return;
    }
    if (isValidBase32Secret(text)) {
      secret = text;
      closeQrScanner();
      showToast('Secret captured — add an account name', 'success');
      return;
    }
    app.qrScannerMessage = 'No TOTP secret found in this QR code.';
  };

  const onIconUpload = (event: Event): void => {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }
    if (!file.type.startsWith('image/')) {
      showToast('Please choose an image file.', 'error');
      return;
    }
    if (file.size > 1_000_000) {
      showToast('Image is too large (max 1 MB).', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      icon = String(reader.result ?? '');
      isCustomIcon = true;
    };
    reader.readAsDataURL(file);
    input.value = '';
  };

  const submit = (): void => {
    saveEntry({
      accountName,
      issuer,
      secret,
      digits: Number(digits) || 6,
      period: Number(period) || 30,
      folderId: folderId || null,
      icon,
      isCustomIcon,
    });
  };

  const setField = (setter: (value: string) => void) => (event: Event) =>
    setter((event.target as HTMLInputElement).value);

  const sortedFolders = $derived(
    app.folders.slice().sort((left, right) => left.name.localeCompare(right.name)),
  );

  // Initialisation du formulaire à l'ouverture du dialogue.
  $effect(() => {
    if (app.entryDialogMode === 'edit' && app.editingEntryId) {
      const entry = app.entries.find((item) => item.id === app.editingEntryId);
      if (entry) {
        const parsed = splitEntryName(entry.name);
        accountName = parsed.title;
        issuer = parsed.subtitle ?? '';
        secret = entry.secret;
        digits = String(entry.digits ?? 6);
        period = String(entry.period ?? 30);
        folderId = entry.folderId ?? '';
        icon = entry.icon ?? '';
        isCustomIcon = entry.isCustomIcon ?? false;
      }
    } else if (app.entryDialogMode === 'create') {
      accountName = '';
      issuer = '';
      secret = '';
      digits = '6';
      period = '30';
      folderId = '';
      icon = '';
      isCustomIcon = false;
    }
  });
</script>

<md-dialog
  open={app.entryDialogMode !== null}
  onclose={closeEntryDialog}
  style="--md-dialog-container-color: var(--md-sys-color-surface-container-high)"
>
  <div slot="headline">
    {isEditing ? 'Edit account' : 'Add account'}
  </div>

  <form
    slot="content"
    class="dialog-body"
    onsubmit={(event) => {
      event.preventDefault();
      submit();
    }}
  >
    {#if app.entryDialogMode === 'create'}
      <md-outlined-text-field
        label="Account name"
        placeholder="GitHub, Google, AWS"
        value={accountName}
        oninput={setField((value) => (accountName = value))}
        style="width: 100%"
      ></md-outlined-text-field>

      <md-outlined-text-field
        label="Secret key or otpauth URI"
        placeholder="JBSWY3DPEHPK3PXP or otpauth://totp/..."
        value={secret}
        oninput={setField((value) => (secret = value))}
        style="width: 100%"
        supporting-text="Paste a Base32 secret or a full otpauth:// URI — xVault parses it automatically."
      ></md-outlined-text-field>

      <div class="inline-actions">
        <md-outlined-button onclick={openQrScanner}>
          <md-icon slot="icon">qr_code_scanner</md-icon>
          Scan QR code
        </md-outlined-button>
      </div>
    {:else}
      <div class="field-grid">
        <md-outlined-text-field
          label="Account label"
          placeholder="alice@company.com"
          value={accountName}
          oninput={setField((value) => (accountName = value))}
          style="width: 100%"
        ></md-outlined-text-field>
        <md-outlined-text-field
          label="Issuer"
          placeholder="GitHub, Google, AWS"
          value={issuer}
          oninput={setField((value) => (issuer = value))}
          style="width: 100%"
        ></md-outlined-text-field>
      </div>

      <md-outlined-text-field
        label="Base32 secret"
        placeholder="JBSWY3DPEHPK3PXP"
        value={secret}
        oninput={setField((value) => (secret = value))}
        style="width: 100%"
      ></md-outlined-text-field>

      <div class="field-grid">
        <md-filled-select
          label="Digits"
          value={digits}
          onchange={(event: Event) =>
            (digits = (event.target as HTMLInputElement).value)}
          style="width: 100%"
        >
          <md-select-option value="6">6 digits</md-select-option>
          <md-select-option value="8">8 digits</md-select-option>
        </md-filled-select>
        <md-filled-select
          label="Refresh period"
          value={period}
          onchange={(event: Event) =>
            (period = (event.target as HTMLInputElement).value)}
          style="width: 100%"
        >
          <md-select-option value="30">30 seconds</md-select-option>
          <md-select-option value="60">60 seconds</md-select-option>
        </md-filled-select>
      </div>
    {/if}

    <md-filled-select
      label="Collection"
      value={folderId}
      onchange={(event: Event) =>
        (folderId = (event.target as HTMLInputElement).value)}
      style="width: 100%"
    >
      <md-select-option value="">Ungrouped</md-select-option>
      {#each sortedFolders as folder (folder.id)}
        <md-select-option value={folder.id}>
          {folder.icon ? `${folder.icon}  ` : ''}{folder.name}
        </md-select-option>
      {/each}
    </md-filled-select>

    <div class="icon-editor">
      <div class="icon-preview" aria-hidden="true">
        {#if isCustomIcon && icon.startsWith('data:image/')}
          <img src={icon} alt="" />
        {:else if icon && icon.length <= 2}
          {icon}
        {:else}
          <md-icon>image</md-icon>
        {/if}
      </div>
      <div class="icon-editor__fields">
        <md-outlined-text-field
          label="Marker (emoji)"
          maxlength="2"
          placeholder="•"
          value={icon}
          oninput={setField((value) => (icon = value))}
          style="width: 100%"
          supporting-text="Keep it short, or upload a custom image instead."
        ></md-outlined-text-field>
        <div class="inline-actions">
          <md-outlined-button onclick={() => iconFileInput?.click()}>
            <md-icon slot="icon">upload</md-icon>
            Upload image
          </md-outlined-button>
          {#if isCustomIcon}
            <md-text-button
              onclick={() => {
                icon = '';
                isCustomIcon = false;
              }}
            >
              Clear
            </md-text-button>
          {/if}
        </div>
      </div>
    </div>

    <div class="dialog-actions">
      <md-text-button type="button" onclick={closeEntryDialog}>
        Cancel
      </md-text-button>
      <md-filled-button type="submit">
        {isEditing ? 'Save changes' : 'Add account'}
      </md-filled-button>
    </div>
  </form>
</md-dialog>

{#if app.qrScannerOpen}
  <md-dialog
    open
    onclose={closeQrScanner}
    style="--md-dialog-container-color: var(--md-sys-color-surface-container-high)"
  >
    <div slot="headline">Scan a TOTP QR code</div>
    <div slot="content" class="dialog-body">
      <QrScanner
        onresult={applyQrResult}
        onmessage={(message) => (app.qrScannerMessage = message)}
      />
      <p class="supporting-text">
        {app.qrScannerMessage ??
          'Allow camera access, then align the QR code inside the frame.'}
      </p>
    </div>
    <div slot="actions">
      <md-text-button onclick={closeQrScanner}>Close</md-text-button>
    </div>
  </md-dialog>
{/if}

<input
  hidden
  type="file"
  accept="image/*"
  bind:this={iconFileInput}
  onchange={onIconUpload}
/>

<style>
  .icon-editor {
    display: flex;
    gap: 14px;
    align-items: flex-start;
  }

  .icon-editor__fields {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-width: 0;
  }
</style>
