<script lang="ts">
	import { onMount } from 'svelte';
	import Package from '@tabler/icons-svelte/icons/package';
	import TriangleAlert from '@tabler/icons-svelte/icons/alert-triangle';
	import PackageX from '@tabler/icons-svelte/icons/package-off';
	import PackagePlus from '@tabler/icons-svelte/icons/package';
	import Lock from '@tabler/icons-svelte/icons/lock';
	import { ApiClientError } from '$lib/api/client';
	import { formatRelative } from '$lib/admin/format';
	import DataTable from '$lib/components/admin/DataTable.svelte';
	import FormField from '$lib/components/admin/FormField.svelte';
	import Menu from '$lib/components/admin/Menu.svelte';
	import Modal from '$lib/components/admin/Modal.svelte';
	import SearchInput from '$lib/components/admin/SearchInput.svelte';
	import SelectField from '$lib/components/admin/SelectField.svelte';
	import SlideOver from '$lib/components/admin/SlideOver.svelte';
	import StatCard from '$lib/components/admin/StatCard.svelte';
	import StatGrid from '$lib/components/admin/StatGrid.svelte';
	import StatusBadge from '$lib/components/admin/StatusBadge.svelte';
	import Switch from '$lib/components/admin/Switch.svelte';
	import Tabs from '$lib/components/admin/Tabs.svelte';
	import TextInput from '$lib/components/admin/TextInput.svelte';
	import { toast } from '$lib/components/admin/toast';
	import { featureAccess } from '$lib/tenant/entitlements.svelte';
	import {
		REASON_LABEL,
		UNITS,
		adjustStock,
		listStock,
		stockMovements,
		trackProduct,
		type AdjustReason,
		type StockMovement,
		type StockRow,
		type StockSummary
	} from '$lib/tenant/inventoryApi';

	/**
	 * Inventory, Food first. A product is "tracked" once you give it a stock
	 * count; from then on accepting an order takes stock, cancelling gives it
	 * back, and a product that hits zero hides itself from the storefront until
	 * you restock it. Products you do not track behave exactly as before.
	 */

	let rows = $state<StockRow[]>([]);
	let summary = $state<StockSummary | null>(null);
	let loading = $state(true);
	let loadError = $state('');
	/** The API's own sentence when the plan has no inventory. */
	let lockedMessage = $state('');

	let tab = $state('tracked');
	let query = $state('');

	const access = $derived(featureAccess('INVENTORY'));
	const locked = $derived(!access.enabled || lockedMessage !== '');

	async function load() {
		loadError = '';
		try {
			const data = await listStock();
			rows = data.items ?? [];
			summary = data.summary ?? null;
			lockedMessage = '';
		} catch (err) {
			if (err instanceof ApiClientError && err.code === 'feature_not_in_plan') {
				lockedMessage = err.message;
			} else {
				loadError = err instanceof Error ? err.message : 'Could not load inventory';
			}
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		if (access.enabled) void load();
		else loading = false;
	});

	/* ---------- the list ---------- */

	const counts = $derived({
		tracked: (summary?.OK ?? 0) + (summary?.LOW ?? 0) + (summary?.OUT ?? 0) + (summary?.PAUSED ?? 0),
		attention: (summary?.LOW ?? 0) + (summary?.OUT ?? 0),
		untracked: summary?.UNTRACKED ?? 0
	});

	const tabs = $derived([
		{ id: 'tracked', label: `Tracked (${counts.tracked})` },
		{ id: 'attention', label: `Needs attention (${counts.attention})` },
		{ id: 'untracked', label: `Not tracked (${counts.untracked})` }
	]);

	const RANK: Record<string, number> = { OUT: 0, LOW: 1, OK: 2, PAUSED: 3, UNTRACKED: 4 };

	const visible = $derived.by(() => {
		const q = query.trim().toLowerCase();
		return rows
			.filter((r) => {
				if (tab === 'untracked') return r.status === 'UNTRACKED';
				if (tab === 'attention') return r.status === 'LOW' || r.status === 'OUT';
				return r.status !== 'UNTRACKED';
			})
			.filter(
				(r) => !q || r.product_name.toLowerCase().includes(q) || r.category.toLowerCase().includes(q)
			)
			.sort((a, b) => RANK[a.status] - RANK[b.status] || a.product_name.localeCompare(b.product_name));
	});

	function badge(status: string): { label: string; kind: 'ok' | 'warn' | 'danger' | 'neutral' } {
		switch (status) {
			case 'OK':
				return { label: 'In stock', kind: 'ok' };
			case 'LOW':
				return { label: 'Low', kind: 'warn' };
			case 'OUT':
				return { label: 'Sold out', kind: 'danger' };
			case 'PAUSED':
				return { label: 'Paused', kind: 'neutral' };
			default:
				return { label: 'Not tracked', kind: 'neutral' };
		}
	}

	function storefrontNote(r: StockRow): string {
		if (r.status === 'OUT' && !r.is_available) return 'Hidden from the storefront until restocked';
		if (r.status === 'PAUSED') return '';
		if (!r.is_available) return 'Hidden from the storefront';
		return '';
	}

	/** Replace one row with the API's fresh copy and refresh the counts. */
	async function refresh() {
		await load();
	}

	/* ---------- adjust stock ---------- */

	let adjustOpen = $state(false);
	let adjustRow = $state<StockRow | null>(null);
	let adjustReason = $state<AdjustReason>('ADD');
	let adjustQty = $state('');
	let adjustNote = $state('');
	let adjustSaving = $state(false);
	let adjustError = $state('');

	const MODES: { id: AdjustReason; label: string; hint: string }[] = [
		{ id: 'ADD', label: 'Add stock', hint: 'A delivery or a batch you just made.' },
		{ id: 'WASTE', label: 'Write off', hint: 'Spoiled, dropped or given away.' },
		{ id: 'CORRECTION', label: 'Set total', hint: 'You counted the shelf — enter what is really there.' }
	];

	function openAdjust(row: StockRow, reason: AdjustReason = 'ADD') {
		adjustRow = row;
		adjustReason = reason;
		adjustQty = '';
		adjustNote = '';
		adjustError = '';
		adjustOpen = true;
	}

	const adjustNumber = $derived(adjustQty.trim() === '' ? NaN : Number(adjustQty));
	const adjustCurrent = $derived(adjustRow?.quantity ?? 0);
	const adjustAfter = $derived.by(() => {
		if (!Number.isInteger(adjustNumber)) return null;
		if (adjustReason === 'ADD') return adjustCurrent + adjustNumber;
		if (adjustReason === 'WASTE') return adjustCurrent - adjustNumber;
		return adjustNumber;
	});
	const adjustProblem = $derived.by(() => {
		if (adjustQty.trim() === '') return '';
		if (!Number.isInteger(adjustNumber)) return 'Enter a whole number';
		if (adjustReason === 'CORRECTION') {
			if (adjustNumber < 0) return 'Cannot be negative';
			if (adjustNumber === adjustCurrent) return `Stock is already ${adjustCurrent}`;
			return '';
		}
		if (adjustNumber < 1) return 'Enter at least 1';
		if (adjustReason === 'WASTE' && adjustNumber > adjustCurrent) {
			return `Only ${adjustCurrent} in stock`;
		}
		return '';
	});
	const adjustReady = $derived(
		adjustQty.trim() !== '' && adjustProblem === '' && adjustAfter !== null && !adjustSaving
	);

	async function submitAdjust() {
		if (!adjustRow || !adjustReady) return;
		adjustSaving = true;
		adjustError = '';
		try {
			await adjustStock(adjustRow.product_id, {
				reason: adjustReason,
				quantity: adjustNumber,
				note: adjustNote.trim()
			});
			adjustOpen = false;
			toast.success(`${adjustRow.product_name} updated`);
			await refresh();
		} catch (err) {
			// Stays in the dialog: the number is probably the thing to fix.
			adjustError = err instanceof Error ? err.message : 'Could not update stock';
		} finally {
			adjustSaving = false;
		}
	}

	/* ---------- start tracking / settings ---------- */

	let formOpen = $state(false);
	let formRow = $state<StockRow | null>(null);
	let formStarting = $state(true);
	let form = $state({ quantity: '', unit: 'pcs', threshold: '', paused: false });
	let formSaving = $state(false);
	let formError = $state('');

	function openTrack(row: StockRow) {
		formRow = row;
		formStarting = true;
		form = { quantity: '', unit: 'pcs', threshold: '', paused: false };
		formError = '';
		formOpen = true;
	}

	function openSettings(row: StockRow) {
		formRow = row;
		formStarting = false;
		form = {
			quantity: '',
			unit: row.unit ?? 'pcs',
			threshold: String(row.reorder_threshold ?? 0),
			paused: row.track === false
		};
		formError = '';
		formOpen = true;
	}

	const whole = (s: string) => /^\d{1,7}$/.test(s.trim());
	const formProblems = $derived.by(() => {
		const out: Record<string, string> = {};
		if (formStarting && !whole(form.quantity)) out.quantity = 'Enter how many you have now (0 is fine)';
		if (form.threshold.trim() !== '' && !whole(form.threshold)) out.threshold = 'Enter a whole number';
		return out;
	});
	const unitOptions = $derived(
		(UNITS.includes(form.unit) ? UNITS : [form.unit, ...UNITS]).map((u) => ({ value: u, label: u }))
	);

	async function submitForm() {
		if (!formRow || Object.keys(formProblems).length) return;
		formSaving = true;
		formError = '';
		try {
			await trackProduct(formRow.product_id, {
				...(formStarting ? { quantity: Number(form.quantity) } : { track: !form.paused }),
				unit: form.unit,
				reorder_threshold: form.threshold.trim() === '' ? 0 : Number(form.threshold)
			});
			formOpen = false;
			toast.success(formStarting ? `Now tracking ${formRow.product_name}` : 'Settings saved');
			await refresh();
		} catch (err) {
			formError = err instanceof Error ? err.message : 'Could not save';
		} finally {
			formSaving = false;
		}
	}

	async function setPaused(row: StockRow, paused: boolean) {
		try {
			await trackProduct(row.product_id, { track: !paused });
			toast.success(paused ? 'Tracking paused' : 'Tracking resumed');
			await refresh();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Could not update');
		}
	}

	/* ---------- history ---------- */

	let historyOpen = $state(false);
	let historyRow = $state<StockRow | null>(null);
	let history = $state<StockMovement[]>([]);
	let historyLoading = $state(false);
	let historyError = $state('');

	async function openHistory(row: StockRow) {
		historyRow = row;
		history = [];
		historyError = '';
		historyLoading = true;
		historyOpen = true;
		try {
			history = await stockMovements(row.product_id);
		} catch (err) {
			historyError = err instanceof Error ? err.message : 'Could not load history';
		} finally {
			historyLoading = false;
		}
	}

	const signed = (n: number) => (n > 0 ? `+${n}` : String(n));
