<script lang="ts">
	import { onMount } from 'svelte';
	import {
		fetchPlatformConfig,
		savePlatformConfig,
		setPlatformSharing,
		testPlatformConfig,
		testPlatformConfigAction
	} from '$lib/admin/configApi';
	import type { ConfigService, ConfigView } from '$lib/admin/configTypes';
	import { CONFIG_SERVICE_LABEL } from '$lib/admin/configTypes';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import Send from '@lucide/svelte/icons/send';
	import Upload from '@lucide/svelte/icons/upload';
	import ConfigForm from '$lib/components/admin/ConfigForm.svelte';
	import ConfigStatusBadge from '$lib/components/admin/ConfigStatusBadge.svelte';
	import ErrorState from '$lib/components/admin/ErrorState.svelte';
	import FormField from '$lib/components/admin/FormField.svelte';
	import SelectField from '$lib/components/admin/SelectField.svelte';
	import Skeleton from '$lib/components/admin/Skeleton.svelte';
	import StatusBadge from '$lib/components/admin/StatusBadge.svelte';
	import Switch from '$lib/components/admin/Switch.svelte';
	import TextInput from '$lib/components/admin/TextInput.svelte';
	import { toast } from '$lib/components/admin/toast';

	let { service = 'SMTP' }: { service?: ConfigService } = $props();

	let view = $state<ConfigView | null>(null);
	let loading = $state(true);
	let error = $state('');
	let saving = $state(false);
	let testing = $state(false);
	let testingAction = $state(false);
	let draft = $state<Record<string, unknown>>({});
	let provider = $state('');
	let enabled = $state(false);
	let allowTenants = $state(false);
	let testTo = $state('');
	let outcome = $state<{ ok: boolean; message: string; detail?: string } | null>(null);

	/**
	 * The old settings screen owned an smtp block. It is superseded by this
	 * page, so the legacy Mail tab is redirected here rather than left showing
	 * a field that no longer drives anything.
	 */
	onMount(async () => {
		try {
			view = await fetchPlatformConfig(service);
			applyView(view);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Could not load configuration';
		} finally {
			loading = false;
		}
	});

	function applyView(v: ConfigView) {
		provider = v.provider;
		enabled = v.enabled;
		allowTenants = v.allow_tenants;
		testTo = String(v.config?.from_email ?? '');
	}

	// The server is the source of truth for status; reflect it after a save.
	$effect(() => {
		if (view) applyView(view);
	});

	function payload(extra: Record<string, unknown> = {}) {
		return {
			provider,
			config: { ...draft, ...extra },
			enabled
		};
	}

	async function save() {
		saving = true;
		outcome = null;
		try {
			view = await savePlatformConfig(service, {
				...payload(),
				allow_tenants: allowTenants
			});
			toast.success(`${CONFIG_SERVICE_LABEL[service]} configuration saved`);
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Could not save');
		} finally {
			saving = false;
		}
	}

	async function toggleSharing(next: boolean) {
		allowTenants = next;
		try {
			view = await setPlatformSharing(service, next);
			toast.success(next ? 'Tenants may now use this' : 'Tenant access revoked');
		} catch (err) {
			allowTenants = !next;
			toast.error(err instanceof Error ? err.message : 'Could not change sharing');
		}
	}

	async function testConnection() {
		testing = true;
		outcome = null;
		try {
			outcome = await testPlatformConfig(service, payload());
			// The test writes a status the page should show immediately.
			view = await fetchPlatformConfig(service);
		} catch (err) {
			outcome = {
				ok: false,
				message: 'Could not run the test',
				detail: err instanceof Error ? err.message : undefined
			};
		} finally {
			testing = false;
		}
	}

	async function testAction(action: string, extra: Record<string, unknown> = {}) {
		testingAction = true;
		outcome = null;
		try {
			if (action === 'send_email' && !testTo.trim()) {
				toast.error('Enter a recipient address first');
				return;
			}
			outcome = await testPlatformConfigAction(service, action, {
				...payload().config,
				...extra,
				to: testTo.trim()
			});
			view = await fetchPlatformConfig(service);
		} catch (err) {
			outcome = {
				ok: false,
				message: 'The action could not run',
				detail: err instanceof Error ? err.message : undefined
			};
		} finally {
			testingAction = false;
		}
	}
</script>

