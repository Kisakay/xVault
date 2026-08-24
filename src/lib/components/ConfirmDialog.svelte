<script lang="ts">
  import { app, closeConfirm } from '../store.svelte';

  let busy = $state(false);

  const confirm = async (): Promise<void> => {
    if (!app.confirm || busy) {
      return;
    }
    busy = true;
    try {
      await app.confirm.action();
      closeConfirm();
    } catch (error) {
      console.error('Confirm action failed:', error);
    } finally {
      busy = false;
    }
  };
</script>

{#if app.confirm}
  <md-dialog
    open
    onclose={closeConfirm}
    style="--md-dialog-container-color: var(--md-sys-color-surface-container-high)"
  >
    <div slot="headline">{app.confirm.title}</div>
    <div slot="content" class="dialog-body">
      <p class="supporting-text" style="line-height: 1.6">
        {app.confirm.message}
      </p>
      <div class="dialog-actions">
        <md-text-button type="button" onclick={closeConfirm} disabled={busy}>
          Cancel
        </md-text-button>
        <md-filled-button
          type="button"
          class:is-danger={app.confirm.danger}
          onclick={() => void confirm()}
          disabled={busy}
        >
          {busy ? 'Working...' : app.confirm.confirmLabel}
        </md-filled-button>
      </div>
    </div>
  </md-dialog>
{/if}

<style>
  :global(.is-danger) {
    --md-filled-button-container-color: var(--md-sys-color-error);
    --md-filled-button-label-text-color: var(--md-sys-color-on-error);
  }
</style>