</script>

<div class="inv-page">
	{#if locked}
		<section class="panel inv-locked" aria-labelledby="inv-locked-title">
			<span class="inv-locked-icon"><Lock size={22} stroke={1.6} /></span>
			<h2 id="inv-locked-title">Inventory is not part of your plan</h2>
			<p class="muted">
				{lockedMessage ||
					(access.requiredPlan
						? `Inventory is part of the ${access.requiredPlan} plan.`
						: 'Ask your platform administrator to add it to your plan.')}
			</p>
			<ul class="inv-benefits">
				<li>Count what is on the shelf, per product</li>
				<li>Stock leaves when you accept an order and returns if you cancel it</li>
				<li>Sold-out items hide themselves from your storefront</li>
				<li>Get a heads-up before you run out</li>
			</ul>
			<p class="muted">Plans are changed by your platform administrator.</p>
		</section>
	{:else}
		<header class="inv-head">
			<p class="muted inv-lead">
				Count what you have. Stock leaves when you <strong>accept</strong> an order and comes back if
				you cancel it. A product that reaches zero hides itself from the storefront until you
				restock.
			</p>
		</header>

		<div class="inv-stats">
		<StatGrid>
			<StatCard label="Tracked products" value={counts.tracked} {loading}>
				{#snippet icon()}<Package size={15} stroke={1.6} />{/snippet}
			</StatCard>
			<StatCard
				label="Low on stock"
				value={summary?.LOW ?? 0}
				hint="At or below the reorder level"
				{loading}
			>
				{#snippet icon()}<TriangleAlert size={15} stroke={1.6} />{/snippet}
			</StatCard>
			<StatCard label="Sold out" value={summary?.OUT ?? 0} hint="Hidden from the storefront" {loading}>
				{#snippet icon()}<PackageX size={15} stroke={1.6} />{/snippet}
			</StatCard>
			<StatCard label="Not tracked" value={counts.untracked} hint="Sell as normal" {loading}>
				{#snippet icon()}<PackagePlus size={15} stroke={1.6} />{/snippet}
			</StatCard>
		</StatGrid>
		</div>

		{#if loadError}
			<div class="panel inv-error" role="alert">
				<strong>Could not load inventory.</strong>
				<span class="muted">{loadError}</span>
				<button type="button" class="btn btn-ghost btn-sm" onclick={load}>Try again</button>
			</div>
		{:else}
			<div class="inv-toolbar">
				<Tabs {tabs} bind:active={tab} />
				<div class="inv-search">
					<SearchInput bind:value={query} placeholder="Search products" label="Search products" id="inv-search" />
				</div>
			</div>

			<section class="panel panel-flush">
				<DataTable
					{loading}
					empty={!loading && visible.length === 0}
					emptyTitle={query
						? 'Nothing matches that search'
						: tab === 'untracked'
							? 'Every product is tracked'
							: tab === 'attention'
								? 'Nothing needs attention'
								: 'No products tracked yet'}
					emptyDescription={query
						? 'Try a different name or category.'
						: tab === 'untracked'
							? 'Add products on the Menu page and they will show up here.'
							: tab === 'attention'
								? 'Nothing is low or sold out right now.'
								: 'Open "Not tracked" and choose the products you want to count.'}
				>
					{#snippet head()}
						<th>Product</th>
						{#if tab === 'untracked'}
							<th class="num">Price</th>
						{:else}
							<th>Stock</th>
							<th class="col-md">Reorder at</th>
							<th>Status</th>
							<th class="col-md">Updated</th>
						{/if}
						<th style="width:1%;"><span class="sr-only">Actions</span></th>
					{/snippet}
					{#each visible as r (r.product_id)}
						{@const b = badge(r.status)}
						<tr>
							<td>
								<span class="inv-name">
									<strong>{r.product_name}</strong>
									<span class="muted">{r.category}</span>
									{#if storefrontNote(r)}
										<span class="inv-note">{storefrontNote(r)}</span>
									{/if}
								</span>
							</td>
							{#if tab === 'untracked'}
								<td class="num">₹{r.price.toLocaleString('en-IN')}</td>
								<td>
									<button type="button" class="btn btn-primary btn-sm" onclick={() => openTrack(r)}>
										Track stock
									</button>
								</td>
							{:else}
								<td>
									<span class="inv-qty" class:is-out={r.status === 'OUT'} class:is-low={r.status === 'LOW'}>
										{r.quantity}
									</span>
									<span class="muted inv-unit">{r.unit}</span>
								</td>
								<td class="col-md muted">
									{r.reorder_threshold ? `${r.reorder_threshold} ${r.unit}` : '—'}
								</td>
								<td><StatusBadge status={b.label} kind={b.kind} /></td>
								<td class="col-md muted">{formatRelative(r.updated_at)}</td>
								<td>
									<span class="inv-actions">
										<button type="button" class="btn btn-ghost btn-sm" onclick={() => openAdjust(r)}>
											Adjust
										</button>
										<Menu
											label={`More actions for ${r.product_name}`}
											items={[
												{ label: 'Add stock', onclick: () => openAdjust(r, 'ADD') },
												{ label: 'Write off', onclick: () => openAdjust(r, 'WASTE') },
												{ label: 'Set total (stock count)', onclick: () => openAdjust(r, 'CORRECTION') },
												{ label: 'History', onclick: () => openHistory(r), separatorBefore: true },
												{ label: 'Settings', onclick: () => openSettings(r) },
												r.track === false
													? { label: 'Resume tracking', onclick: () => setPaused(r, false) }
													: { label: 'Pause tracking', onclick: () => setPaused(r, true) }
											]}
										/>
									</span>
								</td>
							{/if}
						</tr>
					{/each}
				</DataTable>
			</section>
		{/if}
	{/if}
</div>

<!-- Adjust -->
<Modal bind:open={adjustOpen} title={adjustRow ? `Adjust ${adjustRow.product_name}` : 'Adjust stock'}>
	{#if adjustRow}
		<div class="inv-form">
			<div class="inv-modes" role="radiogroup" aria-label="What happened">
				{#each MODES as m (m.id)}
					<button
						type="button"
						role="radio"
						aria-checked={adjustReason === m.id}
						class="inv-mode"
						onclick={() => {
							adjustReason = m.id;
							adjustError = '';
						}}
					>
						{m.label}
					</button>
				{/each}
			</div>
			<p class="field-hint" style="margin:-0.25rem 0 0;">
				{MODES.find((m) => m.id === adjustReason)?.hint}
			</p>

			<FormField
				label={adjustReason === 'CORRECTION' ? 'Total on the shelf now' : 'How many'}
				htmlFor="inv-qty"
				required
				error={adjustProblem}
			>
				<TextInput
					id="inv-qty"
					inputmode="numeric"
					autocomplete="off"
					bind:value={adjustQty}
					placeholder={adjustReason === 'CORRECTION' ? String(adjustCurrent) : '0'}
					suffix={adjustRow.unit ?? ''}
				/>
			</FormField>

			<div class="inv-preview" aria-live="polite">
				<span class="muted">In stock</span>
				<strong>{adjustCurrent}</strong>
				<span class="inv-arrow" aria-hidden="true">→</span>
				<strong class:inv-bad={adjustAfter !== null && adjustAfter < 0}>
					{adjustAfter === null || adjustProblem ? '—' : adjustAfter}
				</strong>
				<span class="muted">{adjustRow.unit}</span>
			</div>

			<FormField label="Note" htmlFor="inv-note" hint="Optional — shows in the history.">
				<TextInput id="inv-note" bind:value={adjustNote} maxlength={200} placeholder="e.g. Tuesday delivery" />
			</FormField>

			{#if adjustError}
				<p class="inv-form-error" role="alert">{adjustError}</p>
			{/if}
		</div>
	{/if}
	{#snippet footer()}
		<button type="button" class="btn btn-ghost" onclick={() => (adjustOpen = false)}>Cancel</button>
		<button type="button" class="btn btn-primary" disabled={!adjustReady} onclick={submitAdjust}>
			{adjustSaving ? 'Saving…' : 'Save'}
		</button>
	{/snippet}
</Modal>

<!-- Start tracking / settings -->
<Modal
	bind:open={formOpen}
	title={formRow ? (formStarting ? `Track ${formRow.product_name}` : `${formRow.product_name} settings`) : ''}
>
	<div class="inv-form">
		{#if formStarting}
			<FormField label="How many do you have now?" htmlFor="inv-start" required error={formProblems.quantity}>
				<TextInput
					id="inv-start"
					inputmode="numeric"
					autocomplete="off"
					bind:value={form.quantity}
					placeholder="0"
				/>
			</FormField>
			<p class="field-hint" style="margin:-0.35rem 0 0;">
				At 0 the product is hidden from your storefront until you add stock.
			</p>
		{/if}
		<FormField label="Counted in" htmlFor="inv-unit">
			<SelectField id="inv-unit" bind:value={form.unit} options={unitOptions} />
		</FormField>
		<FormField
			label="Reorder at"
			htmlFor="inv-threshold"
			hint="You get a notification when stock drops to this number. Leave empty for none."
			error={formProblems.threshold}
		>
			<TextInput
				id="inv-threshold"
				inputmode="numeric"
				autocomplete="off"
				bind:value={form.threshold}
				placeholder="e.g. 5"
			/>
		</FormField>
		{#if !formStarting}
			<Switch
				bind:checked={form.paused}
				label="Pause tracking"
				hint="Orders stop using this count and the product shows as normal. Your history is kept."
			/>
		{/if}
		{#if formError}
			<p class="inv-form-error" role="alert">{formError}</p>
		{/if}
	</div>
	{#snippet footer()}
		<button type="button" class="btn btn-ghost" onclick={() => (formOpen = false)}>Cancel</button>
		<button
			type="button"
			class="btn btn-primary"
			disabled={formSaving || Object.keys(formProblems).length > 0}
			onclick={submitForm}
		>
			{formSaving ? 'Saving…' : formStarting ? 'Start tracking' : 'Save'}
		</button>
	{/snippet}
</Modal>

<!-- History -->
<SlideOver bind:open={historyOpen} title={historyRow ? `${historyRow.product_name} — history` : 'History'}>
	{#if historyLoading}
		<p class="muted">Loading…</p>
	{:else if historyError}
		<p class="inv-form-error" role="alert">{historyError}</p>
	{:else if history.length === 0}
		<p class="muted">Nothing has happened to this stock yet.</p>
	{:else}
		<ol class="inv-history">
			{#each history as m (m.id)}
				<li>
					<span class={['inv-delta', m.delta > 0 ? 'up' : 'down'].join(' ')}>{signed(m.delta)}</span>
					<span class="inv-history-main">
						<strong>
							{REASON_LABEL[m.reason] ?? m.reason}{#if m.order_number}<span class="muted">&nbsp;· order #{m.order_number}</span>{/if}
						</strong>
						{#if m.note}<span class="muted">{m.note}</span>{/if}
						<span class="muted inv-history-meta">
							{m.actor ? `${m.actor} · ` : ''}{formatRelative(m.created_at)} · {m.quantity_after} left
						</span>
					</span>
				</li>
			{/each}
		</ol>
	{/if}
</SlideOver>

<style>
	.inv-page {
		display: grid;
		gap: 1rem;
	}
	.inv-lead {
		margin: 0;
		font-size: var(--fs-body);
		line-height: 1.5;
		max-width: 46rem;
	}
	.inv-lead strong {
		color: var(--text);
	}
	.inv-toolbar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
	}
	.inv-search {
		min-width: min(18rem, 100%);
		flex: 0 1 18rem;
	}
	.inv-name {
		display: grid;
		gap: 0.1rem;
		/* Scroll the table sideways before squeezing names into one word per line. */
		min-width: 8.5rem;
	}
	.inv-note {
		font-size: var(--fs-meta);
		color: var(--text-2);
	}
	.inv-qty {
		font-size: 1.15rem;
		font-weight: 750;
		font-variant-numeric: tabular-nums;
		color: var(--text);
	}
	.inv-qty.is-low {
		color: #b45309;
	}
	.inv-qty.is-out {
		color: #b91c1c;
	}
	.inv-unit {
		margin-left: 0.25rem;
		font-size: var(--fs-meta);
	}
	.inv-actions {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		white-space: nowrap;
	}
	.inv-form {
		display: grid;
		gap: 0.85rem;
	}
	.inv-form-error {
		margin: 0;
		color: #b91c1c;
		font-size: var(--fs-body);
	}
	.inv-modes {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 0.25rem;
		padding: 0.25rem;
		border-radius: 10px;
		background: var(--surface-2, color-mix(in srgb, var(--text) 6%, transparent));
	}
	.inv-mode {
		padding: 0.5rem 0.4rem;
		border: 0;
		border-radius: 8px;
		background: transparent;
		color: var(--text-2);
		font: inherit;
		font-weight: 600;
		cursor: pointer;
		transition: background 0.15s, color 0.15s;
	}
	.inv-mode:hover {
		color: var(--text);
	}
	.inv-mode[aria-checked='true'] {
		background: var(--accent, #4f46e5);
		color: #fff;
	}
	.inv-mode:focus-visible {
		outline: 2px solid var(--accent, #4f46e5);
		outline-offset: 2px;
	}
	.inv-preview {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
		padding: 0.6rem 0.8rem;
		border-radius: 8px;
		background: var(--surface-2, color-mix(in srgb, var(--text) 5%, transparent));
		font-variant-numeric: tabular-nums;
	}
	.inv-preview strong {
		font-size: 1.1rem;
	}
	.inv-arrow {
		color: var(--text-2);
	}
	.inv-bad {
		color: #b91c1c;
	}
	.inv-history {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 0.85rem;
	}
	.inv-history li {
		display: flex;
		gap: 0.75rem;
		align-items: flex-start;
	}
	.inv-history-main {
		display: grid;
		gap: 0.1rem;
		min-width: 0;
	}
	.inv-history-meta {
		font-size: var(--fs-meta);
	}
	.inv-delta {
		min-width: 2.75rem;
		text-align: center;
		padding: 0.15rem 0.4rem;
		border-radius: 6px;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}
	.inv-delta.up {
		background: color-mix(in srgb, #16a34a 16%, transparent);
		color: #166534;
	}
	.inv-delta.down {
		background: color-mix(in srgb, #dc2626 14%, transparent);
		color: #991b1b;
	}
	.inv-error {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.75rem;
		padding: 0.9rem 1rem;
	}
	.inv-locked {
		display: grid;
		justify-items: center;
		gap: 0.6rem;
		padding: 2.25rem 1.25rem;
		text-align: center;
	}
	.inv-locked h2 {
		margin: 0;
		font-size: 1.15rem;
	}
	.inv-locked p {
		margin: 0;
		max-width: 32rem;
	}
	.inv-locked-icon {
		display: grid;
		place-items: center;
		width: 3rem;
		height: 3rem;
		border-radius: 50%;
		background: color-mix(in srgb, var(--text) 7%, transparent);
	}
	.inv-benefits {
		margin: 0.25rem 0;
		padding: 0;
		list-style: none;
		display: grid;
		gap: 0.3rem;
		text-align: left;
		color: var(--text-2);
	}
	.inv-benefits li::before {
		content: '✓';
		margin-right: 0.5rem;
		color: var(--accent-dark);
		font-weight: 700;
	}
	@media (max-width: 640px) {
		/* Four cards in one column push the list a full screen down on a phone. */
		.inv-stats :global(.stat-row) {
			grid-template-columns: 1fr 1fr;
			gap: 0.5rem;
		}
		.inv-stats :global(.stat-hint) {
			display: none;
		}
		.inv-search {
			flex: 1 1 100%;
		}
	}
</style>
