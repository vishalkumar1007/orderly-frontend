<script lang="ts">
	import { ChevronDown } from '@lucide/svelte/icons';
	import FormField from '$lib/components/admin/FormField.svelte';
	import SelectField from '$lib/components/admin/SelectField.svelte';
	import Switch from '$lib/components/admin/Switch.svelte';
	import TextArea from '$lib/components/admin/TextArea.svelte';
	import TextInput from '$lib/components/admin/TextInput.svelte';
	import ImageUpload from '$lib/components/menu/ImageUpload.svelte';
	import OptionGroupsEditor from '$lib/components/menu/OptionGroupsEditor.svelte';
	import type { MenuCategory, MenuProduct, OptionGroup, ProductInput } from '$lib/tenant/menu';
	import { hasBusinessModule, terms } from '$lib/tenant/businessType.svelte';

	// The catalogue's nouns come from the business type, not from this form.
	const t = $derived(terms());


	let {
		categories,
		editing,
		preselectCategoryId = '',
		saving,
		currencySymbol = '₹',
		onclose,
		onsave
	}: {
		categories: MenuCategory[];
		editing: MenuProduct | null;
		preselectCategoryId?: string;
		saving: boolean;
		currencySymbol?: string;
		onclose: () => void;
		onsave: (data: ProductInput) => Promise<void>;
	} = $props();

	let name = $state(editing?.name ?? '');
	let price = $state(editing ? String(editing.price) : '');
	let categoryId = $state(
		editing?.category_id ??
			(preselectCategoryId ||
				categories.find((c) => c.is_active)?.id ||
				categories[0]?.id ||
				'')
	);
	let description = $state(editing?.description ?? '');
	let isAvailable = $state(editing?.is_available ?? true);
	let isVegetarian = $state(editing?.is_vegetarian ?? false);
	let isFeatured = $state(editing?.is_featured ?? false);
	let isPopular = $state(editing?.is_popular ?? false);
	let allowNotes = $state(editing?.allow_special_instructions ?? true);
	let imageUrl = $state(editing?.image_url ?? '');
	let optionGroups = $state<OptionGroup[]>(
		editing?.option_groups?.length
			? structuredClone(editing.option_groups)
			: []
	);

	/**
	 * Whether to offer option groups at all.
	 *
	 * A grocer selling a packet of rice has no sizes or toppings, so the editor
	 * is noise. It still appears when the item already has options: a business
	 * that changed type, or had options added before, must be able to see and
	 * remove them rather than find them stranded behind a hidden control.
	 */
	const showOptions = $derived(
		hasBusinessModule('variants') || hasBusinessModule('addons') || optionGroups.length > 0
	);
	let showMore = $state(
		Boolean(
			editing &&
				((editing.option_groups && editing.option_groups.length > 0) ||
					editing.is_featured ||
					editing.is_popular ||
					editing.is_vegetarian ||
					editing.allow_special_instructions === false)
		)
	);
	let error = $state('');

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		const trimmedName = name.trim();
		const numPrice = Number(price);

		if (!trimmedName) {
			error = 'Give the product a name';
			return;
		}
		if (!Number.isFinite(numPrice) || numPrice < 0) {
			error = 'Enter a valid price (0 or more)';
			return;
		}
		if (!categoryId) {
			error = 'Pick a category';
			return;
		}
		for (const g of optionGroups) {
			if (!g.name.trim()) {
				error = 'Each option group needs a name';
				showMore = true;
				return;
			}
			if (g.options.length === 0) {
				error = `Add at least one option to "${g.name}"`;
				showMore = true;
				return;
			}
			for (const o of g.options) {
				if (!o.name.trim()) {
					error = 'Each option needs a name';
					showMore = true;
					return;
				}
				if (!Number.isFinite(o.price) || o.price < 0) {
					error = 'Option prices must be 0 or more';
					showMore = true;
					return;
				}
			}
		}

		error = '';
		await onsave({
			name: trimmedName,
			price: numPrice,
			category_id: categoryId,
			description: description.trim(),
			is_available: isAvailable,
			is_vegetarian: isVegetarian,
			is_featured: isFeatured,
			is_popular: isPopular,
			allow_special_instructions: allowNotes,
			image_url: imageUrl,
			option_groups: optionGroups
		});
	}
</script>

