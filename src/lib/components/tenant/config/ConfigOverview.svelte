<script lang="ts">
	/**
	 * Configuration at a glance: one card per area, each saying in plain words
	 * what is set up and what still needs doing, and opening that area.
	 *
	 * Every figure comes from data the console already serves; a source that
	 * fails to load shows "Not checked" on its card instead of a guess, and the
	 * other cards still render.
	 */
	import { onMount } from 'svelte';
	import ArrowRight from '@tabler/icons-svelte/icons/arrow-right';
	import Bell from '@tabler/icons-svelte/icons/bell';
	import CircleCheck from '@tabler/icons-svelte/icons/circle-check';
	import CircleDashed from '@tabler/icons-svelte/icons/circle-dashed';
	import CreditCard from '@tabler/icons-svelte/icons/credit-card';
	import Mail from '@tabler/icons-svelte/icons/mail';
	import Plug from '@tabler/icons-svelte/icons/plug';
	import Skeleton from '$lib/components/admin/Skeleton.svelte';
	import { loadTenantConfig } from '$lib/admin/tenantConfigCache.svelte';
	import type { ConfigService, EffectiveConfig } from '$lib/admin/configTypes';
	import { fetchTenantNotificationRules, fetchTenantNotificationTemplates } from '$lib/admin/notificationsApi';
	import type { AdminStorefront } from '$lib/storefront/admin';

	let {
		config,
		canIntegrations = true,
		onopen
	}: {
		config: AdminStorefront;
		/** Integrations needs its own capability; without it the card is hidden. */
		canIntegrations?: boolean;
		onopen: (section: string) => void;
	} = $props();

	type Tone = 'ok' | 'todo' | 'unknown';
	type Service = { id: ConfigService; label: string };
	const SERVICES: Service[] = [
		{ id: 'SMTP', label: 'Email' },
		{ id: 'SMS', label: 'SMS' },
		{ id: 'STORAGE', label: 'Storage' },
		{ id: 'AI', label: 'AI' }
	];

	let loading = $state(true);
	let effective = $state<Partial<Record<ConfigService, EffectiveConfig | null>>>({});
	let alertsOn = $state<number | null>(null);
	let edited = $state<number | null>(null);

	onMount(async () => {
		const services: ConfigService[] = ['PAYMENTS', ...SERVICES.map((s) => s.id)];
		const [configs, rules, templates] = await Promise.all([
			Promise.allSettled(services.map((s) => loadTenantConfig(s))),
			fetchTenantNotificationRules().catch(() => null),
			fetchTenantNotificationTemplates().catch(() => null)
		]);
		const next: Partial<Record<ConfigService, EffectiveConfig | null>> = {};
		services.forEach((s, i) => {
			const r = configs[i];
			next[s] = r.status === 'fulfilled' ? r.value.effective : null;
		});
		effective = next;
		alertsOn = rules ? rules.filter((r) => r.enabled).length : null;
		edited = templates ? new Set(templates.filter((t) => t.overridden).map((t) => t.event_code)).size : null;
		loading = false;
	});

	const ready = (s: ConfigService) => effective[s]?.available === true;
	const via = (s: ConfigService) =>
		effective[s]?.source === 'ORGANIZATION' ? 'your own account' : 'the platform';

	const payments = $derived.by(() => {
		const p = config.payments;
		const methods = [p?.online_payment_enabled ? 'Online' : '', p?.cash_enabled ? 'cash' : '']
			.filter(Boolean)
			.join(' and ');
		const gateway = effective.PAYMENTS;
		const needsGateway = p?.online_payment_enabled && gateway !== undefined && !ready('PAYMENTS');
		return {
			tone: (needsGateway ? 'todo' : 'ok') as Tone,
			status: needsGateway ? 'Needs a provider' : 'Ready',
			lines: [
				methods ? `${methods[0].toUpperCase()}${methods.slice(1)} at checkout` : 'No payment method is on',
				!p?.online_payment_enabled
					? 'Online payments are off'
					: ready('PAYMENTS')
						? `Online payments through ${via('PAYMENTS')}`
						: 'Connect a provider to take online payments'
			]
		};
	});

	const notifications = $derived.by(() => {
		const email = effective.SMTP;
		const emailOk = ready('SMTP');
		return {
			tone: (email === null ? 'unknown' : emailOk ? 'ok' : 'todo') as Tone,
			status: email === null ? 'Not checked' : emailOk ? 'Ready' : 'Email not connected',
			lines: [
				alertsOn === null ? 'Alerts could not be loaded' : `${alertsOn} ${alertsOn === 1 ? 'alert' : 'alerts'} switched on`,
				emailOk ? `Emails are sent through ${via('SMTP')}` : 'Connect email so alerts and receipts can be sent'
			]
		};
	});

	const templates = $derived({
		tone: 'ok' as Tone,
		status: 'Ready',
		lines: [
			edited === null
				? 'Templates could not be loaded'
				: edited === 0
					? 'Using the standard emails'
					: `${edited} ${edited === 1 ? 'email' : 'emails'} reworded`,
			'Add your logo and colour so emails look like yours'
		]
	});

	const integrations = $derived.by(() => {
		const missing = SERVICES.filter((s) => effective[s.id] !== undefined && !ready(s.id)).map((s) => s.label);
		const core = ready('SMTP') && ready('STORAGE');
		return {
			tone: (core ? 'ok' : 'todo') as Tone,
			status: core ? 'Ready' : 'Needs setup',
			lines: [missing.length ? `Not connected: ${missing.join(', ')}` : 'Everything is connected']
		};
	});

	const cards = $derived(
		[
			{ id: 'payments', title: 'Payments', icon: CreditCard, ...payments, action: 'Manage payments' },
			{ id: 'notifications', title: 'Notifications', icon: Bell, ...notifications, action: 'Choose alerts' },
			{ id: 'email-templates', title: 'Email templates', icon: Mail, ...templates, action: 'Edit emails' },
			...(canIntegrations
				? [{ id: 'integrations', title: 'Integrations', icon: Plug, ...integrations, action: 'Manage connections' }]
				: [])
		]
	);
