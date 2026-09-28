<script lang="ts">
	import Send from '@lucide/svelte/icons/send';
	import FormField from '$lib/components/admin/FormField.svelte';
	import TextInput from '$lib/components/admin/TextInput.svelte';
	import { storefrontAdminApi } from '$lib/storefront/admin';
	import { seed, useStorefront, type StorefrontContext } from '$lib/storefront/admin-context';
	import { testTenantConfigAction } from '$lib/admin/configApi';
	import { errorMessage } from '$lib/admin/errors';
	import { toast } from '$lib/components/admin/toast';
	import { settingsHref } from '$lib/tenant/settings';

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
	let saving = $state(false);

	let dirty = $state(false);
	$effect(() => {
		const w = ctx.config.workflow;
		if (!dirty && w) readyNotification = w.ready_notification;
	});

	let testEmail = $state('');
	let testing = $state(false);

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		saving = true;
		const ok = await save(() =>
			storefrontAdminApi.saveWorkflow({ ready_notification: readyNotification })
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
