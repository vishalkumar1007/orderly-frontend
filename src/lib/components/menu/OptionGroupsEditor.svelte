<script lang="ts">
	import { ChevronDown, ChevronUp, Plus, Trash2 } from '@lucide/svelte/icons';
	import Switch from '$lib/components/admin/Switch.svelte';
	import type { OptionGroup } from '$lib/tenant/menu';
	import { newOptionGroup } from '$lib/tenant/menu';

	let {
		groups = $bindable([] as OptionGroup[]),
		disabled = false,
		currencySymbol = '₹'
	}: {
		groups?: OptionGroup[];
		disabled?: boolean;
		currencySymbol?: string;
	} = $props();

	function addGroup() {
		groups = [...groups, newOptionGroup({ sort_order: groups.length })];
	}

	function removeGroup(index: number) {
		groups = groups.filter((_, i) => i !== index);
	}

	function moveGroup(index: number, delta: number) {
		const next = index + delta;
		if (next < 0 || next >= groups.length) return;
		const copy = [...groups];
		const [row] = copy.splice(index, 1);
		copy.splice(next, 0, row);
		groups = copy.map((g, i) => ({ ...g, sort_order: i }));
	}

	function updateGroup(index: number, patch: Partial<OptionGroup>) {
		groups = groups.map((g, i) => (i === index ? { ...g, ...patch } : g));
	}

	function addOption(groupIndex: number) {
		groups = groups.map((g, i) =>
			i === groupIndex
				? {
						...g,
						options: [
							...g.options,
							{
								id: crypto.randomUUID().slice(0, 8),
								name: '',
								price: 0,
								is_active: true,
								sort_order: g.options.length,
								max_qty: g.selection === 'single' ? 1 : 1
							}
						]
					}
				: g
		);
	}

	function removeOption(groupIndex: number, optIndex: number) {
		groups = groups.map((g, i) =>
			i === groupIndex ? { ...g, options: g.options.filter((_, j) => j !== optIndex) } : g
		);
	}

	function updateOption(
		groupIndex: number,
		optIndex: number,
		patch: { name?: string; price?: number; is_active?: boolean }
	) {
		groups = groups.map((g, i) =>
			i === groupIndex
				? {
						...g,
						options: g.options.map((o, j) => (j === optIndex ? { ...o, ...patch } : o))
					}
				: g
		);
	}

	function moveOption(groupIndex: number, optIndex: number, delta: number) {
		const g = groups[groupIndex];
		if (!g) return;
		const next = optIndex + delta;
		if (next < 0 || next >= g.options.length) return;
		const opts = [...g.options];
		const [row] = opts.splice(optIndex, 1);
		opts.splice(next, 0, row);
		updateGroup(groupIndex, { options: opts.map((o, i) => ({ ...o, sort_order: i })) });
	}
</script>

