<script lang="ts">
	import Minus from '@lucide/svelte/icons/minus';
	import Plus from '@lucide/svelte/icons/plus';
	import SlideOver from '$lib/components/admin/SlideOver.svelte';
	import Skeleton from '$lib/components/admin/Skeleton.svelte';
	import { toast } from '$lib/components/admin/toast';
	import { loadMenuSnapshot } from '$lib/tenant/menuCache.svelte';
	import type { MenuCategory, MenuProduct } from '$lib/tenant/menu';
	import { orderBoard, type CounterOrderLine } from '$lib/tenant/orders.svelte';

	type CartLine = {
		key: string;
		product: MenuProduct;
		quantity: number;
		addonIds: string[];
	};

	let {
		open = $bindable(false),
		onPlaced
	}: {
		open?: boolean;
		onPlaced?: (orderNumber: number) => void;
	} = $props();

	let loading = $state(true);
	let placing = $state(false);
	let error = $state('');
	let categories = $state<MenuCategory[]>([]);
	let products = $state<MenuProduct[]>([]);
	let currencySymbol = $state('₹');
	let activeCategory = $state('all');
	let cart = $state<CartLine[]>([]);
	let customerName = $state('Walk-in Guest');
	let customerPhone = $state('');
	let notes = $state('');
	let markPaidAfter = $state(true);

	const availableProducts = $derived(products.filter((p) => p.is_available));
	const visibleProducts = $derived(
		activeCategory === 'all'
			? availableProducts
			: availableProducts.filter((p) => p.category_id === activeCategory)
	);

	const cartTotal = $derived(
		cart.reduce((sum, line) => {
			const addonSum = line.addonIds.reduce((a, id) => {
				const addon = line.product.addons?.find((x) => x.id === id);
				return a + (addon?.price ?? 0);
			}, 0);
			return sum + (line.product.price + addonSum) * line.quantity;
		}, 0)
	);

	const activeCategories = $derived(
		categories.filter(
			(c) => c.is_active && availableProducts.some((p) => p.category_id === c.id)
		)
	);

	$effect(() => {
		if (!open) return;
		void loadMenu();
	});

	async function loadMenu() {
		loading = true;
		error = '';
		try {
			const snap = await loadMenuSnapshot();
			categories = snap.categories;
			products = snap.products;
			currencySymbol = snap.currencySymbol;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Could not load menu';
		} finally {
			loading = false;
		}
	}

	function addProduct(product: MenuProduct) {
		const existing = cart.find((l) => l.product.id === product.id && l.addonIds.length === 0);
		const hasFlatAddons = (product.addons ?? []).some((a) => a.id);
		if (existing && !hasFlatAddons) {
			existing.quantity += 1;
			cart = [...cart];
			return;
		}
		cart = [
			...cart,
			{
				key: `${product.id}-${crypto.randomUUID().slice(0, 6)}`,
				product,
				quantity: 1,
				addonIds: []
			}
		];
	}

	function bump(line: CartLine, delta: number) {
		const next = line.quantity + delta;
		if (next <= 0) {
			cart = cart.filter((l) => l.key !== line.key);
			return;
		}
		line.quantity = next;
		cart = [...cart];
	}

	function toggleAddon(line: CartLine, addonId: string) {
		if (line.addonIds.includes(addonId)) {
			line.addonIds = line.addonIds.filter((id) => id !== addonId);
		} else {
			line.addonIds = [...line.addonIds, addonId];
		}
		cart = [...cart];
	}

	function resetForm() {
		cart = [];
		customerName = 'Walk-in Guest';
		customerPhone = '';
		notes = '';
		markPaidAfter = true;
		error = '';
	}

	async function placeOrder() {
		if (cart.length === 0) {
			toast.error('Add at least one item');
			return;
		}
		if (customerName.trim().length < 2) {
			toast.error('Enter a customer name');
			return;
		}
		if (!customerPhone.trim()) {
			toast.error('Enter a phone number');
			return;
		}

		placing = true;
		error = '';
		try {
			const items: CounterOrderLine[] = cart.map((line) => ({
				product_id: line.product.id,
				quantity: line.quantity,
				...(line.addonIds.length
					? {
							addons: line.addonIds.map((id) => ({ id, quantity: 1 }))
						}
					: {})
			}));
			const created = await orderBoard.createCounterOrder({
				customer_name: customerName.trim(),
				customer_phone: customerPhone.trim(),
				...(notes.trim() ? { notes: notes.trim() } : {}),
				payment_method: 'CASH',
				client_token: crypto.randomUUID(),
				items
			});

			if (markPaidAfter && created.payment?.status === 'PENDING' && created.payment.id) {
				try {
					await orderBoard.confirmPay(created);
				} catch {
					toast.error('Order placed, but payment could not be confirmed');
				}
			}

			toast.success(`Counter order #${created.order_number} placed`);
			onPlaced?.(created.order_number);
			resetForm();
			open = false;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Could not place order';
			toast.error(error);
		} finally {
			placing = false;
		}
	}
