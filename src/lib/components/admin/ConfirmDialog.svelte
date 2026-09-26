<script lang="ts">
	import Modal from './Modal.svelte';

	let {
		open = $bindable(false),
		title = 'Confirm',
		message = 'Are you sure?',
		confirmLabel = 'Confirm',
		cancelLabel = 'Cancel',
		danger = false,
		loading = false,
		onconfirm
	}: {
		open?: boolean;
		title?: string;
		message?: string;
		confirmLabel?: string;
		cancelLabel?: string;
		danger?: boolean;
		loading?: boolean;
		onconfirm?: () => void | Promise<void>;
	} = $props();
</script>

<Modal bind:open {title}>
	<p>{message}</p>
	{#snippet footer()}
		<button type="button" class="btn btn-ghost" onclick={() => (open = false)} disabled={loading}>
			{cancelLabel}
		</button>
		<button
			type="button"
			class={danger ? 'btn btn-danger' : 'btn btn-primary'}
			onclick={() => onconfirm?.()}
			disabled={loading}
		>
			{loading ? 'Working…' : confirmLabel}
		</button>
	{/snippet}
</Modal>
