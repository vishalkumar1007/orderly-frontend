<script lang="ts">
	import { onMount } from 'svelte';
	import Bell from '@lucide/svelte/icons/bell';
	import Building2 from '@lucide/svelte/icons/building-2';
	import Mail from '@lucide/svelte/icons/mail';
	import MessageSquare from '@lucide/svelte/icons/message-square';
	import Send from '@lucide/svelte/icons/send';
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
	import EventRuleMatrix from '$lib/components/admin/EventRuleMatrix.svelte';
	import ErrorState from '$lib/components/admin/ErrorState.svelte';
	import FormField from '$lib/components/admin/FormField.svelte';
	import Skeleton from '$lib/components/admin/Skeleton.svelte';
	import StatusBadge from '$lib/components/admin/StatusBadge.svelte';
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
		icon: typeof Mail;
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
			href: '/superadmin/providers?tab=access'
		}
	]);

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

	/** Everything the platform sends today, and what triggers it. */
	const PLATFORM_MESSAGES = [
		{
			name: 'Administrator setup link',
			audience: 'A business administrator or staff member',
			triggers: [
				'A business is onboarded',
				'A user is invited to a business',
				'A setup link is regenerated',
				"A user's access is reset"
			],
			contents: 'A single-use link to choose a password. Never a password itself.'
		}
	];

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
		<Skeleton height="9rem" />
		<Skeleton height="14rem" />
	</div>
{:else}
	<section class="panel" style="margin-bottom:0.85rem;">
		<div class="bento-head">
			<h3 class="panel-h" style="margin:0;">
				<span style="display:flex;align-items:center;gap:0.45rem;">
					<Bell size={15} strokeWidth={1.9} />
					Delivery channels
				</span>
			</h3>
			{#if config}
				<StatusBadge
					status={CONFIG_STATUS_LABEL[config.status]}
					kind={CONFIG_STATUS_TONE[config.status]}
				/>
			{/if}
		</div>

		<div class="ch-rows">
			{#each channels as channel (channel.id)}
				<div class="ch-row">
					<span class={['ch-icon', channel.state].join(' ')}>
						<channel.icon size={15} strokeWidth={1.8} />
					</span>
					<div class="ch-text">
						<strong>{channel.name}</strong>
						<p>{channel.detail}</p>
					</div>
					<div class="ch-end">
						<StatusBadge
							status={channel.state === 'managed'
								? 'Active'
								: channel.state === 'delegated'
									? 'Per business'
									: 'Unavailable'}
							kind={channel.state === 'managed' ? 'ok' : 'neutral'}
							dot={channel.state === 'managed'}
						/>
						{#if channel.href}
							<a class="btn btn-quiet btn-sm" href={channel.href}>Open</a>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	</section>

	<div class="grid-2" style="margin-bottom:0.85rem;">
		<section class="panel">
			<h3 class="panel-h">Sender identity</h3>
			<p class="panel-note" style="margin:0 0 0.85rem;">
				Who platform email appears to come from. Edited with the email provider, because it is
				part of that configuration rather than a separate setting.
			</p>
			<dl class="dl">
				<div><dt>From name</dt><dd>{fromName || '—'}</dd></div>
				<div><dt>From address</dt><dd class="mono">{fromEmail || '—'}</dd></div>
				<div><dt>Reply-to</dt><dd class="mono">{replyTo || fromEmail || '—'}</dd></div>
				<div>
					<dt>Support address</dt>
					<dd class="mono">{settings?.general.support_email || '—'}</dd>
				</div>
			</dl>
			<div style="margin-top:0.9rem;display:flex;gap:0.5rem;flex-wrap:wrap;">
				<a class="btn btn-ghost btn-sm" href="/superadmin/providers/smtp">Edit email provider</a>
				<a class="btn btn-quiet btn-sm" href="/superadmin/settings">Edit support address</a>
			</div>
		</section>

		<section class="panel">
			<h3 class="panel-h">Send a test</h3>
			<p class="panel-note" style="margin:0 0 0.85rem;">
				Delivers a real message through the configured provider. Worth doing before onboarding a
				business — a failed invite is discovered by the person who cannot sign in.
			</p>
			<FormField label="Send to" htmlFor="notif-test">
				<TextInput id="notif-test" type="email" bind:value={testTo} placeholder="you@example.com" />
			</FormField>
			<div style="margin-top:0.85rem;">
				<button
					type="button"
					class="btn btn-primary btn-sm"
					disabled={sending || !emailReady}
					onclick={sendTest}
				>
					<Send size={14} strokeWidth={2} />
					{sending ? 'Sending…' : 'Send test email'}
				</button>
				{#if !emailReady}
					<p class="field-hint" style="margin:0.5rem 0 0;">
						Configure and enable the email provider first.
					</p>
				{/if}
			</div>

			{#if outcome}
				<div class={['outcome', outcome.ok ? '' : 'bad'].join(' ')} role="status">
					<strong>{outcome.ok ? 'Sent' : 'Failed'}</strong>
					<span>{outcome.message}</span>
					{#if outcome.detail}<span class="detail">{outcome.detail}</span>{/if}
				</div>
			{/if}
		</section>
	</div>

	<section class="panel">
		<h3 class="panel-h">What the platform sends</h3>
		<p class="panel-note" style="margin:0 0 0.85rem;">
			The complete list. Anything not here is not sent by the platform — including order updates,
			which belong to each business.
		</p>

		{#each PLATFORM_MESSAGES as message (message.name)}
			<article class="msg">
				<div class="msg-head">
					<strong>{message.name}</strong>
					<span>{message.audience}</span>
				</div>
				<p class="msg-body">{message.contents}</p>
				<ul class="msg-triggers">
					{#each message.triggers as trigger (trigger)}
						<li>{trigger}</li>
					{/each}
				</ul>
			</article>
		{/each}

		<p class="field-hint" style="margin:0.85rem 0 0;">
			Setup links are single-use and expire after
			{settings?.security.invite_expiry_hours ?? 168} hours, which is set under
			<a href="/superadmin/settings/security">Security</a>.
		</p>
	</section>

	<section class="panel" style="margin-top:0.85rem;">
		<h3 class="panel-h">Default notification rules</h3>
		<p class="panel-note" style="margin:0 0 0.85rem;">
			What every business starts with, for every event in the catalog — security and critical
			platform alerts are marked Required and cannot be turned off by a business. A business's own
			override always wins over what's set here once it writes one.
		</p>
		{#if rulesError}
			<ErrorState message={rulesError} onretry={loadRules} />
		{:else if rulesLoading}
			<Skeleton height="10rem" />
		{:else}
			<EventRuleMatrix {events} {rules} busyKey={busyRuleKey} onchange={onRuleChange} />
		{/if}
	</section>

	<section class="panel" style="margin-top:0.85rem;">
		<h3 class="panel-h">Delivery log</h3>
		<p class="panel-note" style="margin:0 0 0.85rem;">
			Recent email and SMS attempts across every business, plus the platform's own.
		</p>
		{#if deliveriesError}
			<ErrorState message={deliveriesError} onretry={loadDeliveries} />
		{:else if deliveriesLoading}
			<Skeleton height="8rem" />
		{:else if deliveries.length === 0}
			<p class="muted" style="padding:0.5rem 0;">Nothing has been queued yet.</p>
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
								<button type="button" class="btn btn-quiet btn-sm" onclick={() => retryDelivery(d.id)}>
									Retry
								</button>
							{/if}
						</div>
					</li>
				{/each}
			</ul>
		{/if}
	</section>
{/if}

<style>
	.ch-rows {
		display: flex;
		flex-direction: column;
	}

	.ch-row {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
		padding: 0.8rem 0;
		border-top: 1px solid var(--border-subtle);
	}

	.ch-row:first-child {
		border-top: 0;
		padding-top: 0;
	}

	.ch-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2rem;
		height: 2rem;
		border-radius: 10px;
		flex-shrink: 0;
		background: var(--surface-3);
		color: var(--text-3);
	}

	.ch-icon.managed {
		background: var(--success-bg);
		color: var(--success);
	}

	.ch-text {
		flex: 1;
		min-width: 0;
	}

	.ch-text strong {
		font-size: var(--fs-body);
		font-weight: 550;
	}

	.ch-text p {
		margin: 0.15rem 0 0;
		font-size: var(--fs-tab);
		line-height: 1.5;
		color: var(--text-3);
	}

	.ch-end {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-shrink: 0;
	}

	.msg {
		border: 1px solid var(--border);
		border-radius: var(--radius);
		padding: 0.85rem 0.95rem;
		background: var(--surface-2);
	}

	.msg-head {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0.5rem;
	}

	.msg-head strong {
		font-size: var(--fs-body);
		font-weight: 600;
	}

	.msg-head span {
		font-size: var(--fs-code);
		color: var(--text-3);
	}

	.msg-body {
		margin: 0.35rem 0 0;
		font-size: var(--fs-tab);
		line-height: 1.5;
		color: var(--text-2);
	}

	.msg-triggers {
		margin: 0.6rem 0 0;
		padding-left: 1.05rem;
		display: grid;
		gap: 0.2rem;
	}

	.msg-triggers li {
		font-size: var(--fs-code);
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