<form class="product-form" onsubmit={handleSubmit}>
	<FormField label={`${t.item} image`} hint="Optional · JPEG, PNG, or WebP · max 5MB · square 800×800 works best">
		<ImageUpload bind:url={imageUrl} onupload={() => {}} disabled={saving} />
	</FormField>

	<FormField label={`${t.item} name`} htmlFor="pf-name" required>
		<TextInput
			id="pf-name"
			bind:value={name}
			placeholder={`${t.item} name`}
			autocomplete="off"
			required
		/>
	</FormField>

	<FormField label="Description" htmlFor="pf-desc" hint="Optional — shown under the name">
		<TextArea id="pf-desc" rows={2} bind:value={description} placeholder="Short description for customers" />
	</FormField>

	<FormField label={t.group} htmlFor="pf-cat" required>
		<SelectField
			id="pf-cat"
			bind:value={categoryId}
			options={categories.map((c) => ({ value: c.id, label: c.name }))}
			required
		/>
	</FormField>

	<FormField label="Price" htmlFor="pf-price" required>
		<div class="price-row">
			<span class="price-sym">{currencySymbol}</span>
			<TextInput
				id="pf-price"
				type="number"
				min="0"
				step="0.5"
				inputmode="decimal"
				bind:value={price}
				placeholder="0"
				required
			/>
		</div>
	</FormField>

	<div class="avail-row">
		<Switch
			bind:checked={isAvailable}
			label={isAvailable ? 'Available' : 'Unavailable'}
			disabled={saving}
		/>
	</div>

	<button
		type="button"
		class="more-toggle"
		aria-expanded={showMore}
		onclick={() => (showMore = !showMore)}
	>
		More options
		<span class="more-chevron" class:open={showMore}>
			<ChevronDown size={15} strokeWidth={2} />
		</span>
	</button>

	{#if showMore}
		<div class="more-block">
			<div class="toggle-chips">
				{#if hasBusinessModule('diet_tags')}
					<button
						type="button"
						class="chip"
						class:active={isVegetarian}
						role="switch"
						aria-checked={isVegetarian}
						onclick={() => (isVegetarian = !isVegetarian)}
					>
						Vegetarian
					</button>
				{/if}
				<button
					type="button"
					class="chip"
					class:active={isFeatured}
					role="switch"
					aria-checked={isFeatured}
					onclick={() => (isFeatured = !isFeatured)}
				>
					Featured
				</button>
				<button
					type="button"
					class="chip"
					class:active={isPopular}
					role="switch"
					aria-checked={isPopular}
					onclick={() => (isPopular = !isPopular)}
				>
					Recommended
				</button>
				<button
					type="button"
					class="chip"
					class:active={allowNotes}
					role="switch"
					aria-checked={allowNotes}
					onclick={() => (allowNotes = !allowNotes)}
				>
					Special instructions
				</button>
			</div>

			{#if showOptions}
				<FormField
					label={hasBusinessModule('variants') && !hasBusinessModule('addons')
						? 'Sizes & variants'
						: 'Options / Add-ons'}
					hint="Sizes, toppings, extras — optional"
				>
					<OptionGroupsEditor bind:groups={optionGroups} disabled={saving} {currencySymbol} />
				</FormField>
			{/if}
		</div>
	{/if}

	{#if error}
		<p class="err" style="margin:0;">{error}</p>
	{/if}

	<div class="product-form-actions">
		<button class="btn btn-ghost" type="button" onclick={onclose} disabled={saving}>Cancel</button>
		<button class="btn btn-primary" type="submit" disabled={saving}>
			{saving ? 'Saving…' : `Save ${t.item.toLowerCase()}`}
		</button>
	</div>
</form>

<style>
	.product-form {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
	}
	.price-row {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}
	.price-sym {
		color: var(--text-3);
		font-weight: 600;
		font-size: var(--fs-body);
	}
	.price-row :global(.input) {
		flex: 1;
	}
	.avail-row {
		padding: 0.15rem 0;
	}
	.more-toggle {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		align-self: flex-start;
		border: none;
		background: transparent;
		color: var(--accent-dark);
		font: inherit;
		font-size: var(--fs-body);
		font-weight: 600;
		cursor: pointer;
		padding: 0.25rem 0;
	}
	.more-chevron {
		display: inline-flex;
		transition: transform var(--tr);
	}
	.more-chevron.open {
		transform: rotate(180deg);
	}
	.more-block {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
		padding-top: 0.25rem;
	}
	.toggle-chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}
	.chip {
		padding: 0.35rem 0.75rem;
		border: 1px solid var(--border);
		border-radius: 999px;
		background: var(--surface);
		color: var(--text-2);
		font-size: var(--fs-tab);
		font-weight: 550;
		font-family: inherit;
		cursor: pointer;
		white-space: nowrap;
		transition: all var(--tr);
	}
	.chip:hover {
		border-color: color-mix(in srgb, var(--accent) 30%, var(--border));
		color: var(--text);
	}
	.chip.active {
		background: var(--accent-soft);
		border-color: var(--accent);
		color: var(--accent-dark);
	}
	.product-form-actions {
		display: flex;
		gap: 0.5rem;
		margin-top: 0.35rem;
		position: sticky;
		bottom: 0;
		padding-top: 0.5rem;
		background: var(--surface);
	}
	.product-form-actions .btn {
		flex: 1;
		min-height: 2.75rem;
	}
</style>
