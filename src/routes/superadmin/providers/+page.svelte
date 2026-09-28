<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import Bell from '@lucide/svelte/icons/bell';
	import Bot from '@lucide/svelte/icons/bot';
	import CreditCard from '@lucide/svelte/icons/credit-card';
	import HardDrive from '@lucide/svelte/icons/hard-drive';
	import Mail from '@lucide/svelte/icons/mail';
	import ShieldAlert from '@lucide/svelte/icons/shield-alert';
	import type { Component } from 'svelte';
	import { fetchPlatformConfigs } from '$lib/admin/configApi';
	import {
		CONFIG_STATUS_LABEL,
		CONFIG_STATUS_TONE,
		type ConfigService,
		type ConfigView,
		type PlatformConfigList
	} from '$lib/admin/configTypes';
	import { errorMessage } from '$lib/admin/errors';
	import { formatRelative } from '$lib/admin/format';
	import ErrorState from '$lib/components/admin/ErrorState.svelte';
	import Skeleton from '$lib/components/admin/Skeleton.svelte';
	import StatusBadge from '$lib/components/admin/StatusBadge.svelte';
	import Tabs from '$lib/components/admin/Tabs.svelte';
	import TenantAccessTable from '$lib/components/admin/TenantAccessTable.svelte';

	/**
	 * Providers and integrations.
	 *
	 * The platform's own credentials for the services every business can draw
	 * on. Three are managed here — email, storage and AI — and each reports the
	 * same four things: whether it is configured, whether it is switched on,
	 * whether its last test passed, and whether businesses may use it.
	 *
	 * Two more are listed and deliberately not manageable: payments are chosen
	 * per business, and notification delivery is email. Saying so is more
	 * useful than a card that pretends to configure something this build does
	 * not have.
	 */

	const tabs = [
		{ id: 'providers', label: 'Providers' },
		{ id: 'access', label: 'Business access' }
	];

	type ManagedProvider = {
		service: ConfigService;
		name: string;
		icon: Component;
		purpose: string;
	};

	const MANAGED: ManagedProvider[] = [
		{
			service: 'SMTP',
			name: 'Email',
			icon: Mail,
			purpose:
				'Sends administrator invites, password setup links and customer notifications. Without it, setup links have to be copied by hand.'
		},
		{
			service: 'STORAGE',
			name: 'Storage',
			icon: HardDrive,
			purpose:
				'Holds product images and logos uploaded by businesses. Without it, images can only be referenced by URL.'
		},
		{
			service: 'AI',
			name: 'AI',
			icon: Bot,
			purpose:
				'Powers the storefront copy assistant. Entirely optional — nothing breaks when it is off.'
		}
	];

	let data = $state<PlatformConfigList | null>(null);
	let loading = $state(true);
	let error = $state('');
	let tab = $state('providers');

	async function load() {
		loading = true;
		error = '';
		try {
			data = await fetchPlatformConfigs();
		} catch (err) {
			error = errorMessage(err, 'load provider configuration');
			data = null;
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		const q = $page.url.searchParams.get('tab');
		if (q && tabs.some((t) => t.id === q)) tab = q;
		void load();
	});

	function setTab(next: string) {
		tab = next;
		goto(`?tab=${next}`, { replaceState: true, keepFocus: true, noScroll: true });
	}

	function viewOf(service: ConfigService): ConfigView | undefined {
		return data?.configurations.find((c) => c.service === service);
	}

	/** One line summarising the provider's state, for the card. */
	function summary(view: ConfigView | undefined): string {
		if (!view || view.status === 'UNCONFIGURED') return 'Not configured yet';
		const parts: string[] = [];
		if (view.provider) parts.push(view.provider);
		if (view.last_tested_at) parts.push(`tested ${formatRelative(view.last_tested_at)}`);
		if (view.allow_tenants) parts.push('shared with businesses');
		else parts.push('platform only');
		return parts.join(' · ');
	}

	const encryptionOff = $derived(data ? !data.encryption.enabled : false);
</script>

