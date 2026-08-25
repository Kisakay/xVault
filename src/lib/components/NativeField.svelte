<script lang="ts">
  // Champ de formulaire natif stylé MD3 — les inputs natifs (light DOM) sont
  // requis pour que l'autofill et l'enregistrement des mots de passe du
  // navigateur fonctionnent (les custom elements Material Web cachent leur
  // <input> dans un shadow DOM que Chrome ignore pour l'autofill).
  let {
    label,
    type = 'text',
    name,
    id,
    autocomplete,
    placeholder,
    value = $bindable(''),
  }: {
    label: string;
    type?: 'text' | 'email' | 'password';
    name?: string;
    id?: string;
    autocomplete?: string;
    placeholder?: string;
    value?: string;
  } = $props();

  let showPassword = $state(false);
  const effectiveType = $derived(
    type === 'password' && showPassword ? 'text' : type,
  );
</script>

<label class="native-field" for={id ?? name}>
  <span class="native-field__label">{label}</span>
  <span class="native-field__wrap">
    <input
      {id}
      {name}
      type={effectiveType}
      {autocomplete}
      {placeholder}
      {value}
      class="native-field__input"
      class:native-field__input--with-toggle={type === 'password'}
      oninput={(event: Event) =>
        (value = (event.target as HTMLInputElement).value)}
    />
    {#if type === 'password'}
      <button
        type="button"
        class="native-field__toggle"
        aria-label={showPassword ? 'Hide password' : 'Show password'}
        onclick={() => (showPassword = !showPassword)}
      >
        <md-icon>{showPassword ? 'visibility_off' : 'visibility'}</md-icon>
      </button>
    {/if}
  </span>
</label>

<style>
  .native-field {
    display: flex;
    flex-direction: column;
    gap: 6px;
    width: 100%;
  }

  .native-field__label {
    font-size: 13px;
    color: var(--md-sys-color-on-surface-variant);
    padding-left: 4px;
  }

  .native-field__wrap {
    position: relative;
    display: block;
  }

  .native-field__input {
    width: 100%;
    height: 54px;
    padding: 0 16px;
    border: 1px solid var(--md-sys-color-outline);
    border-radius: 4px;
    background: var(--md-sys-color-surface-container-low);
    color: var(--md-sys-color-on-surface);
    font: inherit;
    font-size: 16px;
    caret-color: var(--md-sys-color-primary);
    transition:
      border-color 120ms ease,
      padding 120ms ease;
  }

  .native-field__input:hover {
    border-color: var(--md-sys-color-on-surface);
  }

  .native-field__input:focus {
    outline: none;
    border: 2px solid var(--md-sys-color-primary);
    padding: 0 15px;
  }

  .native-field__input::placeholder {
    color: var(--md-sys-color-on-surface-variant);
  }

  .native-field__input--with-toggle {
    padding-right: 52px;
  }

  .native-field__toggle {
    position: absolute;
    right: 4px;
    top: 50%;
    transform: translateY(-50%);
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    border: none;
    border-radius: 50%;
    background: transparent;
    color: var(--md-sys-color-on-surface-variant);
    cursor: pointer;
  }

  .native-field__toggle:hover {
    background: var(--md-sys-color-surface-container-high);
  }
</style>