</script>

<SlideOver bind:open title="New counter order">
	{#if loading}
		<div class="scp-loading">
			<Skeleton height="2.5rem" />
			<Skeleton height="8rem" />
			<Skeleton height="8rem" />
		</div>
	{:else if error && products.length === 0}
		<div class="panel">
			<p class="muted">{error}</p>
			<button class="btn btn-ghost btn-sm" type="button" onclick={() => void loadMenu()}>Retry</button>
		</div>
	{:else}
		<div class="scp">
			<section class="scp-block">
				<h4>Customer</h4>
				<label class="scp-field">
					<span>Name</span>
					<input class="input" bind:value={customerName} autocomplete="name" />
				</label>
				<label class="scp-field">
					<span>Phone</span>
					<input class="input" bind:value={customerPhone} inputmode="tel" autocomplete="tel" />
				</label>
				<label class="scp-field">
					<span>Notes (optional)</span>
					<textarea class="input" rows="2" bind:value={notes}></textarea>
				</label>
			</section>

			<section class="scp-block">
				<h4>Menu</h4>
				<div class="scp-cats" role="tablist" aria-label="Categories">
					<button
						type="button"
						class={['scp-cat', activeCategory === 'all' ? 'active' : ''].join(' ')}
						onclick={() => (activeCategory = 'all')}
					>
						All
					</button>
					{#each activeCategories as cat (cat.id)}
						<button
							type="button"
							class={['scp-cat', activeCategory === cat.id ? 'active' : ''].join(' ')}
							onclick={() => (activeCategory = cat.id)}
						>
							{cat.name}
						</button>
					{/each}
				</div>
				{#if visibleProducts.length === 0}
					<p class="muted scp-empty">No available products in this category.</p>
				{:else}
					<ul class="scp-products">
						{#each visibleProducts as product (product.id)}
							<li>
								<button type="button" class="scp-product" onclick={() => addProduct(product)}>
									<span>
										<strong>{product.name}</strong>
										<span class="muted">{currencySymbol}{Math.round(product.price)}</span>
									</span>
									<span class="scp-add"><Plus size={14} strokeWidth={2.25} /></span>
								</button>
							</li>
						{/each}
					</ul>
				{/if}
			</section>

			<section class="scp-block">
				<h4>Cart ({cart.reduce((n, l) => n + l.quantity, 0)})</h4>
				{#if cart.length === 0}
					<p class="muted scp-empty">Tap menu items to add them.</p>
				{:else}
					<ul class="scp-cart">
						{#each cart as line (line.key)}
							<li>
								<div class="scp-cart-row">
									<div>
										<strong>{line.product.name}</strong>
										<span class="muted"
											>{currencySymbol}{Math.round(
												(line.product.price +
													line.addonIds.reduce((a, id) => {
														const addon = line.product.addons?.find((x) => x.id === id);
														return a + (addon?.price ?? 0);
													}, 0)) *
													line.quantity
											)}</span
										>
									</div>
									<div class="scp-qty">
										<button type="button" class="btn btn-quiet btn-sm" onclick={() => bump(line, -1)}>
											<Minus size={14} />
										</button>
										<span>{line.quantity}</span>
										<button type="button" class="btn btn-quiet btn-sm" onclick={() => bump(line, 1)}>
											<Plus size={14} />
										</button>
									</div>
								</div>
								{#if (line.product.addons ?? []).some((a) => a.id)}
									<div class="scp-addons">
										{#each line.product.addons ?? [] as addon}
											{#if addon.id}
												<label class="scp-addon">
													<input
														type="checkbox"
														checked={line.addonIds.includes(addon.id)}
														onchange={() => toggleAddon(line, addon.id!)}
													/>
													<span
														>{addon.name}
														{#if addon.price}
															(+{currencySymbol}{Math.round(addon.price)})
														{/if}</span
													>
												</label>
											{/if}
										{/each}
									</div>
								{/if}
							</li>
						{/each}
					</ul>
					<div class="scp-total">
						<span>Est. total</span>
						<strong>{currencySymbol}{Math.round(cartTotal)}</strong>
					</div>
					<p class="muted scp-hint">Final total is calculated on the server when you place the order.</p>
				{/if}
			</section>

			<label class="scp-check">
				<input type="checkbox" bind:checked={markPaidAfter} />
				<span>Mark cash as paid after placing</span>
			</label>

			{#if error}
				<p class="scp-error">{error}</p>
			{/if}
		</div>
	{/if}

	{#snippet footer()}
		<button
			class="btn btn-primary"
			type="button"
			disabled={placing || loading || cart.length === 0}
			onclick={() => void placeOrder()}
		>
			{placing ? 'Placing…' : 'Place counter order'}
		</button>
	{/snippet}
</SlideOver>

<style>
	.scp {
		display: grid;
		gap: 1.15rem;
	}

	.scp-loading {
		display: grid;
		gap: 0.75rem;
	}

	.scp-block h4 {
		margin: 0 0 0.55rem;
		font-size: var(--fs-meta);
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--text-3, var(--muted));
	}

	.scp-field {
		display: grid;
		gap: 0.25rem;
		margin-bottom: 0.55rem;
		font-size: var(--fs-body);
		font-weight: 600;
	}

	.scp-cats {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
		margin-bottom: 0.65rem;
	}

	.scp-cat {
		border: 1px solid var(--border);
		background: var(--bg);
		border-radius: 999px;
		padding: 0.3rem 0.65rem;
		font-size: var(--fs-code);
		font-weight: 650;
		cursor: pointer;
		color: var(--text);
	}

	.scp-cat.active {
		border-color: color-mix(in srgb, var(--accent, #3b82f6) 45%, var(--border));
		background: color-mix(in srgb, var(--accent, #3b82f6) 12%, var(--surface));
	}

	.scp-products,
	.scp-cart {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 0.4rem;
	}

	.scp-product {
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		padding: 0.65rem 0.75rem;
		border: 1px solid var(--border);
		border-radius: 10px;
		background: var(--bg);
		text-align: left;
		cursor: pointer;
		color: var(--text);
	}

	.scp-product strong {
		display: block;
		font-size: var(--fs-body);
	}

	.scp-product .muted {
		font-size: var(--fs-code);
	}

	.scp-add {
		display: grid;
		place-items: center;
		width: 1.75rem;
		height: 1.75rem;
		border-radius: 8px;
		background: var(--accent-soft, #eef2ff);
		color: var(--accent-dark, #3730a3);
		flex: none;
	}

	.scp-cart-row {
		display: flex;
		justify-content: space-between;
		gap: 0.75rem;
		align-items: center;
	}

	.scp-cart-row strong {
		display: block;
		font-size: var(--fs-body);
	}

	.scp-qty {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}

	.scp-addons {
		display: grid;
		gap: 0.25rem;
		margin-top: 0.4rem;
		padding-left: 0.15rem;
	}

	.scp-addon {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-size: var(--fs-tab);
	}

	.scp-total {
		display: flex;
		justify-content: space-between;
		margin-top: 0.65rem;
		padding-top: 0.55rem;
		border-top: 1px solid var(--border);
		font-size: var(--fs-title);
	}

	.scp-empty,
	.scp-hint {
		margin: 0;
		font-size: var(--fs-body);
	}

	.scp-check {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		font-size: var(--fs-body);
	}

	.scp-error {
		margin: 0;
		color: var(--danger, #b91c1c);
		font-size: var(--fs-body);
	}
</style>
