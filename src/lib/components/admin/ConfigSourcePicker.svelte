<script lang="ts">
	import Building2 from '@lucide/svelte/icons/building-2';
	import Check from '@lucide/svelte/icons/check';
	import Globe from '@lucide/svelte/icons/globe';
	import Lock from '@lucide/svelte/icons/lock';
	import type { ConfigSource, TenantConfigOptions } from '$lib/admin/configTypes';

	let {
		options,
		disabled = false,
		onselect
	}: {
		options: TenantConfigOptions;
		disabled?: boolean;
		onselect: (source: ConfigSource) => void;
	} = $props();

	const platformBlocked = $derived(!options.platform_available);
</script>

<section class="source" aria-labelledby="cfg-source-heading">
	<h4 id="cfg-source-heading" class="source-h">Configuration source</h4>

	<div class="options" role="radiogroup" aria-labelledby="cfg-source-heading">
		<button
			type="button"
			role="radio"
			aria-checked={options.source === 'PLATFORM'}
			class="opt"
			class:selected={options.source === 'PLATFORM'}
			disabled={disabled || platformBlocked}
			onclick={() => onselect('PLATFORM')}
		>
			<span class="opt-top">
				<Globe size={15} strokeWidth={2} />
				<span class="opt-title">Platform configuration</span>
				{#if options.source === 'PLATFORM'}
					<Check size={15} strokeWidth={2.4} class="opt-check opt-check-svg" />
				{/if}
			</span>
			<span class="opt-body">
				{#if platformBlocked}
					<span class="opt-line muted">
						<Lock size={12} strokeWidth={2} /> Unavailable
					</span>
					<span class="opt-hint">{options.platform_reason}</span>
				{:else}
					<span class="opt-line ok">Available — managed by your platform administrator</span>
					<span class="opt-hint">
						Your organization does not see or hold these credentials.
					</span>
				{/if}
			</span>
		</button>

		<button
			type="button"
			role="radio"
			aria-checked={options.source === 'ORGANIZATION'}
			class="opt"
			class:selected={options.source === 'ORGANIZATION'}
			{disabled}
			onclick={() => onselect('ORGANIZATION')}
		>
			<span class="opt-top">
				<Building2 size={15} strokeWidth={2} />
				<span class="opt-title">Organization configuration</span>
				{#if options.source === 'ORGANIZATION'}
					<Check size={15} strokeWidth={2.4} class="opt-check opt-check-svg" />
				{/if}
			</span>
			<span class="opt-body">
				{#if options.organization_configured}
					<span class="opt-line ok">Configured by your organization</span>
				{:else}
					<span class="opt-line muted">Not configured yet</span>
					<span class="opt-hint">Add your own credentials to use this instead.</span>
				{/if}
			</span>
		</button>
	</div>
</section>

<style>
	.source {
		margin-bottom: 1.15rem;
	}

	.source-h {
		margin: 0 0 0.5rem;
		font-size: var(--fs-tab);
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--text-3);
	}

	.options {
		display: grid;
		gap: 0.6rem;
		grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
	}

	.opt {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		padding: 0.75rem 0.85rem;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface-1);
		text-align: left;
		cursor: pointer;
		transition: border-color 0.12s ease, background 0.12s ease;
	}

	.opt:hover:not(:disabled) {
		border-color: var(--border-strong, var(--border));
		background: var(--surface-2);
	}

	.opt:disabled {
		cursor: not-allowed;
		opacity: 0.6;
	}

	.opt.selected {
		border-color: var(--accent);
		background: color-mix(in srgb, var(--accent) 7%, var(--surface-1));
	}

	.opt-top {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		color: var(--text-1);
	}

	.opt-title {
		flex: 1;
		font-size: var(--fs-body);
		font-weight: 600;
	}

	.opt-top :global(.opt-check) {
		color: var(--accent);
	}

	.opt-body {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}

	.opt-line {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		font-size: var(--fs-tab);
		color: var(--text-2);
	}

	.opt-line.ok {
		color: var(--ok, #059669);
	}

	.opt-line.muted {
		color: var(--text-3);
	}

	.opt-hint {
		font-size: var(--fs-code);
		color: var(--text-3);
	}
</style>
