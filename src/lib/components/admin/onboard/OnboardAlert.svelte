<script lang="ts">
	import IconAlertTriangle from '@tabler/icons-svelte/icons/alert-triangle';
	import IconInfoCircle from '@tabler/icons-svelte/icons/info-circle';

	/**
	 * A block-level notice inside the wizard.
	 *
	 * `role="alert"` is the point of the component existing. The previous notices
	 * were bare `<div>`s with an icon, so when creation failed the page changed
	 * colour and gained a paragraph and nothing was announced — the operator had
	 * to go looking for what had just happened. `role="alert"` is assertive and
	 * interrupts; `role="status"` is polite and waits for a pause. Creation
	 * failure is worth interrupting for, a missing plan catalogue is not, so
	 * tone selects the role.
	 */
	let {
		tone = 'info',
		title = '',
		children
	}: {
		tone?: 'info' | 'warn' | 'error';
		title?: string;
		children: import('svelte').Snippet;
	} = $props();
</script>

<div
	class="onb-alert"
	class:onb-alert-warn={tone === 'warn'}
	class:onb-alert-err={tone === 'error'}
	role={tone === 'error' ? 'alert' : 'status'}
>
	{#if tone === 'info'}
		<IconInfoCircle size={15} stroke={1.8} />
	{:else}
		<IconAlertTriangle size={15} stroke={1.8} />
	{/if}
	<span>
		{#if title}<strong>{title}.</strong>{/if}
		{@render children()}
	</span>
</div>

<style>
	.onb-alert-err strong {
		font-weight: 600;
	}
</style>
