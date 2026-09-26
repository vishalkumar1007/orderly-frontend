<script lang="ts">
	import { onMount } from 'svelte';
	import IndianRupee from '@lucide/svelte/icons/indian-rupee';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Plus from '@lucide/svelte/icons/plus';
	import Trash from '@lucide/svelte/icons/trash';
	import UtensilsCrossed from '@lucide/svelte/icons/utensils-crossed';
	import X from '@lucide/svelte/icons/x';
	import { api } from '$lib/api/client';
	import EmptyState from '$lib/components/admin/EmptyState.svelte';
	import ErrorState from '$lib/components/admin/ErrorState.svelte';
	import Modal from '$lib/components/admin/Modal.svelte';
	import Reveal from '$lib/components/admin/Reveal.svelte';
	import SelectField from '$lib/components/admin/SelectField.svelte';
	import Skeleton from '$lib/components/admin/Skeleton.svelte';
	import Switch from '$lib/components/admin/Switch.svelte';
	import TextArea from '$lib/components/admin/TextArea.svelte';
	import TextInput from '$lib/components/admin/TextInput.svelte';
	import FormField from '$lib/components/admin/FormField.svelte';
	import { toast } from '$lib/components/admin/toast';

	type Category = { id: string; name: string; is_active: boolean };
	type Product = {
		id: string;
		category_id: string;
		name: string;
		price: number;
		is_available: boolean;
		description: string;
	};

	let categories = $state<Category[]>([]);
	let products = $state<Product[]>([]);
	let error = $state('');
	let loading = $state(true);
	let saving = $state(false);

	/** Category filter; '' means all. */
	let filter = $state('');

	/* ---------- add / edit product dialog ---------- */
	let dialogOpen = $state(false);
	let editing = $state<Product | null>(null);
	let formName = $state('');
	let formPrice = $state('');
	let formCategory = $state('');
	let formDescription = $state('');
	let formAvailable = $state(true);
	let formError = $state('');

	/* ---------- new category ---------- */
	let newCategory = $state('');
	let categoryBusy = $state(false);

	const shown = $derived(
		filter ? products.filter((p) => p.category_id === filter) : products
	);
	const availableCount = $derived(products.filter((p) => p.is_available).length);
	const menuValue = $derived(
		products.filter((p) => p.is_available).reduce((n, p) => n + Number(p.price), 0)
	);

	function productsIn(catId: string): Product[] {
		return products.filter((p) => p.category_id === catId);
	}

	async function load() {
		const [c, p] = await Promise.all([
			api<{ categories: Category[] }>('/api/v1/tenant/categories'),
			api<{ products: Product[] }>('/api/v1/tenant/products')
		]);
		categories = c.categories;
		products = p.products;
		// Stay on "All" — silently defaulting to one category makes the menu look
		// empty at a glance when the owner has several.
	}

	onMount(() => {
		let cancelled = false;
		(async () => {
			try {
				await load();
			} catch (err) {
				if (!cancelled) error = err instanceof Error ? err.message : 'Failed to load menu';
			} finally {
				if (!cancelled) loading = false;
			}
		})();
		return () => {
			cancelled = true;
		};
	});

	/* ---------- product dialog ---------- */
	function openAdd(catId?: string) {
		editing = null;
		formName = '';
		formPrice = '';
		formDescription = '';
		formAvailable = true;
		formCategory = catId ?? filter ?? categories[0]?.id ?? '';
		formError = '';
		dialogOpen = true;
	}

	function openEdit(p: Product) {
		editing = p;
		formName = p.name;
		formPrice = String(p.price);
		formDescription = p.description ?? '';
		formAvailable = p.is_available;
		formCategory = p.category_id;
		formError = '';
		dialogOpen = true;
	}

	async function saveProduct() {
		const name = formName.trim();
		const price = Number(formPrice);
		if (!name) {
			formError = 'Give the item a name';
			return;
		}
		if (!Number.isFinite(price) || price < 0) {
			formError = 'Enter a valid price';
			return;
		}
		if (!formCategory) {
			formError = 'Pick a category';
			return;
		}

		saving = true;
		formError = '';
		try {
			const payload = {
				name,
				price,
				category_id: formCategory,
				description: formDescription.trim(),
				is_available: formAvailable
			};
			if (editing) {
				await api(`/api/v1/tenant/products/${editing.id}`, {
					method: 'PATCH',
					body: JSON.stringify(payload)
				});
				toast.success(`${name} updated`);
			} else {
				await api('/api/v1/tenant/products', { method: 'POST', body: JSON.stringify(payload) });
				toast.success(`${name} added`);
			}
			dialogOpen = false;
			await load();
		} catch (err) {
			formError = err instanceof Error ? err.message : 'Could not save';
		} finally {
			saving = false;
		}
	}

	async function toggleAvailable(p: Product) {
		// Optimistic: availability is flipped constantly during service, so it
		// should feel instant. We reload to reconcile either way.
		const next = !p.is_available;
		products = products.map((x) => (x.id === p.id ? { ...x, is_available: next } : x));
		try {
			await api(`/api/v1/tenant/products/${p.id}`, {
				method: 'PATCH',
				body: JSON.stringify({
					name: p.name,
					price: p.price,
					category_id: p.category_id,
					description: p.description,
					is_available: next
				})
			});
		} catch (err) {
			products = products.map((x) => (x.id === p.id ? { ...x, is_available: !next } : x));
			toast.error(err instanceof Error ? err.message : 'Could not update');
		}
	}

	async function removeProduct(p: Product) {
		if (!confirm(`Remove "${p.name}" from your menu?`)) return;
		try {
			await api(`/api/v1/tenant/products/${p.id}`, { method: 'DELETE' });
			toast.success(`${p.name} removed`);
			await load();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Could not remove');
		}
	}

	/* ---------- categories ---------- */
	async function addCategory(e: SubmitEvent) {
		e.preventDefault();
		const name = newCategory.trim();
		if (!name) return;
		categoryBusy = true;
		try {
			await api('/api/v1/tenant/categories', {
				method: 'POST',
				body: JSON.stringify({ name })
			});
			newCategory = '';
			toast.success(`${name} added`);
			await load();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Could not add category');
		} finally {
			categoryBusy = false;
		}
	}
