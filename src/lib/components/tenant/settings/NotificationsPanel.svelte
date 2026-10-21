<script lang="ts">
	import { onMount } from 'svelte';
	import Bell from '@tabler/icons-svelte/icons/bell';
	import History from '@tabler/icons-svelte/icons/history';
	import Lock from '@tabler/icons-svelte/icons/lock';
	import Mail from '@tabler/icons-svelte/icons/mail';
	import MessageSquare from '@tabler/icons-svelte/icons/message';
	import SlidersHorizontal from '@tabler/icons-svelte/icons/adjustments-horizontal';
	import Volume2 from '@tabler/icons-svelte/icons/volume';
	import type { Component } from 'svelte';
	import EmptyState from '$lib/components/admin/EmptyState.svelte';
	import ErrorState from '$lib/components/admin/ErrorState.svelte';
	import EventChannelGrid from '$lib/components/admin/EventChannelGrid.svelte';
	import FormField from '$lib/components/admin/FormField.svelte';
	import SelectField from '$lib/components/admin/SelectField.svelte';
	import Skeleton from '$lib/components/admin/Skeleton.svelte';
	import SlideOver from '$lib/components/admin/SlideOver.svelte';
	import StatusBadge from '$lib/components/admin/StatusBadge.svelte';
	import Switch from '$lib/components/admin/Switch.svelte';
	import TextInput from '$lib/components/admin/TextInput.svelte';
	import UpgradeNote from '$lib/components/admin/UpgradeNote.svelte';
	import { toast } from '$lib/components/admin/toast';
	import { goto } from '$app/navigation';
	import { storefrontAdminApi } from '$lib/storefront/admin';
	import { seed, useStorefront, type StorefrontContext } from '$lib/storefront/admin-context';
	import { fetchTenantConfigs } from '$lib/admin/configApi';
	import { errorMessage } from '$lib/admin/errors';
	import { formatRelative } from '$lib/admin/format';
	import { configHref } from '$lib/tenant/configuration';
	import ConfigCard from '$lib/components/config/ConfigCard.svelte';
	import ConfigRow from '$lib/components/config/ConfigRow.svelte';
	import Segmented from '$lib/components/config/Segmented.svelte';
	import { featureAccess } from '$lib/tenant/entitlements.svelte';
	import { playSound, SOUND_OPTIONS } from '$lib/sound.svelte';
	import {
		soundEnabled as bellSoundEnabled,
		setSoundEnabled as setBellSoundEnabled
	} from '$lib/notifications.svelte';
	import {
		fetchMyNotificationPreferences,
		fetchTenantNotificationDeliveries,
		fetchTenantNotificationEvents,
		fetchTenantNotificationRules,
		retryTenantNotificationDelivery,
		revertTenantNotificationRule,
		saveMyNotificationPreferences,
		saveTenantNotificationRule
	} from '$lib/admin/notificationsApi';
	import {
		isCustomerFacing,
		type NotificationChannel,
		type NotificationDelivery,
		type NotificationEventDef,
		type NotificationRule
	} from '$lib/admin/notificationTypes';

	/**
	 * Notifications: one page, no sub-sections.
	 *
	 *   channel strip   is each way of reaching people actually available?
	 *   audience toggle Team | Customers
	 *   event table     one switch per event and channel; every change saves itself
	 *
	 * Everything secondary opens in a side drawer so the page stays a single
	 * table: the delivery log, sounds and quiet hours, and message wording.
	 */
	let props: Partial<StorefrontContext> = $props();
	const ctx = useStorefront(() => props);

	/* ---------- audience ---------- */

	let audience = $state<'team' | 'customers'>('team');

	/* ---------- rules ---------- */

	let events = $state<NotificationEventDef[]>([]);
	let rules = $state<NotificationRule[]>([]);
	let loading = $state(true);
	let error = $state('');
	let busyRuleKey = $state('');

	async function loadRules() {
		loading = true;
		error = '';
		try {
			[events, rules] = await Promise.all([
				fetchTenantNotificationEvents(),
				fetchTenantNotificationRules()
			]);
		} catch (err) {
			error = errorMessage(err, 'load notification settings');
		} finally {
			loading = false;
		}
	}

	// Team: every rule not aimed at a customer or at the Orderly team itself
	// (those PLATFORM-audience rules belong to the superadmin console).
	const teamRules = $derived(
		rules.filter((r) => !isCustomerFacing(r) && r.recipient_policy !== 'PLATFORM')
	);
	const customerRules = $derived(rules.filter(isCustomerFacing));
	const shownRules = $derived(audience === 'team' ? teamRules : customerRules);

	const ruleKey = (r: NotificationRule) => `${r.event_code}:${r.channel}:${r.recipient_policy}`;

	async function onRuleChange(rule: NotificationRule, enabled: boolean) {
		busyRuleKey = ruleKey(rule);
		try {
			const saved = await saveTenantNotificationRule({
				event_code: rule.event_code,
				channel: rule.channel,
				recipient_policy: rule.recipient_policy,
				enabled,
				priority: rule.priority
			});
			rules = rules.map((r) => (ruleKey(r) === ruleKey(rule) ? saved : r));
			toast.success(enabled ? 'Turned on' : 'Turned off');
		} catch (err) {
			toast.error(errorMessage(err, 'save that change'));
		} finally {
			busyRuleKey = '';
		}
	}

	async function onRuleRevert(rule: NotificationRule) {
		try {
			await revertTenantNotificationRule(rule.event_code, rule.channel, rule.recipient_policy);
			await loadRules();
			toast.success('Back to the standard setting');
		} catch (err) {
			toast.error(errorMessage(err, 'reset that setting'));
		}
	}

	/* ---------- plan and channel availability ---------- */

	const sms = $derived(featureAccess('NOTIFY_SMS'));
	const templatesAccess = $derived(featureAccess('NOTIFY_TEMPLATES'));
	const lockedChannels = $derived(sms.enabled ? {} : { SMS: sms.requiredPlan ?? 'higher' });

	const TEAM_CHANNELS: { id: NotificationChannel; label: string }[] = [
		{ id: 'IN_APP', label: 'In-app' },
		{ id: 'EMAIL', label: 'Email' },
		{ id: 'SMS', label: 'SMS' }
	];
	const CUSTOMER_CHANNELS: { id: NotificationChannel; label: string }[] = [
		{ id: 'EMAIL', label: 'Email' },
		{ id: 'SMS', label: 'SMS' }
	];

	type Tone = 'ok' | 'warn' | 'neutral';
	const CHANNEL_NOTE: Record<string, string> = {
		app: 'The bell in this console, for your team.',
		email: 'Order emails to customers and alerts to your team.',
		sms: 'Text messages to customers.'
	};
	type Chip = { id: string; name: string; icon: typeof Bell; tone: Tone; state: string; href?: string };

	let providers = $state<{ email: boolean; sms: boolean } | null>(null);

	async function loadProviders() {
		try {
			const { services } = await fetchTenantConfigs();
			const ready = (code: string) => {
				const s = services.find((x) => x.own_config.service === code);
				if (!s) return false;
				const own = s.own_config.enabled && s.own_config.status !== 'UNCONFIGURED';
				return own || s.options.platform_available;
			};
			providers = { email: ready('SMTP'), sms: ready('SMS') };
		} catch {
			providers = null; // unknown: show no verdict rather than a wrong one
		}
	}

	const chips = $derived<Chip[]>([
		{ id: 'app', name: 'In-app', icon: Bell, tone: 'ok', state: 'Always on' },
		{
			id: 'email',
			name: 'Email',
			icon: Mail,
			tone: providers === null ? 'neutral' : providers.email ? 'ok' : 'warn',
			state: providers === null ? 'Status unknown' : providers.email ? 'Ready to send' : 'Set up email',
			href: providers && !providers.email ? configHref('integrations') : undefined
		},
		{
			id: 'sms',
			name: 'SMS',
			icon: MessageSquare,
			tone: !sms.enabled ? 'neutral' : providers === null ? 'neutral' : providers.sms ? 'ok' : 'warn',
			state: !sms.enabled
				? `${sms.requiredPlan ?? 'Higher'} plan`
				: providers === null
					? 'Status unknown'
					: providers.sms
						? 'Ready to send'
						: 'Set up SMS',
			href: sms.enabled && providers && !providers.sms ? configHref('integrations') : undefined
		}
	]);

	/* ---------- drawer: message wording ---------- */

	// Wording and branding live on their own Settings page, the template studio.
	function editWording(ev?: NotificationEventDef) {
		void goto(configHref('email-templates', ev ? `event=${encodeURIComponent(ev.code)}` : ''));
	}

	/* ---------- drawer: delivery log ---------- */

	let logOpen = $state(false);
	let deliveries = $state<NotificationDelivery[]>([]);
	let logLoading = $state(false);
	let logError = $state('');
	let logLoaded = $state(false);

	async function loadDeliveries() {
		logLoading = true;
		logError = '';
		try {
			deliveries = await fetchTenantNotificationDeliveries();
			logLoaded = true;
		} catch (err) {
			logError = errorMessage(err, 'load the delivery log');
		} finally {
			logLoading = false;
		}
	}

	$effect(() => {
		if (logOpen && !logLoaded) void loadDeliveries();
	});

	async function retryDelivery(id: string) {
		try {
			await retryTenantNotificationDelivery(id);
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

	/* ---------- drawer: sounds and quiet hours ---------- */

	let settingsOpen = $state(false);
	let saving = $state(false);

	let readyNotification = $state(seed(() => ctx.config.workflow.ready_notification));
	let newOrderSound = $state(seed(() => ctx.config.workflow.new_order_sound || 'CHIME'));
	let inAppNewOrder = $state(seed(() => ctx.config.workflow.in_app_new_order_enabled ?? true));
	let inAppOrderReady = $state(seed(() => ctx.config.workflow.in_app_order_ready_enabled ?? true));
	let orderReadySound = $state(seed(() => ctx.config.workflow.order_ready_sound || 'CHIME'));
	let soundOn = $state(bellSoundEnabled());
	let quietStart = $state('');
	let quietEnd = $state('');

	// Re-seed from the server each time the drawer opens, so a discarded edit
	// never lingers into the next visit.
	$effect(() => {
		if (!settingsOpen) return;
		const w = ctx.config.workflow;
		readyNotification = w.ready_notification;
		newOrderSound = w.new_order_sound || 'CHIME';
		orderReadySound = w.order_ready_sound || 'CHIME';
		inAppNewOrder = w.in_app_new_order_enabled ?? true;
		inAppOrderReady = w.in_app_order_ready_enabled ?? true;
	});

	async function loadPreferences() {
		try {
			const p = await fetchMyNotificationPreferences('/api/v1/tenant');
			quietStart = p.quiet_hours_start ?? '';
			quietEnd = p.quiet_hours_end ?? '';
		} catch {
			/* defaults are fine if this account has never saved preferences */
		}
	}

	async function saveSettings() {
		saving = true;
		try {
			const ok = await ctx.save(() =>
				storefrontAdminApi.saveWorkflow({
					ready_notification: readyNotification,
					new_order_sound: newOrderSound,
					order_ready_sound: orderReadySound,
					in_app_new_order_enabled: inAppNewOrder,
					in_app_order_ready_enabled: inAppOrderReady
				})
			);
			if (!ok) throw new Error('workflow');
			setBellSoundEnabled(soundOn);
			await saveMyNotificationPreferences('/api/v1/tenant', {
				sound_enabled: soundOn,
				quiet_hours_start: quietStart || undefined,
				quiet_hours_end: quietEnd || undefined
			});
			toast.success('Alert settings saved');
			settingsOpen = false;
		} catch (err) {
			toast.error(errorMessage(err, 'save your alert settings'));
		} finally {
			saving = false;
		}
	}

	onMount(() => {
		void loadRules();
		void loadProviders();
		void loadPreferences();
	});
</script>

<div class="np">
	<ConfigCard
		id="np-channels"
		title="Delivery channels"
		description="Where notifications can go. A channel has to be connected before anything is sent through it."
		flush
	>
		{#each chips as chip (chip.id)}
			<ConfigRow icon={chip.icon} label={chip.name} description={CHANNEL_NOTE[chip.id]}>
				<StatusBadge status={chip.state} kind={chip.tone === 'warn' ? 'warn' : chip.tone === 'ok' ? 'ok' : 'neutral'} />
				{#if chip.href}
					<a class="btn btn-ghost btn-sm" href={chip.href}>Set up</a>
				{/if}
				{#if chip.id === 'sms' && !sms.enabled}<Lock size={13} stroke={1.6} aria-label="Not in your plan" />{/if}
			</ConfigRow>
		{/each}
	</ConfigCard>

	<ConfigCard
		id="np-alerts"
		title={audience === 'team' ? 'Team alerts' : 'Customer messages'}
		description={audience === 'team'
			? 'Which events alert the people who work here.'
			: 'What customers hear from you. They can always follow their order on the tracking screen.'}
		flush
		footnote="Changes save as you make them."
	>
		{#snippet aside()}
			<Segmented
				label="Who is notified"
				value={audience}
				options={[
					{ value: 'team', label: 'Your team' },
					{ value: 'customers', label: 'Customers' }
				]}
				onchange={(v) => (audience = v)}
			/>
		{/snippet}

		{#if audience === 'customers' && !sms.enabled}
			<div class="np-upgrade"><UpgradeNote feature="SMS messages" requiredPlan={sms.requiredPlan} /></div>
		{/if}

		<div class="np-grid">
			{#if error}
				<ErrorState message={error} onretry={loadRules} />
			{:else if loading}
				<Skeleton height="14rem" />
			{:else}
				<EventChannelGrid
					{events}
					rules={shownRules}
					channels={audience === 'team' ? TEAM_CHANNELS : CUSTOMER_CHANNELS}
					locked={lockedChannels}
					busyKey={busyRuleKey}
					onchange={onRuleChange}
					onrevert={onRuleRevert}
					onedit={editWording}
					editLocked={!templatesAccess.enabled}
				/>
			{/if}
		</div>

		{#snippet footer()}
			<button type="button" class="btn btn-ghost btn-sm" onclick={() => editWording()}>
				<Mail size={14} stroke={1.6} /> Email templates
			</button>
			<button type="button" class="btn btn-ghost btn-sm" onclick={() => (logOpen = true)}>
				<History size={14} stroke={1.6} /> Delivery log
			</button>
			<button type="button" class="btn btn-ghost btn-sm" onclick={() => (settingsOpen = true)}>
				<SlidersHorizontal size={14} stroke={1.6} /> Alert settings
			</button>
		{/snippet}
	</ConfigCard>
</div>

<SlideOver bind:open={logOpen} title="Delivery log">
	<p class="drawer-note">Recent emails and texts from this business. Failed ones can be retried.</p>
	{#if logError}
		<ErrorState message={logError} onretry={loadDeliveries} />
	{:else if logLoading && !logLoaded}
		<Skeleton height="8rem" />
	{:else if deliveries.length === 0}
		<EmptyState title="Nothing sent yet" description="Emails and texts will appear here once one goes out." />
	{:else}
		<ul class="dlv">
			{#each deliveries as d (d.id)}
				<li>
					<div class="dlv-main">
						<strong>{d.event_code.replaceAll('_', ' ').toLowerCase()}</strong>
						<span>{d.channel === 'SMS' ? 'Text' : 'Email'} · {d.recipient} · {formatRelative(d.created_at)}</span>
						{#if d.last_error}<span class="dlv-err">{d.last_error}</span>{/if}
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

<SlideOver bind:open={settingsOpen} title="Alert settings">
	<div class="form">
		<Switch bind:checked={inAppNewOrder} label="Show new orders in the bell" hint="Everyone who works Selling." />
		<Switch bind:checked={inAppOrderReady} label="Show ready orders in the bell" hint="Everyone who works Selling." />
		<Switch
			bind:checked={readyNotification}
			label="Update the tracking screen when an order is ready"
			hint="What the customer sees."
		/>

		<FormField label="New order sound" htmlFor="ns-new-order" hint="Plays in the shop console.">
			<div class="sound">
				<SelectField id="ns-new-order" bind:value={newOrderSound} options={SOUND_OPTIONS} />
				<button type="button" class="btn btn-ghost btn-sm" aria-label="Preview sound" onclick={() => playSound(newOrderSound, { preview: true })}>
					<Volume2 size={15} stroke={1.6} />
				</button>
			</div>
		</FormField>
		<FormField label="Order ready sound" htmlFor="ns-order-ready" hint="Plays on the customer's tracking screen.">
			<div class="sound">
				<SelectField id="ns-order-ready" bind:value={orderReadySound} options={SOUND_OPTIONS} />
				<button type="button" class="btn btn-ghost btn-sm" aria-label="Preview sound" onclick={() => playSound(orderReadySound, { preview: true })}>
					<Volume2 size={15} stroke={1.6} />
				</button>
			</div>
		</FormField>

		<Switch bind:checked={soundOn} label="Play a sound for alerts in this browser" hint="Just you." />
		<div class="quiet">
			<FormField label="Quiet hours from" hint="Just you. Alert emails to you are held.">
				<TextInput bind:value={quietStart} type="time" />
			</FormField>
			<FormField label="Until">
				<TextInput bind:value={quietEnd} type="time" />
			</FormField>
		</div>
	</div>
	{#snippet footer()}
		<button type="button" class="btn btn-ghost" onclick={() => (settingsOpen = false)}>Cancel</button>
		<button type="button" class="btn btn-primary" disabled={saving} onclick={saveSettings}>
			{saving ? 'Saving…' : 'Save'}
		</button>
	{/snippet}
</SlideOver>

<style>
	.np {
		display: flex;
		flex-direction: column;
		gap: var(--sp-9);
	}




	.np-upgrade {
		padding: 0 var(--sp-10) var(--sp-6);
	}

	.np-grid {
		padding: 0 var(--sp-6) var(--sp-6);
		overflow-x: auto;
	}
















	.drawer-note {
		margin: 0 0 0.9rem;
		font-size: 0.875rem;
		color: var(--text-3);
	}

	.form {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.sound {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}

	.quiet {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.75rem;
	}

	.dlv {
		list-style: none;
		margin: 0;
		padding: 0;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		overflow: hidden;
	}

	.dlv li {
		display: flex;
		justify-content: space-between;
		gap: 0.75rem;
		padding: 0.65rem 0.85rem;
		border-top: 1px solid var(--border-subtle);
		background: var(--card-bg);
	}

	.dlv li:first-child {
		border-top: 0;
	}

	.dlv-main {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
		min-width: 0;
		font-size: var(--fs-code);
		color: var(--text-3);
	}

	.dlv-main strong {
		color: var(--text-2);
		font-size: 0.875rem;
		text-transform: capitalize;
	}

	.dlv-err {
		color: var(--danger, #dc2626);
	}

	.dlv-end {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		flex-shrink: 0;
	}
</style>
