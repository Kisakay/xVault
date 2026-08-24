<script lang="ts">
  import { app, exportVaultAction, importVaultFromFile } from '../store.svelte';

  let importInput: HTMLInputElement | undefined = $state();

  const onImportChange = async (event: Event): Promise<void> => {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      await importVaultFromFile(file);
    }
    input.value = '';
  };
</script>

<section class="split-panel">
  <article class="md-card stack-lg">
    <div>
      <p class="eyebrow">Encrypted export</p>
      <h3 class="panel-title">Produce a portable vault backup.</h3>
      <p class="supporting-text">
        Exports use the existing backend format. The UI never renders the raw
        secret material during this flow.
      </p>
    </div>
    <md-filled-button
      onclick={() => void exportVaultAction()}
      disabled={app.pending.export}
    >
      <md-icon slot="icon">download</md-icon>
      {app.pending.export ? 'Preparing export...' : 'Export xVault backup'}
    </md-filled-button>
  </article>

  <article class="md-card stack-lg">
    <div>
      <p class="eyebrow">Import</p>
      <h3 class="panel-title">Restore from a trusted xVault file.</h3>
      <p class="supporting-text">
        Imports replace the current vault payload after password verification.
        Only import files you trust.
      </p>
    </div>
    <md-outlined-button
      onclick={() => importInput?.click()}
      disabled={app.pending.import}
    >
      <md-icon slot="icon">upload</md-icon>
      {app.pending.import ? 'Importing...' : 'Import encrypted backup'}
    </md-outlined-button>
  </article>

  <article class="md-card md-card--flat stack-md">
    <p class="eyebrow">Backup discipline</p>
    <ul class="clean-list">
      <li>Keep at least one offline copy of your encrypted export.</li>
      <li>Test restore on a secondary environment before relying on it.</li>
      <li>Do not store backup files in the same place as your main credentials.</li>
    </ul>
  </article>
</section>

<input
  hidden
  type="file"
  accept=".json,application/json"
  bind:this={importInput}
  onchange={onImportChange}
/>

<style>
  .panel-title {
    margin: 6px 0 8px;
    font-size: 17px;
    font-weight: 500;
  }
</style>
