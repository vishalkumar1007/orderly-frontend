<script lang="ts">
	import type { DashboardSetup, SetupStepKey } from '$lib/tenant/dashboardCache.svelte';
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import {
		IconRocket,
		IconCircleCheck,
		IconCircleDashed,
		IconAlertCircle,
		IconAlertTriangle,
		IconExternalLink,
		IconQrcode,
		IconShare,
		IconCopy,
		IconCheck,
		IconClock,
		IconAdjustmentsHorizontal,
		IconSpeakerphone,
		IconShieldCheck,
		IconShieldExclamation,
		IconSparkles,
		IconInfoCircle,
		IconBuildingStore,
		IconLock,
		IconArrowRight,
		IconChevronRight
	} from '@tabler/icons-svelte';

	import { api } from '$lib/api/client';
	import { me, type User } from '$lib/auth';
	import ErrorState from '$lib/components/admin/ErrorState.svelte';
	import Skeleton from '$lib/components/admin/Skeleton.svelte';
	import StatusBadge from '$lib/components/admin/StatusBadge.svelte';
	import Switch from '$lib/components/admin/Switch.svelte';
	import OpeningHoursForm from '$lib/components/storefront/OpeningHoursForm.svelte';
	import { storefrontAdminApi } from '$lib/storefront/admin';
	import { useStorefront, type StorefrontContext } from '$lib/storefront/admin-context';
	import { toast } from '$lib/components/admin/toast';
	import { policyStore, type PolicySignature } from '$lib/tenant/policyStore';
	import BusinessPolicyModal from '$lib/components/tenant/BusinessPolicyModal.svelte';

	type Setup = DashboardSetup;
	type StoreLink = { name: string; public_host: string; public_path: string; is_published: boolean };
	type TabKey = 'readiness' | 'hours' | 'operations' | 'broadcast' | 'compliance';
	type BroadcastType = 'alert' | 'msg' | 'offer' | 'others';

	let sfProps: Partial<StorefrontContext> = $props();
	const ctx = useStorefront(() => sfProps);
	const config = $derived(ctx.config);
	const save = (run: Parameters<StorefrontContext['save']>[0]) => ctx.save(run);

	let setup = $state<Setup | null>(null);
	let store = $state<StoreLink | null>(null);
	let user = $state<User | null>(null);
	let error = $state('');
	let loading = $state(true);
	let busy = $state(false);
	let togglingOrdering = $state(false);
	let copiedLink = $state(false);

	// Studio subpage / tabs
	const activeTab = $derived<TabKey>(
		(($page.url.searchParams.get('tab') as TabKey) || 'readiness')
	);

	function setTab(tab: TabKey) {
		goto(`?tab=${tab}`, { replaceState: true, noScroll: true, keepFocus: true });
	}

	// Policy State
	const tenantSlug = $derived(($page.data.tenantSlug as string) || '');
	let policySignature = $state<PolicySignature | null>(null);
	let policySigned = $state(false);
	let showPolicyModal = $state(false);

	// Inline compliance sign form
	let signerName = $state('');
	let agreedToTerms = $state(false);
	let signingPolicy = $state(false);

	// Operational Status
	const STORE_STATUS_OPTIONS = [
		{
			value: 'OPEN',
			label: 'Open',
			desc: 'Accepting orders normally. Storefront operates at full capacity.',
			color: 'var(--success, #10b981)',
			dotClass: 'status-open'
		},
		{
			value: 'BUSY',
			label: 'Busy',
			desc: 'High kitchen/order volume. Customers are advised orders may take longer.',
			color: 'var(--warning, #f59e0b)',
			dotClass: 'status-busy'
		},
		{
			value: 'AWAY',
			label: 'Away',
			desc: 'Temporarily paused. Counter will return shortly.',
			color: 'var(--accent, #3b82f6)',
			dotClass: 'status-away'
		},
		{
			value: 'CLOSED',
			label: 'Closed',
			desc: 'Closed for business. Checkout is stopped.',
			color: 'var(--danger, #ef4444)',
			dotClass: 'status-closed'
		}
	] as const;

	let savingStatus = $state(false);

	// Ordering enabled & Closed Message
	let closedMessageInput = $state('');
	let savingClosedMessage = $state(false);

	// Customer Broadcast banner
	let broadcastType = $state<BroadcastType>('offer');
	let broadcastText = $state('');
	let savingBroadcast = $state(false);

	function parseBroadcast(msg: string): { type: BroadcastType; text: string } {
		if (!msg) return { type: 'msg', text: '' };
		const match = msg.match(/^\[(alert|msg|offer|others)\]\s*(.*)$/i);
		if (match) {
			const t = match[1].toLowerCase() as BroadcastType;
			return { type: t, text: match[2] };
		}
		return { type: 'msg', text: msg };
	}

	function formatBroadcast(type: BroadcastType, text: string): string {
		const clean = text.trim();
		if (!clean) return '';
		return `[${type}] ${clean}`;
	}

	$effect(() => {
		if (tenantSlug) {
			policySignature = policyStore.getSignature(tenantSlug);
			policySigned = !!policySignature?.signed;
		}
	});

	$effect(() => {
		if (config) {
			closedMessageInput = config.behaviour.closed_message || '';
			const parsed = parseBroadcast(config.behaviour.status_message || '');
			if (parsed.text) {
				broadcastType = parsed.type;
				broadcastText = parsed.text;
			}
		}
	});

	onMount(() => {
		const unsub = policyStore.subscribe(() => {
			if (tenantSlug) {
				policySignature = policyStore.getSignature(tenantSlug);
				policySigned = !!policySignature?.signed;
			}
		});

		(async () => {
			try {
				const [s, l, u] = await Promise.all([
					api<Setup>('/api/v1/tenant/setup'),
					api<StoreLink>('/api/v1/tenant/store-link'),
					me().catch(() => null)
				]);
				setup = s;
				store = l;
				user = u;
				if (user?.name && !signerName) {
					signerName = user.name;
				}
			} catch (err) {
				error = err instanceof Error ? err.message : 'Failed to load launch studio data';
			} finally {
				loading = false;
			}
		})();

		return () => {
			unsub();
		};
	});

	// Launch checklist steps
	const STEPS = $derived([
		{
			key: 'policy' as const,
			label: 'Merchant Policy & Compliance',
			hint: policySigned
				? `Digitally verified by ${policySignature?.signerName || 'Owner'} on ${policySignature?.signedAt ? new Date(policySignature.signedAt).toLocaleDateString() : 'file'}`
				: 'Orderly Platform Merchant Agreement (Required before going live)',
			href: '?tab=compliance',
			isTab: true,
			tab: 'compliance' as TabKey
		},
		{
			key: 'business_info' as const,
			label: 'Business Details & Contact',
			hint: 'Brand name, public phone, address, and city for storefront',
			href: '/shop/settings?section=business'
		},
		{
			key: 'menu' as const,
			label: 'Menu Catalog & Pricing',
			hint: 'At least one active category and item ready for ordering',
			href: '/shop/menu'
		},
		{
			key: 'payment' as const,
			label: 'Payment Methods & Gateways',
			hint: 'Payment options enabled for customer checkout (UPI, Cash, Cards)',
			href: '/shop/payments'
		},
		{
			key: 'hours' as const,
			label: 'Store Schedule & Operating Hours',
			hint: 'Operating shifts when customers can place pickup or delivery orders',
			href: '?tab=hours',
			isTab: true,
			tab: 'hours' as TabKey
		},
		{
			key: 'storefront' as const,
			label: 'Storefront Theme & Branding',
			hint: 'Colors, banner, layout style, and brand identity',
			href: '/shop/customize'
		},
		{
			key: 'staff' as const,
			label: 'Staff Accounts & Terminal Access',
			hint: 'Add team members who will prepare orders and run counter',
			href: '/shop/staff',
			optional: true
		}
	]);

	const required = $derived<SetupStepKey[]>(
		setup?.required ?? ['business_info', 'menu', 'payment', 'hours', 'storefront']
	);
	const countable = $derived(STEPS.filter((s) => !s.optional));
	const done = $derived(
		(policySigned ? 1 : 0) +
			(setup ? countable.filter((s) => s.key !== 'policy' && setup!.steps[s.key as SetupStepKey]).length : 0)
	);
	const progress = $derived(Math.round((done / countable.length) * 100));
	const missing = $derived.by(() => {
		const base = setup ? required.filter((key) => !setup!.steps[key]) : required;
		if (!policySigned) return ['policy' as any, ...base];
		return base;
	});

	// Strict go live blocker: must have all required setup steps AND signed merchant policy
	const canPublish = $derived(Boolean(setup) && policySigned && missing.length === 0);

	function stepLabel(key: string): string {
		if (key === 'policy') return 'Merchant compliance policy';
		return STEPS.find((s) => s.key === key)?.label ?? key;
	}

	const storefrontUrl = $derived(
		store ? `http://${store.public_host}${store.public_path}` : ''
	);

	const orderingEnabled = $derived(config.behaviour.ordering_enabled);
	const currentStoreStatus = $derived(config.behaviour.store_status || 'OPEN');

	async function loadSetup() {
		setup = await api<Setup>('/api/v1/tenant/setup');
		await ctx.refresh();
	}

	async function publish() {
		if (!policySigned) {
			toast.error('You must sign the Orderly Business Policy before taking your store live.');
			setTab('compliance');
			return;
		}
		if (busy) return;
		busy = true;
		try {
			await api('/api/v1/tenant/publish', { method: 'POST' });
			toast.success('Congratulations! Your storefront is now LIVE to customers.');
			await loadSetup();
			const l = await api<StoreLink>('/api/v1/tenant/store-link');
			store = l;
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Could not publish store');
		} finally {
			busy = false;
		}
	}

	async function unpublish() {
		if (busy) return;
		const confirm = window.confirm(
			'Are you sure you want to take your store offline? Customers will no longer be able to browse or order.'
		);
		if (!confirm) return;

		busy = true;
		try {
			await api('/api/v1/tenant/unpublish', { method: 'POST' });
			toast.info('Store taken offline. It is now unpublished.');
			await loadSetup();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Could not unpublish store');
		} finally {
			busy = false;
		}
	}

	async function handleSetStatus(status: 'OPEN' | 'BUSY' | 'AWAY' | 'CLOSED') {
		if (savingStatus || currentStoreStatus === status) return;
		savingStatus = true;
		const ok = await save(() => storefrontAdminApi.saveBehaviour({ store_status: status }));
		savingStatus = false;
		if (ok) {
			toast.success(`Store status changed to ${status}`);
		} else {
			toast.error('Failed to update store status');
		}
	}

	async function toggleOrdering(next: boolean) {
		if (togglingOrdering) return;
		togglingOrdering = true;
		const ok = await save(() => storefrontAdminApi.saveBehaviour({ ordering_enabled: next }));
		togglingOrdering = false;
		if (ok) {
			toast.success(next ? 'Customer ordering enabled' : 'Ordering paused (Browse-only mode)');
		} else {
			toast.error('Could not change ordering availability');
		}
	}

	async function saveClosedMessage() {
		if (savingClosedMessage) return;
		savingClosedMessage = true;
		const ok = await save(() =>
			storefrontAdminApi.saveBehaviour({ closed_message: closedMessageInput.trim() })
		);
		savingClosedMessage = false;
		if (ok) {
			toast.success('Closed store notice saved');
		} else {
			toast.error('Could not save closed message');
		}
	}

	async function saveBroadcast() {
		if (savingBroadcast) return;
		savingBroadcast = true;
		const payload = formatBroadcast(broadcastType, broadcastText);
		const ok = await save(() => storefrontAdminApi.saveBehaviour({ status_message: payload }));
		savingBroadcast = false;
		if (ok) {
			toast.success(
				payload ? 'Customer broadcast published to storefront' : 'Broadcast banner removed'
			);
		} else {
			toast.error('Failed to save broadcast');
		}
	}

	async function clearBroadcast() {
		broadcastText = '';
		await saveBroadcast();
	}

	function applyBroadcastPreset(type: BroadcastType, text: string) {
		broadcastType = type;
		broadcastText = text;
	}

	async function handleSignPolicy() {
		if (!signerName.trim()) {
			toast.error('Please enter your legal name as authorized signer.');
			return;
		}
		if (!agreedToTerms) {
			toast.error('Please accept the agreement checkbox to sign.');
			return;
		}
		signingPolicy = true;
		try {
			policyStore.sign(tenantSlug, signerName.trim(), user?.email || 'owner@orderly.store');
			policySignature = policyStore.getSignature(tenantSlug);
			policySigned = true;
			toast.success('Orderly Business Policy signed and verified. Setup unlocked!');
		} finally {
			signingPolicy = false;
		}
	}

	async function copyLink() {
		if (!storefrontUrl) return;
		try {
			await navigator.clipboard.writeText(storefrontUrl);
			copiedLink = true;
			toast.success('Storefront link copied to clipboard');
			setTimeout(() => {
				copiedLink = false;
			}, 2500);
		} catch {
			toast.error('Could not copy automatically. Select link to copy.');
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

{#if error}
	<ErrorState message={error} />
{/if}

{#if loading}
	<div class="studio-loading">
		<Skeleton height="3.5rem" />
		<Skeleton height="14rem" />
		<Skeleton height="20rem" />
	</div>
{:else if setup}
	<!-- Studio Header -->
	<header class="studio-header">
		<div class="studio-header-main">
			<div class="studio-header-titles">
				<h1 class="studio-title">Storefront Launch Studio</h1>
				<p class="studio-subtitle">
					Configure your live storefront status, operating schedule, customer broadcasts, and compliance readiness.
				</p>
			</div>

			<div class="studio-header-pills">
				{#if setup.is_published}
					<span class="live-status-pill online">
						<span class="pulse-dot"></span>
						<span>Live on Web</span>
					</span>
				{:else if !policySigned}
					<span class="live-status-pill policy-block">
						<IconLock size={13} stroke={2.2} />
						<span>Policy Required</span>
					</span>
				{:else}
					<span class="live-status-pill draft">
						<IconClock size={13} stroke={2} />
						<span>Unpublished Draft</span>
					</span>
				{/if}

				{#if storefrontUrl && setup.is_published}
					<a
						href={storefrontUrl}
						target="_blank"
						rel="noreferrer"
						class="btn btn-ghost btn-sm studio-view-link"
					>
						<IconExternalLink size={14} stroke={2} />
						<span>View Store</span>
					</a>
				{/if}
			</div>
		</div>

		<!-- Navigation Subpage Tabs -->
		<nav class="studio-tabs" aria-label="Launch Studio Sections">
			<button
				type="button"
				class="studio-tab-btn"
				class:active={activeTab === 'readiness'}
				onclick={() => setTab('readiness')}
			>
				<IconRocket size={17} stroke={activeTab === 'readiness' ? 2.2 : 1.75} />
				<span>Launch Readiness</span>
				<span class="studio-tab-badge" class:done={canPublish}>{progress}%</span>
			</button>

			<button
				type="button"
				class="studio-tab-btn"
				class:active={activeTab === 'hours'}
				onclick={() => setTab('hours')}
			>
				<IconClock size={17} stroke={activeTab === 'hours' ? 2.2 : 1.75} />
				<span>Store Time &amp; Hours</span>
			</button>

			<button
				type="button"
				class="studio-tab-btn"
				class:active={activeTab === 'operations'}
				onclick={() => setTab('operations')}
			>
				<IconAdjustmentsHorizontal size={17} stroke={activeTab === 'operations' ? 2.2 : 1.75} />
				<span>Status &amp; Ordering</span>
				<span class="studio-tab-dot {currentStoreStatus.toLowerCase()}"></span>
			</button>

			<button
				type="button"
				class="studio-tab-btn"
				class:active={activeTab === 'broadcast'}
				onclick={() => setTab('broadcast')}
			>
				<IconSpeakerphone size={17} stroke={activeTab === 'broadcast' ? 2.2 : 1.75} />
				<span>Customer Banner</span>
				{#if config.behaviour.status_message}
					<span class="studio-tab-chip active">Active</span>
				{/if}
			</button>

			<button
				type="button"
				class="studio-tab-btn"
				class:active={activeTab === 'compliance'}
				onclick={() => setTab('compliance')}
			>
				<IconShieldCheck size={17} stroke={activeTab === 'compliance' ? 2.2 : 1.75} />
				<span>Policy &amp; Legal</span>
				{#if !policySigned}
					<span class="studio-tab-chip warning">Sign Req</span>
				{:else}
					<span class="studio-tab-chip verified">Verified</span>
				{/if}
			</button>
		</nav>
	</header>

	<!-- TAB 1: LAUNCH READINESS -->
	{#if activeTab === 'readiness'}
		<div class="studio-content-grid">
			<!-- Go-Live Hero Master Card -->
			<div class="panel studio-hero-card">
				<div class="studio-hero-top">
					<div class="hero-text-block">
						<div class="hero-badge-wrap">
							<StatusBadge status={setup.setup_status} />
							{#if !policySigned}
								<span class="badge-lock">
									<IconLock size={12} stroke={2.4} /> Policy Unsigned
								</span>
							{/if}
						</div>
						<h2 class="hero-heading">
							{setup.is_published
								? 'Your storefront is live and public'
								: 'Take your storefront live to customers'}
						</h2>
						<p class="hero-desc">
							{setup.is_published
								? 'Customers can reach your catalog, place orders, and pay online. Manage real-time operational switches below.'
								: `${done} of ${countable.length} launch milestones verified (${progress}% completed). Complete prerequisites to publish.`}
						</p>
					</div>

					<div class="hero-actions-block">
						{#if setup.is_published}
							<button
								class="btn btn-ghost hero-offline-btn"
								type="button"
								disabled={busy}
								onclick={unpublish}
							>
								Take Store Offline
							</button>
						{:else}
							<button
								class="btn btn-primary hero-publish-btn"
								type="button"
								disabled={!canPublish || busy}
								onclick={publish}
							>
								{#if !policySigned}
									<IconLock size={16} stroke={2.2} />
									Sign Policy to Go Live
								{:else}
									<IconRocket size={16} stroke={2.2} />
									{busy ? 'Publishing…' : 'Publish Store & Go Live'}
								{/if}
							</button>
						{/if}
					</div>
				</div>

				<!-- Executive Segmented Milestone Progress Indicator -->
				<div class="launch-progress-box">
					<div class="progress-meta-row">
						<span class="progress-label">Launch Readiness Milestones</span>
						<span class="progress-counter-badge">
							<strong>{done}</strong> of <strong>{countable.length}</strong> milestones verified ({progress}%)
						</span>
					</div>

					<div
						class="segmented-track"
						role="progressbar"
						aria-valuenow={progress}
						aria-valuemin="0"
						aria-valuemax="100"
					>
						{#each countable as step (step.key)}
							{@const isStepDone = step.key === 'policy' ? policySigned : (setup ? setup.steps[step.key as SetupStepKey] : false)}
							<div
								class="segment-bar"
								class:completed={isStepDone}
								title={`${step.label}: ${isStepDone ? 'Completed' : 'Pending'}`}
							></div>
						{/each}
					</div>
				</div>

				<!-- Blocked warning notice if policy unsigned -->
				{#if !policySigned}
					<div class="policy-notice-box">
						<IconShieldExclamation size={20} stroke={2} class="policy-notice-icon" />
						<div class="policy-notice-body">
							<strong>Orderly Business Operations Policy must be signed</strong>
							<p>
								Per platform compliance guidelines, all store operators must review and digitally sign the Merchant Agreement before publishing a live storefront.
							</p>
						</div>
						<button
							class="btn btn-primary btn-sm policy-sign-cta"
							type="button"
							onclick={() => setTab('compliance')}
						>
							Review &amp; Sign Policy
						</button>
					</div>
				{:else if !canPublish && missing.length > 0}
					<div class="checklist-notice-box">
						<IconAlertCircle size={18} stroke={2} class="checklist-notice-icon" />
						<div class="checklist-notice-body">
							<strong>Outstanding steps remaining before publish:</strong>
							<span>{missing.map(stepLabel).join(', ')}.</span>
						</div>
					</div>
				{/if}
			</div>

			<!-- Step-by-Step Checklist Cards (No div side colors) -->
			<div class="panel studio-checklist-panel">
				<div class="section-title-wrap">
					<div>
						<h3 class="section-h">Launch Setup Milestones</h3>
						<p class="section-note">
							Follow each step to ensure your storefront is fully configured and optimized for operations.
						</p>
					</div>
					<span class="milestones-counter">{done} / {countable.length} Completed</span>
				</div>

				<ul class="checklist-grid">
					{#each STEPS as s, i (s.key)}
						{@const isDone = s.key === 'policy' ? policySigned : (setup ? setup.steps[s.key as SetupStepKey] : false)}
						<li class="checklist-item-card" class:is-done={isDone}>
							<div class="check-icon-wrap" class:done={isDone}>
								{#if isDone}
									<IconCircleCheck size={20} stroke={2.2} />
								{:else}
									<IconCircleDashed size={20} stroke={1.8} />
								{/if}
							</div>

							<div class="check-main-wrap">
								<div class="check-title-row">
									<h4 class="check-title">
										<span class="step-num">{i + 1}.</span> {s.label}
									</h4>
									{#if s.optional}
										<span class="optional-pill">Optional</span>
									{/if}
									{#if isDone}
										<span class="status-chip success">
											{s.key === 'policy' ? 'Verified' : 'Ready'}
										</span>
									{:else if s.key === 'policy'}
										<span class="status-chip warning">Signature Required</span>
									{:else}
										<span class="status-chip pending">Incomplete</span>
									{/if}
								</div>
								<p class="check-hint">{s.hint}</p>
							</div>

							<div class="check-action-wrap">
								{#if s.isTab}
									<button
										type="button"
										class="btn btn-ghost btn-sm check-action-btn"
										onclick={() => setTab(s.tab)}
									>
										<span>{isDone ? 'View' : 'Configure'}</span>
										<IconArrowRight size={14} stroke={2} />
									</button>
								{:else}
									<a class="btn btn-ghost btn-sm check-action-btn" href={s.href}>
										<span>{isDone ? 'Review' : 'Configure'}</span>
										<IconArrowRight size={14} stroke={2} />
									</a>
								{/if}
							</div>
						</li>
					{/each}
				</ul>
			</div>

			<!-- Share & QR Distribution Hub -->
			{#if storefrontUrl}
				<div class="panel studio-share-panel">
					<div class="share-panel-header">
						<div>
							<h3 class="section-h">Storefront Distribution &amp; Customer Link</h3>
							<p class="section-note">
								Share your storefront web address or print the table QR code for in-person orders.
							</p>
						</div>
						<a class="btn btn-ghost btn-sm" href="/shop/storefront/qr">
							<IconQrcode size={15} stroke={2} />
							<span>QR Designer</span>
						</a>
					</div>

					<div class="share-link-box">
						<code class="share-url">{storefrontUrl}</code>
						<button
							type="button"
							class="btn btn-ghost btn-sm copy-btn"
							onclick={copyLink}
						>
							{#if copiedLink}
								<IconCheck size={15} stroke={2.4} style="color:var(--success)" />
								<span>Copied!</span>
							{:else}
								<IconCopy size={15} stroke={2} />
								<span>Copy Link</span>
							{/if}
						</button>
					</div>

					<div class="share-actions-row">
						<button class="btn btn-ghost" type="button" onclick={share}>
							<IconShare size={15} stroke={2} />
							<span>Share Link</span>
						</button>
						<a class="btn btn-ghost" href={storefrontUrl} target="_blank" rel="noreferrer">
							<IconExternalLink size={15} stroke={2} />
							<span>Open Storefront</span>
						</a>
						<a class="btn btn-ghost" href="/shop/storefront/qr">
							<IconQrcode size={15} stroke={2} />
							<span>Print QR Code</span>
						</a>
					</div>
				</div>
			{/if}
		</div>
	{/if}

	<!-- TAB 2: STORE SCHEDULE & HOURS -->
	{#if activeTab === 'hours'}
		<div class="studio-content-grid">
			<div class="panel studio-section-intro">
				<div class="intro-icon-wrap">
					<IconClock size={24} stroke={1.8} />
				</div>
				<div>
					<h2 class="intro-h">Store Schedule &amp; Opening Hours</h2>
					<p class="intro-p">
						Control the weekly operating schedule for your storefront. Outside of scheduled hours, the storefront will display a closed notice and stop new checkout orders.
					</p>
				</div>
			</div>

			<div class="panel studio-hours-panel">
				<OpeningHoursForm {...sfProps} onsaved={loadSetup} />
			</div>
		</div>
	{/if}

	<!-- TAB 3: REAL-TIME OPERATIONS & STATUS -->
	{#if activeTab === 'operations'}
		<div class="studio-content-grid">
			<div class="panel studio-section-intro">
				<div class="intro-icon-wrap">
					<IconAdjustmentsHorizontal size={24} stroke={1.8} />
				</div>
				<div>
					<h2 class="intro-h">Real-Time Store Status &amp; Ordering Controls</h2>
					<p class="intro-p">
						Quickly update your storefront operational status based on counter/kitchen capacity, or pause incoming orders in one click.
					</p>
				</div>
			</div>

			<!-- 4-Way Store Status Cards (No div side colors) -->
			<div class="panel status-selector-panel">
				<div class="section-title-wrap">
					<div>
						<h3 class="section-h">Store Operational Status</h3>
						<p class="section-note">
							Changes reflect immediately across your customer storefront banner and store indicators.
						</p>
					</div>
					{#if savingStatus}
						<span class="saving-indicator">Saving updates…</span>
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

			<!-- Online Ordering Toggle -->
			<div class="panel ordering-toggle-panel">
				<div class="ordering-switch-row">
					<div class="switch-meta">
						<h3 class="section-h">Accepting Customer Orders</h3>
						<p class="section-note">
							{orderingEnabled
								? 'Ordering is active. Customers can add menu items to the cart and proceed to payment/checkout.'
								: 'Ordering is paused. Storefront is in browse-only digital menu mode.'}
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

			<!-- Closed Store Message -->
			<div class="panel closed-message-panel">
				<div class="section-title-wrap">
					<div>
						<h3 class="section-h">Closed Store Customer Message</h3>
						<p class="section-note">
							Custom explanation displayed to customers when ordering is disabled or store is closed.
						</p>
					</div>
				</div>

				<div class="closed-msg-input-wrap">
					<input
						type="text"
						class="text-input closed-msg-input"
						placeholder="e.g. We are closed for private catering today. Reopening at 10 AM tomorrow!"
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
		</div>
	{/if}

	<!-- TAB 4: STOREFRONT BROADCAST & BANNER -->
	{#if activeTab === 'broadcast'}
		<div class="studio-content-grid">
			<div class="panel studio-section-intro">
				<div class="intro-icon-wrap">
					<IconSpeakerphone size={24} stroke={1.8} />
				</div>
				<div>
					<h2 class="intro-h">Customer Announcements &amp; Broadcast Banner</h2>
					<p class="intro-p">
						Display a high-visibility announcement banner pinned to the top of your storefront. Perfect for flash offers, weather advisories, or welcoming first-time visitors.
					</p>
				</div>
			</div>

			<div class="panel broadcast-builder-panel">
				<!-- Category Selector -->
				<div class="broadcast-type-selection">
					<label class="form-label" for="broadcast-type">Select Announcement Type</label>
					<div class="type-pill-grid" id="broadcast-type">
						<button
							type="button"
							class="type-pill-btn offer"
							class:active={broadcastType === 'offer'}
							onclick={() => (broadcastType = 'offer')}
						>
							<IconSparkles size={16} stroke={2} />
							<span>🏷️ Special Offer</span>
						</button>

						<button
							type="button"
							class="type-pill-btn alert"
							class:active={broadcastType === 'alert'}
							onclick={() => (broadcastType = 'alert')}
						>
							<IconAlertCircle size={16} stroke={2} />
							<span>🚨 Urgent Alert</span>
						</button>

						<button
							type="button"
							class="type-pill-btn msg"
							class:active={broadcastType === 'msg'}
							onclick={() => (broadcastType = 'msg')}
						>
							<IconInfoCircle size={16} stroke={2} />
							<span>💬 General Message</span>
						</button>

						<button
							type="button"
							class="type-pill-btn others"
							class:active={broadcastType === 'others'}
							onclick={() => (broadcastType = 'others')}
						>
							<IconBuildingStore size={16} stroke={2} />
							<span>ℹ️ Other Information</span>
						</button>
					</div>
				</div>

				<!-- Message Input Area -->
				<div class="broadcast-composer">
					<div class="composer-header">
						<label class="form-label" for="broadcast-text">Banner Announcement Message</label>
						<span class="char-counter" class:warn={broadcastText.length > 180}>
							{broadcastText.length} / 200 characters
						</span>
					</div>
					<textarea
						id="broadcast-text"
						class="text-input broadcast-textarea"
						rows={3}
						placeholder="Write an announcement to display across your storefront..."
						maxlength={200}
						bind:value={broadcastText}
					></textarea>

					<!-- Quick presets -->
					<div class="presets-row">
						<span class="presets-label">Quick templates:</span>
						<div class="presets-chips">
							<button
								type="button"
								class="preset-chip"
								onclick={() =>
									applyBroadcastPreset(
										'offer',
										'🎉 Flat 20% OFF all orders above ₹499 today! Use code CELEBRATE at checkout.'
									)}
							>
								⚡ 20% Discount Deal
							</button>
							<button
								type="button"
								class="preset-chip"
								onclick={() =>
									applyBroadcastPreset(
										'alert',
										'⚠️ Heavy rain in the area: preparation and pickup times may be delayed by 15 mins.'
									)}
							>
								🌧️ Weather Delay Alert
							</button>
							<button
								type="button"
								class="preset-chip"
								onclick={() =>
									applyBroadcastPreset(
										'msg',
										'👋 Welcome to our online storefront! Explore our freshly curated seasonal dishes.'
									)}
							>
								🍲 Welcome Note
							</button>
							<button
								type="button"
								class="preset-chip"
								onclick={() =>
									applyBroadcastPreset(
										'others',
										'✨ Corporate party & catering orders available! Contact counter staff for details.'
									)}
							>
								🎂 Catering Inquiries
							</button>
						</div>
					</div>
				</div>

				<!-- LIVE REALTIME PREVIEW OF BROADCAST -->
				<div class="broadcast-live-preview-box">
					<div class="preview-header">
						<span>Live Storefront Preview</span>
						<span class="preview-sub">As seen by customers on your website</span>
					</div>

					<div class="preview-browser-frame">
						<div class="browser-address-bar">
							<span class="browser-dot red"></span>
							<span class="browser-dot yellow"></span>
							<span class="browser-dot green"></span>
							<span class="browser-url-text">https://{store?.public_host || 'yourstore.orderly.com'}</span>
						</div>

						<div class="browser-viewport">
							{#if broadcastText.trim()}
								<div class="sf-preview-alert" data-tone={broadcastType}>
									{#if broadcastType === 'alert'}
										<IconAlertCircle size={18} stroke={2} class="preview-icon alert" />
									{:else if broadcastType === 'offer'}
										<IconSparkles size={18} stroke={2} class="preview-icon offer" />
									{:else if broadcastType === 'others'}
										<IconBuildingStore size={18} stroke={2} class="preview-icon others" />
									{:else}
										<IconInfoCircle size={18} stroke={2} class="preview-icon msg" />
									{/if}

									<div class="preview-text-wrap">
										{#if broadcastType === 'offer'}
											<span class="preview-badge offer">Special Offer</span>
										{:else if broadcastType === 'alert'}
											<span class="preview-badge alert">Store Notice</span>
										{:else if broadcastType === 'others'}
											<span class="preview-badge others">Notice</span>
										{/if}
										<span class="preview-text">{broadcastText.trim()}</span>
									</div>
								</div>
							{:else}
								<div class="sf-preview-empty">
									<p>No active announcement banner. Enter text above to see live simulation.</p>
								</div>
							{/if}
						</div>
					</div>
				</div>

				<!-- Action Buttons -->
				<div class="broadcast-actions-bar">
					<button
						type="button"
						class="btn btn-primary"
						disabled={savingBroadcast || !broadcastText.trim()}
						onclick={saveBroadcast}
					>
						{savingBroadcast ? 'Publishing…' : 'Publish Banner to Storefront'}
					</button>

					{#if config.behaviour.status_message}
						<button
							type="button"
							class="btn btn-ghost text-danger"
							disabled={savingBroadcast}
							onclick={clearBroadcast}
						>
							Remove Banner
						</button>
					{/if}
				</div>
			</div>
		</div>
	{/if}

	<!-- TAB 5: COMPLIANCE & LEGAL POLICY -->
	{#if activeTab === 'compliance'}
		<div class="studio-content-grid">
			<div class="panel studio-section-intro">
				<div class="intro-icon-wrap policy">
					<IconShieldCheck size={24} stroke={1.8} />
				</div>
				<div>
					<h2 class="intro-h">Merchant Governance &amp; Operating Agreement</h2>
					<p class="intro-p">
						To protect customers, operators, and platform integrity, all merchants must review and digitally sign the Orderly Platform Operations Policy before their storefront can go live.
					</p>
				</div>
			</div>

			<!-- Status Card -->
			{#if policySigned}
				<div class="panel policy-verified-card">
					<div class="verified-header">
						<div class="verified-icon-circle">
							<IconShieldCheck size={28} stroke={2} />
						</div>
						<div class="verified-meta">
							<div class="verified-badge-row">
								<span class="verified-badge">Digitally Verified &amp; Signed</span>
								<span class="policy-version-chip">Policy v{policySignature?.version || '1.0.0'}</span>
							</div>
							<h3 class="verified-title">Orderly Merchant Agreement Active</h3>
							<p class="verified-desc">
								Your business is fully authorized to publish and accept commercial orders on the Orderly network.
							</p>
						</div>
					</div>

					<div class="verified-details-grid">
						<div class="detail-block">
							<span class="detail-label">Authorized Signer</span>
							<strong class="detail-val">{policySignature?.signerName || 'Account Owner'}</strong>
						</div>
						<div class="detail-block">
							<span class="detail-label">Account Identity</span>
							<strong class="detail-val">{policySignature?.signerEmail || user?.email || 'Registered Owner'}</strong>
						</div>
						<div class="detail-block">
							<span class="detail-label">Execution Timestamp</span>
							<strong class="detail-val">
								{policySignature?.signedAt ? new Date(policySignature.signedAt).toLocaleString() : 'On File'}
							</strong>
						</div>
						<div class="detail-block">
							<span class="detail-label">Compliance Audit Hash</span>
							<code class="detail-hash">ORD-VERIFIED-{tenantSlug.toUpperCase().slice(0, 8)}</code>
						</div>
					</div>

					<div class="verified-card-actions">
						<button
							type="button"
							class="btn btn-ghost"
							onclick={() => (showPolicyModal = true)}
						>
							Read Full Executed Agreement
						</button>
						<button
							type="button"
							class="btn btn-primary"
							onclick={() => setTab('readiness')}
						>
							Return to Launch Readiness
						</button>
					</div>
				</div>
			{:else}
				<div class="panel policy-signing-panel">
					<div class="signing-alert-banner">
						<IconShieldExclamation size={20} stroke={2} />
						<div>
							<strong>Launch Blocked: Digital Signature Required</strong>
							<p>Your store cannot be published until an authorized representative signs this operating policy.</p>
						</div>
					</div>

					<!-- Scrollable Terms Agreement Box -->
					<div class="policy-document-container">
						<div class="doc-header">
							<span class="doc-badge">Official Orderly Merchant Policy</span>
							<span class="doc-version">Version 1.0.0 · Active</span>
						</div>

						<div class="doc-body">
							<article class="policy-article">
								<h4 class="article-title">Article 1: Operational Standards &amp; Order Fulfillment</h4>
								<p>
									Merchants operating on Orderly agree to maintain accurate operational hours and inventory availability. When a customer order is accepted, the merchant commits to preparing the order within standard preparation timelines. Any unforeseen delays or order cancellations must be promptly communicated to the customer.
								</p>
							</article>

							<article class="policy-article">
								<h4 class="article-title">Article 2: Menu Accuracy &amp; Transparent Pricing</h4>
								<p>
									All product pricing, packaging fees, and taxes displayed on the storefront must represent the final cost charged to the consumer. Merchants are strictly prohibited from adding undisclosed markups or hidden fees at pickup. Food safety, allergen information, and dietary classifications must be kept truthful and accurate.
								</p>
							</article>

							<article class="policy-article">
								<h4 class="article-title">Article 3: Customer Privacy &amp; Data Protection</h4>
								<p>
									Customer phone numbers, order histories, and personal details accessed through the Orderly Business Dashboard are strictly confidential. Merchants agree not to export, sell, or utilize customer contact information for unsolicited off-platform marketing without explicit opt-in consent.
								</p>
							</article>

							<article class="policy-article">
								<h4 class="article-title">Article 4: Platform Security, SLA &amp; Fair Use</h4>
								<p>
									Orderly targets 99.9% platform availability. Merchants agree to refrain from unauthorized automated API scraping, denial-of-service simulations, fraudulent order injections, or account sharing with unauthorized third parties. All operations are logged in isolated audit trails.
								</p>
							</article>

							<article class="policy-article">
								<h4 class="article-title">Article 5: Prohibited Conduct &amp; Account Suspension</h4>
								<p>
									Engaging in deceptive commercial practices, listing prohibited substances or illegal items, or violating consumer safety standards will result in immediate tenant account suspension and termination of storefront access without notice.
								</p>
							</article>

							<article class="policy-article">
								<h4 class="article-title">Article 6: Electronic Execution &amp; Binding Agreement</h4>
								<p>
									By checking the affirmation box and clicking "Sign Agreement &amp; Unlock Launch", the signatory certifies that they possess legal authority to bind the tenant organization to these terms.
								</p>
							</article>
						</div>
					</div>

					<!-- Signature Form -->
					<div class="policy-sign-form">
						<div class="form-inputs-grid">
							<div class="form-field">
								<label class="form-label" for="signer-name">
									Signer Full Legal Name <span class="required">*</span>
								</label>
								<input
									id="signer-name"
									type="text"
									class="text-input"
									placeholder="e.g. Vishal Kumar"
									bind:value={signerName}
								/>
							</div>

							<div class="form-field">
								<label class="form-label" for="signer-email">Signer Account Email</label>
								<input
									id="signer-email"
									type="email"
									class="text-input read-only"
									readonly
									value={user?.email || 'owner@orderly.store'}
								/>
							</div>
						</div>

						<label class="agreement-checkbox-row">
							<input
								type="checkbox"
								class="custom-checkbox"
								bind:checked={agreedToTerms}
							/>
							<span class="checkbox-text">
								I, as the authorized representative of <strong>{store?.name || tenantSlug}</strong>, confirm that I have reviewed, understood, and agree to adhere to the <strong>Orderly Business Operations Policy &amp; Merchant Agreement</strong>.
							</span>
						</label>

						<div class="sign-actions-row">
							<button
								type="button"
								class="btn btn-primary sign-submit-btn"
								disabled={signingPolicy || !agreedToTerms || !signerName.trim()}
								onclick={handleSignPolicy}
							>
								<IconShieldCheck size={16} stroke={2.2} />
								<span>{signingPolicy ? 'Executing Agreement…' : 'Sign Agreement & Unlock Launch'}</span>
							</button>

							<button
								type="button"
								class="btn btn-ghost"
								onclick={() => (showPolicyModal = true)}
							>
								Open Fullscreen Document
							</button>
						</div>
					</div>
				</div>
			{/if}
		</div>
	{/if}
{/if}

<!-- Policy Modal (always available for full reading or review) -->
<BusinessPolicyModal
	bind:open={showPolicyModal}
	{tenantSlug}
	businessName={store?.name || tenantSlug}
	mandatory={false}
	onsigned={() => {
		policySignature = policyStore.getSignature(tenantSlug);
		policySigned = true;
	}}
/>

<style>
	/* Studio Header Styles */
	.studio-header {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		margin-bottom: 1.5rem;
	}

	.studio-header-main {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1.5rem;
		flex-wrap: wrap;
	}

	.studio-title {
		font-family: var(--font-display);
		font-size: 1.75rem;
		font-weight: 700;
		letter-spacing: -0.025em;
		color: var(--text);
		margin: 0 0 0.35rem;
	}

	.studio-subtitle {
		margin: 0;
		font-size: var(--fs-body, 0.875rem);
		color: var(--text-2);
		max-width: 48rem;
		line-height: 1.45;
	}

	.studio-header-pills {
		display: flex;
		align-items: center;
		gap: 0.65rem;
	}

	.live-status-pill {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		padding: 0.35rem 0.75rem;
		border-radius: 999px;
		font-size: var(--fs-meta, 0.75rem);
		font-weight: 650;
		letter-spacing: 0.02em;
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
		box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7);
		animation: pulseRing 1.8s infinite;
	}

	@keyframes pulseRing {
		0% {
			transform: scale(0.95);
			box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7);
		}
		70% {
			transform: scale(1);
			box-shadow: 0 0 0 6px rgba(16, 185, 129, 0);
		}
		100% {
			transform: scale(0.95);
			box-shadow: 0 0 0 0 rgba(16, 185, 129, 0);
		}
	}

	/* Studio Tabs Navigation */
	.studio-tabs {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		border-bottom: 1px solid var(--border);
		padding-bottom: 0.2rem;
		overflow-x: auto;
		scrollbar-width: none;
	}

	.studio-tabs::-webkit-scrollbar {
		display: none;
	}

	.studio-tab-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.65rem 0.95rem;
		border: none;
		background: transparent;
		color: var(--text-2);
		font-family: inherit;
		font-size: var(--fs-body, 0.875rem);
		font-weight: 550;
		cursor: pointer;
		border-radius: var(--radius-sm, 6px);
		transition: all var(--tr, 0.15s ease);
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
		bottom: -0.25rem;
		left: 0.5rem;
		right: 0.5rem;
		height: 2px;
		background: var(--primary, #3b82f6);
		border-radius: 999px;
	}

	.studio-tab-badge {
		font-size: 0.68rem;
		font-weight: 700;
		padding: 0.1rem 0.4rem;
		border-radius: 999px;
		background: var(--surface-3);
		color: var(--text-3);
	}

	.studio-tab-badge.done {
		background: rgba(16, 185, 129, 0.15);
		color: #10b981;
	}

	.studio-tab-chip {
		font-size: 0.65rem;
		font-weight: 700;
		padding: 0.1rem 0.4rem;
		border-radius: 4px;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.studio-tab-chip.active {
		background: rgba(59, 130, 246, 0.15);
		color: #3b82f6;
	}

	.studio-tab-chip.warning {
		background: rgba(239, 68, 68, 0.15);
		color: #ef4444;
	}

	.studio-tab-chip.verified {
		background: rgba(16, 185, 129, 0.15);
		color: #10b981;
	}

	.studio-tab-dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
	}

	.studio-tab-dot.open {
		background: #10b981;
	}
	.studio-tab-dot.busy {
		background: #f59e0b;
	}
	.studio-tab-dot.away {
		background: #3b82f6;
	}
	.studio-tab-dot.closed {
		background: #ef4444;
	}

	/* Content Grid */
	.studio-content-grid {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	/* Hero Card */
	.studio-hero-card {
		padding: 1.5rem;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-md, 12px);
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	.studio-hero-top {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1.5rem;
		flex-wrap: wrap;
	}

	.hero-text-block {
		flex: 1;
		min-width: 280px;
	}

	.hero-badge-wrap {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.5rem;
	}

	.badge-lock {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		font-size: 0.72rem;
		font-weight: 700;
		color: #ef4444;
		background: rgba(239, 68, 68, 0.1);
		padding: 2px 7px;
		border-radius: 4px;
	}

	.hero-heading {
		font-family: var(--font-display);
		font-size: 1.35rem;
		font-weight: 700;
		color: var(--text);
		margin: 0 0 0.35rem;
		letter-spacing: -0.015em;
	}

	.hero-desc {
		margin: 0;
		font-size: var(--fs-body, 0.875rem);
		color: var(--text-2);
		line-height: 1.45;
	}

	.hero-actions-block {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.hero-publish-btn {
		min-height: 2.85rem;
		padding: 0 1.5rem;
		font-weight: 650;
		display: inline-flex;
		align-items: center;
		gap: 0.55rem;
		font-size: 0.92rem;
	}

	.hero-offline-btn {
		min-height: 2.85rem;
		padding: 0 1.25rem;
		font-weight: 600;
		border: 1px solid var(--border);
	}

	/* Executive Segmented Milestone Progress Indicator */
	.launch-progress-box {
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
		padding: 0.85rem 1rem;
		background: var(--surface-2);
		border-radius: var(--radius-sm, 8px);
		border: 1px solid var(--border-subtle, var(--border));
	}

	.progress-meta-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		font-size: var(--fs-meta, 0.78rem);
	}

	.progress-label {
		color: var(--text-2);
		font-weight: 600;
	}

	.progress-counter-badge {
		color: var(--text-3);
		font-size: 0.75rem;
	}

	.progress-counter-badge strong {
		color: var(--text);
	}

	.segmented-track {
		display: flex;
		align-items: center;
		gap: 5px;
		width: 100%;
		height: 6px;
	}

	.segment-bar {
		flex: 1;
		height: 100%;
		background: var(--surface-3);
		border-radius: 999px;
		transition: background 0.3s ease;
	}

	.segment-bar.completed {
		background: var(--text);
	}

	:global([data-theme='dark']) .segment-bar.completed {
		background: var(--primary, #6366f1);
	}

	/* Policy Warning Notice */
	.policy-notice-box {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 0.95rem 1.15rem;
		background: rgba(239, 68, 68, 0.08);
		border: 1px solid rgba(239, 68, 68, 0.25);
		border-radius: var(--radius-sm, 8px);
		color: var(--text);
		flex-wrap: wrap;
	}

	:global(.policy-notice-icon) {
		color: #ef4444;
		flex-shrink: 0;
	}

	.policy-notice-body {
		flex: 1;
		min-width: 240px;
	}

	.policy-notice-body strong {
		display: block;
		font-size: 0.88rem;
		color: #ef4444;
		margin-bottom: 0.2rem;
	}

	.policy-notice-body p {
		margin: 0;
		font-size: var(--fs-meta, 0.78rem);
		color: var(--text-2);
		line-height: 1.4;
	}

	.policy-sign-cta {
		flex-shrink: 0;
		background: #ef4444;
		border-color: #ef4444;
		color: #ffffff;
	}

	.policy-sign-cta:hover {
		background: #dc2626;
	}

	.checklist-notice-box {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem 1rem;
		background: var(--surface-2);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm, 8px);
		font-size: var(--fs-meta, 0.8rem);
		color: var(--text-2);
	}

	:global(.checklist-notice-icon) {
		color: var(--warning, #f59e0b);
		flex-shrink: 0;
	}

	/* Checklist Panel - Uniform Cards with NO Div Side Colors */
	.studio-checklist-panel {
		padding: 1.5rem;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-md, 12px);
	}

	.section-title-wrap {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 1.25rem;
		flex-wrap: wrap;
	}

	.section-h {
		font-family: var(--font-display);
		font-size: 1.15rem;
		font-weight: 700;
		color: var(--text);
		margin: 0 0 0.25rem;
	}

	.section-note {
		margin: 0;
		font-size: var(--fs-body, 0.85rem);
		color: var(--text-2);
		line-height: 1.4;
	}

	.milestones-counter {
		font-size: var(--fs-meta, 0.75rem);
		font-weight: 650;
		color: var(--text-3);
		padding: 0.25rem 0.65rem;
		border-radius: 999px;
		background: var(--surface-2);
		border: 1px solid var(--border);
	}

	.checklist-grid {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
	}

	/* Uniform 1px border card - NO div side border color! */
	.checklist-item-card {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 1rem 1.25rem;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm, 10px);
		transition: border-color 0.15s ease, background 0.15s ease, transform 0.15s ease;
	}

	.checklist-item-card:hover {
		border-color: var(--border-hover, var(--text-3));
		background: var(--surface-2);
	}

	.check-icon-wrap {
		width: 2.25rem;
		height: 2.25rem;
		border-radius: 50%;
		display: grid;
		place-items: center;
		background: var(--surface-2);
		color: var(--text-3);
		border: 1px solid var(--border);
		flex-shrink: 0;
	}

	.check-icon-wrap.done {
		background: rgba(16, 185, 129, 0.1);
		color: #10b981;
		border-color: rgba(16, 185, 129, 0.25);
	}

	.check-main-wrap {
		flex: 1;
		min-width: 0;
	}

	.check-title-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.2rem;
		flex-wrap: wrap;
	}

	.check-title {
		margin: 0;
		font-size: 0.92rem;
		font-weight: 650;
		color: var(--text);
	}

	.step-num {
		color: var(--text-3);
		margin-right: 0.15rem;
	}

	.optional-pill {
		font-size: 0.65rem;
		font-weight: 650;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		padding: 1px 6px;
		border-radius: 999px;
		background: var(--surface-3);
		color: var(--text-3);
	}

	.status-chip {
		font-size: 0.7rem;
		font-weight: 650;
		padding: 2px 8px;
		border-radius: 999px;
		letter-spacing: 0.02em;
	}

	.status-chip.success {
		background: rgba(16, 185, 129, 0.1);
		color: #10b981;
		border: 1px solid rgba(16, 185, 129, 0.25);
	}

	.status-chip.warning {
		background: rgba(245, 158, 11, 0.1);
		color: #d97706;
		border: 1px solid rgba(245, 158, 11, 0.25);
	}

	.status-chip.pending {
		background: var(--surface-2);
		color: var(--text-3);
		border: 1px solid var(--border);
	}

	.check-hint {
		margin: 0;
		font-size: var(--fs-meta, 0.78rem);
		color: var(--text-3);
		line-height: 1.35;
	}

	.check-action-wrap {
		flex-shrink: 0;
	}

	.check-action-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.82rem;
		font-weight: 600;
		padding: 0.4rem 0.75rem;
	}

	/* Share Panel */
	.studio-share-panel {
		padding: 1.5rem;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-md, 12px);
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.share-panel-header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
		flex-wrap: wrap;
	}

	.share-link-box {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		padding: 0.75rem 1rem;
		background: var(--surface-2);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm, 8px);
	}

	.share-url {
		font-family: var(--font-mono);
		font-size: 0.88rem;
		color: var(--text);
		word-break: break-all;
	}

	.copy-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		flex-shrink: 0;
	}

	.share-actions-row {
		display: flex;
		gap: 0.65rem;
		flex-wrap: wrap;
	}

	/* Section Intros */
	.studio-section-intro {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 1.25rem 1.5rem;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-md, 12px);
	}

	.intro-icon-wrap {
		width: 3rem;
		height: 3rem;
		border-radius: 12px;
		display: grid;
		place-items: center;
		background: var(--surface-2);
		color: var(--primary, #3b82f6);
		flex-shrink: 0;
		border: 1px solid var(--border);
	}

	.intro-icon-wrap.policy {
		background: rgba(16, 185, 129, 0.1);
		color: #10b981;
		border-color: rgba(16, 185, 129, 0.25);
	}

	.intro-h {
		font-family: var(--font-display);
		font-size: 1.25rem;
		font-weight: 700;
		color: var(--text);
		margin: 0 0 0.25rem;
	}

	.intro-p {
		margin: 0;
		font-size: var(--fs-body, 0.85rem);
		color: var(--text-2);
		line-height: 1.45;
	}

	/* Store Status Cards Grid - Clean Uniform Cards */
	.status-selector-panel {
		padding: 1.5rem;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-md, 12px);
	}

	.saving-indicator {
		font-size: var(--fs-meta, 0.75rem);
		color: var(--accent, #3b82f6);
		font-weight: 600;
	}

	.status-cards-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		gap: 0.85rem;
	}

	.status-option-card {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 1.15rem;
		border-radius: var(--radius-sm, 10px);
		border: 1px solid var(--border);
		background: var(--surface);
		text-align: left;
		cursor: pointer;
		font-family: inherit;
		transition: all var(--tr, 0.15s ease);
	}

	.status-option-card:hover {
		border-color: var(--text-3);
		background: var(--surface-2);
	}

	.status-option-card.active {
		border-color: var(--primary, #3b82f6);
		background: color-mix(in srgb, var(--primary, #3b82f6) 6%, var(--surface));
		box-shadow: 0 0 0 1px var(--primary, #3b82f6);
	}

	.status-card-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.status-indicator-dot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
	}

	.status-indicator-dot.status-open {
		background: #10b981;
		box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.2);
	}
	.status-indicator-dot.status-busy {
		background: #f59e0b;
		box-shadow: 0 0 0 2px rgba(245, 158, 11, 0.2);
	}
	.status-indicator-dot.status-away {
		background: #3b82f6;
		box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
	}
	.status-indicator-dot.status-closed {
		background: #ef4444;
		box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.2);
	}

	.status-name {
		font-size: 0.95rem;
		font-weight: 700;
		color: var(--text);
		flex: 1;
	}

	.status-active-chip {
		font-size: 0.65rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		padding: 2px 6px;
		border-radius: 4px;
		background: var(--primary, #3b82f6);
		color: #ffffff;
	}

	.status-desc {
		margin: 0;
		font-size: var(--fs-meta, 0.78rem);
		color: var(--text-2);
		line-height: 1.4;
	}

	/* Ordering Toggle Panel */
	.ordering-toggle-panel {
		padding: 1.5rem;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-md, 12px);
	}

	.ordering-switch-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1.5rem;
	}

	.switch-meta {
		flex: 1;
	}

	/* Closed Store Message */
	.closed-message-panel {
		padding: 1.5rem;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-md, 12px);
	}

	.closed-msg-input-wrap {
		display: flex;
		gap: 0.75rem;
		align-items: center;
		flex-wrap: wrap;
	}

	.closed-msg-input {
		flex: 1;
		min-width: 260px;
	}

	/* Broadcast Builder */
	.broadcast-builder-panel {
		padding: 1.5rem;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-md, 12px);
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.form-label {
		display: block;
		font-size: var(--fs-meta, 0.8rem);
		font-weight: 650;
		color: var(--text);
		margin-bottom: 0.45rem;
	}

	.type-pill-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
		gap: 0.65rem;
	}

	.type-pill-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.75rem 1rem;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm, 8px);
		background: var(--surface);
		color: var(--text-2);
		font-family: inherit;
		font-size: 0.85rem;
		font-weight: 600;
		cursor: pointer;
		transition: all var(--tr, 0.15s ease);
	}

	.type-pill-btn:hover {
		border-color: var(--text-3);
		color: var(--text);
		background: var(--surface-2);
	}

	.type-pill-btn.active.offer {
		border-color: #8b5cf6;
		background: rgba(139, 92, 246, 0.1);
		color: #8b5cf6;
		box-shadow: 0 0 0 1px #8b5cf6;
	}

	.type-pill-btn.active.alert {
		border-color: #ef4444;
		background: rgba(239, 68, 68, 0.1);
		color: #ef4444;
		box-shadow: 0 0 0 1px #ef4444;
	}

	.type-pill-btn.active.msg {
		border-color: #3b82f6;
		background: rgba(59, 130, 246, 0.1);
		color: #3b82f6;
		box-shadow: 0 0 0 1px #3b82f6;
	}

	.type-pill-btn.active.others {
		border-color: #f59e0b;
		background: rgba(245, 158, 11, 0.1);
		color: #b45309;
		box-shadow: 0 0 0 1px #f59e0b;
	}

	.broadcast-composer {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.composer-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.char-counter {
		font-size: var(--fs-meta, 0.75rem);
		color: var(--text-3);
	}

	.char-counter.warn {
		color: #ef4444;
		font-weight: 600;
	}

	.broadcast-textarea {
		width: 100%;
		resize: vertical;
		font-family: inherit;
		font-size: 0.88rem;
		line-height: 1.45;
	}

	.presets-row {
		display: flex;
		align-items: center;
		gap: 0.65rem;
		margin-top: 0.25rem;
		flex-wrap: wrap;
	}

	.presets-label {
		font-size: var(--fs-meta, 0.72rem);
		font-weight: 600;
		color: var(--text-3);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.presets-chips {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		flex-wrap: wrap;
	}

	.preset-chip {
		background: var(--surface-2);
		border: 1px solid var(--border);
		color: var(--text-2);
		padding: 0.25rem 0.6rem;
		border-radius: 999px;
		font-size: var(--fs-meta, 0.75rem);
		font-family: inherit;
		cursor: pointer;
		transition: all var(--tr, 0.15s ease);
	}

	.preset-chip:hover {
		background: var(--surface-3);
		color: var(--text);
		border-color: var(--text-3);
	}

	/* Live Simulation Preview */
	.broadcast-live-preview-box {
		background: var(--surface-2);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm, 10px);
		padding: 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.preview-header {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
		font-size: var(--fs-meta, 0.78rem);
		font-weight: 650;
		color: var(--text);
	}

	.preview-sub {
		font-weight: 400;
		color: var(--text-3);
	}

	.preview-browser-frame {
		border: 1px solid var(--border);
		border-radius: 8px;
		background: var(--bg);
		overflow: hidden;
	}

	.browser-address-bar {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.45rem 0.75rem;
		background: var(--surface-2);
		border-bottom: 1px solid var(--border);
	}

	.browser-dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
	}
	.browser-dot.red {
		background: #ef4444;
	}
	.browser-dot.yellow {
		background: #f59e0b;
	}
	.browser-dot.green {
		background: #10b981;
	}

	.browser-url-text {
		font-family: var(--font-mono);
		font-size: 0.68rem;
		color: var(--text-3);
		margin-left: 0.4rem;
	}

	.browser-viewport {
		padding: 0.85rem;
		min-height: 4.5rem;
		display: flex;
		align-items: center;
	}

	.sf-preview-alert {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem 1rem;
		border-radius: 8px;
		width: 100%;
		font-size: 0.85rem;
		line-height: 1.4;
	}

	.sf-preview-alert[data-tone='alert'] {
		background: rgba(239, 68, 68, 0.1);
		border: 1px solid rgba(239, 68, 68, 0.35);
		color: #ef4444;
	}

	.sf-preview-alert[data-tone='offer'] {
		background: rgba(139, 92, 246, 0.12);
		border: 1px solid rgba(139, 92, 246, 0.35);
		color: var(--text);
	}

	.sf-preview-alert[data-tone='msg'] {
		background: rgba(59, 130, 246, 0.1);
		border: 1px solid rgba(59, 130, 246, 0.3);
		color: var(--text);
	}

	.sf-preview-alert[data-tone='others'] {
		background: rgba(245, 158, 11, 0.1);
		border: 1px solid rgba(245, 158, 11, 0.3);
		color: #b45309;
	}

	.preview-text-wrap {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.preview-badge {
		font-size: 0.65rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		padding: 2px 6px;
		border-radius: 4px;
	}

	.preview-badge.offer {
		background: #8b5cf6;
		color: #ffffff;
	}

	.preview-badge.alert {
		background: #ef4444;
		color: #ffffff;
	}

	.preview-badge.others {
		background: #f59e0b;
		color: #ffffff;
	}

	.preview-text {
		color: inherit;
		font-weight: 500;
	}

	.sf-preview-empty {
		width: 100%;
		text-align: center;
		color: var(--text-3);
		font-size: var(--fs-meta, 0.8rem);
	}

	.broadcast-actions-bar {
		display: flex;
		align-items: center;
		gap: 0.85rem;
	}

	/* Compliance & Policy Tab */
	.policy-verified-card {
		padding: 1.75rem;
		background: var(--surface);
		border: 1px solid rgba(16, 185, 129, 0.3);
		border-radius: var(--radius-md, 12px);
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.verified-header {
		display: flex;
		align-items: center;
		gap: 1.25rem;
	}

	.verified-icon-circle {
		width: 3.5rem;
		height: 3.5rem;
		border-radius: 50%;
		background: rgba(16, 185, 129, 0.15);
		color: #10b981;
		display: grid;
		place-items: center;
		flex-shrink: 0;
	}

	.verified-badge-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.35rem;
	}

	.verified-badge {
		font-size: 0.72rem;
		font-weight: 700;
		color: #10b981;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.policy-version-chip {
		font-size: 0.65rem;
		font-weight: 650;
		background: var(--surface-3);
		color: var(--text-3);
		padding: 1px 6px;
		border-radius: 4px;
	}

	.verified-title {
		font-family: var(--font-display);
		font-size: 1.35rem;
		font-weight: 700;
		color: var(--text);
		margin: 0 0 0.25rem;
	}

	.verified-desc {
		margin: 0;
		font-size: var(--fs-body, 0.85rem);
		color: var(--text-2);
		line-height: 1.4;
	}

	.verified-details-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 1rem;
		padding: 1.25rem;
		background: var(--surface-2);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm, 8px);
	}

	.detail-block {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.detail-label {
		font-size: var(--fs-meta, 0.72rem);
		font-weight: 600;
		color: var(--text-3);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.detail-val {
		font-size: 0.9rem;
		color: var(--text);
		font-weight: 600;
	}

	.detail-hash {
		font-family: var(--font-mono);
		font-size: 0.75rem;
		color: var(--text-2);
	}

	.verified-card-actions {
		display: flex;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	/* Policy Signing Panel */
	.policy-signing-panel {
		padding: 1.75rem;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-md, 12px);
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.signing-alert-banner {
		display: flex;
		align-items: center;
		gap: 0.85rem;
		padding: 0.95rem 1.15rem;
		background: rgba(239, 68, 68, 0.08);
		border: 1px solid rgba(239, 68, 68, 0.25);
		border-radius: 8px;
		color: #ef4444;
	}

	.signing-alert-banner strong {
		display: block;
		font-size: 0.9rem;
		margin-bottom: 0.15rem;
	}

	.signing-alert-banner p {
		margin: 0;
		font-size: var(--fs-meta, 0.8rem);
		color: var(--text-2);
	}

	.policy-document-container {
		border: 1px solid var(--border);
		border-radius: 8px;
		background: var(--bg);
		overflow: hidden;
	}

	.doc-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.75rem 1.25rem;
		background: var(--surface-2);
		border-bottom: 1px solid var(--border);
		font-size: var(--fs-meta, 0.75rem);
		font-weight: 650;
	}

	.doc-badge {
		color: var(--text);
	}

	.doc-version {
		color: var(--text-3);
	}

	.doc-body {
		padding: 1.25rem;
		max-height: 280px;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 1.15rem;
		background: var(--surface);
	}

	.policy-article {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.article-title {
		margin: 0;
		font-size: 0.88rem;
		font-weight: 700;
		color: #ef4444;
	}

	.policy-article p {
		margin: 0;
		font-size: var(--fs-body, 0.82rem);
		color: var(--text, #0f172a);
		line-height: 1.5;
	}

	.policy-sign-form {
		display: flex;
		flex-direction: column;
		gap: 1.15rem;
		padding-top: 0.5rem;
	}

	.form-inputs-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
		gap: 1rem;
	}

	.form-field {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.required {
		color: #ef4444;
	}

	.text-input {
		width: 100%;
		padding: 0.65rem 0.85rem;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm, 6px);
		background: var(--surface-2);
		color: var(--text);
		font-family: inherit;
		font-size: 0.88rem;
	}

	.text-input:focus {
		outline: none;
		border-color: var(--primary, #3b82f6);
		box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.15);
	}

	.text-input.read-only {
		background: var(--surface-3);
		color: var(--text-2);
		cursor: not-allowed;
	}

	.agreement-checkbox-row {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
		cursor: pointer;
		user-select: none;
		padding: 0.5rem 0;
	}

	.custom-checkbox {
		margin-top: 0.2rem;
		width: 18px;
		height: 18px;
		cursor: pointer;
		accent-color: #ef4444;
	}

	.checkbox-text {
		font-size: var(--fs-body, 0.84rem);
		color: var(--text-2);
		line-height: 1.45;
	}

	.checkbox-text strong {
		color: var(--text);
	}

	.sign-actions-row {
		display: flex;
		align-items: center;
		gap: 0.85rem;
		flex-wrap: wrap;
	}

	.sign-submit-btn {
		min-height: 2.85rem;
		padding: 0 1.5rem;
		background: #ef4444;
		border-color: #ef4444;
		color: #ffffff;
		font-weight: 650;
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
	}

	.sign-submit-btn:hover {
		background: #dc2626;
	}

	.studio-loading {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	.text-danger {
		color: #ef4444;
	}

	@media (max-width: 768px) {
		.studio-header-main {
			flex-direction: column;
			align-items: stretch;
		}

		.hero-actions-block {
			width: 100%;
		}

		.hero-publish-btn,
		.hero-offline-btn {
			width: 100%;
		}

		.broadcast-actions-bar,
		.sign-actions-row {
			flex-direction: column;
			align-items: stretch;
		}

		.sign-submit-btn {
			width: 100%;
			justify-content: center;
		}
	}
</style>
