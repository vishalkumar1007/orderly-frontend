<script lang="ts" generics="T extends string">
	/**
	 * A choice between a few options, shown side by side. The one control
	 * Orderly uses for "pick one of two or three" (team or customers, online or
	 * cash, platform or your own account), so every such choice looks the same.
	 */
	let {
		options,
		value,
		label,
		disabled = false,
		onchange
	}: {
		options: Array<{ value: T; label: string; disabled?: boolean }>;
		value: T;
		/** Read by screen readers: what is being chosen. */
		label: string;
		disabled?: boolean;
		onchange: (value: T) => void;
	} = $props();
</script>

<div class="seg" role="radiogroup" aria-label={label}>
	{#each options as o (o.value)}
		<button
			type="button"
			role="radio"
			aria-checked={value === o.value}
			disabled={disabled || o.disabled}
			onclick={() => o.value !== value && onchange(o.value)}
		>
			{o.label}
		</button>
	{/each}
</div>

<style>
	.seg {
		display: inline-flex;
		padding: 2px;
		border-radius: var(--radius);
		background: var(--surface-2);
	}

	.seg button {
		padding: var(--sp-3) var(--sp-8);
		border: 0;
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--text-3);
		font: inherit;
		font-size: var(--fs-tab);
		font-weight: 500;
		white-space: nowrap;
		transition:
			background var(--tr, 0.15s),
			color var(--tr, 0.15s);
	}

	.seg button:hover:not(:disabled):not([aria-checked='true']) {
		color: var(--text);
	}

	.seg button[aria-checked='true'] {
		background: var(--accent-soft);
		color: var(--text);
		font-weight: 600;
	}

	.seg button:disabled {
		opacity: 0.45;
	}
</style>