</script>

{#if error}
	<ErrorState message={error} onretry={() => location.reload()} />
{/if}

<!-- ---------- Summary ---------- -->
{#if loading}
	<div class="osstats" style="grid-template-columns:repeat(2,minmax(0,1fr));">
		{#each [1, 2, 3, 4] as _, i (i)}
			<div class="osstat"><Skeleton height="2.2rem" /></div>
		{/each}
	</div>
{:else}
	<div class="osstats" style="grid-template-columns:repeat(2,minmax(0,1fr));">
		<div class="osstat accent">
			<div class="osstat-label">Items on menu</div>
			<p class="osstat-value">{products.length}</p>
		</div>
		<div class="osstat">
			<div class="osstat-label">Available now</div>
			<p class="osstat-value">{availableCount}</p>
		</div>
		<div class="osstat">
			<div class="osstat-label">Categories</div>
			<p class="osstat-value">{categories.length}</p>
		</div>
		<div class="osstat">
			<div class="osstat-label">Menu value</div>
			<p class="osstat-value">₹{menuValue.toLocaleString('en-IN')}</p>
		</div>
	</div>
{/if}

{#if !loading && categories.length === 0}
	<Reveal class="panel" delay={60}>
		<EmptyState
			title="No categories yet"
			description="Categories group your menu for customers — start with one, then add items."
		>
			{#snippet action()}
				<form onsubmit={addCategory} class="osh-inline-form">
					<input class="input" placeholder="e.g. Momo" bind:value={newCategory} required />
					<button class="btn btn-primary" type="submit" disabled={categoryBusy}>
						<Plus size={15} strokeWidth={2.2} /> Add
					</button>
				</form>
			{/snippet}
		</EmptyState>
	</Reveal>
{:else if !loading}
	<!-- ---------- Category chips ---------- -->
	<div class="os-tabs" role="tablist" aria-label="Categories">
		<button
			class={['os-tab', filter === '' ? 'active' : ''].join(' ')}
			role="tab"
			aria-selected={filter === ''}
			onclick={() => (filter = '')}
		>
			All
			<span class="os-tab-count">{products.length}</span>
		</button>
		{#each categories as c (c.id)}
			<button
				class={['os-tab', filter === c.id ? 'active' : ''].join(' ')}
				role="tab"
				aria-selected={filter === c.id}
				onclick={() => (filter = c.id)}
			>
				{c.name}
				<span class="os-tab-count">{productsIn(c.id).length}</span>
			</button>
		{/each}
	</div>

	<div class="osh-actions-row">
		<!-- Primary action gets its own full-width row on a phone. -->
		<button
			class="btn btn-primary osh-add-item"
			type="button"
			onclick={() => openAdd(filter || undefined)}
			disabled={categories.length === 0}
		>
			<Plus size={16} strokeWidth={2.2} /> Add item
		</button>

		<details class="osh-newcat">
			<summary class="btn btn-ghost osh-newcat-summary">
				<Plus size={15} strokeWidth={2.2} /> New category
			</summary>
			<form class="osh-inline-form" onsubmit={addCategory}>
				<input class="input" placeholder="e.g. Desserts" bind:value={newCategory} />
				<button class="btn btn-ghost" type="submit" disabled={categoryBusy || !newCategory.trim()}>
					Add
				</button>
			</form>
		</details>
	</div>

	<!-- ---------- Product list ---------- -->
	<div class="osh-list">
		{#each shown as p (p.id)}
			<div class={['osh-prod', p.is_available ? '' : 'off'].join(' ')}>
				<div class="osh-prod-main">
					<div class="osh-prod-top">
						<span class="osh-prod-name">{p.name}</span>
						<span class="osh-prod-price">
							<IndianRupee size={12} strokeWidth={2.2} />{p.price}
						</span>
					</div>
					{#if p.description}
						<p class="osh-prod-desc">{p.description}</p>
					{/if}
					<div class="osh-prod-meta">
						<span class="osh-prod-cat">
							{categories.find((c) => c.id === p.category_id)?.name ?? 'Uncategorised'}
						</span>
						{#if !p.is_available}<span class="oschip off">Sold out</span>{/if}
					</div>
				</div>

				<div class="osh-prod-actions">
					<!-- Availability is a switch in its own right, not a button wrapper. -->
					<Switch
						checked={p.is_available}
						label={p.is_available ? 'Available' : 'Sold out'}
						onchange={() => toggleAvailable(p)}
					/>
					<button
						class="osh-icon-btn"
						type="button"
						aria-label={`Edit ${p.name}`}
						title="Edit"
						onclick={() => openEdit(p)}
					>
						<Pencil size={15} strokeWidth={1.9} />
					</button>
					<button
						class="osh-icon-btn danger"
						type="button"
						aria-label={`Remove ${p.name}`}
						title="Remove"
						onclick={() => removeProduct(p)}
					>
						<Trash size={15} strokeWidth={1.9} />
					</button>
				</div>
			</div>
		{:else}
			<EmptyState
				title="Nothing here yet"
				description="Add your first item so customers can start ordering."
			>
				{#snippet action()}
					<button class="btn btn-primary" type="button" onclick={() => openAdd(filter || undefined)}>
						<Plus size={15} strokeWidth={2.2} /> Add item
					</button>
				{/snippet}
			</EmptyState>
		{/each}
	</div>
{/if}

<!-- ---------- Add / edit dialog ---------- -->
<Modal bind:open={dialogOpen} title={editing ? 'Edit item' : 'Add item'}>
	<form
		class="osh-form"
		onsubmit={(e) => {
			e.preventDefault();
			void saveProduct();
		}}
	>
		<FormField label="Item name" htmlFor="p-name" required>
			<TextInput
				id="p-name"
				bind:value={formName}
				placeholder="Steamed Momo"
				autocomplete="off"
			/>
		</FormField>

		<FormField label="Price" htmlFor="p-price" required>
			<TextInput
				id="p-price"
				type="number"
				min="0"
				step="0.5"
				inputmode="decimal"
				bind:value={formPrice}
				placeholder="80"
			/>
		</FormField>

		<FormField label="Category" htmlFor="p-cat" required>
			<SelectField
				id="p-cat"
				bind:value={formCategory}
				options={categories.map((c) => ({ value: c.id, label: c.name }))}
			/>
		</FormField>

		<FormField label="Description" htmlFor="p-desc" hint="Optional — shown under the name.">
			<TextArea id="p-desc" rows={2} bind:value={formDescription} />
		</FormField>

		<Switch
			bind:checked={formAvailable}
			label="Available to order"
			hint="Turn off to mark it sold out without deleting it."
		/>

		{#if formError}
			<p class="err" style="margin:0;">{formError}</p>
		{/if}

		<div class="osh-form-actions">
			<button class="btn btn-ghost" type="button" onclick={() => (dialogOpen = false)}>
				<X size={15} strokeWidth={2} /> Cancel
			</button>
			<button class="btn btn-primary" type="submit" disabled={saving}>
				{saving ? 'Saving…' : editing ? 'Save changes' : 'Add item'}
			</button>
		</div>
	</form>
</Modal>

<style>
	.osh-actions-row {
		margin-bottom: 0.75rem;
	}

	.osh-add-item {
		width: 100%;
		min-height: 2.9rem;
		margin-bottom: 0.5rem;
	}

	/* "New category" is secondary, so it collapses out of the way until wanted. */
	.osh-newcat {
		margin-bottom: 0.75rem;
	}

	.osh-newcat-summary {
		list-style: none;
		cursor: pointer;
		-webkit-tap-highlight-color: transparent;
	}

	.osh-newcat-summary::-webkit-details-marker {
		display: none;
	}

	.osh-newcat[open] .osh-newcat-summary {
		margin-bottom: 0.4rem;
	}

	.osh-inline-form {
		display: flex;
		gap: 0.4rem;
		flex: 1;
		min-width: 0;
	}

	.osh-inline-form .input {
		flex: 1;
		min-width: 0;
	}

	.osh-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.osh-prod {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.7rem 0.75rem;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		min-width: 0;
	}

	.osh-prod.off {
		opacity: 0.66;
	}

	.osh-prod-main {
		flex: 1;
		min-width: 0;
	}

	.osh-prod-top {
		display: flex;
		align-items: baseline;
		gap: 0.6rem;
	}

	.osh-prod-name {
		font-size: 0.92rem;
		font-weight: 650;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		min-width: 0;
	}

	.osh-prod-price {
		margin-left: auto;
		flex: none;
		display: inline-flex;
		align-items: center;
		gap: 0.1rem;
		font-weight: 700;
		font-size: 0.9rem;
		font-variant-numeric: tabular-nums;
	}

	.osh-prod-desc {
		margin: 0.15rem 0 0;
		font-size: 0.78rem;
		color: var(--text-3);
		line-height: 1.4;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.osh-prod-meta {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		margin-top: 0.3rem;
		flex-wrap: wrap;
	}

	.osh-prod-cat {
		font-size: 0.7rem;
		color: var(--text-3);
		background: var(--surface-3);
		padding: 0.1rem 0.4rem;
		border-radius: 999px;
	}

	.osh-prod-actions {
		flex: none;
		display: flex;
		align-items: center;
		gap: 0.15rem;
	}

	.osh-icon-btn {
		width: 2.25rem;
		height: 2.25rem;
		display: grid;
		place-items: center;
		border: 1px solid transparent;
		border-radius: 9px;
		background: none;
		color: var(--text-3);
		cursor: pointer;
		-webkit-tap-highlight-color: transparent;
		transition: all var(--tr);
	}

	.osh-icon-btn:hover {
		background: var(--surface-3);
		color: var(--text);
	}

	.osh-icon-btn.danger:hover {
		color: var(--danger);
		background: var(--danger-bg);
	}

	/* The Switch renders label text after the track; in a dense row we only
	   want the track, so the text is hidden here rather than passed as "". */
	.osh-prod-actions :global(.switch) {
		margin: 0;
		gap: 0;
	}

	.osh-prod-actions :global(.switch > span:last-child) {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}

	.osh-form {
		display: flex;
		flex-direction: column;
		gap: 0.8rem;
	}

	.osh-form-actions {
		display: flex;
		gap: 0.5rem;
		margin-top: 0.25rem;
	}

	.osh-form-actions .btn {
		flex: 1;
		min-height: 2.75rem;
	}

	@media (min-width: 700px) {
		/* Side by side once there is room, so the list starts higher up. */
		.osh-actions-row {
			display: flex;
			gap: 0.5rem;
			align-items: flex-start;
		}

		.osh-add-item {
			width: auto;
			min-width: 9rem;
			margin-bottom: 0;
		}

		.osh-newcat {
			flex: 1;
			margin-bottom: 0;
		}

		.osh-list {
			display: grid;
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}
</style>
