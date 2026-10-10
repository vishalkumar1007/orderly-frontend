<script lang="ts">
	import { onMount } from 'svelte';
	import Send from '@lucide/svelte/icons/send';
	import Volume2 from '@lucide/svelte/icons/volume-2';
	import FormField from '$lib/components/admin/FormField.svelte';
	import SelectField from '$lib/components/admin/SelectField.svelte';
	import Switch from '$lib/components/admin/Switch.svelte';
	import TextInput from '$lib/components/admin/TextInput.svelte';
	import { storefrontAdminApi } from '$lib/storefront/admin';
	import { seed, useStorefront, type StorefrontContext } from '$lib/storefront/admin-context';
	import { testTenantConfigAction } from '$lib/admin/configApi';
	import { errorMessage } from '$lib/admin/errors';
	import { formatRelative } from '$lib/admin/format';
	import { toast } from '$lib/components/admin/toast';
	import { settingsHref } from '$lib/tenant/settings';
	import { playSound, SOUND_OPTIONS } from '$lib/sound';
	import { soundEnabled as bellSoundEnabled, setSoundEnabled as setBellSoundEnabled } from '$lib/notifications.svelte';
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
		type NotificationDelivery,
		type NotificationEventDef,
		type NotificationRule
	} from '$lib/admin/notificationTypes';
	import EventRuleMatrix from '$lib/components/admin/EventRuleMatrix.svelte';
	import ErrorState from '$lib/components/admin/ErrorState.svelte';
	import Skeleton from '$lib/components/admin/Skeleton.svelte';
	import StatusBadge from '$lib/components/admin/StatusBadge.svelte';

	/**
	 * Notifications.
	 *
	 * What a customer hears from you while their order is being made, and proof
	 * that the mail actually leaves the building. The stages themselves belong
	 * to Order workflow; this screen owns only the messages.
	 */
	let props: Partial<StorefrontContext> = $props();
	const ctx = useStorefront(() => props);
	const save = (run: Parameters<StorefrontContext['save']>[0]) => ctx.save(run);

	let readyNotification = $state(seed(() => ctx.config.workflow.ready_notification));
	let newOrderSound = $state(seed(() => ctx.config.workflow.new_order_sound || 'CHIME'));
	let orderReadySound = $state(seed(() => ctx.config.workflow.order_ready_sound || 'CHIME'));
	let inAppNewOrder = $state(seed(() => ctx.config.workflow.in_app_new_order_enabled ?? true));
	let inAppOrderReady = $state(seed(() => ctx.config.workflow.in_app_order_ready_enabled ?? true));
	let saving = $state(false);

	let dirty = $state(false);
	$effect(() => {
		const w = ctx.config.workflow;
		if (!dirty && w) {
			readyNotification = w.ready_notification;
			newOrderSound = w.new_order_sound || 'CHIME';
			orderReadySound = w.order_ready_sound || 'CHIME';
			inAppNewOrder = w.in_app_new_order_enabled ?? true;
			inAppOrderReady = w.in_app_order_ready_enabled ?? true;
		}
	});

	let testEmail = $state('');
	let testing = $state(false);

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		saving = true;
		const ok = await save(() =>
			storefrontAdminApi.saveWorkflow({
				ready_notification: readyNotification,
				new_order_sound: newOrderSound,
				order_ready_sound: orderReadySound,
				in_app_new_order_enabled: inAppNewOrder,
				in_app_order_ready_enabled: inAppOrderReady
			})
		);
		saving = false;
		dirty = false;
		if (ok) toast.success('Notification settings saved');
		else toast.error('Could not save your notification settings');
	}

	async function sendTest() {
		const to = testEmail.trim();
		if (!to) {
			toast.error('Enter an email address to send a test');
			return;
		}
		testing = true;
		try {
			const outcome = await testTenantConfigAction('SMTP', 'send_email', { to });
			if (outcome.ok) toast.success(outcome.message || 'Test email sent');
			else toast.error(outcome.message || 'Could not send test email');
		} catch (err) {
			toast.error(errorMessage(err, 'send the test email'));
		} finally {
			testing = false;
		}
	}

	/* ---------- rules engine: events, admin/storefront matrix ---------- */

	let events = $state<NotificationEventDef[]>([]);
	let rules = $state<NotificationRule[]>([]);
	let rulesLoading = $state(true);
	let rulesError = $state('');
	let busyRuleKey = $state('');

	async function loadRules() {
		rulesLoading = true;
		rulesError = '';
		try {
			[events, rules] = await Promise.all([fetchTenantNotificationEvents(), fetchTenantNotificationRules()]);
		} catch (err) {
			rulesError = errorMessage(err, 'load notification rules');
		} finally {
			rulesLoading = false;
		}
	}

	const adminRules = $derived(rules.filter((r) => !isCustomerFacing(r)));
	const storefrontRules = $derived(rules.filter(isCustomerFacing));

	function ruleKey(r: NotificationRule) {
		return `${r.event_code}:${r.channel}:${r.recipient_policy}`;
	}

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
		} catch (err) {
			toast.error(errorMessage(err, 'save that notification rule'));
		} finally {
			busyRuleKey = '';
		}
	}

	async function onRuleRevert(rule: NotificationRule) {
		try {
			await revertTenantNotificationRule(rule.event_code, rule.channel, rule.recipient_policy);
			await loadRules();
			toast.success('Reverted to the platform default');
		} catch (err) {
			toast.error(errorMessage(err, 'revert that rule'));
		}
	}

	/* ---------- delivery history ---------- */

	let deliveries = $state<NotificationDelivery[]>([]);
	let deliveriesLoading = $state(true);
	let deliveriesError = $state('');

	async function loadDeliveries() {
		deliveriesLoading = true;
		deliveriesError = '';
		try {
			deliveries = await fetchTenantNotificationDeliveries();
		} catch (err) {
			deliveriesError = errorMessage(err, 'load delivery history');
		} finally {
			deliveriesLoading = false;
		}
	}

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

	/* ---------- personal preferences ---------- */

	let soundOn = $state(bellSoundEnabled());
	let quietStart = $state('');
	let quietEnd = $state('');
	let prefsSaving = $state(false);

	async function loadPreferences() {
		try {
			const p = await fetchMyNotificationPreferences('/api/v1/tenant');
			quietStart = p.quiet_hours_start ?? '';
			quietEnd = p.quiet_hours_end ?? '';
		} catch {
			/* defaults are fine if this account has never saved preferences */
		}
	}

	function toggleSound(on: boolean) {
		soundOn = on;
		setBellSoundEnabled(on);
	}

	async function savePreferences() {
		prefsSaving = true;
		try {
			await saveMyNotificationPreferences('/api/v1/tenant', {
				sound_enabled: soundOn,
				quiet_hours_start: quietStart || undefined,
				quiet_hours_end: quietEnd || undefined
			});
			toast.success('Preferences saved');
		} catch (err) {
			toast.error(errorMessage(err, 'save your preferences'));
		} finally {
			prefsSaving = false;
		}
	}

	onMount(() => {
		void loadRules();
		void loadDeliveries();
		void loadPreferences();
	});
