<script lang="ts">
  import { app, closeFolderDialog, saveFolder } from '../store.svelte';

  let name = $state('');
  let icon = $state('');
  let color = $state('#00897b');

  const isEditing = $derived(app.editingFolderId !== null);

  const setField = (setter: (value: string) => void) => (event: Event) =>
    setter((event.target as HTMLInputElement).value);

  $effect(() => {
    if (app.editingFolderId) {
      const folder = app.folders.find((item) => item.id === app.editingFolderId);
      if (folder) {
        name = folder.name;
        icon = folder.icon ?? '';
        color = folder.color ?? '#00897b';
        return;
      }
    }
    name = '';
    icon = '';
    color = '#00897b';
  });
</script>

<md-dialog
  open={app.folderDialogOpen}
  onclose={closeFolderDialog}
  style="--md-dialog-container-color: var(--md-sys-color-surface-container-high)"
>
  <div slot="headline">{isEditing ? 'Edit folder' : 'New folder'}</div>

  <form
    slot="content"
    class="dialog-body"
    onsubmit={(event) => {
      event.preventDefault();
      saveFolder(name, icon, color);
    }}
  >
    <md-outlined-text-field
      label="Folder name"
      placeholder="Work, Personal, Critical"
      value={name}
      oninput={setField((value) => (name = value))}
      style="width: 100%"
    ></md-outlined-text-field>

    <div class="field-grid">
      <md-outlined-text-field
        label="Marker (emoji)"
        maxlength="2"
        placeholder="•"
        value={icon}
        oninput={setField((value) => (icon = value))}
        style="width: 100%"
      ></md-outlined-text-field>
      <label class="color-field">
        <span class="eyebrow">Accent color</span>
        <input type="color" bind:value={color} />
      </label>
    </div>

    <div class="dialog-actions">
      <md-text-button type="button" onclick={closeFolderDialog}>
        Cancel
      </md-text-button>
      <md-filled-button type="submit">
        {isEditing ? 'Save changes' : 'Create folder'}
      </md-filled-button>
    </div>
  </form>
</md-dialog>

<style>
  .color-field {
    display: flex;
    flex-direction: column;
    gap: 8px;
    justify-content: center;
  }

  .color-field input[type='color'] {
    width: 100%;
    height: 44px;
    border: 1px solid var(--md-sys-color-outline-variant);
    border-radius: var(--xv-radius-xs);
    background: var(--md-sys-color-surface-container-low);
    padding: 4px;
    cursor: pointer;
  }
</style>
