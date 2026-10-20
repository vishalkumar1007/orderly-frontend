<script lang="ts">
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import Plus from '@tabler/icons-svelte/icons/plus';
	import Search from '@tabler/icons-svelte/icons/search';
	import LayoutGrid from '@tabler/icons-svelte/icons/layout-grid';
	import ListIcon from '@tabler/icons-svelte/icons/list';
	import Filter from '@tabler/icons-svelte/icons/adjustments-horizontal';
	import ConfirmDialog from '$lib/components/admin/ConfirmDialog.svelte';
	import ErrorState from '$lib/components/admin/ErrorState.svelte';
	import Modal from '$lib/components/admin/Modal.svelte';
	import Reveal from '$lib/components/admin/Reveal.svelte';
	import SelectField from '$lib/components/admin/SelectField.svelte';
	import Skeleton from '$lib/components/admin/Skeleton.svelte';
	import SlideOver from '$lib/components/admin/SlideOver.svelte';
	import { toast } from '$lib/components/admin/toast';
	import CategoryForm from '$lib/components/menu/CategoryForm.svelte';
	import EmptyState from '$lib/components/menu/EmptyState.svelte';
	import ProductForm from '$lib/components/menu/ProductForm.svelte';
	import ProductList, { type MenuAction, type ProductGroup } from '$lib/components/menu/ProductList.svelte';
	import { formatCurrency } from '$lib/admin/format';
	import {
		getMenuSnapshot,
		loadMenuSnapshot,
		setMenuSnapshot
	} from '$lib/tenant/menuCache.svelte';
	import {
		menuApi,
		type CategoryInput,
		type MenuCategory,
		type MenuProduct,
		type ProductInput,
		productHasOptions
	} from '$lib/tenant/menu';
	import { hasBusinessModule, terms } from '$lib/tenant/businessType.svelte';

	// Every noun on this screen belongs to the business, not to us. A grocer
	// manages aisles of products; a hotel manages departments of services.
	// The data model is the same either way: only the words change.
	const t = $derived(terms());

	const seed = getMenuSnapshot();
	let categories = $state<MenuCategory[]>(seed?.categories ?? []);
	let products = $state<MenuProduct[]>(seed?.products ?? []);
	let currency = $state(seed?.currency ?? 'INR');
	let currencySymbol = $state(seed?.currencySymbol ?? '₹');
	let error = $state('');
	let loading = $state(!seed);
	let saving = $state(false);

	/** Category id, or '' for all. */
	let filter = $state('');
	let search = $state('');
	/**
	 * Seeded from the URL so a link can point at a real view rather than just
	 * at the screen. A grocer's "what is out of stock" shortcut is the same
	 * catalogue with one filter applied: worth a link, not a second page.
	 */
	let status = $state<'all' | 'available' | 'unavailable'>(
		statusFromUrl($page.url.searchParams.get('availability'))
	);
	let diet = $state<'all' | 'veg' | 'nonveg'>('all');
	/** Extra filters a busy owner reaches for: what needs attention. */
	let tags = $state({ featured: false, popular: false, options: false, nophoto: false });
	// List or card view, remembered per browser.
	const VIEW_KEY = 'orderly.menu.view';
	let view = $state<'list' | 'grid'>(readView());
	function readView(): 'list' | 'grid' {
		try {
			return localStorage.getItem(VIEW_KEY) === 'grid' ? 'grid' : 'list';
		} catch {
			return 'list';
		}
	}
	function setView(v: 'list' | 'grid') {
		view = v;
		try {
			localStorage.setItem(VIEW_KEY, v);
		} catch {
			/* private mode: the choice just is not remembered */
		}
	}
	let filtersOpen = $state(false);
	let filtersEl = $state<HTMLDetailsElement | null>(null);
	function closeFilters(e: MouseEvent) {
		if (filtersOpen && filtersEl && !filtersEl.contains(e.target as Node)) filtersOpen = false;
	}
	const activeTagCount = $derived(Object.values(tags).filter(Boolean).length);

	let sort = $state<'menu' | 'name' | 'price_asc' | 'price_desc' | 'recent'>('menu');

	const tagFilters = [
		{ key: 'featured', label: 'Featured' },
		{ key: 'popular', label: 'Popular' },
		{ key: 'options', label: 'With options' },
		{ key: 'nophoto', label: 'No photo' }
	] as const;

	function clearFilters() {
		search = '';
		status = 'all';
		diet = 'all';
		filter = '';
		tags = { featured: false, popular: false, options: false, nophoto: false };
		sort = 'menu';
	}

	function statusFromUrl(raw: string | null): 'all' | 'available' | 'unavailable' {
		return raw === 'available' || raw === 'unavailable' ? raw : 'all';
	}

	let selected = $state<string[]>([]);
	let bulkBusy = $state(false);
	let bulkMove = $state('');
	let archiveOpen = $state(false);

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

	const sortedCategories = $derived(
		[...categories].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
	);
	const unavailableCount = $derived(products.filter((p) => !p.is_available).length);
	const categoryCounts = $derived.by(() => {
		const counts: Record<string, number> = {};
		for (const p of products) {
			counts[p.category_id] = (counts[p.category_id] ?? 0) + 1;
		}
		return counts;
	});
	const hiddenCategories = $derived(categories.filter((c) => !c.is_active).length);
	const averagePrice = $derived(
		products.length ? products.reduce((sum, p) => sum + Number(p.price), 0) / products.length : 0
	);

	function categoryActions(id: string): MenuAction[] {
		const i = sortedCategories.findIndex((c) => c.id === id);
		const c = sortedCategories[i];
		if (!c) return [];
		return [
			{ label: `Rename or edit`, onclick: () => openEditCategory(c) },
			{
				label: c.is_active ? 'Hide from customers' : 'Show to customers',
				onclick: () => toggleCategoryActive(c)
			},
			{ label: 'Move up', onclick: () => reorderCategory(c, -1), disabled: i === 0, separatorBefore: true },
			{
				label: 'Move down',
				onclick: () => reorderCategory(c, 1),
				disabled: i === sortedCategories.length - 1
			},
			{
				label: `Delete ${t.group.toLowerCase()}`,
				onclick: () => requestDeleteCategory(c.id),
				danger: true,
				separatorBefore: true
			}
		];
	}

	const filtering = $derived(
		search.trim() !== '' ||
			status !== 'all' ||
			diet !== 'all' ||
			Object.values(tags).some(Boolean)
	);

	const groups = $derived.by<ProductGroup[]>(() => {
		const q = search.trim().toLowerCase();
		const match = (p: MenuProduct) =>
			(!q ||
				p.name.toLowerCase().includes(q) ||
				(p.description || '').toLowerCase().includes(q)) &&
			(status === 'all' || p.is_available === (status === 'available')) &&
			(diet === 'all' || p.is_vegetarian === (diet === 'veg')) &&
			(!tags.featured || p.is_featured) &&
			(!tags.popular || p.is_popular) &&
			(!tags.options || productHasOptions(p)) &&
			(!tags.nophoto || !p.image_url);
		const order = (a: MenuProduct, b: MenuProduct) => {
			switch (sort) {
				case 'name':
					return a.name.localeCompare(b.name);
				case 'price_asc':
					return Number(a.price) - Number(b.price);
				case 'price_desc':
					return Number(b.price) - Number(a.price);
				case 'recent':
					return (b.updated_at ?? '').localeCompare(a.updated_at ?? '');
				default:
					return a.sort_order - b.sort_order || a.name.localeCompare(b.name);
			}
		};
		return sortedCategories
			.filter((c) => !filter || c.id === filter)
			.map((c) => ({
				id: c.id,
				name: c.name,
				active: c.is_active,
				products: products
					.filter((p) => p.category_id === c.id && match(p))
					.sort(order)
			}))
			// While filtering, hide empty groups; otherwise keep them for quick add.
			.filter((g) => !filtering || g.products.length > 0);
	});

	const shownCount = $derived(groups.reduce((n, g) => n + g.products.length, 0));

	/** Keep local state and the shared cache in step after every patch. */
	function commit() {
		setMenuSnapshot({
			categories: $state.snapshot(categories),
			products: $state.snapshot(products),
			currency,
			currencySymbol
		});
	}

	function replaceProduct(next: MenuProduct) {
		products = products.map((x) => (x.id === next.id ? next : x));
		commit();
	}

	function removeProducts(ids: string[]) {
		products = products.filter((x) => !ids.includes(x.id));
		selected = selected.filter((id) => !ids.includes(id));
		commit();
	}

	function errMsg(err: unknown, fallback: string) {
		return err instanceof Error ? err.message : fallback;
	}

	function apply(snap: Awaited<ReturnType<typeof loadMenuSnapshot>>) {
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
				apply(snap);
			} catch (err) {
				if (!cancelled && categories.length === 0) {
					error = errMsg(err, 'Failed to load menu');
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
				replaceProduct(await menuApi.updateProduct(editingProduct.id, data));
				toast.success(`${data.name} updated`);
			} else {
				const created = await menuApi.createProduct(data);
				products = [...products, created];
				commit();
				toast.success(`${data.name} added`);
			}
			productOpen = false;
		} catch (err) {
			toast.error(errMsg(err, 'Could not save'));
		} finally {
			saving = false;
		}
	}

	async function quickAdd(categoryId: string, name: string, price: number) {
		try {
			const created = await menuApi.createProduct({
				name,
				price,
				category_id: categoryId,
				is_available: true
			});
			products = [...products, created];
			commit();
			return true;
		} catch (err) {
			toast.error(errMsg(err, 'Could not add'));
			return false;
		}
	}

	async function toggleAvailable(p: MenuProduct) {
		const next = !p.is_available;
		const set = (v: boolean) => {
			products = products.map((x) => (x.id === p.id ? { ...x, is_available: v } : x));
			commit();
		};
		set(next);
		try {
			await menuApi.updateProduct(p.id, { is_available: next });
		} catch (err) {
			set(!next);
			toast.error(errMsg(err, 'Could not update'));
		}
	}

	async function toggleFlag(p: MenuProduct, flag: 'is_featured' | 'is_popular') {
		try {
			replaceProduct(await menuApi.updateProduct(p.id, { [flag]: !p[flag] }));
		} catch (err) {
			toast.error(errMsg(err, 'Could not update'));
		}
	}

	async function savePrice(p: MenuProduct, price: number) {
		try {
			replaceProduct(await menuApi.updateProduct(p.id, { price }));
		} catch (err) {
			toast.error(errMsg(err, 'Could not update price'));
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
			const res = await menuApi.deleteProduct(deleteProductTarget.id);
			const name = deleteProductTarget.name;
			removeProducts([deleteProductTarget.id]);
			toast.success(
				res.status === 'archived' ? `${name} archived: it has past orders` : `${name} removed`
			);
			deleteProductOpen = false;
			deleteProductTarget = null;
		} catch (err) {
			toast.error(errMsg(err, 'Could not remove'));
		} finally {
			deleteBusy = false;
		}
	}

	async function duplicateProduct(p: MenuProduct) {
		try {
			const copy = await menuApi.duplicateProduct(p.id);
			products = [...products, copy];
			commit();
			toast.success(`Duplicated as ${copy.name}`);
			openEditProduct(copy);
		} catch (err) {
			toast.error(errMsg(err, 'Could not duplicate'));
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
			replaceProduct(await menuApi.updateProduct(moveProductTarget.id, { category_id: moveTargetId }));
			toast.success(`Moved ${moveProductTarget.name}`);
			moveProductOpen = false;
			moveProductTarget = null;
		} catch (err) {
			toast.error(errMsg(err, 'Could not move'));
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
		const before = products;
		// sort_order is the array index, so only this category's ids are sent.
		products = products.map((x) =>
			x.category_id === p.category_id ? { ...x, sort_order: ids.indexOf(x.id) } : x
		);
		commit();
		try {
			await menuApi.reorderProducts(ids);
		} catch (err) {
			products = before;
			commit();
			toast.error(errMsg(err, 'Could not reorder'));
		}
	}

	async function bulk(action: 'available' | 'unavailable' | 'archive' | 'move', categoryId?: string) {
		const ids = [...selected];
		if (ids.length === 0) return;
		bulkBusy = true;
		try {
			await menuApi.bulkProducts({ ids, action, category_id: categoryId });
			if (action === 'archive') {
				removeProducts(ids);
				toast.success(`${ids.length} archived`);
			} else {
				products = products.map((x) => {
					if (!ids.includes(x.id)) return x;
					if (action === 'move') return { ...x, category_id: categoryId ?? x.category_id };
					return { ...x, is_available: action === 'available' };
				});
				commit();
				selected = [];
				toast.success(`${ids.length} updated`);
			}
		} catch (err) {
			toast.error(errMsg(err, 'Could not update selection'));
		} finally {
			bulkBusy = false;
			bulkMove = '';
			archiveOpen = false;
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
				const updated = await menuApi.updateCategory(editingCategory.id, data);
				categories = categories.map((x) => (x.id === updated.id ? updated : x));
				toast.success(`${data.name} updated`);
			} else {
				const created = await menuApi.createCategory(data);
				categories = [...categories, created];
				toast.success(`${data.name} created`);
			}
			commit();
			categoryOpen = false;
		} catch (err) {
			toast.error(errMsg(err, 'Could not save'));
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
		const target = deleteCategoryTarget;
		if (!target) return;
		const count = categoryCounts[target.id] ?? 0;
		if (count > 0 && !moveToCategoryId) {
			toast.error(`Choose a ${t.group.toLowerCase()} to move ${t.items.toLowerCase()} into`);
			return;
		}
		categoryDeleteBusy = true;
		try {
			await menuApi.deleteCategory(target.id, count > 0 ? moveToCategoryId : undefined);
			categories = categories.filter((x) => x.id !== target.id);
			products =
				count > 0
					? products.map((x) =>
							x.category_id === target.id ? { ...x, category_id: moveToCategoryId } : x
						)
					: products;
			commit();
			toast.success(`${target.name} deleted`);
			if (filter === target.id) filter = '';
			deleteCategoryOpen = false;
			deleteCategoryTarget = null;
		} catch (err) {
			toast.error(errMsg(err, 'Could not delete'));
		} finally {
			categoryDeleteBusy = false;
		}
	}

	async function toggleCategoryActive(c: MenuCategory) {
		const set = (v: boolean) => {
			categories = categories.map((x) => (x.id === c.id ? { ...x, is_active: v } : x));
			commit();
		};
		set(!c.is_active);
		try {
			await menuApi.updateCategory(c.id, { is_active: !c.is_active });
		} catch (err) {
			set(c.is_active);
			toast.error(errMsg(err, 'Could not update'));
		}
	}

	async function reorderCategory(c: MenuCategory, direction: -1 | 1) {
		const ids = sortedCategories.map((x) => x.id);
		const idx = ids.indexOf(c.id);
		const swap = idx + direction;
		if (idx < 0 || swap < 0 || swap >= ids.length) return;
		[ids[idx], ids[swap]] = [ids[swap], ids[idx]];
		const before = categories;
		categories = categories.map((x) => ({ ...x, sort_order: ids.indexOf(x.id) }));
		commit();
		try {
			await menuApi.reorderCategories(ids);
		} catch (err) {
			categories = before;
			commit();
			toast.error(errMsg(err, 'Could not reorder'));
		}
	}

	const deleteCategoryProductCount = $derived(
		deleteCategoryTarget ? (categoryCounts[deleteCategoryTarget.id] ?? 0) : 0
	);
	const statusChips = [
		{ id: 'all', label: 'All' },
		{ id: 'available', label: 'In stock' },
		{ id: 'unavailable', label: 'Sold out' }
	] as const;
</script>

<svelte:window onclick={closeFilters} onkeydown={(e) => e.key === 'Escape' && (filtersOpen = false)} />

<div class="menu-page">
	<header class="menu-header">
		<div>
			<h1 class="menu-title">{t.catalog}</h1>
			<p class="menu-sub">Manage what customers can order</p>
		</div>
		{#if !loading && categories.length > 0}
			<div class="menu-header-actions">
				<button class="btn btn-ghost" type="button" onclick={openAddCategory}>
					<Plus size={15} stroke={1.6} /> Add {t.group.toLowerCase()}
				</button>
				<button class="btn btn-primary" type="button" onclick={() => openAddProduct()}>
					<Plus size={15} stroke={1.6} /> Add {t.item.toLowerCase()}
				</button>
			</div>
		{/if}
	</header>

	{#if error}
		<ErrorState message={error} onretry={() => location.reload()} />
	{/if}

	{#if loading}
		<Skeleton height="18rem" />
	{:else if !error && categories.length === 0}
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
	{:else if !error}
		<dl class="kpis">
			<div class="kpi">
				<dt>{t.items}</dt>
				<dd>{products.length}</dd>
			</div>
			<div class="kpi">
				<dt>Available</dt>
				<dd class="ok">{products.length - unavailableCount}</dd>
			</div>
			<div class="kpi">
				<dt>Sold out</dt>
				<dd class:bad={unavailableCount > 0}>{unavailableCount}</dd>
			</div>
			<div class="kpi">
				<dt>{t.groups}</dt>
				<dd>
					{categories.length}
					{#if hiddenCategories}<small>{hiddenCategories} hidden</small>{/if}
				</dd>
			</div>
			<div class="kpi">
				<dt>Average price</dt>
				<dd>{formatCurrency(averagePrice, currency)}</dd>
			</div>
		</dl>

		<div class="controls">
			<div class="toolbar">
				<div class="search-wrap">
					<span class="search-ico"><Search size={16} stroke={1.6} /></span>
					<label class="sr-only" for="menu-search">Search {t.items.toLowerCase()}</label>
					<input
						id="menu-search"
						class="input"
						type="search"
						placeholder={`Search ${t.items.toLowerCase()}`}
						bind:value={search}
					/>
				</div>
				<div class="seg" role="group" aria-label="Availability">
					{#each statusChips as c (c.id)}
						<button
							type="button"
							class="seg-btn"
							class:active={status === c.id}
							aria-pressed={status === c.id}
							onclick={() => (status = c.id)}
						>
							{c.label}
						</button>
					{/each}
				</div>
				{#if hasBusinessModule('diet_tags')}
					<label class="sr-only" for="menu-diet">Food type</label>
					<select id="menu-diet" class="input sel" bind:value={diet}>
						<option value="all">All types</option>
						<option value="veg">Veg</option>
						<option value="nonveg">Non-veg</option>
					</select>
				{/if}
				<details class="more" bind:open={filtersOpen} bind:this={filtersEl}>
					<summary class="more-btn" class:active={activeTagCount > 0}>
						<Filter size={16} stroke={1.6} /> Filters
						{#if activeTagCount}<span class="more-n">{activeTagCount}</span>{/if}
					</summary>
					<div class="more-pop">
						<p class="more-title">Only show {t.items.toLowerCase()} that are</p>
						{#each tagFilters as f (f.key)}
							<label class="more-opt">
								<input type="checkbox" bind:checked={tags[f.key]} />
								{f.label}
							</label>
						{/each}
						<label class="more-sort" for="menu-sort">Sort by</label>
						<select id="menu-sort" class="input" bind:value={sort}>
							<option value="menu">Menu order</option>
							<option value="name">Name, A to Z</option>
							<option value="price_asc">Price, low to high</option>
							<option value="price_desc">Price, high to low</option>
							<option value="recent">Recently updated</option>
						</select>
					</div>
				</details>
				<div class="view" role="group" aria-label="View">
					<button
						type="button"
						class="view-btn"
						class:active={view === 'list'}
						aria-pressed={view === 'list'}
						aria-label="List view"
						title="List view"
						onclick={() => setView('list')}
					>
						<ListIcon size={17} stroke={1.7} />
					</button>
					<button
						type="button"
						class="view-btn"
						class:active={view === 'grid'}
						aria-pressed={view === 'grid'}
						aria-label="Card view"
						title="Card view"
						onclick={() => setView('grid')}
					>
						<LayoutGrid size={17} stroke={1.7} />
					</button>
				</div>
			</div>

			<div class="subbar">
				<nav class="cats" aria-label={t.groups}>
					<button
						type="button"
						class="cat"
						class:active={filter === ''}
						aria-current={filter === '' ? 'true' : undefined}
						onclick={() => (filter = '')}
					>
						All <span class="cat-n">{products.length}</span>
					</button>
					{#each sortedCategories as c (c.id)}
						<button
							type="button"
							class="cat"
							class:active={filter === c.id}
							class:hidden-cat={!c.is_active}
							aria-current={filter === c.id ? 'true' : undefined}
							onclick={() => (filter = c.id)}
						>
							{c.name} <span class="cat-n">{categoryCounts[c.id] ?? 0}</span>
						</button>
					{/each}
				</nav>
				<span class="result">
					{#if filtering || filter || sort !== 'menu'}
						{shownCount} of {products.length}
						<button type="button" class="clear" onclick={clearFilters}>Clear</button>
					{/if}
				</span>
			</div>
		</div>

		{#if groups.length === 0}
			<div class="list-empty">
				<EmptyState
					title={`No ${t.items.toLowerCase()} match`}
					description="Try another search, or clear the filters above."
				/>
			</div>
		{:else}
			<div class="sections">
				<ProductList
					{groups}
					{view}
					bind:selected
					canReorder={!filtering}
					{currency}
					{currencySymbol}
					{categoryActions}
					onedit={openEditProduct}
					ondelete={requestDeleteProduct}
					ontoggle={toggleAvailable}
					onflag={toggleFlag}
					onduplicate={duplicateProduct}
					onmove={openMoveProduct}
					onreorder={reorderProduct}
					onprice={savePrice}
					onquickadd={quickAdd}
					onmore={(id) => openAddProduct(id)}
				/>
			</div>
		{/if}

		{#if selected.length > 0}
			<div class="bulk" role="region" aria-label="Selected items">
				<strong>{selected.length} selected</strong>
				<button class="btn btn-ghost btn-sm" type="button" disabled={bulkBusy} onclick={() => bulk('available')}>
					Mark in stock
				</button>
				<button class="btn btn-ghost btn-sm" type="button" disabled={bulkBusy} onclick={() => bulk('unavailable')}>
					Mark sold out
				</button>
				<label class="sr-only" for="bulk-move">Move selected to {t.group.toLowerCase()}</label>
				<select
					id="bulk-move"
					class="input bulk-move"
					disabled={bulkBusy}
					bind:value={bulkMove}
					onchange={() => bulkMove && bulk('move', bulkMove)}
				>
					<option value="">Move to…</option>
					{#each sortedCategories as c (c.id)}
						<option value={c.id}>{c.name}</option>
					{/each}
				</select>
				<button class="btn btn-ghost btn-sm bulk-danger" type="button" disabled={bulkBusy} onclick={() => (archiveOpen = true)}>
					Archive
				</button>
				<button class="btn btn-quiet btn-sm" type="button" onclick={() => (selected = [])}>Clear</button>
			</div>
		{/if}
	{/if}
</div>

<SlideOver bind:open={productOpen} title={editingProduct ? `Edit ${t.item.toLowerCase()}` : `Add ${t.item.toLowerCase()}`}>
	{#if productOpen}
		{#key editingProduct?.id ?? 'new'}
			<ProductForm
				{categories}
				editing={editingProduct}
				{preselectCategoryId}
				{saving}
				{currencySymbol}
				onclose={() => (productOpen = false)}
				onsave={saveProduct}
			/>
		{/key}
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
	title={`Delete ${t.item.toLowerCase()}?`}
	message={deleteProductTarget
		? `Delete “${deleteProductTarget.name}”? If it has past orders it is archived instead.`
		: ''}
	confirmLabel="Delete"
	danger
	loading={deleteBusy}
	onconfirm={confirmDeleteProduct}
/>

<ConfirmDialog
	bind:open={archiveOpen}
	title={`Archive ${selected.length} ${t.items.toLowerCase()}?`}
	message="They will no longer appear on your storefront."
	confirmLabel="Archive"
	danger
	loading={bulkBusy}
	onconfirm={() => bulk('archive')}
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
			disabled={categoryDeleteBusy || (deleteCategoryProductCount > 0 && !moveToCategoryId)}
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
		gap: 1.1rem;
		padding-bottom: 2rem;
	}
	.menu-header {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 1rem;
		flex-wrap: wrap;
	}
	.menu-title {
		margin: 0;
		font-size: var(--fs-h1);
		font-weight: 700;
		letter-spacing: -0.015em;
	}
	.menu-sub {
		margin: 0.3rem 0 0;
		color: var(--text-3);
		font-size: var(--fs-body);
	}
	.menu-header-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.6rem;
	}
	.menu-header-actions :global(.btn) {
		height: 2.5rem;
		padding: 0 1rem;
	}

	/* Summary: one slim strip, not a wall of boxes. */
	.kpis {
		display: grid;
		grid-template-columns: repeat(5, minmax(0, 1fr));
		margin: 0;
		border: 1px solid var(--border);
		border-radius: 12px;
		background: var(--surface);
	}
	.kpi {
		padding: 0.7rem 1rem;
		min-width: 0;
	}
	.kpi + .kpi {
		border-left: 1px solid var(--border);
	}
	.kpi dt {
		font-size: var(--fs-tab);
		color: var(--text-3);
	}
	.kpi dd {
		margin: 0.15rem 0 0;
		font-size: 1.25rem;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}
	.kpi dd small {
		margin-left: 0.3rem;
		font-size: var(--fs-micro);
		font-weight: 500;
		color: var(--text-3);
	}
	.kpi dd.ok {
		color: #16a34a;
	}
	.kpi dd.bad {
		color: var(--danger);
	}

	.controls {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
	.toolbar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
	}
	.search-wrap {
		position: relative;
		flex: 1 1 16rem;
		min-width: 0;
	}
	.search-ico {
		position: absolute;
		left: 0.75rem;
		top: 50%;
		transform: translateY(-50%);
		color: var(--text-3);
		pointer-events: none;
		display: inline-flex;
	}
	.search-wrap .input {
		width: 100%;
		height: 2.375rem;
		padding-left: 2.3rem;
	}
	.seg,
	.view {
		display: inline-flex;
		height: 2.375rem;
		padding: 3px;
		border: 1px solid var(--border);
		border-radius: 9px;
		background: var(--surface);
	}
	.seg-btn,
	.view-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0 0.8rem;
		border: none;
		border-radius: 6px;
		background: transparent;
		color: var(--text-3);
		font: inherit;
		font-size: var(--fs-body);
		font-weight: 550;
		cursor: pointer;
	}
	.view-btn {
		width: 2.1rem;
		padding: 0;
	}
	.seg-btn:hover,
	.view-btn:hover {
		color: var(--text);
	}
	.seg-btn.active,
	.view-btn.active {
		background: var(--surface-2);
		color: var(--text);
		box-shadow: inset 0 0 0 1px var(--border);
	}
	.sel {
		width: auto;
		height: 2.375rem;
		padding-top: 0;
		padding-bottom: 0;
	}
	.more {
		position: relative;
	}
	.more-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		height: 2.375rem;
		padding: 0 0.85rem;
		border: 1px solid var(--border);
		border-radius: 9px;
		background: var(--surface);
		color: var(--text-2);
		font-size: var(--fs-body);
		font-weight: 550;
		list-style: none;
		cursor: pointer;
		user-select: none;
	}
	.more-btn::-webkit-details-marker {
		display: none;
	}
	.more-btn:hover,
	.more[open] .more-btn {
		color: var(--text);
		background: var(--surface-2);
	}
	.more-btn.active {
		border-color: var(--accent);
		color: var(--accent-dark);
	}
	.more-n {
		min-width: 1.2rem;
		padding: 0 0.3rem;
		border-radius: 999px;
		background: var(--accent);
		color: #fff;
		font-size: var(--fs-micro);
		line-height: 1.2rem;
		text-align: center;
	}
	.more-pop {
		position: absolute;
		right: 0;
		top: calc(100% + 0.4rem);
		z-index: 20;
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		width: 15rem;
		padding: 0.75rem;
		border: 1px solid var(--border);
		border-radius: 12px;
		background: var(--surface);
		box-shadow: 0 16px 40px rgb(0 0 0 / 0.35);
	}
	.more-title,
	.more-sort {
		margin: 0 0 0.3rem;
		font-size: var(--fs-tab);
		color: var(--text-3);
	}
	.more-sort {
		margin-top: 0.6rem;
	}
	.more-opt {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		padding: 0.4rem 0.35rem;
		border-radius: 6px;
		font-size: var(--fs-body);
		cursor: pointer;
	}
	.more-opt:hover {
		background: var(--surface-2);
	}
	.more-opt input {
		appearance: none;
		display: inline-grid;
		place-items: center;
		width: 1.125rem;
		height: 1.125rem;
		margin: 0;
		border: 1.5px solid color-mix(in srgb, var(--text-3) 70%, transparent);
		border-radius: 5px;
		cursor: pointer;
	}
	.more-opt input:checked {
		border-color: var(--accent);
		background: var(--accent);
	}
	.more-opt input:checked::after {
		content: '';
		width: 0.3rem;
		height: 0.55rem;
		margin-top: -0.1rem;
		border: solid #fff;
		border-width: 0 2px 2px 0;
		transform: rotate(45deg);
	}
	.more-opt input:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}

	.subbar {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		min-width: 0;
	}
	.cats {
		flex: 1;
		min-width: 0;
		display: flex;
		gap: 0.4rem;
		overflow-x: auto;
		scrollbar-width: none;
	}
	.cat {
		flex-shrink: 0;
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		height: 2rem;
		padding: 0 0.8rem;
		border: 1px solid var(--border);
		border-radius: 999px;
		background: transparent;
		color: var(--text-2);
		font: inherit;
		font-size: var(--fs-tab);
		font-weight: 600;
		white-space: nowrap;
		cursor: pointer;
	}
	.cat:hover {
		background: var(--surface-2);
		color: var(--text);
	}
	.cat.active {
		border-color: var(--accent);
		background: var(--accent-soft);
		color: var(--accent-dark);
	}
	.cat.hidden-cat {
		border-style: dashed;
	}
	.cat-n {
		font-size: var(--fs-micro);
		color: var(--text-3);
		font-variant-numeric: tabular-nums;
	}
	.cat.active .cat-n {
		color: inherit;
	}
	.result {
		flex-shrink: 0;
		display: inline-flex;
		align-items: center;
		gap: 0.6rem;
		font-size: var(--fs-tab);
		color: var(--text-3);
		font-variant-numeric: tabular-nums;
	}
	.clear {
		border: none;
		background: none;
		padding: 0;
		font: inherit;
		color: var(--accent-dark);
		font-weight: 600;
		cursor: pointer;
	}
	.clear:hover {
		text-decoration: underline;
	}
	.sections {
		margin-top: 0.25rem;
	}
	.list-empty {
		padding: 2.5rem 1rem;
		border: 1px dashed var(--border);
		border-radius: 14px;
	}

	/* Floats over the grid while items are selected. */
	.bulk {
		position: sticky;
		bottom: 1.25rem;
		z-index: 10;
		align-self: center;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
		max-width: 100%;
		padding: 0.6rem 0.75rem 0.6rem 1.1rem;
		border: 1px solid var(--border);
		border-radius: 14px;
		background: var(--surface);
		box-shadow: 0 12px 32px rgb(0 0 0 / 0.35);
	}
	.bulk strong {
		margin-right: 0.5rem;
		font-size: var(--fs-body);
	}
	.bulk-move {
		width: auto;
		min-width: 9rem;
		height: 2.1rem;
		padding-top: 0;
		padding-bottom: 0;
	}
	.bulk-danger {
		color: var(--danger);
	}
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}
	@media (max-width: 900px) {
		.kpis {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
		.kpi:nth-child(4) {
			border-left: none;
		}
		.kpi:nth-child(n + 4) {
			border-top: 1px solid var(--border);
		}
	}
	@media (max-width: 640px) {
		.menu-page {
			gap: 1.1rem;
		}
		.menu-header-actions {
			width: 100%;
		}
		.menu-header-actions :global(.btn) {
			flex: 1;
		}
		.seg {
			flex: 1;
		}
		.seg-btn {
			flex: 1;
			padding: 0 0.5rem;
		}
		.bulk {
			left: 0;
			right: 0;
		}
	}
</style>