<div class="og-editor">
	{#if groups.length === 0}
		<div class="og-empty">
			<p>No options yet</p>
			<p class="og-hint">Add sizes, toppings, or extras customers can choose.</p>
			{#if !disabled}
				<button type="button" class="btn btn-ghost btn-sm" onclick={addGroup}>
					<Plus size={14} strokeWidth={2.2} /> Add option group
				</button>
			{/if}
		</div>
	{:else}
		{#each groups as group, gi (group.id)}
			<div class="og-group" class:inactive={!group.is_active}>
				<div class="og-group-head">
					<input
						class="input og-group-name"
						placeholder="Group name (e.g. Choose size)"
						disabled={disabled}
						value={group.name}
						oninput={(e) => updateGroup(gi, { name: e.currentTarget.value })}
					/>
					<div class="og-group-tools">
						<button
							type="button"
							class="og-icon"
							aria-label="Move group up"
							disabled={disabled || gi === 0}
							onclick={() => moveGroup(gi, -1)}
						>
							<ChevronUp size={14} />
						</button>
						<button
							type="button"
							class="og-icon"
							aria-label="Move group down"
							disabled={disabled || gi === groups.length - 1}
							onclick={() => moveGroup(gi, 1)}
						>
							<ChevronDown size={14} />
						</button>
						{#if !disabled}
							<button
								type="button"
								class="og-icon danger"
								aria-label="Remove group"
								onclick={() => removeGroup(gi)}
							>
								<Trash2 size={14} />
							</button>
						{/if}
					</div>
				</div>

				<div class="og-group-meta">
					<label class="og-radio">
						<input
							type="radio"
							name={`sel-${group.id}`}
							disabled={disabled}
							checked={group.selection === 'single'}
							onchange={() => updateGroup(gi, { selection: 'single' })}
						/>
						Single selection
					</label>
					<label class="og-radio">
						<input
							type="radio"
							name={`sel-${group.id}`}
							disabled={disabled}
							checked={group.selection === 'multiple'}
							onchange={() => updateGroup(gi, { selection: 'multiple' })}
						/>
						Multiple selection
					</label>
					<label class="og-check">
						<input
							type="checkbox"
							disabled={disabled}
							checked={group.required}
							onchange={(e) => updateGroup(gi, { required: e.currentTarget.checked })}
						/>
						Required
					</label>
					<Switch
						checked={group.is_active}
						label={group.is_active ? 'Active' : 'Hidden'}
						disabled={disabled}
						onchange={(v) => updateGroup(gi, { is_active: v })}
					/>
				</div>

				<div class="og-options">
					{#each group.options as opt, oi (opt.id)}
						<div class="og-option">
							<input
								class="input og-opt-name"
								placeholder="Option name"
								disabled={disabled}
								value={opt.name}
								oninput={(e) => updateOption(gi, oi, { name: e.currentTarget.value })}
							/>
							<div class="og-opt-price">
								<span>{currencySymbol}</span>
								<input
									class="input"
									type="number"
									min="0"
									step="0.5"
									placeholder="0"
									disabled={disabled}
									value={opt.price || ''}
									oninput={(e) => {
										const n = Number(e.currentTarget.value);
										updateOption(gi, oi, { price: Number.isFinite(n) ? n : 0 });
									}}
								/>
							</div>
							<button
								type="button"
								class="og-icon"
								aria-label="Move option up"
								disabled={disabled || oi === 0}
								onclick={() => moveOption(gi, oi, -1)}
							>
								<ChevronUp size={13} />
							</button>
							<button
								type="button"
								class="og-icon"
								aria-label="Move option down"
								disabled={disabled || oi === group.options.length - 1}
								onclick={() => moveOption(gi, oi, 1)}
							>
								<ChevronDown size={13} />
							</button>
							{#if !disabled}
								<button
									type="button"
									class="og-icon danger"
									aria-label="Remove option"
									onclick={() => removeOption(gi, oi)}
								>
									<Trash2 size={13} />
								</button>
							{/if}
						</div>
					{/each}
					{#if !disabled}
						<button type="button" class="btn btn-ghost btn-sm" onclick={() => addOption(gi)}>
							<Plus size={13} strokeWidth={2.2} /> Add option
						</button>
					{/if}
				</div>
			</div>
		{/each}
		{#if !disabled}
			<button type="button" class="btn btn-ghost btn-sm" onclick={addGroup}>
				<Plus size={14} strokeWidth={2.2} /> Add option group
			</button>
		{/if}
	{/if}
</div>

<style>
	.og-editor {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
	.og-empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.35rem;
		padding: 1rem;
		border: 1px dashed var(--border);
		border-radius: var(--radius-sm);
		text-align: center;
	}
	.og-empty p {
		margin: 0;
		font-size: 0.82rem;
		color: var(--text-2);
	}
	.og-hint {
		color: var(--text-3) !important;
		font-size: 0.75rem !important;
	}
	.og-group {
		padding: 0.75rem;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--surface-2);
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
	}
	.og-group.inactive {
		opacity: 0.65;
	}
	.og-group-head {
		display: flex;
		gap: 0.4rem;
		align-items: center;
	}
	.og-group-name {
		flex: 1;
		min-width: 0;
		font-weight: 550;
	}
	.og-group-tools {
		display: flex;
		gap: 0.15rem;
		flex-shrink: 0;
	}
	.og-group-meta {
		display: flex;
		flex-wrap: wrap;
		gap: 0.65rem 1rem;
		align-items: center;
		font-size: 0.78rem;
		color: var(--text-2);
	}
	.og-radio,
	.og-check {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		cursor: pointer;
	}
	.og-options {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}
	.og-option {
		display: flex;
		align-items: center;
		gap: 0.35rem;
	}
	.og-opt-name {
		flex: 1;
		min-width: 0;
	}
	.og-opt-price {
		display: flex;
		align-items: center;
		gap: 0.2rem;
		flex-shrink: 0;
		color: var(--text-3);
		font-size: 0.78rem;
	}
	.og-opt-price .input {
		width: 4.5rem;
	}
	.og-icon {
		width: 1.85rem;
		height: 1.85rem;
		display: grid;
		place-items: center;
		border: none;
		border-radius: 7px;
		background: transparent;
		color: var(--text-3);
		cursor: pointer;
		flex-shrink: 0;
	}
	.og-icon:hover:not(:disabled) {
		background: var(--surface-3);
		color: var(--text);
	}
	.og-icon:disabled {
		opacity: 0.35;
		cursor: not-allowed;
	}
	.og-icon.danger:hover:not(:disabled) {
		background: var(--danger-bg);
		color: var(--danger);
	}
</style>