</script>

<form onsubmit={submit}>
	<div class="sfctl-section">
		<h2>Order updates</h2>
		<p class="sfctl-note">
			What a customer is told while their order is being made. The tracking screen is always
			available to them; this decides whether you push an update to it.
		</p>
		<div style="display:grid;gap:0.4rem;">
			<button
				class="sfopt"
				type="button"
				aria-pressed={readyNotification}
				onclick={() => {
					readyNotification = !readyNotification;
					dirty = true;
				}}
			>
				<span class="sfopt-mark" aria-hidden="true"></span>
				<span class="sfopt-body">
					<span class="sfopt-label">Tell customers when an order is ready</span>
					<span class="sfopt-hint">
						{readyNotification
							? 'The tracking screen updates the moment you mark an order ready.'
							: 'Customers will still see the tracking screen; it just updates less eagerly.'}
					</span>
				</span>
			</button>
		</div>
	</div>

	<div class="sfctl-section">
		<h2>In-app notifications</h2>
		<p class="sfctl-note">
			What shows up in the bell, for everyone who works Selling on this business. Independent of
			the sounds below — mute the sound and keep the bell, or the other way around.
		</p>
		<div style="display:flex;flex-direction:column;gap:0.6rem;">
			<Switch
				bind:checked={inAppNewOrder}
				label="New order arrives"
				onchange={() => (dirty = true)}
			/>
			<Switch
				bind:checked={inAppOrderReady}
				label="Order marked ready"
				onchange={() => (dirty = true)}
			/>
		</div>
	</div>

	<div class="sfctl-section">
		<h2>Sounds</h2>
		<p class="sfctl-note">
			What plays where: the shop console when a new order arrives, and the customer's tracking
			screen when their order is marked ready. "No sound" is silent.
		</p>
		<div class="sfctl-grid">
			<FormField label="New order (shop console)" htmlFor="ns-new-order">
				<div style="display:flex;gap:0.5rem;align-items:center;">
					<SelectField id="ns-new-order" bind:value={newOrderSound} options={SOUND_OPTIONS} />
					<button
						type="button"
						class="btn btn-ghost btn-sm"
						aria-label="Preview new order sound"
						onclick={() => playSound(newOrderSound)}
					>
						<Volume2 size={15} strokeWidth={2} />
					</button>
				</div>
			</FormField>
			<FormField label="Order ready (customer tracking)" htmlFor="ns-order-ready">
				<div style="display:flex;gap:0.5rem;align-items:center;">
					<SelectField id="ns-order-ready" bind:value={orderReadySound} options={SOUND_OPTIONS} />
					<button
						type="button"
						class="btn btn-ghost btn-sm"
						aria-label="Preview order ready sound"
						onclick={() => playSound(orderReadySound)}
					>
						<Volume2 size={15} strokeWidth={2} />
					</button>
				</div>
			</FormField>
		</div>
	</div>

	<div class="sfctl-section">
		<h2>Email delivery</h2>
		<p class="sfctl-note">
			Order mail goes out over the email service configured under
			<a href={settingsHref('integrations')}>Integrations</a>. Send yourself a test to confirm it
			is working before a customer finds out for you.
		</p>
		<div class="sfctl-grid">
			<FormField label="Send a test to" hint="Any address you can open right now.">
				<TextInput bind:value={testEmail} type="email" placeholder="you@example.com" />
			</FormField>
		</div>
		<button
			type="button"
			class="btn btn-secondary btn-sm"
			style="margin-top:0.6rem;"
			onclick={sendTest}
			disabled={testing}
		>
			<Send size={14} strokeWidth={2} />
			{testing ? 'Sending…' : 'Send test email'}
		</button>
	</div>

	<div class="sfctl-foot">
		<span class="sfctl-foot-note">Applies to orders placed from now on.</span>
		<button class="btn btn-primary" type="submit" disabled={saving}>
			{saving ? 'Saving…' : 'Save notification settings'}
		</button>
	</div>
