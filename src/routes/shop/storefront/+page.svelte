<script lang="ts">
	import { goto } from '$app/navigation';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import CircleX from '@lucide/svelte/icons/circle-x';
	import Clock from '@lucide/svelte/icons/clock';
	import CreditCard from '@lucide/svelte/icons/credit-card';
	import ListOrdered from '@lucide/svelte/icons/list-ordered';
	import QrCode from '@lucide/svelte/icons/qr-code';
	import Store from '@lucide/svelte/icons/store';
	import type { AdminStorefront } from '$lib/storefront/admin';
	import type { StorefrontContext } from '$lib/storefront/admin-context';
	import { storefrontAdminApi } from '$lib/storefront/admin';

	/**
	 * Storefront overview.
	 *
	 * Answers three questions a shopkeeper opens this screen to ask: is my
	 * storefront live, is it taking orders, and where do I go to change each
	 * thing. Everything here links to the screen that owns it rather than
	 * duplicating those controls.
	 */
	let { config, save }: StorefrontContext = $props();

	let busy = $state(false);
	let message = $state('');
	let failure = $state(false);

	async function togglePublished() {
		busy = true;
		const next = !config.behaviour.published;
		failure = await save(() => storefrontAdminApi.saveBehaviour({ published: next }));
		message = failure ? 'Could not change the publish state' : next ? 'Your storefront is live' : 'Your storefront is hidden';
		busy = false;
	}

	async function toggleOrdering() {
		busy = true;
		const next = !config.behaviour.ordering_enabled;
		failure = await save(() => storefrontAdminApi.saveBehaviour({ ordering_enabled: next }));
		message = failure
			? 'Could not change ordering'
			: next
				? 'Customers can order again'
				: 'Ordering is off. Browsing stays available.';
		busy = false;
	}

	const sectionCount = $derived(config.homepage.sections.filter((s) => s.enabled).length);
	const preset = $derived(
		config.catalogues.presets.find((p) => p.id === config.theme.preset) ?? null
	);

	const checks = $derived([
		{
			href: '/shop/storefront/branding',
			icon: Store,
			label: 'Branding',
			detail: config.store.logo_url
				? 'Logo uploaded'
				: 'No logo yet — your store name is shown instead',
			ok: Boolean(config.store.logo_url)
		},
		{
			href: '/shop/storefront/theme',
			icon: null,
			label: 'Theme',
			detail: preset ? `${preset.name} preset` : 'Custom colours',
			ok: true
		},
		{
			href: '/shop/storefront/homepage',
			icon: null,
			label: 'Homepage',
			detail: `${sectionCount} of ${config.homepage.sections.length} sections showing`,
			ok: sectionCount > 0
		},
		{
			href: '/shop/storefront/hours',
			icon: Clock,
			label: 'Opening hours',
			detail: config.hours.always_open ? 'Open 24 hours' : config.hours.detail,
			ok: true
		},
		{
			href: '/shop/storefront/payments',
			icon: CreditCard,
			label: 'Payments',
			detail: config.payments.methods.length
				? config.payments.methods.join(' and ').replace('ONLINE', 'Online').replace('CASH', 'Cash')
				: 'No payment method enabled',
			ok: config.payments.methods.length > 0
		},
		{
			href: '/shop/storefront/workflow',
			icon: ListOrdered,
			label: 'Order workflow',
			detail: `${config.workflow.acceptance_mode === 'AUTO' ? 'Automatic' : 'Manual'} acceptance · ${config.workflow.auto_complete ? 'auto-complete on' : 'auto-complete off'}`,
			ok: true
		}
	]);
</script>

<div class="panel">
	<div class="panel-h" style="display:flex;align-items:flex-start;justify-content:space-between;gap:1rem;flex-wrap:wrap;">
		<div>
			<h2 style="margin:0;">Your storefront</h2>
			<p class="panel-note" style="margin:0.2rem 0 0;">
				{config.public_url}
			</p>
		</div>
		<div style="display:flex;gap:0.4rem;align-items:center;">
			<button class="btn btn-secondary btn-sm" type="button" disabled={busy} onclick={togglePublished}>
				{config.behaviour.published ? 'Unpublish' : 'Publish'}
			</button>
			<a class="btn btn-primary btn-sm" href="/shop/storefront/qr">Share it</a>
		</div>
	</div>

	{#if message}
		<div class="alert {failure ? 'alert-danger' : 'alert-info'}" style="margin-top:0.9rem;">
			{message}
		</div>
	{/if}

	<div style="display:grid;gap:0.7rem;margin-top:1.1rem;">
		{#each checks as check (check.label)}
			<a
				href={check.href}
				style="display:flex;align-items:flex-start;gap:0.75rem;padding:0.8rem 0.9rem;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--surface-2);text-decoration:none;color:inherit;"
			>
				<span style="margin-top:1px;flex-shrink:0;">
					{#if check.ok}
						<CircleCheck size={17} strokeWidth={2} style="color:var(--success);" />
					{:else}
						<CircleX size={17} strokeWidth={2} style="color:var(--warn);" />
					{/if}
				</span>
				<span style="min-width:0;flex:1;">
					<span style="display:block;font-size:0.875rem;font-weight:600;">{check.label}</span>
					<span style="display:block;font-size:0.75rem;color:var(--text-2);line-height:1.4;">
						{check.detail}
					</span>
				</span>
			</a>
		{/each}
	</div>
</div>

<div class="panel" style="margin-top:1rem;">
	<div class="panel-h">
		<h2 style="margin:0;">Take payments and orders</h2>
	</div>
	<p class="panel-note">
		Two independent switches. Turning ordering off stops new orders immediately —
		browsing, the menu and your existing orders all keep working.
	</p>
	<div style="display:grid;gap:0.6rem;">
		<button
			class="sfopt"
			type="button"
			aria-pressed={config.behaviour.published}
			disabled={busy}
			onclick={togglePublished}
		>
			<span class="sfopt-mark" aria-hidden="true"></span>
			<span class="sfopt-body">
				<span class="sfopt-label">Storefront published</span>
				<span class="sfopt-hint">
					{config.behaviour.published
						? 'Anyone with your store link can browse and order.'
						: 'Hidden. Only you can see it.'}
				</span>
			</span>
		</button>
		<button
			class="sfopt"
			type="button"
			aria-pressed={config.behaviour.ordering_enabled}
			disabled={busy}
			onclick={toggleOrdering}
		>
			<span class="sfopt-mark" aria-hidden="true"></span>
			<span class="sfopt-body">
				<span class="sfopt-label">Accepting orders</span>
				<span class="sfopt-hint">
					{config.ordering_available_now
						? 'Customers can place orders right now.'
						: config.closed_reason || 'Ordering is currently off.'}
				</span>
			</span>
		</button>
	</div>
</div>
