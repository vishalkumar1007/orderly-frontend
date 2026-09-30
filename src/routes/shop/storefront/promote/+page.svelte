<script lang="ts">
	import type { SetupStepKey } from '$lib/tenant/dashboardCache.svelte';
	import { getDashboardSnapshot } from '$lib/tenant/dashboardCache.svelte';
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import Rocket from '@lucide/svelte/icons/rocket';
	import ShieldCheck from '@lucide/svelte/icons/shield-check';
	import Megaphone from '@lucide/svelte/icons/megaphone';
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import Lock from '@lucide/svelte/icons/lock';

	import { api } from '$lib/api/client';
	import Skeleton from '$lib/components/admin/Skeleton.svelte';
	import ErrorState from '$lib/components/admin/ErrorState.svelte';
	import { useStorefront, type StorefrontContext } from '$lib/storefront/admin-context';
	import { storefrontAdminApi, type AdminQr } from '$lib/storefront/admin';
	import { toast } from '$lib/components/admin/toast';
	import { policyStore, type PolicySignature } from '$lib/tenant/policyStore';
	import { resolveStorefrontUrl } from '$lib/tenant/dashboardCache.svelte';
	import LaunchReadiness from '$lib/components/storefront/launch/LaunchReadiness.svelte';
	import type { TabKey as LaunchTabKey } from '$lib/components/storefront/launch/types';
	import {
		resolveMarketingAsset,
		resolvePromoteTab,
		type MarketingAsset,
		type PromoteTab,
		type Setup,
		type StoreLink
	} from '$lib/components/storefront/promote/types';
	import MarketingAssetStudio from '$lib/components/storefront/promote/MarketingAssetStudio.svelte';
	import '$lib/components/storefront/launch/launch-shared.css';

	let sfProps: Partial<StorefrontContext> = $props();
	const ctx = useStorefront(() => sfProps);
	const config = $derived(ctx.config);

	const cachedDash = typeof window !== 'undefined' ? getDashboardSnapshot() : null;
	let setup = $state<Setup | null>(cachedDash?.setup ?? null);
	let store = $state<StoreLink | null>(cachedDash?.store ?? null);
	let error = $state('');
	let loading = $state(!cachedDash?.setup);
	let busy = $state(false);
	let copiedLink = $state(false);

	let activeTab = $state<PromoteTab>('publish');
	let marketingAsset = $state<MarketingAsset>('qr');

	let qr = $state<AdminQr | null>(null);
	let qrLoading = $state(false);
	let qrError = $state('');

	function setTab(tab: PromoteTab) {
		if (activeTab === tab) return;
		activeTab = tab;
		const url = new URL(window.location.href);
		url.searchParams.set('tab', tab);
		if (tab !== 'marketing') url.searchParams.delete('asset');
		else url.searchParams.set('asset', marketingAsset);
		url.hash = '';
		history.replaceState(history.state, '', url);
	}

	function onLaunchSetTab(tab: LaunchTabKey) {
		setTab(tab === 'compliance' ? 'compliance' : 'publish');
	}

	function setMarketingAsset(asset: MarketingAsset) {
		marketingAsset = asset;
		const url = new URL(window.location.href);
		url.searchParams.set('tab', 'marketing');
		url.searchParams.set('asset', asset);
		history.replaceState(history.state, '', url);
	}

	const tenantSlug = $derived(($page.data.tenantSlug as string) || '');
	let policySignature = $state<PolicySignature | null>(null);
	let policySigned = $state(false);

	function syncPolicyFromStore() {
		const slug = tenantSlug;
		if (!slug) return;
		const next = policyStore.getSignature(slug);
		policySignature = next;
		policySigned = !!next?.signed;
	}

	async function fetchLaunchData() {
		loading = true;
		try {
			const [s, l] = await Promise.all([
				api<Setup>('/api/v1/tenant/setup'),
				api<StoreLink>('/api/v1/tenant/store-link')
			]);
			setup = s;
			store = l;
			error = '';
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load publish data';
		} finally {
			loading = false;
		}
	}

	async function loadQr() {
		qrLoading = true;
		try {
			qr = await storefrontAdminApi.qr();
			qrError = '';
		} catch (err) {
			qrError = err instanceof Error ? err.message : 'Could not generate the QR code';
		} finally {
			qrLoading = false;
		}
	}

	onMount(() => {
		activeTab = resolvePromoteTab($page.url.searchParams, {
			published: cachedDash?.setup?.is_published
		});
		marketingAsset = resolveMarketingAsset($page.url.searchParams);

		syncPolicyFromStore();
		const unsub = policyStore.subscribe(() => syncPolicyFromStore());

		void fetchLaunchData().then(() => {
			// After setup loads, if no explicit tab was chosen, prefer Marketing when live.
			const hadTab = $page.url.searchParams.has('tab');
			if (!hadTab && setup?.is_published) {
				activeTab = 'marketing';
			}
		});
		void loadQr();

		return () => unsub();
	});

	const STEPS = $derived([
		{
			key: 'policy' as const,
			label: 'Merchant Policy & Compliance',
			hint: policySigned
				? `Verified by ${policySignature?.signerName || 'Owner'}`
				: 'Required before going live',
			href: '?tab=compliance',
			isTab: true,
			tab: 'compliance' as LaunchTabKey
		},
		{
			key: 'business_info' as const,
			label: 'Business Details & Contact',
			hint: 'Name, phone, address',
			href: '/shop/settings?section=business'
		},
		{
			key: 'menu' as const,
			label: 'Menu Catalog & Pricing',
			hint: 'At least one category and item',
			href: '/shop/menu'
		},
		{
			key: 'payment' as const,
			label: 'Payment Methods',
			hint: 'UPI, cash, cards',
			href: '/shop/payments'
		},
		{
			key: 'hours' as const,
			label: 'Store Schedule & Hours',
			hint: 'When customers can order',
			href: '/shop/storefront/actions?section=hours'
		},
		{
			key: 'storefront' as const,
			label: 'Theme & Branding',
			hint: 'Colors and layout',
			href: '/shop/customize'
		},
		{
			key: 'staff' as const,
			label: 'Staff Accounts',
			hint: 'Team access (optional)',
			href: '/shop/staff',
			optional: true
		}
	]);

	const required = $derived<SetupStepKey[]>(
		setup?.required ?? ['business_info', 'menu', 'payment', 'hours', 'storefront']
	);
	const steps = $derived(setup?.steps ?? null);
	const countable = $derived(STEPS.filter((s) => !s.optional));
	const done = $derived(
		(policySigned ? 1 : 0) +
			(steps
				? countable.filter((s) => s.key !== 'policy' && Boolean(steps[s.key as SetupStepKey])).length
				: 0)
	);
	const progress = $derived(
		countable.length > 0 ? Math.round((done / countable.length) * 100) || 0 : 0
	);
	const missing = $derived.by(() => {
		const base = steps ? required.filter((key) => !steps[key]) : [...required];
		if (!policySigned) return ['policy', ...base];
		return base;
	});
	const canPublish = $derived(Boolean(setup) && Boolean(steps) && policySigned && missing.length === 0);

	function stepLabel(key: string): string {
		if (key === 'policy') return 'Merchant compliance policy';
		return STEPS.find((s) => s.key === key)?.label ?? key;
	}

	const storefrontUrl = $derived(store ? resolveStorefrontUrl(store) : '');

	async function loadSetup() {
		setup = await api<Setup>('/api/v1/tenant/setup');
		await ctx.refresh();
	}

	async function publish() {
		if (!policySigned) {
			toast.error('Sign the Business Policy before going live.');
			setTab('compliance');
			return;
		}
		if (busy) return;
		busy = true;
		try {
			await api('/api/v1/tenant/publish', { method: 'POST' });
			toast.success('Storefront is now live.');
			await loadSetup();
			store = await api<StoreLink>('/api/v1/tenant/store-link');
			void loadQr();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Could not publish');
		} finally {
			busy = false;
		}
	}

	async function unpublish() {
		if (busy) return;
		if (!window.confirm('Take your store offline? Customers will not be able to order.')) return;
		busy = true;
		try {
			await api('/api/v1/tenant/unpublish', { method: 'POST' });
			toast.info('Store taken offline.');
			await loadSetup();
			void loadQr();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Could not unpublish');
		} finally {
			busy = false;
		}
	}

	async function copyLink() {
		if (!storefrontUrl) return;
		try {
			await navigator.clipboard.writeText(storefrontUrl);
			copiedLink = true;
			toast.success('Link copied');
			setTimeout(() => (copiedLink = false), 2000);
		} catch {
			toast.error('Could not copy — select the link manually');
		}
	}

	async function share() {
		if (!storefrontUrl) return;
		if (navigator.share) {
			try {
				await navigator.share({ title: store?.name ?? 'Storefront', url: storefrontUrl });
				return;
			} catch {
				/* dismissed */
			}
		}
		await copyLink();
	}