<section class="page">
	<header class="head">
		<div>
			<h2 class="title">{CONFIG_SERVICE_LABEL[service]}</h2>
			<p class="sub">
				Managed by the platform. Tenants can use this configuration only when you allow it.
			</p>
		</div>
		{#if view}
			<ConfigStatusBadge status={view.status} enabled={view.enabled} />
		{/if}
	</header>

	{#if loading}
		<div class="stack">
			<Skeleton height="2.4rem" />
			<Skeleton height="9rem" />
			<Skeleton height="9rem" />
		</div>
	{:else if error}
		<ErrorState message={error} onretry={() => location.reload()} />
	{:else if view}
		<div class="panel">
			<div class="panel-head">
				<h3 class="panel-h">Provider</h3>
				<p class="panel-note">Switching provider keeps the fields you have filled in.</p>
			</div>
			<div class="panel-body">
				<FormField label="Provider" htmlFor={`cfg-${service}-provider`}>
					<SelectField
						id={`cfg-${service}-provider`}
						bind:value={provider}
						options={(view.providers ?? []).map((p) => ({ value: p.value, label: p.label }))}
					/>
				</FormField>
			</div>
		</div>

		<div class="panel">
			<div class="panel-head">
				<h3 class="panel-h">Settings</h3>
				<p class="panel-note">
					Secrets are encrypted before they are stored and are never sent back to the browser.
				</p>
			</div>
			<div class="panel-body">
				<ConfigForm {service} {view} onchange={(d) => (draft = d)} />
			</div>
		</div>

		<div class="panel">
			<div class="panel-body toggles">
				<Switch
					bind:checked={enabled}
					label="Enabled"
					hint="Turn this off to stop using the configuration without deleting it."
				/>
				<Switch
					checked={allowTenants}
					label="Allow tenants to use platform {CONFIG_SERVICE_LABEL[service].toLowerCase()}"
					hint="Tenants can then choose this instead of configuring their own. They never see the credentials."
					disabled={!enabled}
					onchange={(v: boolean) => toggleSharing(v)}
				/>
			</div>
		</div>

		<div class="panel">
			<div class="panel-head">
				<h3 class="panel-h">Verify</h3>
				<p class="panel-note">Tests run against the values above, saved or not.</p>
			</div>
			<div class="panel-body">
				{#if service === 'SMTP'}
					<div class="verify-row">
						<FormField label="Send a test email to" htmlFor="cfg-test-to">
							<TextInput id="cfg-test-to" type="email" bind:value={testTo} placeholder="you@example.com" />
						</FormField>
					</div>
				{/if}

				<div class="actions">
					<button
						type="button"
						class="btn btn-ghost"
						disabled={testing || testingAction}
						onclick={testConnection}
					>
						<CircleCheck size={14} strokeWidth={2} />
						{testing ? 'Testing…' : 'Test connection'}
					</button>
					{#if service === 'SMTP'}
						<button
							type="button"
							class="btn btn-ghost"
							disabled={testingAction}
							onclick={() => testAction('send_email')}
						>
							<Send size={14} strokeWidth={2} />
							{testingAction ? 'Sending…' : 'Send test email'}
						</button>
					{/if}
					{#if service === 'STORAGE'}
						<button
							type="button"
							class="btn btn-ghost"
							disabled={testingAction}
							onclick={() => testAction('upload')}
						>
							<Upload size={14} strokeWidth={2} />
							{testingAction ? 'Uploading…' : 'Test upload'}
						</button>
					{/if}
					{#if service === 'AI'}
						<button
							type="button"
							class="btn btn-ghost"
							disabled={testingAction}
							onclick={() => testAction('test_model')}
						>
							<CircleCheck size={14} strokeWidth={2} />
							{testingAction ? 'Testing…' : 'Test model'}
						</button>
					{/if}
					<button type="button" class="btn btn-primary" disabled={saving} onclick={save}>
						{saving ? 'Saving…' : 'Save configuration'}
					</button>
				</div>

				{#if outcome}
					<div class="outcome" class:bad={!outcome.ok} role="status">
						<strong>{outcome.ok ? 'Passed' : 'Failed'}</strong>
						<span>{outcome.message}</span>
						{#if outcome.detail}<span class="detail">{outcome.detail}</span>{/if}
					</div>
				{/if}

				{#if view.last_error}
					<div class="outcome bad" role="status">
						<strong>Last failure</strong>
						<span class="detail">{view.last_error}</span>
					</div>
				{/if}
			</div>
		</div>
	{/if}
</section>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.head {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.title {
		margin: 0;
		font-size: 1.1rem;
		font-weight: 650;
		color: var(--text-1);
	}

	.sub {
		margin: 0.2rem 0 0;
		font-size: 0.82rem;
		color: var(--text-3);
		max-width: 46rem;
	}

	.panel {
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface-1);
	}

	.panel-head {
		padding: 0.85rem 1.1rem 0;
	}

	.panel-h {
		margin: 0;
		font-size: 0.86rem;
		font-weight: 600;
		color: var(--text-1);
	}

	.panel-note {
		margin: 0.2rem 0 0;
		font-size: 0.76rem;
		color: var(--text-3);
	}

	.panel-body {
		padding: 0.9rem 1.1rem 1.1rem;
	}

	.toggles {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
	}

	.verify-row {
		margin-bottom: 0.85rem;
		max-width: 22rem;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.outcome {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		margin-top: 0.85rem;
		padding: 0.65rem 0.8rem;
		border: 1px solid color-mix(in srgb, var(--ok, #059669) 35%, transparent);
		border-radius: var(--radius-sm);
		background: color-mix(in srgb, var(--ok, #059669) 8%, transparent);
		font-size: 0.8rem;
		color: var(--text-2);
	}

	.outcome.bad {
		border-color: color-mix(in srgb, var(--danger, #dc2626) 35%, transparent);
		background: color-mix(in srgb, var(--danger, #dc2626) 8%, transparent);
	}

	.detail {
		font-family: var(--font-mono);
		font-size: 0.72rem;
		color: var(--text-3);
		word-break: break-word;
	}

	.stack {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
	}
</style>
