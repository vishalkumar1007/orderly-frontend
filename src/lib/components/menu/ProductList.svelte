<script module lang="ts">
	import type { MenuProduct } from '$lib/tenant/menu';
	export type ProductGroup = { id: string; name: string; active: boolean; products: MenuProduct[] };
	export type MenuAction = {
		label: string;
		onclick: () => void;
		danger?: boolean;
		disabled?: boolean;
		separatorBefore?: boolean;
	};
</script>

<script lang="ts">
	import Plus from '@tabler/icons-svelte/icons/plus';
	import UtensilsCrossed from '@tabler/icons-svelte/icons/tools-kitchen-2';
	import Menu from '$lib/components/admin/Menu.svelte';
	import { formatCurrency } from '$lib/admin/format';
	import { productHasOptions } from '$lib/tenant/menu';
	import { hasBusinessModule, terms } from '$lib/tenant/businessType.svelte';

	// The catalogue's nouns come from the business type, not from this table.
	const t = $derived(terms());
	const showDiet = $derived(hasBusinessModule('diet_tags'));

	let {
		groups,
		view = 'list',
		selected = $bindable([]),
		canReorder = false,
		currency = 'INR',
		currencySymbol = '₹',
		categoryActions,
		onedit,
		ondelete,
		ontoggle,
		onflag,
		onduplicate,
		onmove,
		onreorder,
		onprice,
		onquickadd,
		onmore
	}: {
		groups: ProductGroup[];
		view?: 'list' | 'grid';
		selected?: string[];
		canReorder?: boolean;
		currency?: string;
		currencySymbol?: string;
		categoryActions: (groupId: string) => MenuAction[];
		onedit: (p: MenuProduct) => void;
		ondelete: (p: MenuProduct) => void;
		ontoggle: (p: MenuProduct) => void;
		onflag: (p: MenuProduct, flag: 'is_featured' | 'is_popular') => void;
		onduplicate: (p: MenuProduct) => void;
		onmove: (p: MenuProduct) => void;
		onreorder: (p: MenuProduct, direction: -1 | 1) => void;
		onprice: (p: MenuProduct, price: number) => Promise<void>;
		onquickadd: (categoryId: string, name: string, price: number) => Promise<boolean>;
		onmore: (categoryId: string) => void;
	} = $props();

	// Inline price edit: one row at a time.
	let priceId = $state('');
	let priceDraft = $state('');

	function startPrice(p: MenuProduct) {
		priceId = p.id;
		priceDraft = String(p.price);
	}

	function focusOnMount(node: HTMLInputElement) {
		node.focus();
		node.select();
	}

	async function commitPrice(p: MenuProduct) {
		// Blur fires after Enter/Escape already closed the editor: ignore it.
		if (priceId !== p.id) return;
		priceId = '';
		const next = Number(priceDraft);
		if (priceDraft.trim() === '' || !Number.isFinite(next) || next < 0 || next === Number(p.price)) {
			return;
		}
		await onprice(p, next);
	}

	function toggleSelect(id: string) {
		selected = selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id];
	}

	function toggleGroup(g: ProductGroup) {
		const ids = g.products.map((p) => p.id);
		const all = ids.length > 0 && ids.every((id) => selected.includes(id));
		selected = all
			? selected.filter((id) => !ids.includes(id))
			: [...new Set([...selected, ...ids])];
	}

	// Clicking anywhere on a row opens it, except on the row's own controls.
	function rowClick(e: MouseEvent, p: MenuProduct) {
		if ((e.target as HTMLElement).closest('button, input, a, label, [role="menu"]')) return;
		onedit(p);
	}

	// Quick add sits under a section; one open at a time.
	let qaOpen = $state('');
	let qaName = $state('');
	let qaPrice = $state('');
	let qaBusy = $state(false);

	function openQuick(groupId: string) {
		qaOpen = groupId;
		qaName = '';
		qaPrice = '';
	}

	async function quickAdd(e: SubmitEvent, groupId: string) {
		e.preventDefault();
		const form = e.currentTarget as HTMLFormElement;
		const name = qaName.trim();
		const price = Number(qaPrice);
		if (!name || qaBusy) return;
		if (qaPrice === '' || !Number.isFinite(price) || price < 0) {
			(form.elements.namedItem('price') as HTMLInputElement | null)?.focus();
			return;
		}
		qaBusy = true;
		const ok = await onquickadd(groupId, name, price);
		qaBusy = false;
		if (ok) {
			qaName = '';
			qaPrice = '';
		}
		// Stay open for the next one: menus are usually typed in a batch.
		(form.elements.namedItem('name') as HTMLInputElement | null)?.focus();
	}

	function actions(p: MenuProduct, i: number, count: number) {
		const list: MenuAction[] = [
			{ label: 'Edit', onclick: () => onedit(p) },
			{ label: 'Duplicate', onclick: () => onduplicate(p) },
			{ label: `Move to another ${t.group.toLowerCase()}`, onclick: () => onmove(p) },
			{
				label: p.is_featured ? 'Remove from featured' : 'Mark as featured',
				onclick: () => onflag(p, 'is_featured'),
				separatorBefore: true
			},
			{
				label: p.is_popular ? 'Remove popular tag' : 'Mark as popular',
				onclick: () => onflag(p, 'is_popular')
			}
		];
		if (canReorder) {
			list.push(
				{ label: 'Move up', onclick: () => onreorder(p, -1), disabled: i === 0, separatorBefore: true },
				{ label: 'Move down', onclick: () => onreorder(p, 1), disabled: i === count - 1 }
			);
		}
		list.push({ label: 'Delete', onclick: () => ondelete(p), danger: true, separatorBefore: true });
		return list;
	}

	function optionCount(p: MenuProduct) {
		return p.option_groups?.filter((g) => g.is_active !== false).length || p.addons?.length || 0;
	}
