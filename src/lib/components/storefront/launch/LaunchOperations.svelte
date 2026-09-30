<script lang="ts">
	import SlidersHorizontal from '@lucide/svelte/icons/sliders-horizontal';
	import Switch from '$lib/components/admin/Switch.svelte';
	import FormField from '$lib/components/admin/FormField.svelte';
	import TextInput from '$lib/components/admin/TextInput.svelte';
	import { storefrontAdminApi } from '$lib/storefront/admin';
	import type { StorefrontContext } from '$lib/storefront/admin-context';
	import { toast } from '$lib/components/admin/toast';
	import './launch-shared.css';

	const STORE_STATUS_OPTIONS = [
		{
			value: 'OPEN' as const,
			label: 'Open',
			desc: 'Accepting orders normally.',
			dotClass: 'status-open'
		},
		{
			value: 'BUSY' as const,
			label: 'Busy',
			desc: 'Orders may take longer.',
			dotClass: 'status-busy'
		},
		{
			value: 'AWAY' as const,
			label: 'Away',
			desc: 'Temporarily paused.',
			dotClass: 'status-away'
		},
		{
			value: 'CLOSED' as const,
			label: 'Closed',
			desc: 'Checkout is stopped.',
			dotClass: 'status-closed'
		}
	];

	let {
		config,
		save
	}: {
		config: StorefrontContext['config'];
		save: StorefrontContext['save'];
	} = $props();

	let savingStatus = $state(false);
	let togglingOrdering = $state(false);
	let closedMessageInput = $state(config.behaviour.closed_message || '');
	let savingClosedMessage = $state(false);

	let prepTime = $state(String(config.behaviour.prep_time_minutes ?? 20));
	let taxPercent = $state(String(config.behaviour.tax_percent ?? 0));
	let packagingFee = $state(String(config.behaviour.packaging_fee ?? 0));
	let savingPricing = $state(false);

	const orderingEnabled = $derived(config.behaviour.ordering_enabled);
	const currentStoreStatus = $derived(config.behaviour.store_status || 'OPEN');

	$effect(() => {
		closedMessageInput = config.behaviour.closed_message || '';
		prepTime = String(config.behaviour.prep_time_minutes ?? 20);
		taxPercent = String(config.behaviour.tax_percent ?? 0);
		packagingFee = String(config.behaviour.packaging_fee ?? 0);
	});

	async function handleSetStatus(status: 'OPEN' | 'BUSY' | 'AWAY' | 'CLOSED') {
		if (savingStatus || currentStoreStatus === status) return;
		savingStatus = true;
		const ok = await save(() => storefrontAdminApi.saveBehaviour({ store_status: status }));
		savingStatus = false;
		if (ok) toast.success(`Store status changed to ${status}`);
		else toast.error('Failed to update store status');
	}

	async function toggleOrdering(next: boolean) {
		if (togglingOrdering) return;
		togglingOrdering = true;
		const ok = await save(() => storefrontAdminApi.saveBehaviour({ ordering_enabled: next }));
		togglingOrdering = false;
		if (ok) toast.success(next ? 'Customer ordering enabled' : 'Ordering paused');
		else toast.error('Could not change ordering availability');
	}

	async function saveClosedMessage() {
		if (savingClosedMessage) return;
		savingClosedMessage = true;
		const ok = await save(() =>
			storefrontAdminApi.saveBehaviour({ closed_message: closedMessageInput.trim() })
		);
		savingClosedMessage = false;
		if (ok) toast.success('Closed store notice saved');
		else toast.error('Could not save closed message');
	}

	async function savePricing(event: SubmitEvent) {
		event.preventDefault();
		const prep = Number(prepTime);
		if (!Number.isFinite(prep) || prep < 0 || prep > 240) {
			toast.error('Preparation time must be between 0 and 240 minutes');
			return;
		}
		const tax = Number(taxPercent);
		if (!Number.isFinite(tax) || tax < 0 || tax > 100) {
			toast.error('Tax must be a percentage between 0 and 100');
			return;
		}
		const fee = Number(packagingFee);
		if (!Number.isFinite(fee) || fee < 0) {
			toast.error('Packaging fee cannot be negative');
			return;
		}
		savingPricing = true;
		const ok = await save(() =>
			storefrontAdminApi.saveBehaviour({
				prep_time_minutes: Math.round(prep),
				tax_percent: tax,
				packaging_fee: fee
			})
		);
		savingPricing = false;
		if (ok) toast.success('Pricing saved');
		else toast.error('Could not save pricing');
	}
</script>

