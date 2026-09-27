<script lang="ts">
	import { Plus, X } from '@lucide/svelte/icons';

	type Addon = { name: string; price: number };

	let {
		addons = $bindable([]),
		disabled = false
	}: {
		addons?: Addon[];
		disabled?: boolean;
	} = $props();

	function addAddon() {
		addons = [...addons, { name: '', price: 0 }];
	}

	function removeAddon(index: number) {
		addons = addons.filter((_, i) => i !== index);
	}

	function updateName(index: number, value: string) {
		addons = addons.map((a, i) => (i === index ? { ...a, name: value } : a));
	}

	function updatePrice(index: number, value: string) {
		const num = Number(value);
		addons = addons.map((a, i) => (i === index ? { ...a, price: Number.isFinite(num) ? num : 0 } : a));
	}
</script>

<div class="addons-manager">
	{#if addons.length === 0}
		<div class="addons-empty">
			<p>No addons yet</p>
			{#if !disabled}
				<button type="button" class="btn btn-ghost btn-sm" onclick={addAddon}>
					<Plus size={14} strokeWidth={2.2} /> Add addon
				</button>
			{/if}
		</div>
	{:else}
		<div class="addons-list">
			{#each addons as addon, i (i)}
				<div class="addon-row">
					<input
						class="input addon-name"
						placeholder="Extra cheese"
						disabled={disabled}
						value={addon.name}
						oninput={(e) => updateName(i, e.currentTarget.value)}
					/>
					<input
						class="input addon-price"
						type="number"
						min="0"
						step="0.5"
						placeholder="₹0"
						disabled={disabled}
						value={addon.price || ''}
						oninput={(e) => updatePrice(i, e.currentTarget.value)}
					/>
					{#if !disabled}
						<button
							type="button"
							class="addon-remove"
							aria-label="Remove addon"
							onclick={() => removeAddon(i)}
						>
							<X size={14} strokeWidth={2.2} />
						</button>
					{/if}
				</div>
			{/each}
		</div>
		{#if !disabled}
			<button type="button" class="btn btn-ghost btn-sm addons-add" onclick={addAddon}>
				<Plus size={14} strokeWidth={2.2} /> Add addon
			</button>
		{/if}
	{/if}
</div>

<style>
	.addons-manager {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.addons-empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.4rem;
		padding: 1rem;
		border: 1px dashed var(--border);
		border-radius: var(--radius-sm);
	}

	.addons-empty p {
		margin: 0;
		font-size: 0.8rem;
		color: var(--text-3);
	}

	.addons-list {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.addon-row {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}

	.addon-name {
		flex: 1;
		min-width: 0;
	}

	.addon-price {
		width: 5.5rem;
		flex-shrink: 0;
	}

	.addon-remove {
		width: 2rem;
		height: 2rem;
		display: grid;
		place-items: center;
		border: none;
		border-radius: 7px;
		background: transparent;
		color: var(--text-3);
		cursor: pointer;
		flex-shrink: 0;
		transition: background var(--tr), color var(--tr);
	}

	.addon-remove:hover {
		background: var(--danger-bg);
		color: var(--danger);
	}

	.addons-add {
		align-self: flex-start;
	}
</style>
