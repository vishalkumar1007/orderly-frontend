<script lang="ts">
	import { onMount } from 'svelte';
	import Bell from '@tabler/icons-svelte/icons/bell';
	import Building2 from '@tabler/icons-svelte/icons/building';
	import Mail from '@tabler/icons-svelte/icons/mail';
	import MessageSquare from '@tabler/icons-svelte/icons/message';
	import Send from '@tabler/icons-svelte/icons/send';
	import { fetchSettings } from '$lib/admin/api';
	import { fetchPlatformConfig, testPlatformConfigAction } from '$lib/admin/configApi';
	import {
		CONFIG_STATUS_LABEL,
		CONFIG_STATUS_TONE,
		type ConfigView
	} from '$lib/admin/configTypes';
	import { errorMessage } from '$lib/admin/errors';
	import { formatRelative } from '$lib/admin/format';
	import type { PlatformSettings } from '$lib/admin/types';
	import {
		fetchAllNotificationDeliveries,
		fetchNotificationEvents,
		fetchPlatformNotificationRules,
		retryNotificationDeliveryAsAdmin,
		savePlatformNotificationRule
	} from '$lib/admin/notificationsApi';
	import type { NotificationDelivery, NotificationEventDef, NotificationRule } from '$lib/admin/notificationTypes';
	import EventChannelGrid from '$lib/components/admin/EventChannelGrid.svelte';
	import EventRuleMatrix from '$lib/components/admin/EventRuleMatrix.svelte';
	import ErrorState from '$lib/components/admin/ErrorState.svelte';
	import FormField from '$lib/components/admin/FormField.svelte';
	import Skeleton from '$lib/components/admin/Skeleton.svelte';
	import StatusBadge from '$lib/components/admin/StatusBadge.svelte';
	import EmptyState from '$lib/components/admin/EmptyState.svelte';
	import SlideOver from '$lib/components/admin/SlideOver.svelte';
	import History from '@tabler/icons-svelte/icons/history';
	import TextInput from '$lib/components/admin/TextInput.svelte';
	import { toast } from '$lib/components/admin/toast';

	/**
	 * Platform notifications.
	 *
	 * Two things live here: the platform's own outbound messaging (account
	 * email, business onboarding, subscription and security alerts to the
	 * console team), and the platform DEFAULT for every event in the catalog
	 * — what a business inherits until it writes its own override.
	 *
	 * A business's customer-facing rules are still that business's own call:
	 * this screen sets the default they start from, not a value that
	 * overrides what they've already changed.
	 */

	type Channel = {
		id: string;
		name: string;
		icon: typeof Bell;
		state: 'managed' | 'absent' | 'delegated';
		detail: string;
		href?: string;
	};

	let config = $state<ConfigView | null>(null);
	let smsConfig = $state<ConfigView | null>(null);
	let settings = $state<PlatformSettings | null>(null);
	let loading = $state(true);
	let error = $state('');

	let testTo = $state('');
	let sending = $state(false);
	let outcome = $state<{ ok: boolean; message: string; detail?: string } | null>(null);

	async function load() {
		loading = true;
		error = '';
		try {
			const [cfg, sms, s] = await Promise.all([
				fetchPlatformConfig('SMTP'),
				fetchPlatformConfig('SMS'),
				fetchSettings()
			]);
			config = cfg;
			smsConfig = sms;
			settings = s;
			testTo = String(cfg.config?.from_email ?? s.general.support_email ?? '');
		} catch (err) {
			error = errorMessage(err, 'load notification settings');
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		load();
		void loadRules();
		void loadDeliveries();
	});

	const fromName = $derived(String(config?.config?.from_name ?? ''));
	const fromEmail = $derived(String(config?.config?.from_email ?? ''));
	const replyTo = $derived(String(config?.config?.reply_to ?? ''));
	const emailReady = $derived(
		Boolean(config && config.enabled && config.status !== 'UNCONFIGURED')
	);
	const smsReady = $derived(
		Boolean(smsConfig && smsConfig.enabled && smsConfig.status !== 'UNCONFIGURED')
	);

	const channels = $derived<Channel[]>([
		{
			id: 'email',
			name: 'Email',
			icon: Mail,
			state: emailReady ? 'managed' : 'absent',
			detail: emailReady
				? `Sent through ${config?.provider || 'SMTP'} as ${fromEmail || 'the configured sender'}.`
				: 'No email provider is configured, so nothing can be sent. Setup links have to be copied by hand.',
			href: '/superadmin/providers/smtp'
		},
		{
			id: 'sms',
			name: 'SMS',
			icon: MessageSquare,
			state: smsReady ? 'managed' : 'absent',
			detail: smsReady
				? `Sent through ${smsConfig?.provider || 'Twilio'} as ${String(smsConfig?.config?.from_number ?? 'the configured number')}.`
				: 'No SMS provider is configured, so nothing can be sent by text yet.',
			href: '/superadmin/providers/sms'
		},
		{
			id: 'business',
			name: 'Customer notifications',
			icon: Building2,
			state: 'delegated',
			detail:
				'Order-ready messages belong to each business and are configured in its own console. A business may use the platform email provider only if you grant it access.',
			href: '/superadmin/settings?section=tenant-access'
		}
	]);

	let logOpen = $state(false);
	let senderOpen = $state(false);
	let defaultsOpen = $state(false);

	/* ---------- platform-default rules, every event in the catalog ---------- */

	let events = $state<NotificationEventDef[]>([]);
	let rules = $state<NotificationRule[]>([]);
	let rulesLoading = $state(true);
	let rulesError = $state('');
	let busyRuleKey = $state('');

	async function loadRules() {
		rulesLoading = true;
		rulesError = '';
		try {
			[events, rules] = await Promise.all([fetchNotificationEvents(), fetchPlatformNotificationRules()]);
		} catch (err) {
			rulesError = errorMessage(err, 'load default notification rules');
		} finally {
			rulesLoading = false;
		}
	}

	/** Alerts for the Orderly team itself vs what businesses start with. */
	const platformRules = $derived(rules.filter((r) => r.recipient_policy === 'PLATFORM'));
	const businessDefaultRules = $derived(rules.filter((r) => r.recipient_policy !== 'PLATFORM'));

	function ruleKey(r: NotificationRule) {
		return `${r.event_code}:${r.channel}:${r.recipient_policy}`;
	}

	async function onRuleChange(rule: NotificationRule, enabled: boolean) {
		busyRuleKey = ruleKey(rule);
		try {
			const saved = await savePlatformNotificationRule({
				event_code: rule.event_code,
				channel: rule.channel,
				recipient_policy: rule.recipient_policy,
				enabled,
				priority: rule.priority
			});
			rules = rules.map((r) => (ruleKey(r) === ruleKey(rule) ? saved : r));
		} catch (err) {
			toast.error(errorMessage(err, 'save that default'));
		} finally {
			busyRuleKey = '';
		}
	}

	/* ---------- delivery log, every tenant ---------- */

	let deliveries = $state<NotificationDelivery[]>([]);
	let deliveriesLoading = $state(true);
	let deliveriesError = $state('');

	async function loadDeliveries() {
		deliveriesLoading = true;
		deliveriesError = '';
		try {
			deliveries = await fetchAllNotificationDeliveries();
		} catch (err) {
			deliveriesError = errorMessage(err, 'load the delivery log');
		} finally {
			deliveriesLoading = false;
		}
	}

	async function retryDelivery(id: string) {
		try {
			await retryNotificationDeliveryAsAdmin(id);
			toast.success('Queued for retry');
			await loadDeliveries();
		} catch (err) {
			toast.error(errorMessage(err, 'retry that delivery'));
		}
	}

	const DELIVERY_TONE: Record<string, 'ok' | 'warn' | 'danger' | 'neutral'> = {
		SENT: 'ok',
		PENDING: 'neutral',
		RETRYING: 'warn',
		FAILED: 'danger',
		DEAD: 'danger'
	};

	async function sendTest() {
		if (!testTo.trim()) {
			toast.error('Enter an address to send the test to');
			return;
		}
		sending = true;
		outcome = null;
		try {
			outcome = await testPlatformConfigAction('SMTP', 'send_email', { to: testTo.trim() });
			if (outcome.ok) toast.success('Test email sent');
			else toast.error('The test email could not be sent');
		} catch (err) {
			outcome = { ok: false, message: errorMessage(err, 'send a test email') };
			toast.error(outcome.message);
		} finally {
			sending = false;
		}
	}