</form>

<div class="sfctl-section">
	<h2>Admin notifications</h2>
	<p class="sfctl-note">
		What reaches your staff, and over which channel. Email and SMS need a provider configured
		under <a href={settingsHref('integrations')}>Integrations</a> first — a channel with none
		configured simply won't send until it is.
	</p>
	{#if rulesError}
		<ErrorState message={rulesError} onretry={loadRules} />
	{:else if rulesLoading}
		<Skeleton height="8rem" />
	{:else}
		<EventRuleMatrix
			events={events.filter((e) => e.category !== 'PLATFORM')}
			rules={adminRules}
			busyKey={busyRuleKey}
			onchange={onRuleChange}
			onrevert={onRuleRevert}
		/>
	{/if}
</div>

<div class="sfctl-section">
	<h2>Storefront notifications</h2>
	<p class="sfctl-note">
		What a customer is told, and how. These are the messages that leave the building — review
		before turning one on.
	</p>
	{#if !rulesLoading && !rulesError}
		<EventRuleMatrix
			events={events.filter((e) => e.category !== 'PLATFORM')}
			rules={storefrontRules}
			busyKey={busyRuleKey}
			onchange={onRuleChange}
			onrevert={onRuleRevert}
		/>
	{/if}
</div>

<div class="sfctl-section">
	<h2>Delivery history</h2>
	<p class="sfctl-note">Recent email and SMS attempts for this business.</p>
	{#if deliveriesError}
		<ErrorState message={deliveriesError} onretry={loadDeliveries} />
	{:else if deliveriesLoading}
		<Skeleton height="6rem" />
	{:else if deliveries.length === 0}
		<p class="muted" style="padding:0.5rem 0;">Nothing has been queued yet.</p>
	{:else}
		<ul class="dlv-list">
			{#each deliveries as d (d.id)}
				<li class="dlv-row">
					<div class="dlv-main">
						<strong>{d.event_code}</strong>
						<span class="dlv-meta">{d.channel} · {d.recipient} · {formatRelative(d.created_at)}</span>
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
</div>

<div class="sfctl-section">
	<h2>Your preferences</h2>
	<p class="sfctl-note">
		Personal, within what the business allows above — this is about you, not the business.
	</p>
	<div style="display:flex;flex-direction:column;gap:0.6rem;">
		<Switch
			checked={soundOn}
			label="Play a sound for important alerts"
			hint="Applies to the notification bell in this browser only."
			onchange={toggleSound}
		/>
		<div class="sfctl-grid">
			<FormField label="Quiet hours start" hint="Optional. Non-critical alerts are held until after this.">
				<TextInput bind:value={quietStart} type="time" />
			</FormField>
			<FormField label="Quiet hours end">
				<TextInput bind:value={quietEnd} type="time" />
			</FormField>
		</div>
		<div>
			<button type="button" class="btn btn-secondary btn-sm" disabled={prefsSaving} onclick={savePreferences}>
				{prefsSaving ? 'Saving…' : 'Save preferences'}
			</button>
		</div>
	</div>
</div>

<style>
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
