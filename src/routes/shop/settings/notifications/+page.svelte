<script lang="ts">
	import FormField from '$lib/components/admin/FormField.svelte';
	import TextInput from '$lib/components/admin/TextInput.svelte';
	import Skeleton from '$lib/components/admin/Skeleton.svelte';
	import ErrorState from '$lib/components/admin/ErrorState.svelte';
	import { loadStorefrontAdmin, type AdminStorefront } from '$lib/storefront/adminCache.svelte';
	import { storefrontAdminApi } from '$lib/storefront/admin';
	import { testTenantConfigAction } from '$lib/admin/configApi';
	import { toast } from '$lib/components/admin/toast';

	let config = $state<AdminStorefront | null>(null);
	let loading = $state(true);
	let error = $state('');
	let saving = $state(false);
	let loaded = $state(false);

	// Notification settings
	let readyNotification = $state(false);
	let autoComplete = $state(false);
	let acceptanceMode = $state('AUTO');

	// Test notification
	let testEmail = $state('');
	let testing = $state(false);

	async function load() {
		loading = true;
		error = '';
		try {
			const cfg = await loadStorefrontAdmin();
			config = cfg;
			if (!loaded) {
				readyNotification = cfg.workflow.ready_notification;
				autoComplete = cfg.workflow.auto_complete;
				acceptanceMode = cfg.workflow.acceptance_mode;
				loaded = true;
			}
		} catch (err) {
			error = err instanceof Error ? err.message : 'Could not load your settings';
		} finally {
			loading = false;
		}
	}

	async function save(event: SubmitEvent) {
		event.preventDefault();
		saving = true;
		try {
			await storefrontAdminApi.saveWorkflow({
				acceptance_mode: acceptanceMode,
				ready_notification: readyNotification,
				auto_complete: autoComplete
			});
			toast.success('Notification settings saved');
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Could not save your settings');
		} finally {
			saving = false;
		}
	}

	async function sendTestNotification() {
		const to = testEmail.trim();
		if (!to) {
			toast.error('Enter an email address to send a test');
			return;
		}
		testing = true;
		try {
			const outcome = await testTenantConfigAction('SMTP', 'send_email', { to });
			if (outcome.ok) {
				toast.success(outcome.message || 'Test email sent');
			} else {
				toast.error(outcome.message || 'Could not send test email');
			}
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Could not send test email');
		} finally {
			testing = false;
		}
	}

	load();
</script>

{#if loading}
	<div class="panel">
		<Skeleton height="1.2rem" width="12rem" />
		<div style="margin-top:1rem;display:grid;gap:0.7rem;grid-template-columns:repeat(auto-fill,minmax(11rem,1fr));">
			{#each [1, 2, 3] as i (i)}
				<Skeleton height="4.5rem" />
			{/each}
		</div>
	</div>
{:else if error && !config}
	<ErrorState message={error} onretry={load} />
{:else if config}
	<form onsubmit={save}>
		<div class="sfctl-section">
			<h2>Order notifications</h2>
			<p class="sfctl-note">
				Choose how your team is notified when orders come in and when they are ready.
			</p>
			<div style="display:grid;gap:0.4rem;">
				<button
					class="sfopt"
					type="button"
					aria-pressed={readyNotification}
					onclick={() => (readyNotification = !readyNotification)}
				>
					<span class="sfopt-mark" aria-hidden="true"></span>
					<span class="sfopt-body">
						<span class="sfopt-label">Ready notification</span>
						<span class="sfopt-hint">
							{readyNotification
								? 'Staff are notified when an order is ready for pickup.'
								: 'No notification when orders are ready.'}
						</span>
					</span>
				</button>
				<button
					class="sfopt"
					type="button"
					aria-pressed={autoComplete}
					onclick={() => (autoComplete = !autoComplete)}
				>
					<span class="sfopt-mark" aria-hidden="true"></span>
					<span class="sfopt-body">
						<span class="sfopt-label">Auto-complete orders</span>
						<span class="sfopt-hint">
							{autoComplete
								? 'Orders are automatically marked as completed after pickup.'
								: 'Orders stay open until manually completed.'}
						</span>
					</span>
				</button>
			</div>
		</div>

		<div class="sfctl-section">
			<h2>Order acceptance</h2>
			<p class="sfctl-note">
				Decide whether new orders start preparing automatically or need manual acceptance.
			</p>
			<div style="display:grid;gap:0.4rem;">
				<button
					class="sfopt"
					type="button"
					aria-pressed={acceptanceMode === 'AUTO'}
					onclick={() => (acceptanceMode = 'AUTO')}
				>
					<span class="sfopt-mark" aria-hidden="true"></span>
					<span class="sfopt-body">
						<span class="sfopt-label">Automatic</span>
						<span class="sfopt-hint">New orders start preparing without a tap</span>
					</span>
				</button>
				<button
					class="sfopt"
					type="button"
					aria-pressed={acceptanceMode === 'MANUAL'}
					onclick={() => (acceptanceMode = 'MANUAL')}
				>
					<span class="sfopt-mark" aria-hidden="true"></span>
					<span class="sfopt-body">
						<span class="sfopt-label">Manual</span>
						<span class="sfopt-hint">You accept each order yourself</span>
					</span>
				</button>
			</div>
		</div>

		<div class="sfctl-section">
			<h2>Test email</h2>
			<p class="sfctl-note">
				Send a test email to verify your SMTP configuration is working.
			</p>
			<FormField label="Email address" hint="Where to send the test message">
				<TextInput bind:value={testEmail} type="email" placeholder="you@example.com" />
			</FormField>
			<button
				type="button"
				class="btn btn-ghost btn-sm"
				style="margin-top:0.5rem;"
				onclick={sendTestNotification}
				disabled={testing}
			>
				{testing ? 'Sending…' : 'Send test email'}
			</button>
		</div>

		<div class="sfctl-foot">
			<span class="sfctl-foot-note"></span>
			<button class="btn btn-primary" type="submit" disabled={saving}>
				{saving ? 'Saving…' : 'Save notification settings'}
			</button>
		</div>
	</form>
{/if}
