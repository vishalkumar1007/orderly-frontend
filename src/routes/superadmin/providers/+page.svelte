<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import ArrowRight from '@tabler/icons-svelte/icons/arrow-right';
	import Bot from '@tabler/icons-svelte/icons/robot';
	import CreditCard from '@tabler/icons-svelte/icons/credit-card';
	import HardDrive from '@tabler/icons-svelte/icons/device-floppy';
	import Mail from '@tabler/icons-svelte/icons/mail';
	import MessageSquare from '@tabler/icons-svelte/icons/message';
	import ShieldAlert from '@tabler/icons-svelte/icons/shield-exclamation';
	import type { IconComponent as Component } from '$lib/icons';
	import { fetchPlatformConfigs } from '$lib/admin/configApi';
	import { fetchPlatformPayments, type PlatformPayments } from '$lib/admin/paymentsApi';
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

	/**
	 * Providers and integrations.
	 *
	 * The platform's own credentials for the services every business can draw
	 * on. Five are managed here — email, SMS, storage, AI and payments — and each
	 * reports the same three things: whether it is configured, whether it is
	 * switched on, and whether its last test passed. Whether businesses may
	 * use it at all is set per provider below; which specific businesses do is
	 * a configuration decision under Settings → Business access, not a
	 * credential, so it does not live on this page.
	 *
	 */

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
		},
		{
			service: 'SMS',
			name: 'SMS',
			icon: MessageSquare,
			purpose:
				'Sends text notifications — order-ready, booking confirmations — to customers who opt in. Optional; nothing sends by SMS until this is configured and a business enables it.'
		},
		{
			service: 'PAYMENTS',
			name: 'Payments',
			icon: CreditCard,
			purpose:
				'The payment gateway customers pay through, and the switch between dummy and real payments. Dummy payments need no setup, so building and testing never wait on a gateway.'
		}
	];

	let data = $state<PlatformConfigList | null>(null);
	let payments = $state<PlatformPayments | null>(null);
	let loading = $state(true);
	let error = $state('');

	async function load() {
		loading = true;
		error = '';
		try {
			data = await fetchPlatformConfigs();
			// The mode badge is a nicety: a failure here must not hide the cards.
			payments = await fetchPlatformPayments().catch(() => null);
		} catch (err) {
			error = errorMessage(err, 'load provider configuration');
			data = null;
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		// The per-business access grant moved to Settings; old links still out
		// there should land there instead of a page that no longer has it.
		if ($page.url.searchParams.get('tab') === 'access') {
			goto('/superadmin/settings?section=tenant-access', { replaceState: true });
			return;
		}
		void load();
	});

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
		<ShieldAlert size={16} stroke={1.6} />
		<span>
			<strong style="color:var(--text);">Secrets cannot be stored</strong>
			<span style="display:block;margin-top:0.15rem;">
				CONFIG_ENCRYPTION_KEY is not set on the API, so no password, secret key or API key can be
				sealed. Set it and restart the API before configuring a provider.
			</span>
		</span>
	</div>
{/if}

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
					<span class="prov-icon"><provider.icon size={17} stroke={1.6} /></span>
					<div class="prov-title">
						<strong>{provider.name}</strong>
						<span>{summary(view)}</span>
					</div>
					<StatusBadge
						status={CONFIG_STATUS_LABEL[status]}
						kind={CONFIG_STATUS_TONE[status]}
					/>
				</div>
				{#if provider.service === 'PAYMENTS' && payments}
					<div class="prov-mode" class:live={payments.mode === 'LIVE'}>
						<span class="prov-mode-dot" aria-hidden="true"></span>
						{payments.mode === 'LIVE' ? 'Real payments' : 'Dummy payments — nobody is charged'}
					</div>
				{/if}

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
						<dt>Open to businesses</dt>
						<dd>{view?.allow_tenants ? 'Yes' : 'No'}</dd>
					</div>
				</dl>

				{#if view?.last_error}
					<p class="prov-error">Last failure: {view.last_error}</p>
				{/if}

				<span class="prov-cta">
					Configure and test
					<ArrowRight size={13} stroke={1.6} />
				</span>
			</a>
		{/each}
	</div>

	<p class="prov-footnote">
		Deciding <em>which</em> businesses may use a provider that's open to them is a configuration
		choice, not a credential — see
		<a href="/superadmin/settings?section=tenant-access">Settings &rarr; Business access</a>.
	</p>
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

	.prov-title {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
		min-width: 0;
		flex: 1;
	}

	.prov-title strong {
		font-size: var(--fs-title);
		font-weight: 600;
	}

	.prov-title span {
		font-size: var(--fs-meta);
		color: var(--text-3);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.prov-purpose {
		margin: 0;
		font-size: var(--fs-tab);
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
		font-size: var(--fs-code);
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
		font-size: var(--fs-meta);
		font-family: var(--font-mono);
		word-break: break-word;
	}

	.prov-mode {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		align-self: flex-start;
		padding: 0.25rem 0.6rem;
		border-radius: 999px;
		background: var(--warn-bg);
		color: var(--warn);
		font-size: var(--fs-meta);
		font-weight: 600;
	}

	.prov-mode.live {
		background: color-mix(in srgb, var(--ok) 14%, var(--surface));
		color: var(--ok);
	}

	.prov-mode-dot {
		width: 0.45rem;
		height: 0.45rem;
		border-radius: 50%;
		background: currentColor;
	}

	.prov-footnote {
		margin: 0.85rem 0 0;
		font-size: var(--fs-tab);
		color: var(--text-3);
	}

	.prov-footnote a {
		color: var(--accent-dark);
	}

	.prov-cta {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		margin-top: auto;
		font-size: var(--fs-tab);
		font-weight: 600;
		color: var(--accent-dark);
	}
</style>