</script>

<div class="cfo">
	{#each cards as c (c.id)}
		<button type="button" class="cfo-card" onclick={() => onopen(c.id)}>
			<span class="cfo-top">
				<span class="cfo-icon" aria-hidden="true"><c.icon size={18} stroke={1.6} /></span>
				<span class="cfo-title">{c.title}</span>
				{#if loading}
					<Skeleton height="1.1rem" width="5rem" />
				{:else}
					<span class="cfo-status" data-tone={c.tone}>
						{#if c.tone === 'ok'}<CircleCheck size={13} stroke={1.8} />{:else}<CircleDashed size={13} stroke={1.8} />{/if}
						{c.status}
					</span>
				{/if}
			</span>
			<span class="cfo-lines">
				{#if loading}
					<Skeleton height="0.85rem" width="80%" />
					<Skeleton height="0.85rem" width="60%" />
				{:else}
					{#each c.lines as line, i (i)}
						<span class:cfo-lead={i === 0}>{line}</span>
					{/each}
				{/if}
			</span>
			<span class="cfo-action">{c.action} <ArrowRight size={14} stroke={1.6} /></span>
		</button>
	{/each}
</div>

<style>
	.cfo {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 19rem), 1fr));
		gap: var(--sp-8);
	}

	.cfo-card {
		display: flex;
		flex-direction: column;
		gap: var(--sp-6);
		padding: var(--sp-9) var(--sp-10);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		background: var(--card-bg, var(--surface));
		color: var(--text-2);
		font: inherit;
		text-align: left;
		cursor: pointer;
		transition:
			border-color var(--tr, 0.15s),
			box-shadow var(--tr, 0.15s),
			transform var(--tr, 0.15s);
	}

	.cfo-card:hover,
	.cfo-card:focus-visible {
		border-color: var(--accent);
		box-shadow: var(--shadow-sm);
	}

	.cfo-top {
		display: flex;
		align-items: center;
		gap: var(--sp-5);
	}

	.cfo-icon {
		display: grid;
		place-items: center;
		flex: none;
		width: 34px;
		height: 34px;
		border-radius: var(--radius-md, 8px);
		background: var(--icon-bg, var(--surface-2));
		color: var(--icon-fg, var(--text-2));
	}

	.cfo-title {
		flex: 1;
		font-size: var(--fs-body);
		font-weight: 650;
		color: var(--text);
	}

	.cfo-status {
		display: inline-flex;
		align-items: center;
		gap: var(--sp-2);
		padding: 2px var(--sp-4);
		border-radius: 999px;
		font-size: var(--fs-meta);
		font-weight: 600;
		white-space: nowrap;
	}

	.cfo-status[data-tone='ok'] {
		background: var(--success-bg, var(--ok-soft));
		color: var(--success, var(--ok));
	}

	.cfo-status[data-tone='todo'] {
		background: var(--warn-bg);
		color: var(--warn);
	}

	.cfo-status[data-tone='unknown'] {
		background: var(--surface-2);
		color: var(--text-3);
	}

	.cfo-lines {
		display: flex;
		flex-direction: column;
		gap: var(--sp-3);
		min-height: 2.6rem;
		font-size: var(--fs-tab);
		line-height: 1.45;
		color: var(--text-3);
	}

	.cfo-lead {
		color: var(--text-2);
		font-weight: 500;
	}

	.cfo-action {
		display: inline-flex;
		align-items: center;
		gap: var(--sp-3);
		margin-top: auto;
		padding-top: var(--sp-5);
		border-top: 1px solid var(--border-subtle);
		font-size: var(--fs-tab);
		font-weight: 600;
		color: var(--accent);
	}
</style>
