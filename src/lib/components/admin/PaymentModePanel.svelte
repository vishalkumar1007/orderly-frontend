<script lang="ts">
	/**
	 * Dummy vs real payments.
	 *
	 * One panel for both levels: the platform default, and: when `tenantId` is
	 * given: a single business, which can follow the default or override it.
	 * Going real is deliberately a second step: it is disabled until the
	 * go-live checklist passes, and then asks for confirmation, because real
	 * customers get charged real money.
	 */
	import { onMount, untrack } from 'svelte';
	import { getConfig, isConfigCached } from '$lib/admin/configCache.svelte';
	import BadgeCheck from '@tabler/icons-svelte/icons/rosette-discount-check';
	import CircleCheck from '@tabler/icons-svelte/icons/circle-check';
	import CircleDashed from '@tabler/icons-svelte/icons/circle-dashed';
	import FlaskConical from '@tabler/icons-svelte/icons/flask';
	import Undo2 from '@tabler/icons-svelte/icons/arrow-back-up';
	import {
		fetchPlatformPayments,
		fetchTenantPayments,
		setPlatformPaymentMode,
		setTenantPaymentMode,
		type PaymentMode,
		type PlatformPayments,
		type Readiness,
		type TenantPayments
	} from '$lib/admin/paymentsApi';
	import { ApiClientError } from '$lib/api/client';
	import { errorLines } from '$lib/admin/errors';
	import ConfirmDialog from '$lib/components/admin/ConfirmDialog.svelte';
	import ErrorState from '$lib/components/admin/ErrorState.svelte';
	import Skeleton from '$lib/components/admin/Skeleton.svelte';
	import StatusBadge from '$lib/components/admin/StatusBadge.svelte';
	import { toast } from '$lib/components/admin/toast';

	let {
		tenantId = '',
		businessName = ''
	}: {
		/** Omit for the platform default. */
		tenantId?: string;
		businessName?: string;
	} = $props();

	type Choice = PaymentMode | 'INHERIT';

	let platform = $state<PlatformPayments | null>(null);
	let tenant = $state<TenantPayments | null>(null);
	let loading = $state(true);
	let error = $state('');
	let saving = $state(false);
	let confirmOpen = $state(false);
	let pending = $state<Choice | null>(null);

	const scoped = $derived(Boolean(tenantId));
	const readiness = $derived<Readiness | null>(
		(scoped ? tenant?.readiness : platform?.readiness) ?? null
	);
	const v2 = $derived((scoped ? tenant?.v2_enabled : platform?.v2_enabled) ?? true);
	const liveAvailable = $derived(
		(scoped ? tenant?.live_available : platform?.live_available) ?? false
	);
	const effective = $derived<PaymentMode>(
		(scoped ? tenant?.effective_mode : platform?.mode) ?? 'SANDBOX'
	);
	const selected = $derived<Choice>(
		scoped ? (tenant?.override?.mode ?? 'INHERIT') : (platform?.mode ?? 'SANDBOX')
	);
	const platformMode = $derived<PaymentMode>(platform?.mode ?? 'SANDBOX');
	const canGoLive = $derived(Boolean(readiness?.ready));
	const subject = $derived(scoped ? (businessName || 'this business') : 'the platform');

	/** `quiet` re-checks in place, without the skeleton, for background refreshes. */
	async function load(quiet = false) {
		if (!quiet) loading = true;
		error = '';
		try {
			if (scoped) {
				// A business's "inherit" label needs the platform default too.
				[tenant, platform] = await Promise.all([
					fetchTenantPayments(tenantId),
					fetchPlatformPayments()
				]);
			} else {
				platform = await fetchPlatformPayments();
			}
		} catch (err) {
			error = errorLines(err, 'load the payment mode').detail;
		} finally {
			loading = false;
		}
	}

	onMount(() => void load());

	// Save, Test connection and sharing changes on the provider panel all write
	// the shared config cache. Re-check readiness whenever that entry changes, so
	// the checklist and the "Real payments" lock follow without a page reload.
	// The first cached value is only recorded: it is the load we already did.
	let seenConfig: unknown;
	$effect(() => {
		if (!isConfigCached('PAYMENTS')) return;
		const view = getConfig('PAYMENTS');
		if (seenConfig !== undefined && view !== seenConfig) untrack(() => void load(true));
		seenConfig = view;
	});

	function choose(choice: Choice) {
		if (saving || choice === selected) return;
		if (choice === 'LIVE') {
			if (!canGoLive) return;
			pending = choice;
			confirmOpen = true;
			return;
		}
		void apply(choice);
	}

	async function apply(choice: Choice) {
		saving = true;
		try {
			const live = choice === 'LIVE';
			if (scoped) {
				tenant = await setTenantPaymentMode(tenantId, choice, live);
			} else {
				platform = await setPlatformPaymentMode(choice as PaymentMode, live);
			}
			confirmOpen = false;
			toast.success(
				choice === 'LIVE'
					? `Real payments are on for ${subject}`
					: choice === 'INHERIT'
						? `${businessName || 'This business'} now follows the platform default`
						: `${subject === 'the platform' ? 'The platform' : subject} is on dummy payments`
			);
		} catch (err) {
			confirmOpen = false;
			// The server re-checks readiness: show its checklist if it disagrees.
			if (err instanceof ApiClientError && err.code === 'gateway_not_ready') {
				toast.error('The gateway is not ready for real payments yet');
				await load();
			} else {
				toast.error(errorLines(err, 'change the payment mode').title);
			}
		} finally {
			saving = false;
			pending = null;
		}
	}

	const keyKindLabel = $derived(
		readiness?.key_kind === 'live'
			? 'Live keys'
			: readiness?.key_kind === 'test'
				? 'Gateway test keys'
				: ''
	);