<div class="studio-content-grid">
	<div class="panel studio-section-intro">
		<div class="intro-icon-wrap">
			<SlidersHorizontal size={24} strokeWidth={1.8} />
		</div>
		<div>
			<h2 class="intro-h">Store Status &amp; Ordering</h2>
			<p class="intro-p">
				Live status, order pause, and the figures applied to every bill. Weekly hours live on the
				Hours tab.
			</p>
		</div>
	</div>

	<div class="panel status-selector-panel">
		<div class="section-title-wrap">
			<div>
				<h3 class="section-h">Store Operational Status</h3>
				<p class="section-note">Changes show immediately on the customer storefront.</p>
			</div>
			{#if savingStatus}
				<span class="saving-indicator">Saving…</span>
			{/if}
		</div>

		<div class="status-cards-grid">
			{#each STORE_STATUS_OPTIONS as opt (opt.value)}
				{@const isSelected = currentStoreStatus === opt.value}
				<button
					type="button"
					class="status-option-card"
					class:active={isSelected}
					onclick={() => handleSetStatus(opt.value)}
					disabled={savingStatus}
				>
					<div class="status-card-header">
						<span class="status-indicator-dot {opt.dotClass}"></span>
						<strong class="status-name">{opt.label}</strong>
						{#if isSelected}
							<span class="status-active-chip">Active</span>
						{/if}
					</div>
					<p class="status-desc">{opt.desc}</p>
				</button>
			{/each}
		</div>
	</div>

	<div class="panel ordering-toggle-panel">
		<div class="ordering-switch-row">
			<div class="switch-meta">
				<h3 class="section-h">Accepting Customer Orders</h3>
				<p class="section-note">
					{orderingEnabled
						? 'Ordering is active.'
						: 'Ordering is paused — browse-only mode.'}
				</p>
			</div>
			<Switch
				checked={orderingEnabled}
				disabled={togglingOrdering}
				label=""
				onchange={toggleOrdering}
			/>
		</div>
	</div>

	<div class="panel closed-message-panel">
		<div class="section-title-wrap">
			<div>
				<h3 class="section-h">Closed Store Message</h3>
				<p class="section-note">Shown when ordering is disabled or the store is closed.</p>
			</div>
		</div>
		<div class="closed-msg-input-wrap">
			<input
				type="text"
				class="text-input closed-msg-input"
				placeholder="e.g. Closed for catering today — back tomorrow at 10 AM"
				maxlength={140}
				bind:value={closedMessageInput}
			/>
			<button
				type="button"
				class="btn btn-primary"
				disabled={savingClosedMessage}
				onclick={saveClosedMessage}
			>
				{savingClosedMessage ? 'Saving…' : 'Save Notice'}
			</button>
		</div>
	</div>

	<form class="panel pricing-panel" onsubmit={savePricing}>
		<div class="section-title-wrap">
			<div>
				<h3 class="section-h">Pricing</h3>
				<p class="section-note">
					Applied by the server on every order. Amounts use {config.store.currency}.
				</p>
			</div>
		</div>
		<div class="pricing-grid">
			<FormField label="Preparation time" hint="Minutes, shown as an estimate on confirmation.">
				<TextInput bind:value={prepTime} inputmode="numeric" suffix="min" />
			</FormField>
			<FormField label="Tax" hint="Percentage. Use 0 for none.">
				<TextInput bind:value={taxPercent} inputmode="decimal" suffix="%" />
			</FormField>
			<FormField label="Packaging fee" hint="Flat amount per order. Use 0 for none.">
				<TextInput bind:value={packagingFee} inputmode="decimal" />
			</FormField>
		</div>
		<div class="pricing-actions">
			<button class="btn btn-primary" type="submit" disabled={savingPricing}>
				{savingPricing ? 'Saving…' : 'Save pricing'}
			</button>
		</div>
	</form>
</div>

<style>
	.status-selector-panel,
	.ordering-toggle-panel,
	.closed-message-panel,
	.pricing-panel {
		padding: 1.25rem 1.5rem;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-md, 12px);
	}
	.saving-indicator {
		font-size: var(--fs-meta, 0.78rem);
		color: var(--text-3);
	}
	.status-cards-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
		gap: 0.75rem;
	}
	.status-option-card {
		text-align: left;
		padding: 0.9rem 1rem;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm, 8px);
		background: var(--surface-2);
		cursor: pointer;
		font: inherit;
		color: var(--text);
	}
	.status-option-card.active {
		border-color: var(--primary, #3b82f6);
		background: var(--surface);
		box-shadow: 0 0 0 1px color-mix(in srgb, var(--primary, #3b82f6) 35%, transparent);
	}
	.status-option-card:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
	.status-card-header {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		margin-bottom: 0.35rem;
	}
	.status-indicator-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
	}
	.status-indicator-dot.status-open {
		background: #10b981;
	}
	.status-indicator-dot.status-busy {
		background: #f59e0b;
	}
	.status-indicator-dot.status-away {
		background: #3b82f6;
	}
	.status-indicator-dot.status-closed {
		background: #ef4444;
	}
	.status-name {
		font-size: 0.9rem;
	}
	.status-active-chip {
		margin-left: auto;
		font-size: 0.65rem;
		font-weight: 700;
		color: var(--primary, #3b82f6);
		text-transform: uppercase;
	}
	.status-desc {
		margin: 0;
		font-size: var(--fs-meta, 0.78rem);
		color: var(--text-2);
		line-height: 1.35;
	}
	.ordering-switch-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}
	.closed-msg-input-wrap {
		display: flex;
		gap: 0.65rem;
		flex-wrap: wrap;
	}
	.closed-msg-input {
		flex: 1;
		min-width: 200px;
	}
	.pricing-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
		gap: 0.85rem;
		margin-top: 0.35rem;
	}
	.pricing-actions {
		margin-top: 1rem;
		display: flex;
		justify-content: flex-end;
	}
</style>
