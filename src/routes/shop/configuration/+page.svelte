<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import Skeleton from '$lib/components/admin/Skeleton.svelte';
	import EmailTemplateStudio from '$lib/components/admin/email/EmailTemplateStudio.svelte';
	import ConfigOverview from '$lib/components/tenant/config/ConfigOverview.svelte';
	import PaymentMethodsPanel from '$lib/components/tenant/config/PaymentMethodsPanel.svelte';
	import IntegrationsPanel from '$lib/components/tenant/settings/IntegrationsPanel.svelte';
	import NotificationsPanel from '$lib/components/tenant/settings/NotificationsPanel.svelte';
	import ServiceConfigPanel from '$lib/components/tenant/settings/ServiceConfigPanel.svelte';
	import { me, type User } from '$lib/auth';
	import type { ConfigService } from '$lib/admin/configTypes';
	import {
		ensureLiveStorefrontAdmin,
		getStorefrontAdminOrDefault,
		loadStorefrontAdmin,
		setStorefrontAdmin,
		type AdminStorefront
	} from '$lib/storefront/adminCache.svelte';
	import { setStorefrontContext } from '$lib/storefront/admin-context';
	import { loadTenantConfig } from '$lib/admin/tenantConfigCache.svelte';
	import { configSectionFor, visibleConfigSections } from '$lib/tenant/configuration';

	/**
	 * Configuration: payments, notifications, email templates and integrations,
	 * with an overview that says what is ready and what still needs doing.
	 *
	 * Five sections read best as tabs under the page title, the way project
	 * settings work in most tools, and the content gets the full width (the
	 * email studio and the overview cards need it). A tab whose area needs
	 * attention carries a small dot, so problems are visible from any tab.
	 * The storefront document is loaded once here and shared with the sections
	 * that edit it, so two sections never disagree about what is saved.
	 */
	let { data }: { data: { storefront: AdminStorefront; storefrontError: string | null } } = $props();

	// svelte-ignore state_referenced_locally
	let config = $state<AdminStorefront>(data.storefront ?? getStorefrontAdminOrDefault());
	// svelte-ignore state_referenced_locally
	let configError = $state(data.storefrontError ?? '');
	let configLoaded = $state(false);
	let retrying = $state(false);
	let user = $state<User | null>(null);

	setStorefrontContext({
		get config() {
			return config;
		},
		save,
		refresh
	});

	async function bootstrap(force = false) {
		try {
			const fetched = await loadStorefrontAdmin(force);
			config = fetched;
			setStorefrontAdmin(fetched);
			configError = '';
			configLoaded = true;
		} catch (err) {
			configError = err instanceof Error ? err.message : 'Could not load your configuration';
		} finally {
			retrying = false;
		}
	}

	async function save(run: () => Promise<AdminStorefront>): Promise<boolean> {
		try {
			await ensureLiveStorefrontAdmin();
			const updated = await run();
			config = updated;
			setStorefrontAdmin(updated);
			configError = '';
			return true;
		} catch (err) {
			configError = err instanceof Error ? err.message : 'Could not save';
			return false;
		}
	}

	async function refresh() {
		await bootstrap(true);
	}

	onMount(() => {
		void bootstrap(false);
		void (async () => {
			try {
				user = await me();
			} catch {
				// The shell guards this route; without permissions every section shows.
			}
		})();
	});

	const sections = $derived(visibleConfigSections(user?.permissions));

	// Which areas need attention, for the dots on the tabs. Read from the same
	// cached configuration the sections load, so it costs nothing extra.
	let ready = $state<Partial<Record<ConfigService, boolean>>>({});
	onMount(() => {
		for (const s of ['PAYMENTS', 'SMTP', 'STORAGE'] as ConfigService[]) {
			loadTenantConfig(s)
				.then((entry) => (ready = { ...ready, [s]: entry.effective.available }))
				.catch(() => {});
		}
	});
	const attention = $derived<Record<string, string>>({
		...(config.payments?.online_payment_enabled && ready.PAYMENTS === false
			? { payments: 'Online payments need a provider' }
			: {}),
		...(ready.SMTP === false ? { notifications: 'Email is not connected' } : {}),
		...(ready.SMTP === false || ready.STORAGE === false ? { integrations: 'Email or storage is not connected' } : {})
	});
	const active = $derived(configSectionFor($page.url.searchParams.get('section'), user?.permissions));
	const canIntegrations = $derived(sections.some((s) => s.id === 'integrations'));

	/** Integrations keeps the open service in the URL too; none shows the list. */
	const service = $derived(($page.url.searchParams.get('service') ?? '').toUpperCase() as ConfigService | '');

	function select(id: string) {
		goto(`?section=${id}`, { replaceState: true, keepFocus: true, noScroll: true });
	}

	function selectService(next: ConfigService | '') {
		goto(next ? `?section=integrations&service=${next}` : '?section=integrations', {
			keepFocus: true,
			noScroll: true
		});
	}

	// The gateway used to be an Integrations tab: send old links to Payments.
	$effect(() => {
		if (active.id === 'integrations' && service === 'PAYMENTS') select('payments');
	});