</script>

<section class="panel mode-panel" aria-labelledby="pay-mode-h">
	<div class="panel-head">
		<div class="head-row">
			<h3 class="panel-h" id="pay-mode-h">
				{scoped ? 'Payment mode' : 'Payment mode: platform default'}
			</h3>
			{#if !loading && !error}
				<StatusBadge
					status={effective === 'LIVE' ? 'Real payments' : 'Dummy payments'}
					kind={effective === 'LIVE' ? 'ok' : 'warn'}
				/>
			{/if}
		</div>
		<p class="panel-note">
			{#if scoped}
				Choose whether {subject} takes real payments. Follow the platform default, or set this
				business on its own.
			{:else}
				The default for every business. Keep it on dummy while you build and test: nobody is
				charged, and the whole order-to-kitchen flow still works. A business can be moved to real
				payments on its own from its page.
			{/if}
		</p>
	</div>

	<div class="panel-body">
		{#if loading}
			<Skeleton height="6rem" />
		{:else if error}
			<ErrorState message={error} onretry={load} />
		{:else}
			{#if !v2}
				<div class="alert alert-warn" role="status">
					<span>
						The new payment path is switched off on this server (<code>PAYMENTS_V2</code>).
						Storefronts keep using the original dummy flow whatever you choose here.
					</span>
				</div>
			{/if}

			<div class="modes" role="radiogroup" aria-label="Payment mode">
				{#if scoped}
					<button
						type="button"
						role="radio"
						aria-checked={selected === 'INHERIT'}
						class="mode"
						class:on={selected === 'INHERIT'}
						disabled={saving}
						onclick={() => choose('INHERIT')}
					>
						<span class="mode-icon"><Undo2 size={17} stroke={1.6} /></span>
						<span class="mode-body">
							<strong>Follow platform default</strong>
							<span>
								Currently {platformMode === 'LIVE' ? 'real' : 'dummy'} payments. Changes
								automatically when the default changes.
							</span>
						</span>
						<span class="mode-mark" aria-hidden="true"></span>
					</button>
				{/if}

				<button
					type="button"
					role="radio"
					aria-checked={selected === 'SANDBOX'}
					class="mode"
					class:on={selected === 'SANDBOX'}
					disabled={saving}
					onclick={() => choose('SANDBOX')}
				>
					<span class="mode-icon test"><FlaskConical size={17} stroke={1.6} /></span>
					<span class="mode-body">
						<strong>Dummy payments</strong>
						<span>
							Nobody is charged. Customers get a test checkout, and orders are labelled TEST
							and left out of revenue.
						</span>
					</span>
					<span class="mode-mark" aria-hidden="true"></span>
				</button>

				<button
					type="button"
					role="radio"
					aria-checked={selected === 'LIVE'}
					aria-describedby="pay-live-hint"
					class="mode"
					class:on={selected === 'LIVE'}
					disabled={saving || (!canGoLive && selected !== 'LIVE')}
					onclick={() => choose('LIVE')}
				>
					<span class="mode-icon live"><BadgeCheck size={17} stroke={1.6} /></span>
					<span class="mode-body">
						<strong>Real payments</strong>
						<span id="pay-live-hint">
							{#if canGoLive || selected === 'LIVE'}
								Customers are charged through the gateway you configured.
							{:else}
								Locked until the checklist below passes.
							{/if}
						</span>
					</span>
					<span class="mode-mark" aria-hidden="true"></span>
				</button>
			</div>

			{#if readiness}
				<div class="check-head">
					<h4>Go-live checklist</h4>
					<span class="check-meta">
						{#if readiness.credentials_source}
							{readiness.credentials_source === 'ORGANIZATION'
								? 'Using this business’s own gateway keys'
								: 'Using the platform’s gateway keys'}
						{/if}
						{#if keyKindLabel}<span class="chip">{keyKindLabel}</span>{/if}
					</span>
				</div>
				<ul class="checks">
					{#each readiness.checks as check (check.key)}
						<li class:ok={check.ok}>
							<span class="check-ico" aria-hidden="true">
								{#if check.ok}
									<CircleCheck size={16} stroke={1.6} />
								{:else}
									<CircleDashed size={16} stroke={1.6} />
								{/if}
							</span>
							<span class="check-text">
								<span class="check-label">{check.label}</span>
								{#if !check.ok && check.detail}
									<span class="check-detail">{check.detail}</span>
								{/if}
							</span>
							<span class="sr-only">{check.ok ? 'Done' : 'Not done'}</span>
						</li>
					{/each}
				</ul>
				{#if readiness.key_kind === 'test'}
					<p class="note">
						These are the gateway’s <strong>test</strong> keys. Real payments in this state run
						against the gateway’s test environment: the right way to prove the integration
						before real keys go in.
					</p>
				{/if}
			{/if}

			{#if effective === 'LIVE' && !liveAvailable}
				<div class="alert alert-info" role="status">
					<span>
						Live checkout is not connected in this build yet. Businesses on real payments are
						offered pay-at-pickup only: a payment is never faked.
					</span>
				</div>
			{/if}
		{/if}
	</div>
</section>

<ConfirmDialog
	bind:open={confirmOpen}
	title="Switch {subject} to real payments?"
	message="Customers will be charged real money through the gateway. Orders placed from now on are no longer test orders. You can switch back to dummy payments at any time; payments already taken stay as they are."
	confirmLabel="Switch to real payments"
	danger
	loading={saving}
	onconfirm={() => (pending ? apply(pending) : undefined)}
/>

<style>
	.head-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	.modes {
		display: grid;
		gap: 0.6rem;
		grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
	}

	.mode {
		position: relative;
		display: flex;
		align-items: flex-start;
		gap: 0.7rem;
		padding: 0.85rem 2.4rem 0.85rem 0.9rem;
		text-align: left;
		font: inherit;
		color: inherit;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		cursor: pointer;
		transition:
			border-color var(--tr),
			box-shadow var(--tr),
			background var(--tr);
	}

	.mode:hover:not(:disabled) {
		border-color: color-mix(in srgb, var(--accent) 45%, var(--border));
	}

	.mode:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}

	.mode.on {
		border-color: var(--accent);
		background: color-mix(in srgb, var(--accent) 6%, var(--surface));
		box-shadow: 0 0 0 1px var(--accent);
	}

	.mode:disabled {
		cursor: not-allowed;
		opacity: 0.6;
	}

	.mode-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2.1rem;
		height: 2.1rem;
		flex-shrink: 0;
		border-radius: 9px;
		background: var(--surface-3);
		color: var(--icon-fg);
	}

	.mode-icon.test {
		background: var(--warn-bg);
		color: var(--warn);
	}

	.mode-icon.live {
		background: color-mix(in srgb, var(--ok) 14%, var(--surface));
		color: var(--ok);
	}

	.mode-body {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		min-width: 0;
	}

	.mode-body strong {
		font-size: var(--fs-body);
		font-weight: 600;
	}

	.mode-body span {
		font-size: var(--fs-meta);
		line-height: 1.45;
		color: var(--text-3);
	}

	.mode-mark {
		position: absolute;
		top: 0.85rem;
		right: 0.85rem;
		width: 1rem;
		height: 1rem;
		border: 1.5px solid var(--border);
		border-radius: 50%;
		background: var(--surface);
	}

	.mode.on .mode-mark {
		border-color: var(--accent);
		background: radial-gradient(circle, var(--accent) 0 38%, var(--surface) 42%);
	}

	.check-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.75rem;
		flex-wrap: wrap;
		margin: 1.1rem 0 0.4rem;
	}

	.check-head h4 {
		margin: 0;
		font-size: var(--fs-label);
		font-weight: 650;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--text-3);
	}

	.check-meta {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		font-size: var(--fs-meta);
		color: var(--text-3);
	}

	.chip {
		padding: 0.1rem 0.45rem;
		border-radius: 999px;
		background: var(--surface-3);
		color: var(--text-2);
		font-size: var(--fs-micro);
		font-weight: 600;
	}

	.checks {
		list-style: none;
		margin: 0;
		padding: 0;
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius);
		overflow: hidden;
	}

	.checks li {
		display: flex;
		align-items: flex-start;
		gap: 0.6rem;
		padding: 0.6rem 0.8rem;
		border-top: 1px solid var(--border-subtle);
		color: var(--text-3);
	}

	.checks li:first-child {
		border-top: 0;
	}

	.checks li.ok {
		color: var(--text-1);
	}

	.checks li.ok .check-ico {
		color: var(--ok);
	}

	.check-ico {
		display: inline-flex;
		margin-top: 0.05rem;
	}

	.check-text {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}

	.check-label {
		font-size: var(--fs-body);
		font-weight: 550;
	}

	.check-detail {
		font-size: var(--fs-meta);
		color: var(--text-3);
	}

	.note {
		margin: 0.7rem 0 0;
		font-size: var(--fs-meta);
		line-height: 1.5;
		color: var(--text-3);
	}

	.alert {
		margin: 0 0 0.85rem;
	}

	.mode-panel :global(.alert:last-child) {
		margin: 0.85rem 0 0;
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}
</style>
