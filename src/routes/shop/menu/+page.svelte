<script lang="ts">
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { Eye, Plus, Search } from '@lucide/svelte/icons';
	import ConfirmDialog from '$lib/components/admin/ConfirmDialog.svelte';
	import ErrorState from '$lib/components/admin/ErrorState.svelte';
	import Modal from '$lib/components/admin/Modal.svelte';
	import Reveal from '$lib/components/admin/Reveal.svelte';
	import SelectField from '$lib/components/admin/SelectField.svelte';
	import Skeleton from '$lib/components/admin/Skeleton.svelte';
	import SlideOver from '$lib/components/admin/SlideOver.svelte';
	import { toast } from '$lib/components/admin/toast';
	import CategoryForm from '$lib/components/menu/CategoryForm.svelte';
	import CategoryTabs from '$lib/components/menu/CategoryTabs.svelte';
	import EmptyState from '$lib/components/menu/EmptyState.svelte';
	import ProductForm from '$lib/components/menu/ProductForm.svelte';
	import ProductList from '$lib/components/menu/ProductList.svelte';
	import {
		getMenuSnapshot,
		loadMenuSnapshot
	} from '$lib/tenant/menuCache.svelte';
	import {
		menuApi,
		productHasOptions,
		type CategoryInput,
		type MenuCategory,
		type MenuProduct,
		type ProductInput
	} from '$lib/tenant/menu';
	import { terms } from '$lib/tenant/businessType.svelte';

	// Every noun on this screen belongs to the business, not to us. A grocer
	// manages aisles of products; a hotel manages departments of services.
	// The data model is the same either way — only the words change.
	const t = $derived(terms());

	const seed = getMenuSnapshot();
	let categories = $state<MenuCategory[]>(seed?.categories ?? []);
	let products = $state<MenuProduct[]>(seed?.products ?? []);
	let currency = $state(seed?.currency ?? 'INR');
	let currencySymbol = $state(seed?.currencySymbol ?? '₹');
	let error = $state('');
	let loading = $state(!seed);
	let saving = $state(false);

	let filter = $state('');
	let search = $state('');
	/**
	 * Seeded from the URL so a link can point at a real view rather than just
	 * at the screen. A grocer's "what is out of stock" shortcut is the same
	 * catalogue with one filter applied — worth a link, not a second page.
	 */
	let availabilityFilter = $state<'all' | 'available' | 'unavailable'>(
		availabilityFromUrl($page.url.searchParams.get('availability'))
	);

	function availabilityFromUrl(raw: string | null): 'all' | 'available' | 'unavailable' {
		return raw === 'available' || raw === 'unavailable' ? raw : 'all';
	}
	let featuredOnly = $state(false);
	let hasOptionsOnly = $state(false);
	let sortBy = $state<'order' | 'name' | 'price' | 'category' | 'updated'>('order');
	let filtersOpen = $state(false);

	let productOpen = $state(false);
	let editingProduct = $state<MenuProduct | null>(null);
	let preselectCategoryId = $state('');

	let categoryOpen = $state(false);
	let editingCategory = $state<MenuCategory | null>(null);

	let deleteProductTarget = $state<MenuProduct | null>(null);
	let deleteProductOpen = $state(false);
	let deleteBusy = $state(false);

	let deleteCategoryOpen = $state(false);
	let deleteCategoryTarget = $state<MenuCategory | null>(null);
	let moveToCategoryId = $state('');
	let categoryDeleteBusy = $state(false);

	let moveProductOpen = $state(false);
	let moveProductTarget = $state<MenuProduct | null>(null);
	let moveTargetId = $state('');
	let moveBusy = $state(false);

	const availableCount = $derived(products.filter((p) => p.is_available).length);
	const unavailableCount = $derived(products.length - availableCount);
	const categoryCounts = $derived.by(() => {
		const counts: Record<string, number> = {};
		for (const p of products) {
			counts[p.category_id] = (counts[p.category_id] ?? 0) + 1;
		}
		return counts;
	});

	const shown = $derived.by(() => {
		let list = [...products];
		if (filter) list = list.filter((p) => p.category_id === filter);
		const q = search.trim().toLowerCase();
		if (q) {
			list = list.filter(
				(p) =>
					p.name.toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q)
			);
		}
		if (availabilityFilter === 'available') list = list.filter((p) => p.is_available);
		if (availabilityFilter === 'unavailable') list = list.filter((p) => !p.is_available);
		if (featuredOnly) list = list.filter((p) => p.is_featured);
		if (hasOptionsOnly) list = list.filter((p) => productHasOptions(p));

		const catName = (id: string) => categories.find((c) => c.id === id)?.name ?? '';
		list.sort((a, b) => {
			switch (sortBy) {
				case 'name':
					return a.name.localeCompare(b.name);
				case 'price':
					return Number(a.price) - Number(b.price);
				case 'category':
					return (
						catName(a.category_id).localeCompare(catName(b.category_id)) ||
						a.name.localeCompare(b.name)
					);
				case 'updated':
					return (b.updated_at || '').localeCompare(a.updated_at || '');
				default:
					return a.sort_order - b.sort_order || a.name.localeCompare(b.name);
			}
		});
		return list;
	});

	function catLabel(id: string) {
		return categories.find((c) => c.id === id)?.name ?? 'Uncategorised';
	}

	function patchPayload(p: MenuProduct, overrides: Partial<ProductInput> = {}): ProductInput {
		return {
			category_id: p.category_id,
			name: p.name,
			description: p.description,
			price: Number(p.price),
			image_url: p.image_url ?? null,
			is_available: p.is_available,
			is_vegetarian: p.is_vegetarian,
			is_featured: p.is_featured,
			is_popular: p.is_popular,
			allow_special_instructions: p.allow_special_instructions,
			...overrides
		};
	}

	async function load() {
		const snap = await loadMenuSnapshot(true);
		categories = snap.categories;
		products = snap.products;
		currency = snap.currency;
		currencySymbol = snap.currencySymbol;
	}

	onMount(() => {
		let cancelled = false;
		(async () => {
			try {
				const snap = await loadMenuSnapshot(Boolean(getMenuSnapshot()));
				if (cancelled) return;
				categories = snap.categories;
				products = snap.products;
				currency = snap.currency;
				currencySymbol = snap.currencySymbol;
			} catch (err) {
				if (!cancelled && categories.length === 0) {
					error = err instanceof Error ? err.message : 'Failed to load menu';
				}
			} finally {
				if (!cancelled) loading = false;
			}
		})();
		return () => {
			cancelled = true;
		};
	});

	function openAddProduct(catId?: string) {
		editingProduct = null;
		preselectCategoryId = catId || filter || '';
		productOpen = true;
	}

	function openEditProduct(p: MenuProduct) {
		editingProduct = p;
		preselectCategoryId = p.category_id;
		productOpen = true;
	}

	async function saveProduct(data: ProductInput) {
		saving = true;
		try {
			if (editingProduct) {
				await menuApi.updateProduct(editingProduct.id, data);
				toast.success(`${data.name} updated`);
			} else {
				await menuApi.createProduct(data);
				toast.success(`${data.name} added`);
			}
			productOpen = false;
			await load();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Could not save');
		} finally {
			saving = false;
		}
	}

	async function toggleAvailable(p: MenuProduct) {
		const next = !p.is_available;
		products = products.map((x) => (x.id === p.id ? { ...x, is_available: next } : x));
		try {
			await menuApi.updateProduct(p.id, patchPayload(p, { is_available: next }));
		} catch (err) {
			products = products.map((x) => (x.id === p.id ? { ...x, is_available: !next } : x));
			toast.error(err instanceof Error ? err.message : 'Could not update');
		}
	}

	function requestDeleteProduct(p: MenuProduct) {
		deleteProductTarget = p;
		deleteProductOpen = true;
	}

	async function confirmDeleteProduct() {
		if (!deleteProductTarget) return;
		deleteBusy = true;
		try {
			await menuApi.deleteProduct(deleteProductTarget.id);
			toast.success(`${deleteProductTarget.name} removed`);
			deleteProductOpen = false;
			deleteProductTarget = null;
			await load();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Could not remove');
		} finally {
			deleteBusy = false;
		}
	}

	async function duplicateProduct(p: MenuProduct) {
		try {
			const copy = await menuApi.duplicateProduct(p.id);
			toast.success(`Duplicated as ${copy.name}`);
			await load();
			openEditProduct(copy);
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Could not duplicate');
		}
	}

	function openMoveProduct(p: MenuProduct) {
		moveProductTarget = p;
		moveTargetId = categories.find((c) => c.id !== p.category_id)?.id ?? '';
		moveProductOpen = true;
	}

	async function confirmMoveProduct() {
		if (!moveProductTarget || !moveTargetId) return;
		moveBusy = true;
		try {
			await menuApi.updateProduct(
				moveProductTarget.id,
				patchPayload(moveProductTarget, { category_id: moveTargetId })
			);
			toast.success(`Moved ${moveProductTarget.name}`);
			moveProductOpen = false;
			moveProductTarget = null;
			await load();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Could not move');
		} finally {
			moveBusy = false;
		}
	}

	async function reorderProduct(p: MenuProduct, direction: -1 | 1) {
		const siblings = products
			.filter((x) => x.category_id === p.category_id)
			.sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
		const idx = siblings.findIndex((x) => x.id === p.id);
		const swap = idx + direction;
		if (idx < 0 || swap < 0 || swap >= siblings.length) return;
		const ids = siblings.map((x) => x.id);
		[ids[idx], ids[swap]] = [ids[swap], ids[idx]];
		const byCat = new Map<string, string[]>();
		for (const c of categories) byCat.set(c.id, []);
		for (const prod of [...products].sort((a, b) => a.sort_order - b.sort_order)) {
			if (prod.category_id === p.category_id) continue;
			const arr = byCat.get(prod.category_id) ?? [];
			arr.push(prod.id);
			byCat.set(prod.category_id, arr);
		}
		byCat.set(p.category_id, ids);
		const ordered: string[] = [];
		for (const c of categories) ordered.push(...(byCat.get(c.id) ?? []));
		for (const prod of products) {
			if (!ordered.includes(prod.id)) ordered.push(prod.id);
		}
		try {
			await menuApi.reorderProducts(ordered);
			await load();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Could not reorder');
		}
	}

	function openAddCategory() {
		editingCategory = null;
		categoryOpen = true;
	}

	function openEditCategory(c: MenuCategory) {
		editingCategory = c;
		categoryOpen = true;
	}

	async function saveCategory(data: CategoryInput) {
		saving = true;
		try {
			if (editingCategory) {
				await menuApi.updateCategory(editingCategory.id, data);
				toast.success(`${data.name} updated`);
			} else {
				await menuApi.createCategory(data);
				toast.success(`${data.name} created`);
			}
			categoryOpen = false;
			await load();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Could not save category');
		} finally {
			saving = false;
		}
	}

	function requestDeleteCategory(id: string) {
		const c = categories.find((x) => x.id === id);
		if (!c) return;
		deleteCategoryTarget = c;
		moveToCategoryId = categories.find((x) => x.id !== id)?.id ?? '';
		deleteCategoryOpen = true;
	}

	async function confirmDeleteCategory() {
		if (!deleteCategoryTarget) return;
		const count = categoryCounts[deleteCategoryTarget.id] ?? 0;
		categoryDeleteBusy = true;
		try {
			if (count > 0) {
				if (!moveToCategoryId) {
					toast.error('Choose a category to move products into');
					return;
				}
				await menuApi.deleteCategory(deleteCategoryTarget.id, moveToCategoryId);
			} else {
				await menuApi.deleteCategory(deleteCategoryTarget.id);
			}
			toast.success(`${deleteCategoryTarget.name} deleted`);
			if (filter === deleteCategoryTarget.id) filter = '';
			deleteCategoryOpen = false;
			deleteCategoryTarget = null;
			await load();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Could not delete category');
		} finally {
			categoryDeleteBusy = false;
		}
	}

	async function toggleCategoryActive(c: MenuCategory) {
		try {
			await menuApi.updateCategory(c.id, {
				name: c.name,
				description: c.description,
				is_active: !c.is_active,
				image_url: c.image_url ?? null
			});
			await load();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Could not update category');
		}
	}

	async function reorderCategory(c: MenuCategory, direction: -1 | 1) {
		const ordered = [...categories].sort(
			(a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)
		);
		const idx = ordered.findIndex((x) => x.id === c.id);
		const swap = idx + direction;
		if (idx < 0 || swap < 0 || swap >= ordered.length) return;
		const ids = ordered.map((x) => x.id);
		[ids[idx], ids[swap]] = [ids[swap], ids[idx]];
		try {
			await menuApi.reorderCategories(ids);
			await load();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Could not reorder');
		}
	}

	const deleteCategoryProductCount = $derived(
		deleteCategoryTarget ? (categoryCounts[deleteCategoryTarget.id] ?? 0) : 0
	);