</script>

{#snippet formSkeleton()}
	<div class="panel">
		<Skeleton height="1.1rem" width="11rem" />
		<div class="cfg-skeleton">
			{#each [1, 2, 3, 4] as _, i (i)}
				<Skeleton height="4.5rem" />
			{/each}
		</div>
	</div>
{/snippet}

<div class="cfg">
	<header class="cfg-head">
		<h1>Configuration</h1>
		<p>Payments, messages and the services your business connects to.</p>
	</header>

	<div class="tabs cfg-tabs" role="tablist" aria-label="Configuration">
		{#each sections as s (s.id)}
			<button
				type="button"
				role="tab"
				aria-selected={active.id === s.id}
				aria-controls="cfg-panel"
				onclick={() => select(s.id)}
				title={attention[s.id] ?? ''}
			>
				<s.icon size={15} stroke={1.6} />
				{s.label}
				{#if attention[s.id]}<span class="cfg-dot" aria-label={attention[s.id]}></span>{/if}
			</button>
		{/each}
	</div>

	<div id="cfg-panel" role="tabpanel" aria-label={active.label}>
		{#if active.id !== 'overview'}
			<p class="cfg-lede">{active.lede}</p>
		{/if}

		{#if configError && (active.id === 'overview' || active.id === 'payments' || active.id === 'notifications')}
			<div class="alert alert-danger cfg-alert">
				<div><strong>Could not load:</strong> {configError}</div>
				<button
					class="btn btn-primary btn-sm"
					type="button"
					disabled={retrying}
					onclick={() => {
						retrying = true;
						void bootstrap(true);
					}}
				>
					{retrying ? 'Retrying...' : 'Try again'}
				</button>
			</div>
		{/if}

	{#if active.id === 'email-templates'}
		<EmailTemplateStudio scope="tenant" initialEvent={$page.url.searchParams.get('event') ?? ''} />
	{:else if active.id === 'integrations'}
		<IntegrationsPanel {service} onselect={selectService} />
	{:else if !configLoaded}
		{@render formSkeleton()}
	{:else if active.id === 'payments'}
		<div class="cfg-stack">
			<PaymentMethodsPanel />
			<ServiceConfigPanel service="PAYMENTS" title="Online payment provider" />
		</div>
	{:else if active.id === 'notifications'}
		<NotificationsPanel {config} {save} {refresh} />
	{:else}
		<ConfigOverview {config} {canIntegrations} onopen={select} />
	{/if}
	</div>
</div>

<style>
	.cfg {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	.cfg-head h1 {
		margin: 0;
		font-family: var(--font-display);
		font-size: var(--fs-h1);
		font-weight: 650;
		letter-spacing: -0.01em;
		color: var(--text);
	}

	.cfg-head p {
		margin: var(--sp-3) 0 var(--sp-10);
		font-size: var(--fs-body);
		color: var(--text-3);
	}

	/* The shared .tabs style (soft accent fill, no underline), with icons. */
	.cfg-tabs button {
		display: inline-flex;
		align-items: center;
		gap: var(--sp-4);
		padding: var(--sp-4) var(--sp-7);
	}

	.cfg-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--warn);
	}

	.cfg-lede {
		margin: 0 0 var(--sp-10);
		max-width: 46rem;
		font-size: var(--fs-body);
		line-height: 1.55;
		color: var(--text-3);
	}

	.cfg-skeleton {
		margin-top: var(--sp-8);
		display: grid;
		gap: var(--sp-5);
		grid-template-columns: repeat(auto-fill, minmax(11rem, 1fr));
	}

	.cfg-alert {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--sp-8);
		flex-wrap: wrap;
	}

	.cfg-stack {
		display: flex;
		flex-direction: column;
		gap: var(--sp-9);
	}




</style>