</script>

{#if error}
	<div class="panel" style="margin-bottom:1rem;">
		<ErrorState message={error} onretry={load} />
	</div>
{/if}

{#if loading}
	<div style="display:flex;flex-direction:column;gap:0.85rem;">
		<Skeleton height="4rem" />
		<Skeleton height="14rem" />
	</div>
{:else}
	<div class="np">
		<div class="chips" aria-label="Platform delivery channels">
			{#each channels.filter((c) => c.id !== 'business') as channel (channel.id)}
				<div class={['chip', channel.state === 'managed' ? 'ok' : 'warn'].join(' ')}>
					<span class="chip-icon"><channel.icon size={15} stroke={1.6} /></span>
					<span class="chip-text">
						<strong>{channel.name}</strong>
						{#if channel.state === 'managed'}
							<span>Ready to send</span>
						{:else}
							<a href={channel.href}>Set up {channel.name.toLowerCase()} →</a>
						{/if}
					</span>
				</div>
			{/each}
			<div class="chip ok">
				<span class="chip-icon"><Bell size={15} stroke={1.6} /></span>
				<span class="chip-text"><strong>In-app</strong><span>Always on</span></span>
			</div>
		</div>

		<div class="toolbar">
			<p class="lede">
				Alerts for the people running Orderly: new businesses, system errors, plan and security
				events. Changes save as you make them.
			</p>
			<div class="actions">
				<button type="button" class="btn btn-ghost btn-sm" onclick={() => (logOpen = true)}>
					<History size={14} stroke={1.6} /> Delivery log
				</button>
				<button type="button" class="btn btn-ghost btn-sm" onclick={() => (senderOpen = true)}>
					<Mail size={14} stroke={1.6} /> Sender &amp; test
				</button>
				<button type="button" class="btn btn-ghost btn-sm" onclick={() => (defaultsOpen = true)}>
					<Building2 size={14} stroke={1.6} /> Business defaults
				</button>
			</div>
		</div>

		{#if rulesError}
			<ErrorState message={rulesError} onretry={loadRules} />
		{:else if rulesLoading}
			<Skeleton height="12rem" />
		{:else}
			<EventChannelGrid
				{events}
				rules={platformRules}
				channels={[
					{ id: 'IN_APP', label: 'In-app' },
					{ id: 'EMAIL', label: 'Email' }
				]}
				busyKey={busyRuleKey}
				onchange={onRuleChange}
			/>
		{/if}
	</div>
{/if}

<SlideOver bind:open={logOpen} title="Delivery log">
	<p class="drawer-note">Recent email and SMS attempts across every business, plus the platform's own.</p>
	{#if deliveriesError}
		<ErrorState message={deliveriesError} onretry={loadDeliveries} />
	{:else if deliveriesLoading}
		<Skeleton height="8rem" />
	{:else if deliveries.length === 0}
		<EmptyState title="Nothing sent yet" description="Deliveries will appear here once one is queued." />
	{:else}
		<ul class="dlv-list">
			{#each deliveries as d (d.id)}
				<li class="dlv-row">
					<div class="dlv-main">
						<strong>{d.event_code}</strong>
						<span class="dlv-meta">
							{d.channel} · {d.recipient}
							{d.tenant_id ? `· tenant ${d.tenant_id.slice(0, 8)}` : '· platform'} ·
							{formatRelative(d.created_at)}
						</span>
						{#if d.last_error}<span class="dlv-error">{d.last_error}</span>{/if}
					</div>
					<div class="dlv-end">
						<StatusBadge status={d.status} kind={DELIVERY_TONE[d.status] ?? 'neutral'} />
						{#if d.status === 'FAILED' || d.status === 'DEAD'}
							<button type="button" class="btn btn-quiet btn-sm" onclick={() => retryDelivery(d.id)}>Retry</button>
						{/if}
					</div>
				</li>
			{/each}
		</ul>
	{/if}
</SlideOver>

<SlideOver bind:open={senderOpen} title="Sender & test">
	<dl class="dl">
		<div><dt>From name</dt><dd>{fromName || '—'}</dd></div>
		<div><dt>From address</dt><dd class="mono">{fromEmail || '—'}</dd></div>
		<div><dt>Reply-to</dt><dd class="mono">{replyTo || fromEmail || '—'}</dd></div>
		<div><dt>Support address</dt><dd class="mono">{settings?.general.support_email || '—'}</dd></div>
	</dl>
	<div style="margin:0.9rem 0 1.4rem;display:flex;gap:0.5rem;flex-wrap:wrap;">
		<a class="btn btn-ghost btn-sm" href="/superadmin/providers/smtp">Edit email provider</a>
		<a class="btn btn-quiet btn-sm" href="/superadmin/settings">Edit support address</a>
	</div>
	<FormField label="Send a test email to" htmlFor="notif-test" hint="Worth doing before onboarding a business.">
		<TextInput id="notif-test" type="email" bind:value={testTo} placeholder="you@example.com" />
	</FormField>
	<div style="margin-top:0.75rem;">
		<button type="button" class="btn btn-primary btn-sm" disabled={sending || !emailReady} onclick={sendTest}>
			<Send size={14} stroke={1.6} />
			{sending ? 'Sending…' : 'Send test email'}
		</button>
		{#if !emailReady}
			<p class="field-hint" style="margin:0.5rem 0 0;">Configure and enable the email provider first.</p>
		{/if}
	</div>
	{#if outcome}
		<div class={['outcome', outcome.ok ? '' : 'bad'].join(' ')} role="status">
			<strong>{outcome.ok ? 'Sent' : 'Failed'}</strong>
			<span>{outcome.message}</span>
			{#if outcome.detail}<span class="detail">{outcome.detail}</span>{/if}
		</div>
	{/if}
</SlideOver>

<SlideOver bind:open={defaultsOpen} title="Business defaults">
	<p class="drawer-note">
		What a new business starts with. Each business manages its own under Settings → Notifications
		and can change it; what it already changed is not touched. SMS and custom wording are
		controlled by plan on the <a href="/superadmin/plans">Plans</a> page.
	</p>
	{#if rulesLoading}
		<Skeleton height="6rem" />
	{:else if !rulesError}
		<EventRuleMatrix {events} rules={businessDefaultRules} busyKey={busyRuleKey} onchange={onRuleChange} />
	{/if}
</SlideOver>

<style>
	.np {
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
	}

	.chips {
		display: flex;
		flex-wrap: wrap;
		overflow: hidden;
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		background: var(--card-bg);
	}

	.chip {
		display: flex;
		flex: 1 1 11rem;
		align-items: center;
		gap: var(--sp-5);
		padding: var(--sp-5) var(--sp-7);
		border: 0;
		border-left: 1px solid var(--border-subtle);
		background: none;
		color: var(--text-3);
	}

	.chip:first-child {
		border-left: 0;
	}

	.chip-icon {
		display: inline-flex;
		color: var(--text-3);
		flex-shrink: 0;
	}

	.chip.ok .chip-text span {
		color: var(--success);
	}

	.chip.warn .chip-text span,
	.chip.warn .chip-text a {
		color: var(--warn);
	}

	.chip-text {
		display: flex;
		flex-direction: column;
		font-size: var(--fs-code);
	}

	.chip-text strong {
		color: var(--text-2);
		font-size: 0.875rem;
	}

	.toolbar {
		display: flex;
		flex-wrap: wrap;
		gap: 0.6rem;
		align-items: center;
		justify-content: space-between;
	}

	.lede {
		margin: 0;
		flex: 1 1 18rem;
		font-size: 0.875rem;
		color: var(--text-3);
	}

	.actions {
		display: flex;
		gap: 0.4rem;
		flex-wrap: wrap;
	}

	.drawer-note {
		margin: 0 0 0.9rem;
		font-size: 0.875rem;
		color: var(--text-3);
	}

	.outcome {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		margin-top: 0.85rem;
		padding: 0.65rem 0.8rem;
		border: 1px solid color-mix(in srgb, var(--success) 35%, transparent);
		border-radius: var(--radius-sm);
		background: color-mix(in srgb, var(--success) 8%, transparent);
		font-size: var(--fs-body);
		color: var(--text-2);
	}

	.outcome.bad {
		border-color: color-mix(in srgb, var(--danger) 35%, transparent);
		background: color-mix(in srgb, var(--danger) 8%, transparent);
	}

	.outcome .detail {
		font-family: var(--font-mono);
		font-size: var(--fs-meta);
		color: var(--text-3);
		word-break: break-word;
	}

	.dlv-list {
		list-style: none;
		margin: 0;
		padding: 0;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		overflow: hidden;
	}

	.dlv-row {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 0.75rem;
		padding: 0.6rem 0.85rem;
		border-top: 1px solid var(--border-subtle);
		background: var(--surface-1);
	}

	.dlv-row:first-child {
		border-top: none;
	}

	.dlv-main {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
		min-width: 0;
	}

	.dlv-meta {
		font-size: var(--fs-code);
		color: var(--text-3);
	}

	.dlv-error {
		font-size: var(--fs-code);
		color: var(--danger, #dc2626);
	}

	.dlv-end {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-shrink: 0;
	}
</style>