</script>

<div class="menu-page">
	<header class="menu-header">
		<div>
			<h1 class="menu-title">{t.catalog}</h1>
			<p class="menu-sub">Manage what customers can order</p>
		</div>
		<div class="menu-header-actions">
			<a class="btn btn-ghost" href="/shop/storefront/launch">
				<Eye size={15} strokeWidth={2} /> Preview Store
			</a>
			<button class="btn btn-ghost" type="button" onclick={openAddCategory}>
				<Plus size={15} strokeWidth={2.2} /> Add {t.group.toLowerCase()}
			</button>
			<button
				class="btn btn-primary"
				type="button"
				onclick={() => openAddProduct()}
				disabled={categories.length === 0}
			>
				<Plus size={15} strokeWidth={2.2} /> Add {t.item.toLowerCase()}
			</button>
		</div>
	</header>

	{#if error}
		<ErrorState message={error} onretry={() => location.reload()} />
	{/if}

	{#if loading}
		<div class="osstats menu-stats">
			{#each [1, 2, 3, 4] as _, i (i)}
				<div class="osstat"><Skeleton height="2.2rem" /></div>
			{/each}
		</div>
	{:else if !error}
		<div class="osstats menu-stats">
			<div class="osstat accent">
				<div class="osstat-label">Total {t.items.toLowerCase()}</div>
				<p class="osstat-value">{products.length}</p>
			</div>
			<div class="osstat">
				<div class="osstat-label">Active {t.items.toLowerCase()}</div>
				<p class="osstat-value">{availableCount}</p>
			</div>
			<div class="osstat">
				<div class="osstat-label">{t.groups}</div>
				<p class="osstat-value">{categories.length}</p>
			</div>
			<div class="osstat">
				<div class="osstat-label">Unavailable {t.items.toLowerCase()}</div>
				<p class="osstat-value">{unavailableCount}</p>
			</div>
		</div>
	{/if}

	{#if !loading && !error && categories.length === 0}
		<Reveal class="panel" delay={60}>
			<EmptyState
				title={`Your ${t.catalog.toLowerCase()} is empty`}
				description={`Create your first ${t.group.toLowerCase()} and start adding ${t.items.toLowerCase()}.`}
				hint={`${t.groups} help customers browse your ${t.items.toLowerCase()}`}
			>
				{#snippet action()}
					<button class="btn btn-primary" type="button" onclick={openAddCategory}>
						+ Create {t.group.toLowerCase()}
					</button>
				{/snippet}
			</EmptyState>
		</Reveal>
	{:else if !loading && !error}
		<section class="cat-section panel">
			<div
				class="panel-h"
				style="display:flex;align-items:center;justify-content:space-between;gap:0.75rem;flex-wrap:wrap;"
			>
				<div>
					<h2 style="margin:0;font-size:var(--fs-title);">{t.groups}</h2>
					<p class="panel-note" style="margin:0.15rem 0 0;">
						Organize {t.items.toLowerCase()} and control display order
					</p>
				</div>
				<button class="btn btn-ghost btn-sm" type="button" onclick={openAddCategory}>
					<Plus size={14} /> Add
				</button>
			</div>
			<div class="cat-manage">
				{#each [...categories].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)) as c (c.id)}
					<div class="cat-row" class:inactive={!c.is_active}>
						<div class="cat-row-main">
							<span class="cat-name">{c.name}</span>
							<span class="cat-count">{categoryCounts[c.id] ?? 0} products</span>
							{#if !c.is_active}<span class="badge badge-neutral">Hidden</span>{/if}
						</div>
						<div class="cat-row-actions">
							<button
								type="button"
								class="icon-btn"
								aria-label="Move up"
								onclick={() => reorderCategory(c, -1)}>↑</button
							>
							<button
								type="button"
								class="icon-btn"
								aria-label="Move down"
								onclick={() => reorderCategory(c, 1)}>↓</button
							>
							<button type="button" class="btn btn-quiet btn-sm" onclick={() => toggleCategoryActive(c)}>
								{c.is_active ? 'Hide' : 'Show'}
							</button>
							<button type="button" class="btn btn-quiet btn-sm" onclick={() => openEditCategory(c)}
								>Edit</button
							>
							<button
								type="button"
								class="btn btn-quiet btn-sm"
								style="color:var(--danger);"
								onclick={() => requestDeleteCategory(c.id)}
							>
								Delete
							</button>
						</div>
					</div>
				{/each}
			</div>
		</section>

		<CategoryTabs
			{categories}
			counts={categoryCounts}
			active={filter}
			onselect={(id: string) => (filter = id)}
			onadd={openAddCategory}
			ondelete={(id: string) => requestDeleteCategory(id)}
		/>

		<div class="toolbar">
			<div class="search-wrap">
				<span class="search-ico"><Search size={15} strokeWidth={1.9} /></span>
				<input class="input" type="search" placeholder="Search products…" bind:value={search} />
			</div>
			<button
				type="button"
				class="btn btn-ghost btn-sm filters-toggle"
				onclick={() => (filtersOpen = !filtersOpen)}
			>
				Filters
			</button>
			<div class="toolbar-filters" class:open={filtersOpen}>
				<select class="input" bind:value={availabilityFilter} aria-label="Availability">
					<option value="all">All status</option>
					<option value="available">Available</option>
					<option value="unavailable">Unavailable</option>
				</select>
				<select class="input" bind:value={sortBy} aria-label="Sort">
					<option value="order">Display order</option>
					<option value="name">Name</option>
					<option value="price">Price</option>
					<option value="category">{t.group}</option>
					<option value="updated">Recently updated</option>
				</select>
				<label class="chip-filter">
					<input type="checkbox" bind:checked={featuredOnly} /> Featured
				</label>
				<label class="chip-filter">
					<input type="checkbox" bind:checked={hasOptionsOnly} /> Has options
				</label>
			</div>
		</div>

		{#if shown.length === 0}
			<EmptyState
				title={products.length === 0 ? 'No products yet' : 'No matching products'}
				description={products.length === 0
					? 'Add your first product so customers can start ordering.'
					: 'Try a different search or clear filters.'}
			>
				{#snippet action()}
					{#if products.length === 0}
						<button
							class="btn btn-primary"
							type="button"
							onclick={() => openAddProduct(filter || undefined)}
						>
							+ Add {t.item.toLowerCase()}
						</button>
					{/if}
				{/snippet}
			</EmptyState>
		{:else}
			<ProductList
				products={shown}
				categoryName={catLabel}
				{currency}
				onedit={openEditProduct}
				ondelete={requestDeleteProduct}
				ontoggle={toggleAvailable}
				onduplicate={duplicateProduct}
				onmove={openMoveProduct}
				onreorder={reorderProduct}
			/>
		{/if}
	{/if}
</div>

<SlideOver bind:open={productOpen} title={editingProduct ? `Edit ${t.item.toLowerCase()}` : `Add ${t.item.toLowerCase()}`}>
	{#if productOpen}
		<ProductForm
			{categories}
			editing={editingProduct}
			{preselectCategoryId}
			{saving}
			{currencySymbol}
			onclose={() => (productOpen = false)}
			onsave={saveProduct}
		/>
	{/if}
</SlideOver>

<SlideOver bind:open={categoryOpen} title={editingCategory ? `Edit ${t.group.toLowerCase()}` : `Add ${t.group.toLowerCase()}`}>
	{#if categoryOpen}
		<CategoryForm
			editing={editingCategory}
			{saving}
			onclose={() => (categoryOpen = false)}
			onsave={saveCategory}
		/>
	{/if}
</SlideOver>

<ConfirmDialog
	bind:open={deleteProductOpen}
	title="Delete product?"
	message={deleteProductTarget
		? `Delete “${deleteProductTarget.name}”? This cannot be undone.`
		: ''}
	confirmLabel="Delete"
	danger
	loading={deleteBusy}
	onconfirm={confirmDeleteProduct}
/>

<Modal bind:open={deleteCategoryOpen} title={`Delete ${t.group.toLowerCase()}?`}>
	{#if deleteCategoryTarget}
		{#if deleteCategoryProductCount > 0}
			<p>
				This {t.group.toLowerCase()} contains <strong>{deleteCategoryProductCount}</strong>
				{deleteCategoryProductCount === 1 ? t.item.toLowerCase() : t.items.toLowerCase()}.
			</p>
			<p class="panel-note">Move them to another {t.group.toLowerCase()} before deleting.</p>
			<div class="field" style="margin-top:0.75rem;">
				<label class="field-label" for="move-cat">Move {t.items.toLowerCase()} to</label>
				<SelectField
					id="move-cat"
					bind:value={moveToCategoryId}
					options={categories
						.filter((c) => c.id !== deleteCategoryTarget?.id)
						.map((c) => ({ value: c.id, label: c.name }))}
				/>
			</div>
		{:else}
			<p>Delete “{deleteCategoryTarget.name}”? This cannot be undone.</p>
		{/if}
	{/if}
	{#snippet footer()}
		<button
			type="button"
			class="btn btn-ghost"
			onclick={() => (deleteCategoryOpen = false)}
			disabled={categoryDeleteBusy}
		>
			Cancel
		</button>
		<button
			type="button"
			class="btn btn-danger"
			onclick={confirmDeleteCategory}
			disabled={categoryDeleteBusy ||
				(deleteCategoryProductCount > 0 && !moveToCategoryId)}
		>
			{categoryDeleteBusy
				? 'Working…'
				: deleteCategoryProductCount > 0
					? 'Move & Delete'
					: 'Delete'}
		</button>
	{/snippet}
</Modal>

<Modal bind:open={moveProductOpen} title={`Move ${t.group.toLowerCase()}`}>
	{#if moveProductTarget}
		<p>Move “{moveProductTarget.name}” to another {t.group.toLowerCase()}.</p>
		<div class="field" style="margin-top:0.75rem;">
			<label class="field-label" for="move-prod-cat">{t.group}</label>
			<SelectField
				id="move-prod-cat"
				bind:value={moveTargetId}
				options={categories
					.filter((c) => c.id !== moveProductTarget?.category_id)
					.map((c) => ({ value: c.id, label: c.name }))}
			/>
		</div>
	{/if}
	{#snippet footer()}
		<button
			type="button"
			class="btn btn-ghost"
			onclick={() => (moveProductOpen = false)}
			disabled={moveBusy}
		>
			Cancel
		</button>
		<button
			type="button"
			class="btn btn-primary"
			onclick={confirmMoveProduct}
			disabled={moveBusy || !moveTargetId}
		>
			{moveBusy ? 'Moving…' : 'Move'}
		</button>
	{/snippet}
</Modal>

<style>
	.menu-page {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	.menu-header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
		flex-wrap: wrap;
	}
	.menu-title {
		margin: 0;
		font-size: var(--fs-h1);
		font-weight: 700;
	}
	.menu-sub {
		margin: 0.2rem 0 0;
		color: var(--text-3);
		font-size: var(--fs-body);
	}
	.menu-header-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}
	.menu-stats {
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}
	.cat-section {
		padding: 0.85rem 1rem 1rem;
	}
	.cat-manage {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}
	.cat-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		padding: 0.55rem 0.35rem;
		border-bottom: 1px solid var(--border);
		flex-wrap: wrap;
	}
	.cat-row:last-child {
		border-bottom: none;
	}
	.cat-row.inactive {
		opacity: 0.65;
	}
	.cat-row-main {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
		min-width: 0;
	}
	.cat-name {
		font-weight: 600;
	}
	.cat-count {
		font-size: var(--fs-tab);
		color: var(--text-3);
	}
	.cat-row-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
		align-items: center;
	}
	.icon-btn {
		width: 2rem;
		height: 2rem;
		border: 1px solid var(--border);
		border-radius: 7px;
		background: var(--surface);
		cursor: pointer;
		color: var(--text-2);
	}
	.toolbar {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		align-items: center;
	}
	.search-wrap {
		position: relative;
		flex: 1;
		min-width: 10rem;
	}
	.search-ico {
		position: absolute;
		left: 0.65rem;
		top: 50%;
		transform: translateY(-50%);
		color: var(--text-3);
		pointer-events: none;
		display: inline-flex;
	}
	.search-wrap .input {
		padding-left: 2.1rem;
		width: 100%;
	}
	.toolbar-filters {
		display: none;
		flex-wrap: wrap;
		gap: 0.4rem;
		align-items: center;
		width: 100%;
	}
	.toolbar-filters.open {
		display: flex;
	}
	.toolbar-filters .input {
		width: auto;
		min-width: 8rem;
	}
	.chip-filter {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		font-size: var(--fs-body);
		color: var(--text-2);
		padding: 0.35rem 0.55rem;
		border: 1px solid var(--border);
		border-radius: 999px;
		cursor: pointer;
	}
	@media (min-width: 768px) {
		.filters-toggle {
			display: none;
		}
		.toolbar-filters {
			display: flex;
			width: auto;
			flex: 1;
		}
		.menu-stats {
			grid-template-columns: repeat(4, minmax(0, 1fr));
		}
	}
</style>