{#if error}
	<div class="panel" style="margin-bottom:1rem;">
		<ErrorState message={error} onretry={load} />
	</div>
{/if}

{#if encryptionOff}
	<div class="alert alert-danger" style="margin-bottom:0.85rem;align-items:flex-start;">
		<ShieldAlert size={16} strokeWidth={1.9} />
		<span>
			<strong style="color:var(--text);">Secrets cannot be stored</strong>
			<span style="display:block;margin-top:0.15rem;">
				CONFIG_ENCRYPTION_KEY is not set on the API, so no password, secret key or API key can be
				sealed. Set it and restart the API before configuring a provider.
			</span>
		</span>
	</div>
{/if}

<Tabs {tabs} bind:active={tab} onchange={setTab} />

{#if tab === 'providers'}
	{#if loading}
		<div class="prov-grid">
			{#each [1, 2, 3] as _, i (i)}
				<Skeleton height="10rem" />
			{/each}
		</div>
	{:else}
		<div class="prov-grid">
			{#each MANAGED as provider (provider.service)}
				{@const view = viewOf(provider.service)}
				{@const status = view?.status ?? 'UNCONFIGURED'}
				<a class="prov" href={`/superadmin/providers/${provider.service.toLowerCase()}`}>
					<div class="prov-head">
						<span class="prov-icon"><provider.icon size={17} strokeWidth={1.8} /></span>
						<div class="prov-title">
							<strong>{provider.name}</strong>
							<span>{summary(view)}</span>
						</div>
						<StatusBadge
							status={CONFIG_STATUS_LABEL[status]}
							kind={CONFIG_STATUS_TONE[status]}
						/>
					</div>

					<p class="prov-purpose">{provider.purpose}</p>

					<dl class="prov-facts">
						<div>
							<dt>Configured</dt>
							<dd>{view && view.status !== 'UNCONFIGURED' ? 'Yes' : 'No'}</dd>
						</div>
						<div>
							<dt>Enabled</dt>
							<dd>{view?.enabled ? 'Yes' : 'No'}</dd>
						</div>
						<div>
							<dt>Businesses may use it</dt>
							<dd>{view?.allow_tenants ? 'Yes' : 'No'}</dd>
						</div>
					</dl>

					{#if view?.last_error}
						<p class="prov-error">Last failure: {view.last_error}</p>
					{/if}

					<span class="prov-cta">
						Configure and test
						<ArrowRight size={13} strokeWidth={2} />
					</span>
				</a>
			{/each}
		</div>

		<section class="panel" style="margin-top:0.85rem;">
			<h3 class="panel-h">Not managed at platform level</h3>
			<p class="panel-note" style="margin:0 0 0.85rem;">
				These exist in the product but have no platform-wide credentials to hold. They are listed
				so the absence is deliberate rather than a gap you have to go looking for.
			</p>
			<div class="unmanaged">
				<div class="un-row">
					<span class="prov-icon small"><CreditCard size={15} strokeWidth={1.8} /></span>
					<div>
						<strong>Payments</strong>
						<p>
							Each business chooses cash, online payment, or both, and when customers pay — in its
							own storefront settings. There is no platform gateway holding merchant credentials.
						</p>
					</div>
					<StatusBadge status="Per business" kind="neutral" dot={false} />
				</div>
				<div class="un-row">
					<span class="prov-icon small"><Bell size={15} strokeWidth={1.8} /></span>
					<div>
						<strong>Notifications</strong>
						<p>
							Delivery is email, so notifications inherit whatever the Email provider above is set
							to. What gets sent is configured under
							<a href="/superadmin/notifications">Notifications</a>.
						</p>
					</div>
					<StatusBadge status="Via email" kind="neutral" dot={false} />
				</div>
			</div>
		</section>
	{/if}
{:else}
	<TenantAccessTable />
{/if}

<style>
	.prov-grid {
		display: grid;
		gap: 0.85rem;
		grid-template-columns: repeat(auto-fit, minmax(19rem, 1fr));
	}

	.prov {
		display: flex;
		flex-direction: column;
		gap: 0.7rem;
		padding: 1rem 1.1rem;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface);
		box-shadow: var(--shadow-sm);
		text-decoration: none;
		color: inherit;
		transition:
			border-color var(--tr),
			box-shadow var(--tr),
			transform var(--tr);
	}

	.prov:hover {
		border-color: color-mix(in srgb, var(--accent) 40%, var(--border));
		box-shadow: var(--shadow);
	}

	.prov-head {
		display: flex;
		align-items: flex-start;
		gap: 0.6rem;
	}

	.prov-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2.2rem;
		height: 2.2rem;
		border-radius: 10px;
		background: var(--surface-3);
		color: var(--icon-fg);
		flex-shrink: 0;
	}

	.prov-icon.small {
		width: 1.9rem;
		height: 1.9rem;
	}

	.prov-title {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
		min-width: 0;
		flex: 1;
	}

	.prov-title strong {
		font-size: 0.92rem;
		font-weight: 600;
	}

	.prov-title span {
		font-size: 0.73rem;
		color: var(--text-3);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.prov-purpose {
		margin: 0;
		font-size: 0.78rem;
		line-height: 1.5;
		color: var(--text-2);
	}

	.prov-facts {
		display: grid;
		gap: 0.2rem;
		margin: 0;
	}

	.prov-facts > div {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.6rem;
		font-size: 0.76rem;
	}

	.prov-facts dt {
		color: var(--text-3);
	}

	.prov-facts dd {
		margin: 0;
		font-weight: 550;
	}

	.prov-error {
		margin: 0;
		padding: 0.4rem 0.55rem;
		border-radius: var(--radius-sm);
		background: var(--danger-bg);
		color: var(--danger);
		font-size: 0.72rem;
		font-family: var(--font-mono);
		word-break: break-word;
	}

	.prov-cta {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		margin-top: auto;
		font-size: 0.78rem;
		font-weight: 600;
		color: var(--accent-dark);
	}

	.unmanaged {
		display: flex;
		flex-direction: column;
	}

	.un-row {
		display: flex;
		align-items: flex-start;
		gap: 0.7rem;
		padding: 0.8rem 0;
		border-top: 1px solid var(--border-subtle);
	}

	.un-row:first-child {
		border-top: 0;
		padding-top: 0;
	}

	.un-row > div {
		flex: 1;
		min-width: 0;
	}

	.un-row strong {
		font-size: 0.86rem;
		font-weight: 550;
	}

	.un-row p {
		margin: 0.15rem 0 0;
		font-size: 0.77rem;
		line-height: 1.5;
		color: var(--text-3);
	}

	.un-row a {
		color: var(--accent-dark);
	}
</style>
