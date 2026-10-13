<script lang="ts">
	import { onMount } from 'svelte';
	import Send from '@tabler/icons-svelte/icons/send';
	import FormField from '$lib/components/admin/FormField.svelte';
	import SelectField from '$lib/components/admin/SelectField.svelte';
	import TextInput from '$lib/components/admin/TextInput.svelte';
	import TextArea from '$lib/components/admin/TextArea.svelte';
	import Skeleton from '$lib/components/admin/Skeleton.svelte';
	import ErrorState from '$lib/components/admin/ErrorState.svelte';
	import StatusBadge from '$lib/components/admin/StatusBadge.svelte';
	import { toast } from '$lib/components/admin/toast';
	import { errorMessage } from '$lib/admin/errors';
	import {
		fetchTenantNotificationTemplates,
		saveTenantNotificationTemplate,
		testSendTenantTemplate
	} from '$lib/admin/notificationsApi';
	import {
		CHANNEL_LABEL,
		type NotificationChannel,
		type NotificationEventDef,
		type NotificationRule,
		type NotificationTemplate
	} from '$lib/admin/notificationTypes';

	/**
	 * Edit the wording of one customer message. Pick the message, then write it:
	 * the variables it understands are listed, and a test goes to an address you
	 * choose. Saving makes a new version; nothing here changes who is messaged.
	 */
	let {
		events,
		rules,
		initialEvent = ''
	}: { events: NotificationEventDef[]; rules: NotificationRule[]; initialEvent?: string } = $props();

	let templates = $state<NotificationTemplate[]>([]);
	let loading = $state(true);
	let error = $state('');

	// svelte-ignore state_referenced_locally
	let eventCode = $state(initialEvent);
	let channel = $state<NotificationChannel>('EMAIL');
	let subject = $state('');
	let body = $state('');
	let testTo = $state('');
	let saving = $state(false);
	let testing = $state(false);

	// Only the channels this message is actually sent on — no SMS wording for a
	// message that only ever goes out by email.
	const channelsFor = $derived(
		(['EMAIL', 'SMS'] as const).filter((c) => rules.some((r) => r.event_code === eventCode && r.channel === c))
	);
	$effect(() => {
		if (channelsFor.length && !channelsFor.includes(channel as 'EMAIL' | 'SMS')) channel = channelsFor[0];
	});

	const event = $derived(events.find((e) => e.code === eventCode));
	const current = $derived(templates.find((t) => t.event_code === eventCode && t.channel === channel));

	async function load() {
		loading = true;
		error = '';
		try {
			templates = await fetchTenantNotificationTemplates();
		} catch (err) {
			error = errorMessage(err, 'load message templates');
		} finally {
			loading = false;
		}
	}

	// Switching message or channel loads that message's current wording.
	$effect(() => {
		subject = current?.subject ?? '';
		body = current?.body ?? '';
	});

	$effect(() => {
		if (!eventCode && events.length) eventCode = events[0].code;
	});

	async function save() {
		if (!body.trim()) {
			toast.error('Write the message first');
			return;
		}
		saving = true;
		try {
			const saved = await saveTenantNotificationTemplate({
				event_code: eventCode,
				channel,
				subject: channel === 'EMAIL' ? subject : undefined,
				body
			});
			templates = [...templates.filter((t) => !(t.event_code === eventCode && t.channel === channel)), saved];
			toast.success('Message saved');
		} catch (err) {
			toast.error(errorMessage(err, 'save that message'));
		} finally {
			saving = false;
		}
	}

	async function sendTest() {
		if (!testTo.trim()) {
			toast.error(channel === 'EMAIL' ? 'Enter an email address' : 'Enter a phone number');
			return;
		}
		testing = true;
		try {
			const out = await testSendTenantTemplate({ event_code: eventCode, channel, to: testTo.trim() });
			if (out.ok) toast.success(out.message || 'Test sent');
			else toast.error(out.message || 'Could not send the test');
		} catch (err) {
			toast.error(errorMessage(err, 'send the test'));
		} finally {
			testing = false;
		}
	}

	onMount(load);
</script>

{#if error}
	<ErrorState message={error} onretry={load} />
{:else if loading}
	<Skeleton height="10rem" />
{:else if events.length === 0}
	<p class="muted">No customer messages are available for your business type.</p>
{:else}
	<div class="sfctl-grid">
		<FormField label="Message" htmlFor="mt-event">
			<SelectField
				id="mt-event"
				bind:value={eventCode}
				options={events.map((e) => ({ value: e.code, label: e.label }))}
			/>
		</FormField>
		<FormField label="Sent by" htmlFor="mt-channel">
			<SelectField
				id="mt-channel"
				bind:value={channel}
				options={channelsFor.map((c) => ({ value: c, label: CHANNEL_LABEL[c] }))}
			/>
		</FormField>
	</div>

	<p class="sfctl-note" style="margin-top:0.6rem;">
		{event?.description}
		{#if current}
			<StatusBadge status={current.overridden ? 'Your wording' : 'Standard wording'} kind="neutral" />
		{/if}
	</p>

	{#if channel === 'EMAIL'}
		<FormField label="Subject" htmlFor="mt-subject">
			<TextInput id="mt-subject" bind:value={subject} />
		</FormField>
	{/if}
	<FormField
		label="Message"
		htmlFor="mt-body"
		hint={channel === 'SMS' ? 'Keep it short — long texts are split and cost more.' : ''}
	>
		<TextArea id="mt-body" bind:value={body} rows={channel === 'SMS' ? 4 : 8} />
	</FormField>

	{#if event?.variables?.length}
		<p class="vars">
			You can use:
			{#each event.variables as v (v)}<code>{`{{${v}}}`}</code>{/each}
		</p>
	{/if}

	<div class="actions">
		<button type="button" class="btn btn-primary" disabled={saving} onclick={save}>
			{saving ? 'Saving…' : 'Save message'}
		</button>
		<span class="test">
			<TextInput
				bind:value={testTo}
				type={channel === 'EMAIL' ? 'email' : 'tel'}
				placeholder={channel === 'EMAIL' ? 'you@example.com' : '+91…'}
			/>
			<button type="button" class="btn btn-secondary btn-sm" disabled={testing} onclick={sendTest}>
				<Send size={14} stroke={1.6} />
				{testing ? 'Sending…' : 'Send saved message as a test'}
			</button>
		</span>
	</div>
{/if}

<style>
	.vars {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
		align-items: center;
		margin: 0.4rem 0 0;
		font-size: var(--fs-code);
		color: var(--text-3);
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		justify-content: space-between;
		align-items: center;
		margin-top: 0.9rem;
	}

	.test {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}
</style>