</script>

{#snippet priceCell(p: MenuProduct)}
	{#if priceId === p.id}
		<span class="price-edit">
			<span class="sym" aria-hidden="true">{currencySymbol}</span>
			<input
				class="input price-input"
				type="number"
				min="0"
				step="0.5"
				inputmode="decimal"
				aria-label={`Price for ${p.name}`}
				bind:value={priceDraft}
				use:focusOnMount
				onblur={() => commitPrice(p)}
				onkeydown={(e) => {
					if (e.key === 'Enter') {
						e.preventDefault();
						commitPrice(p);
					} else if (e.key === 'Escape') {
						priceId = '';
					}
				}}
			/>
		</span>
	{:else}
		<button
			type="button"
			class="price"
			title="Change price"
			aria-label={`Change price of ${p.name}, now ${formatCurrency(Number(p.price), currency)}`}
			onclick={() => startPrice(p)}
		>
			{formatCurrency(Number(p.price), currency)}
		</button>
	{/if}
{/snippet}

{#snippet stockSwitch(p: MenuProduct, withLabel: boolean)}
	<button
		type="button"
		class="stock"
		role="switch"
		aria-checked={p.is_available}
		aria-label={`${p.name} available to order`}
		title={p.is_available ? 'Available: click to mark sold out' : 'Sold out: click to make available'}
		onclick={() => ontoggle(p)}
	>
		<span class="sw"><span class="knob"></span></span>
		{#if withLabel}<span class="stock-label">{p.is_available ? 'Available' : 'Sold out'}</span>{/if}
	</button>
{/snippet}

{#snippet tagsFor(p: MenuProduct)}
	{#if productHasOptions(p)}
		<span class="tag tag-muted" title="Has sizes, add-ons or choices">
			{optionCount(p)} {optionCount(p) === 1 ? 'option' : 'options'}
		</span>
	{/if}
	{#if p.is_featured}<span class="tag tag-amber">Featured</span>{/if}
	{#if p.is_popular}<span class="tag tag-blue">Popular</span>{/if}
{/snippet}

{#snippet dietMark(p: MenuProduct)}
	<span
		class="diet-mark"
		class:veg={p.is_vegetarian}
		title={p.is_vegetarian ? 'Veg' : 'Non-veg'}
		aria-label={p.is_vegetarian ? 'Veg' : 'Non-veg'}
	></span>
{/snippet}

{#each groups as g (g.id)}
	{@const allPicked = g.products.length > 0 && g.products.every((p) => selected.includes(p.id))}
	{@const somePicked = !allPicked && g.products.some((p) => selected.includes(p.id))}
	<section class="sec" class:inactive={!g.active} aria-labelledby={`sec-h-${g.id}`}>
		<header class="sec-head">
			{#if g.products.length > 0}
				<input
					class="pick"
					type="checkbox"
					checked={allPicked}
					indeterminate={somePicked}
					aria-label={`Select all in ${g.name}`}
					onchange={() => toggleGroup(g)}
				/>
			{/if}
			<h2 class="sec-title" id={`sec-h-${g.id}`}>{g.name}</h2>
			<span class="sec-count">{g.products.length}</span>
			{#if !g.active}
				<span class="badge badge-neutral" title="Customers cannot see this section">Hidden</span>
			{/if}
			<div class="sec-actions">
				<button type="button" class="sec-add" onclick={() => openQuick(g.id)}>
					<Plus size={15} stroke={1.8} /> Add {t.item.toLowerCase()}
				</button>
				<Menu items={categoryActions(g.id)} label={`${g.name} options`} />
			</div>
		</header>

		{#if g.products.length > 0 && view === 'list'}
			<div class="tbl" role="table" aria-labelledby={`sec-h-${g.id}`}>
				<div class="tr th" role="row">
					<span class="c-pick" role="columnheader"></span>
					<span class="c-item" role="columnheader">{t.item}</span>
					{#if showDiet}<span class="c-type" role="columnheader">Type</span>{/if}
					<span class="c-price" role="columnheader">Price</span>
					<span class="c-status" role="columnheader">Availability</span>
					<span class="c-act" role="columnheader"><span class="sr-only">Actions</span></span>
				</div>
				{#each g.products as p, i (p.id)}
					{@const picked = selected.includes(p.id)}
					<!-- svelte-ignore a11y_click_events_have_key_events -->
					<div class="tr" class:off={!p.is_available} class:picked role="row" tabindex="-1" onclick={(e) => rowClick(e, p)}>
						<span class="c-pick" role="cell">
							<input
								class="pick"
								type="checkbox"
								checked={picked}
								aria-label={`Select ${p.name}`}
								onchange={() => toggleSelect(p.id)}
							/>
						</span>
						<span class="c-item" role="cell">
							{#if p.image_url}
								<img class="thumb" src={p.image_url} alt="" loading="lazy" />
							{:else}
								<span class="thumb ph" aria-hidden="true"><UtensilsCrossed size={18} stroke={1.5} /></span>
							{/if}
							<span class="item-text">
								<span class="item-line">
									<button type="button" class="item-name" onclick={() => onedit(p)}>{p.name}</button>
									{@render tagsFor(p)}
								</span>
								{#if p.description}
									<span class="item-desc">{p.description}</span>
								{/if}
							</span>
						</span>
						{#if showDiet}
							<span class="c-type" role="cell">
								<span class="diet">
									{@render dietMark(p)}
									{p.is_vegetarian ? 'Veg' : 'Non-veg'}
								</span>
							</span>
						{/if}
						<span class="c-price" role="cell">{@render priceCell(p)}</span>
						<span class="c-status" role="cell">{@render stockSwitch(p, true)}</span>
						<span class="c-act" role="cell">
							<Menu items={actions(p, i, g.products.length)} label={`${p.name} actions`} />
						</span>
					</div>
				{/each}
			</div>
		{:else if g.products.length > 0}
			<ul class="cards">
				{#each g.products as p, i (p.id)}
					{@const picked = selected.includes(p.id)}
					<!-- svelte-ignore a11y_click_events_have_key_events -->
					<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
					<li class="card" class:off={!p.is_available} class:picked onclick={(e) => rowClick(e, p)}>
						<div class="card-media">
							{#if p.image_url}
								<img src={p.image_url} alt="" loading="lazy" />
							{:else}
								<span class="card-ph" aria-hidden="true"><UtensilsCrossed size={22} stroke={1.4} /></span>
							{/if}
							<label class="card-pick" class:show={selected.length > 0}>
								<input
									class="pick"
									type="checkbox"
									checked={picked}
									aria-label={`Select ${p.name}`}
									onchange={() => toggleSelect(p.id)}
								/>
							</label>
							{#if !p.is_available}<span class="card-sold">Sold out</span>{/if}
						</div>
						<div class="card-body">
							<span class="card-line">
								{#if showDiet}{@render dietMark(p)}{/if}
								<button type="button" class="item-name" onclick={() => onedit(p)}>{p.name}</button>
							</span>
							<span class="card-tags">{@render tagsFor(p)}</span>
						</div>
						<div class="card-foot">
							{@render priceCell(p)}
							<span class="card-tools">
								{@render stockSwitch(p, false)}
								<Menu items={actions(p, i, g.products.length)} label={`${p.name} actions`} />
							</span>
						</div>
					</li>
				{/each}
			</ul>
		{/if}

		{#if qaOpen === g.id}
			<form class="quick" onsubmit={(e) => quickAdd(e, g.id)}>
				<label class="sr-only" for={`qa-name-${g.id}`}>{t.item} name</label>
				<!-- svelte-ignore a11y_autofocus -->
				<input
					id={`qa-name-${g.id}`}
					name="name"
					class="input quick-name"
					autocomplete="off"
					autofocus
					placeholder={`${t.item} name`}
					bind:value={qaName}
					onkeydown={(e) => e.key === 'Escape' && (qaOpen = '')}
				/>
				<label class="sr-only" for={`qa-price-${g.id}`}>Price</label>
				<span class="quick-price">
					<span class="sym" aria-hidden="true">{currencySymbol}</span>
					<input
						id={`qa-price-${g.id}`}
						name="price"
						class="input"
						type="number"
						min="0"
						step="0.5"
						inputmode="decimal"
						placeholder="Price"
						bind:value={qaPrice}
						onkeydown={(e) => e.key === 'Escape' && (qaOpen = '')}
					/>
				</span>
				<button class="btn btn-primary btn-sm quick-btn" type="submit" disabled={qaBusy || !qaName.trim()}>
					{qaBusy ? 'Adding…' : 'Add'}
				</button>
				<button type="button" class="btn btn-ghost btn-sm quick-btn quick-more" onclick={() => onmore(g.id)}>
					Full form
				</button>
				<button type="button" class="btn btn-quiet btn-sm quick-btn" onclick={() => (qaOpen = '')}>Cancel</button>
			</form>
		{:else if g.products.length === 0}
			<button type="button" class="empty-add" onclick={() => openQuick(g.id)}>
				Nothing in {g.name} yet.
				<span class="empty-cta"><Plus size={14} stroke={2} /> Add {t.item.toLowerCase()}</span>
			</button>
		{/if}
	</section>
{/each}

<style>
	/* Each category is one panel: header, rows, quick add. */
	.sec {
		border: 1px solid var(--border);
		border-radius: 12px;
		background: var(--surface);
		overflow: hidden;
	}
	.sec + .sec {
		margin-top: 1rem;
	}
	.sec-head {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		min-height: 3.25rem;
		padding: 0.4rem 0.6rem 0.4rem 1rem;
	}
	.sec:has(.tbl) .sec-head,
	.sec:has(.cards) .sec-head {
		border-bottom: 1px solid var(--border);
	}
	.sec-title {
		margin: 0;
		font-size: var(--fs-title, 1rem);
		font-weight: 700;
		letter-spacing: -0.01em;
	}
	.sec.inactive .sec-title {
		color: var(--text-3);
	}
	.sec-count {
		min-width: 1.5rem;
		padding: 0 0.4rem;
		border-radius: 999px;
		background: var(--surface-2);
		font-size: var(--fs-micro);
		font-weight: 600;
		line-height: 1.35rem;
		text-align: center;
		color: var(--text-2);
		font-variant-numeric: tabular-nums;
	}
	.sec-actions {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		margin-left: auto;
	}
	.sec-add {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		height: 2.1rem;
		padding: 0 0.75rem;
		border: none;
		border-radius: 8px;
		background: transparent;
		color: var(--accent-dark);
		font: inherit;
		font-size: var(--fs-body);
		font-weight: 600;
		cursor: pointer;
	}
	.sec-add:hover {
		background: var(--accent-soft);
	}
	/* Themed checkbox: the native one is a bright white square on dark. */
	.pick {
		appearance: none;
		flex-shrink: 0;
		position: relative;
		display: inline-grid;
		place-items: center;
		width: 1.125rem;
		height: 1.125rem;
		margin: 0;
		border: 1.5px solid color-mix(in srgb, var(--text-3) 70%, transparent);
		border-radius: 5px;
		background: transparent;
		cursor: pointer;
		transition:
			background var(--tr),
			border-color var(--tr);
	}
	.pick:hover {
		border-color: var(--accent);
	}
	.pick:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
	.pick:checked,
	.pick:indeterminate {
		border-color: var(--accent);
		background: var(--accent);
	}
	.pick:checked::after {
		content: '';
		width: 0.3rem;
		height: 0.55rem;
		margin-top: -0.1rem;
		border: solid #fff;
		border-width: 0 2px 2px 0;
		transform: rotate(45deg);
	}
	.pick:indeterminate::after {
		content: '';
		width: 0.55rem;
		height: 2px;
		border-radius: 1px;
		background: #fff;
	}

	/* List view */
	.tr {
		display: grid;
		grid-template-columns: 1.25rem minmax(0, 1fr) 6.5rem 6.5rem 9rem 2.5rem;
		align-items: center;
		gap: 0 1rem;
		min-height: 3.75rem;
		padding: 0.45rem 0.6rem 0.45rem 1rem;
		border-bottom: 1px solid var(--border);
		cursor: pointer;
		transition: background var(--tr);
	}
	.tbl:not(:has(.c-type)) .tr {
		grid-template-columns: 1.25rem minmax(0, 1fr) 6.5rem 9rem 2.5rem;
	}
	.tr:last-child {
		border-bottom: none;
	}
	.tr:not(.th):hover {
		background: var(--surface-2);
	}
	.tr.picked {
		background: var(--accent-soft);
	}
	.th {
		min-height: 2.1rem;
		padding-top: 0;
		padding-bottom: 0;
		font-size: var(--fs-micro);
		font-weight: 600;
		color: var(--text-3);
		cursor: default;
	}
	.c-pick {
		display: flex;
	}
	.c-item {
		display: flex;
		align-items: center;
		gap: 0.8rem;
		min-width: 0;
	}
	.c-price {
		text-align: right;
	}
	.c-status {
		padding-left: 0.75rem;
	}
	.c-act {
		display: flex;
		justify-content: flex-end;
	}
	.thumb {
		flex-shrink: 0;
		width: 2.6rem;
		height: 2.6rem;
		border-radius: 8px;
		object-fit: cover;
		display: block;
		background: var(--surface-2);
	}
	.ph {
		display: grid;
		place-items: center;
		color: var(--text-3);
		border: 1px solid var(--border);
	}
	.tr.off .thumb,
	.card.off .card-media img {
		filter: grayscale(1);
		opacity: 0.6;
	}
	.item-text {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
		min-width: 0;
	}
	.item-line {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.25rem 0.45rem;
		min-width: 0;
	}
	.item-name {
		max-width: 100%;
		border: none;
		background: none;
		padding: 0;
		font: inherit;
		font-size: var(--fs-body);
		font-weight: 600;
		color: var(--text);
		text-align: left;
		cursor: pointer;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.off .item-name {
		color: var(--text-3);
	}
	.tr:hover .item-name,
	.card:hover .item-name {
		color: var(--accent-dark);
	}
	.item-desc {
		font-size: var(--fs-tab);
		color: var(--text-3);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.tag {
		display: inline-flex;
		align-items: center;
		height: 1.25rem;
		padding: 0 0.45rem;
		border-radius: 6px;
		font-size: var(--fs-micro);
		font-weight: 600;
		white-space: nowrap;
	}
	.tag-muted {
		background: var(--surface-2);
		color: var(--text-2);
	}
	.tag-amber {
		background: rgb(245 158 11 / 0.14);
		color: #f5a524;
	}
	.tag-blue {
		background: rgb(59 130 246 / 0.14);
		color: #6aa5ff;
	}
	.diet {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		font-size: var(--fs-tab);
		color: var(--text-2);
	}
	/* Indian food marks: green square-dot for veg, red for non-veg. */
	.diet-mark {
		--mark: #d64545;
		flex-shrink: 0;
		position: relative;
		width: 0.85rem;
		height: 0.85rem;
		border: 1.5px solid var(--mark);
		border-radius: 2px;
		background: #fff;
	}
	.diet-mark.veg {
		--mark: #1e9e4a;
	}
	.diet-mark::after {
		content: '';
		position: absolute;
		inset: 2px;
		border-radius: 50%;
		background: var(--mark);
	}
	.price {
		padding: 0.3rem 0.45rem;
		margin-right: -0.45rem;
		border: 1px dashed transparent;
		border-radius: 8px;
		background: none;
		font: inherit;
		font-weight: 650;
		font-variant-numeric: tabular-nums;
		color: var(--text);
		cursor: text;
	}
	.price:hover {
		border-color: var(--border);
	}
	.price-edit {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
	}
	.sym {
		color: var(--text-3);
		font-size: var(--fs-body);
	}
	.price-input {
		width: 5.5rem;
		padding: 0.3rem 0.45rem;
		text-align: right;
		font-variant-numeric: tabular-nums;
	}
	.stock {
		display: inline-flex;
		align-items: center;
		gap: 0.55rem;
		height: 2rem;
		padding: 0 0.35rem;
		margin-left: -0.35rem;
		border: none;
		border-radius: 8px;
		background: transparent;
		font: inherit;
		font-size: var(--fs-tab);
		font-weight: 600;
		color: var(--text-2);
		cursor: pointer;
	}
	.stock[aria-checked='false'] .stock-label {
		color: var(--danger);
	}
	.sw {
		position: relative;
		width: 2.2rem;
		height: 1.25rem;
		border-radius: 999px;
		background: var(--border);
		transition: background var(--tr);
	}
	.stock[aria-checked='true'] .sw {
		background: #16a34a;
	}
	.knob {
		position: absolute;
		top: 2px;
		left: 2px;
		width: calc(1.25rem - 4px);
		height: calc(1.25rem - 4px);
		border-radius: 50%;
		background: #fff;
		box-shadow: 0 1px 2px rgb(0 0 0 / 0.3);
		transition: transform var(--tr);
	}
	.stock[aria-checked='true'] .knob {
		transform: translateX(0.95rem);
	}

	/* Card view */
	.cards {
		list-style: none;
		margin: 0;
		padding: 0.85rem;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(10rem, 1fr));
		gap: 0.7rem;
	}
	.card {
		display: flex;
		flex-direction: column;
		min-width: 0;
		border: 1px solid var(--border);
		border-radius: 10px;
		background: var(--bg, var(--surface));
		overflow: hidden;
		cursor: pointer;
		transition: border-color var(--tr);
	}
	.card:hover {
		border-color: color-mix(in srgb, var(--accent) 40%, var(--border));
	}
	.card.picked {
		border-color: var(--accent);
	}
	.card-media {
		position: relative;
		aspect-ratio: 4 / 3;
		background: var(--surface-2);
	}
	.card-media img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}
	.card-ph {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		color: var(--text-3);
	}
	.card-pick {
		position: absolute;
		top: 0.4rem;
		left: 0.4rem;
		display: grid;
		place-items: center;
		width: 1.6rem;
		height: 1.6rem;
		border-radius: 7px;
		background: rgb(0 0 0 / 0.5);
		backdrop-filter: blur(4px);
		opacity: 0;
		transition: opacity var(--tr);
	}
	.card:hover .card-pick,
	.card-pick .pick:not(:checked) {
		border-color: rgb(255 255 255 / 0.85);
	}
	.card-pick:focus-within,
	.card-pick.show,
	.card.picked .card-pick {
		opacity: 1;
	}
	.card-sold {
		position: absolute;
		top: 0.4rem;
		right: 0.4rem;
		padding: 0.1rem 0.45rem;
		border-radius: 999px;
		background: var(--danger);
		color: #fff;
		font-size: var(--fs-micro);
		font-weight: 650;
	}
	.card-body {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		padding: 0.5rem 0.6rem 0.2rem;
		flex: 1;
	}
	.card-line {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		min-width: 0;
	}
	.card-tags {
		display: flex;
		flex-wrap: wrap;
		gap: 0.3rem;
	}
	.card-tags:empty {
		display: none;
	}
	.card-foot {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.25rem;
		padding: 0.15rem 0.25rem 0.3rem 0.6rem;
	}
	.card-foot .price {
		margin-left: -0.45rem;
		margin-right: 0;
		font-size: var(--fs-tab);
	}
	.card .item-name {
		font-size: var(--fs-tab);
	}
	.card .tag {
		height: 1.1rem;
		padding: 0 0.35rem;
	}
	.card .sw {
		width: 1.9rem;
		height: 1.1rem;
	}
	.card .knob {
		width: calc(1.1rem - 4px);
		height: calc(1.1rem - 4px);
	}
	.card .stock[aria-checked='true'] .knob {
		transform: translateX(0.8rem);
	}
	.card-tools {
		display: inline-flex;
		align-items: center;
	}

	/* Quick add and empty state */
	.quick {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.65rem 0.75rem 0.65rem 1rem;
		border-top: 1px solid var(--border);
		background: var(--accent-soft);
	}
	.sec-head + .quick {
		border-top-color: var(--border);
	}
	.quick-name {
		flex: 1;
		min-width: 0;
		height: 2.25rem;
	}
	.quick-price {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
	}
	.quick-price .input {
		width: 6.5rem;
		height: 2.25rem;
	}
	.quick-btn {
		height: 2.25rem;
	}
	.empty-add {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		width: 100%;
		height: 2.75rem;
		padding: 0 1rem;
		border: none;
		border-top: 1px dashed var(--border);
		background: transparent;
		color: var(--text-3);
		font: inherit;
		font-size: var(--fs-tab);
		text-align: left;
		cursor: pointer;
	}
	.empty-cta {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		color: var(--accent-dark);
		font-weight: 600;
	}
	.empty-add:hover {
		background: var(--surface-2);
	}
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}

	@media (max-width: 760px) {
		.th {
			display: none;
		}
		.tr,
		.tbl:not(:has(.c-type)) .tr {
			grid-template-columns: 1.25rem minmax(0, 1fr) auto 2.5rem;
			grid-template-areas:
				'pick item item act'
				'pick price status act';
			gap: 0.35rem 0.6rem;
			padding: 0.7rem 0.5rem 0.7rem 0.75rem;
		}
		.c-pick {
			grid-area: pick;
			align-self: start;
			padding-top: 0.8rem;
		}
		.c-item {
			grid-area: item;
		}
		.c-type {
			display: none;
		}
		.c-price {
			grid-area: price;
			text-align: left;
			padding-left: 3.4rem;
		}
		.c-status {
			grid-area: status;
			padding-left: 0;
		}
		.c-act {
			grid-area: act;
			align-self: start;
		}
		.cards {
			grid-template-columns: repeat(2, minmax(0, 1fr));
			padding: 0.75rem;
			gap: 0.6rem;
		}
		.quick {
			flex-wrap: wrap;
		}
		.quick-name {
			flex-basis: 100%;
		}
		.quick-more {
			display: none;
		}
		.sec-head {
			padding-left: 0.75rem;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.tr,
		.card,
		.sw,
		.knob,
		.card-pick {
			transition: none;
		}
	}
</style>