</script>

<header class="studio-header">
	<div class="studio-header-main">
		<div class="studio-header-titles">
			<h1 class="studio-title">Publish &amp; Marketing</h1>
			<p class="studio-subtitle">
				Go live, then generate QR codes, business cards, thumbnails and print banners for your shop.
			</p>
		</div>

		<div class="studio-header-pills">
			{#if setup?.is_published}
				<span class="live-status-pill online">
					<span class="pulse-dot"></span>
					Live
				</span>
			{:else if !policySigned}
				<span class="live-status-pill policy-block">
					<Lock size={13} strokeWidth={2.2} />
					Policy Required
				</span>
			{:else}
				<span class="live-status-pill draft">Draft</span>
			{/if}

			{#if storefrontUrl && setup?.is_published}
				<a
					href={storefrontUrl}
					target="_blank"
					rel="noreferrer"
					class="btn btn-ghost btn-sm studio-view-link"
				>
					<ExternalLink size={14} strokeWidth={2} />
					View Store
				</a>
			{/if}
		</div>
	</div>

	<nav class="studio-tabs" aria-label="Publish and marketing sections">
		<button
			type="button"
			class="studio-tab-btn"
			class:active={activeTab === 'publish'}
			onclick={() => setTab('publish')}
		>
			<Rocket size={17} strokeWidth={activeTab === 'publish' ? 2.2 : 1.75} />
			<span>Publish</span>
			<span class="studio-tab-badge" class:done={canPublish}>{progress}%</span>
		</button>
		<button
			type="button"
			class="studio-tab-btn"
			class:active={activeTab === 'marketing'}
			onclick={() => setTab('marketing')}
		>
			<Megaphone size={17} strokeWidth={activeTab === 'marketing' ? 2.2 : 1.75} />
			<span>Marketing</span>
		</button>
		<button
			type="button"
			class="studio-tab-btn"
			class:active={activeTab === 'compliance'}
			onclick={() => setTab('compliance')}
		>
			<ShieldCheck size={17} strokeWidth={activeTab === 'compliance' ? 2.2 : 1.75} />
			<span>Policy</span>
			{#if !policySigned}
				<span class="studio-tab-chip warning">Sign</span>
			{:else}
				<span class="studio-tab-chip verified">OK</span>
			{/if}
		</button>
	</nav>
</header>

{#if activeTab === 'publish'}
	<LaunchReadiness
		{setup}
		{storefrontUrl}
		{loading}
		{error}
		{busy}
		{policySigned}
		{policySignature}
		{progress}
		{done}
		{countable}
		{canPublish}
		{missing}
		{STEPS}
		{copiedLink}
		onPublish={publish}
		onUnpublish={unpublish}
		onSetTab={onLaunchSetTab}
		onCopyLink={copyLink}
		onShare={share}
		onRetry={fetchLaunchData}
		{stepLabel}
	/>
{:else if activeTab === 'marketing'}
	<MarketingAssetStudio
		bind:asset={marketingAsset}
		{config}
		{qr}
		{qrLoading}
		{qrError}
		onRetryQr={loadQr}
		onAssetChange={setMarketingAsset}
	/>
{:else if activeTab === 'compliance'}
	{#await import('$lib/components/storefront/launch/LaunchCompliance.svelte')}
		<div class="studio-loading"><Skeleton height="12rem" /></div>
	{:then m}
		<m.default
			{tenantSlug}
			{store}
			bind:policySigned
			bind:policySignature
			onSetTab={onLaunchSetTab}
		/>
	{:catch}
		<ErrorState message="Could not load policy" />
	{/await}
{/if}

<style>
	.studio-header {
		display: flex;
		flex-direction: column;
		gap: 1.1rem;
		margin-bottom: 1.35rem;
	}
	.studio-header-main {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1.25rem;
		flex-wrap: wrap;
	}
	.studio-title {
		font-family: var(--font-display);
		font-size: 1.65rem;
		font-weight: 700;
		letter-spacing: -0.02em;
		color: var(--text);
		margin: 0 0 0.3rem;
	}
	.studio-subtitle {
		margin: 0;
		font-size: var(--fs-body, 0.875rem);
		color: var(--text-2);
		max-width: 42rem;
		line-height: 1.4;
	}
	.studio-header-pills {
		display: flex;
		align-items: center;
		gap: 0.55rem;
	}
	.live-status-pill {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.3rem 0.7rem;
		border-radius: 999px;
		font-size: var(--fs-meta, 0.75rem);
		font-weight: 650;
	}
	.live-status-pill.online {
		background: rgba(16, 185, 129, 0.12);
		color: #10b981;
		border: 1px solid rgba(16, 185, 129, 0.3);
	}
	.live-status-pill.policy-block {
		background: rgba(239, 68, 68, 0.12);
		color: #ef4444;
		border: 1px solid rgba(239, 68, 68, 0.3);
	}
	.live-status-pill.draft {
		background: var(--surface-3);
		color: var(--text-2);
		border: 1px solid var(--border);
	}
	.pulse-dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: #10b981;
	}
	.studio-tabs {
		display: flex;
		align-items: center;
		gap: 0.3rem;
		border-bottom: 1px solid var(--border);
		overflow-x: auto;
		scrollbar-width: none;
	}
	.studio-tabs::-webkit-scrollbar {
		display: none;
	}
	.studio-tab-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		padding: 0.6rem 0.85rem;
		border: none;
		background: transparent;
		color: var(--text-2);
		font: inherit;
		font-size: var(--fs-body, 0.875rem);
		font-weight: 550;
		cursor: pointer;
		border-radius: var(--radius-sm, 6px);
		white-space: nowrap;
		position: relative;
	}
	.studio-tab-btn:hover {
		color: var(--text);
		background: var(--surface-2);
	}
	.studio-tab-btn.active {
		color: var(--text);
		font-weight: 650;
		background: var(--surface-2);
	}
	.studio-tab-btn.active::after {
		content: '';
		position: absolute;
		bottom: -1px;
		left: 0.45rem;
		right: 0.45rem;
		height: 2px;
		background: var(--accent);
		border-radius: 999px;
	}
	.studio-tab-badge {
		font-size: 0.68rem;
		font-weight: 700;
		padding: 0.1rem 0.35rem;
		border-radius: 999px;
		background: var(--surface-3);
		color: var(--text-3);
	}
	.studio-tab-badge.done {
		background: rgba(16, 185, 129, 0.15);
		color: #10b981;
	}
	.studio-tab-chip {
		font-size: 0.62rem;
		font-weight: 700;
		padding: 0.1rem 0.35rem;
		border-radius: 4px;
		text-transform: uppercase;
	}
	.studio-tab-chip.warning {
		background: rgba(239, 68, 68, 0.15);
		color: #ef4444;
	}
	.studio-tab-chip.verified {
		background: rgba(16, 185, 129, 0.15);
		color: #10b981;
	}
	.studio-loading {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
</style>
