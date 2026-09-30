<script lang="ts">
	import { onMount } from 'svelte';
	import {
		deleteTenantConfig,
		fetchEffectiveConfig,
		fetchTenantConfig,
		saveTenantConfig,
		setServiceSource,
		testTenantConfig,
		testTenantConfigAction
	} from '$lib/admin/configApi';
	import {
		CONFIG_SERVICE_LABEL,
		type ConfigService,
		type EffectiveConfig,
		type TenantServiceDetail
	} from '$lib/admin/configTypes';
	import {
		getTenantConfig,
		loadTenantConfig,
		setTenantConfig
	} from '$lib/admin/tenantConfigCache.svelte';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import CircleSlash from '@lucide/svelte/icons/circle-slash';
	import Info from '@lucide/svelte/icons/info';
	import Send from '@lucide/svelte/icons/send';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import Upload from '@lucide/svelte/icons/upload';
	import ConfigForm from '$lib/components/admin/ConfigForm.svelte';
	import ConfigSourcePicker from '$lib/components/admin/ConfigSourcePicker.svelte';
	import ConfigStatusBadge from '$lib/components/admin/ConfigStatusBadge.svelte';
	import ConfirmDialog from '$lib/components/admin/ConfirmDialog.svelte';
	import ErrorState from '$lib/components/admin/ErrorState.svelte';
	import FormField from '$lib/components/admin/FormField.svelte';
	import SelectField from '$lib/components/admin/SelectField.svelte';
	import Skeleton from '$lib/components/admin/Skeleton.svelte';
	import Switch from '$lib/components/admin/Switch.svelte';
	import TextInput from '$lib/components/admin/TextInput.svelte';
	import { toast } from '$lib/components/admin/toast';

	let { service = 'SMTP' }: { service?: ConfigService } = $props();

	let detail = $state<TenantServiceDetail | null>(null);
	let effective = $state<EffectiveConfig | null>(null);
	let loading = $state(true);
	let error = $state('');
	let saving = $state(false);
	let testing = $state(false);
	let busy = $state(false);
	let draft = $state<Record<string, unknown>>({});
	let provider = $state('');
	let enabled = $state(false);
	let testTo = $state('');
	let outcome = $state<{ ok: boolean; message: string; detail?: string } | null>(null);
	let deleteOpen = $state(false);

	onMount(() => {
		const cached = getTenantConfig(service);
		if (cached) {
			applyEntry(cached.detail, cached.effective);
			loading = false;
			return;
		}
		void loadFromCache();
	});

	function applyEntry(d: TenantServiceDetail, e: EffectiveConfig) {
		detail = d;
		effective = e;
		provider = d.own_config.provider ?? '';
		enabled = d.own_config.enabled ?? false;
		testTo = String(d.own_config.config?.from_email ?? '');
	}

	/** First load / cache miss — shares inflight with other panels. */
	async function loadFromCache() {
		loading = true;
		error = '';
		try {
			const entry = await loadTenantConfig(service);
			applyEntry(entry.detail, entry.effective);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Could not load configuration';
		} finally {
			loading = false;
		}
	}

	/** Force-refresh after save/test/delete mutations. */
	async function load() {
		loading = true;
		error = '';
		try {
			const [d, e] = await Promise.all([
				fetchTenantConfig(service),
				fetchEffectiveConfig(service)
			]);
			setTenantConfig(service, d, e);
			applyEntry(d, e);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Could not load configuration';
		} finally {
			loading = false;
		}
	}

	const options = $derived(detail?.options ?? null);
	const own = $derived(detail?.own_config ?? null);
	const usingPlatform = $derived(detail?.source === 'PLATFORM');

	async function chooseSource(source: 'PLATFORM' | 'ORGANIZATION') {
		busy = true;
		try {
			await setServiceSource(service, source);
			await load();
			toast.success(
				source === 'PLATFORM'
					? `Now using the platform ${CONFIG_SERVICE_LABEL[service].toLowerCase()} configuration`
					: `Now using your organization's ${CONFIG_SERVICE_LABEL[service].toLowerCase()} configuration`
			);
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Could not switch configuration');
		} finally {
			busy = false;
		}
	}

	async function save() {
		saving = true;
		outcome = null;
		try {
			await saveTenantConfig(service, { provider, config: draft, enabled });
			await load();
			if (detail && effective) setTenantConfig(service, detail, effective);
			toast.success('Saved');
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Could not save');
		} finally {
			saving = false;
		}
	}

	async function remove() {
		busy = true;
		try {
			await deleteTenantConfig(service);
			deleteOpen = false;
			await load();
			toast.success('Organization configuration removed');
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Could not remove');
		} finally {
			busy = false;
		}
	}

	async function testConnection() {
		testing = true;
		outcome = null;
		try {
			outcome = await testTenantConfig(service, { provider, config: draft, enabled });
			await load();
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

	async function testAction(action: string) {
		busy = true;
		outcome = null;
		try {
			if (action === 'send_email' && !testTo.trim()) {
				toast.error('Enter a recipient address first');
				return;
			}
			outcome = await testTenantConfigAction(service, action, { ...draft, to: testTo.trim() });
			await load();
		} catch (err) {
			outcome = {
				ok: false,
				message: 'The action could not run',
				detail: err instanceof Error ? err.message : undefined
			};
		} finally {
			busy = false;
		}
	}
</script>

<section class="page">
	<header class="head">
		<div>
			<h2 class="title">{CONFIG_SERVICE_LABEL[service]}</h2>
			<p class="sub">Choose whether to use your organization's settings or your platform's.</p>
		</div>
		{#if effective}
			<ConfigStatusBadge
				status={effective.available ? (own?.status ?? 'UNCONFIGURED') : 'CONNECTION_FAILED'}
				enabled={effective.available}
			/>
		{/if}
	</header>

	{#if loading}
		<div class="stack">
			<Skeleton height="6rem" />
			<Skeleton height="9rem" />
		</div>
	{:else if error}
		<ErrorState message={error} />
	{:else if options && own}
		<!-- Current configuration -->
		<div class="current" class:unavailable={effective && !effective.available}>
			<div class="current-top">
				<span class="current-label">Current configuration</span>
				<span class="current-source">
					{usingPlatform ? 'Platform configuration' : 'Organization configuration'}
				</span>
			</div>
			<p class="current-note">
				{#if usingPlatform}
					Managed by your platform administrator. Your organization cannot see these credentials.
				{:else}
					Configured by your organization.
				{/if}
			</p>

			{#if effective && !effective.available}
				<div class="alert alert-warn" role="status">
					<CircleSlash size={16} strokeWidth={1.9} />
					<div>
						<strong>Currently unavailable.</strong>
						{effective.reason}
						{#if effective.hint}<div class="alert-hint">{effective.hint}</div>{/if}
					</div>
				</div>
			{/if}
		</div>

		<ConfigSourcePicker {options} disabled={busy} onselect={chooseSource} />

		{#if !usingPlatform}
			<div class="panel">
				<div class="panel-head">
					<h3 class="panel-h">Organization settings</h3>
					<p class="panel-note">
						Stored encrypted. Passwords and keys are never shown again after saving.
					</p>
				</div>
				<div class="panel-body">
					<FormField label="Provider" htmlFor={`tcfg-${service}-provider`}>
						<SelectField
							id={`tcfg-${service}-provider`}
							bind:value={provider}
							options={(own.providers ?? []).map((p) => ({ value: p.value, label: p.label }))}
						/>
					</FormField>
				</div>
			</div>

			<div class="panel">
				<div class="panel-body">
					<ConfigForm {service} view={own} onchange={(d) => (draft = d)} />
				</div>
				<div class="panel-body">
					<Switch
						bind:checked={enabled}
						label="Enabled"
						hint="Turn off to keep these settings without using them."
					/>
				</div>
			</div>

			<div class="panel">
				<div class="panel-body">
					{#if service === 'SMTP'}
						<div class="verify-row">
							<FormField label="Send a test email to" htmlFor="tcfg-test-to">
								<TextInput id="tcfg-test-to" type="email" bind:value={testTo} placeholder="you@example.com" />
							</FormField>
						</div>
					{/if}

					<div class="actions">
						<button type="button" class="btn btn-ghost" disabled={testing || busy} onclick={testConnection}>
							<CircleCheck size={14} strokeWidth={2} />
							{testing ? 'Testing…' : 'Test connection'}
						</button>
						{#if service === 'SMTP'}
							<button type="button" class="btn btn-ghost" disabled={busy} onclick={() => testAction('send_email')}>
								<Send size={14} strokeWidth={2} /> Send test email
							</button>
						{/if}
						{#if service === 'STORAGE'}
							<button type="button" class="btn btn-ghost" disabled={busy} onclick={() => testAction('upload')}>
								<Upload size={14} strokeWidth={2} /> Test upload
							</button>
						{/if}
						{#if service === 'AI'}
							<button type="button" class="btn btn-ghost" disabled={busy} onclick={() => testAction('test_model')}>
								<CircleCheck size={14} strokeWidth={2} /> Test model
							</button>
						{/if}
						<button type="button" class="btn btn-primary" disabled={saving} onclick={save}>
							{saving ? 'Saving…' : 'Save'}
						</button>
						{#if options.organization_configured}
							<button type="button" class="btn btn-ghost btn-danger" disabled={busy} onclick={() => (deleteOpen = true)}>
								<Trash2 size={14} strokeWidth={2} /> Remove
							</button>
						{/if}
					</div>

					{#if outcome}
						<div class="outcome" class:bad={!outcome.ok} role="status">
							<strong>{outcome.ok ? 'Passed' : 'Failed'}</strong>
							<span>{outcome.message}</span>
							{#if outcome.detail}<span class="detail">{outcome.detail}</span>{/if}
						</div>
					{/if}

					{#if own.last_error}
						<div class="outcome bad" role="status">
							<strong>Last failure</strong>
							<span class="detail">{own.last_error}</span>
						</div>
					{/if}
				</div>
			</div>
		{:else}
			<div class="panel">
				<div class="panel-body read-only">
					<Info size={15} strokeWidth={2} />
					<span>
						Your organization is using the platform {CONFIG_SERVICE_LABEL[service].toLowerCase()}
						configuration. Switch to your organization configuration above to manage your own settings.
					</span>
				</div>
			</div>
		{/if}
	{/if}
</section>

<ConfirmDialog
	bind:open={deleteOpen}
	title="Remove organization configuration?"
	message="Your stored settings for this service will be deleted. If you were using the platform configuration, nothing changes."
	confirmLabel="Remove"
	danger={true}
	loading={busy}
	onconfirm={remove}
/>

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
		font-size: var(--fs-title);
		font-weight: 650;
		color: var(--text-1);
	}

	.sub {
		margin: 0.2rem 0 0;
		font-size: var(--fs-body);
		color: var(--text-3);
	}

	.current {
		padding: 0.85rem 1rem;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface-1);
	}

	.current.unavailable {
		border-color: color-mix(in srgb, var(--warn, #d97706) 45%, transparent);
	}

	.current-top {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.current-label {
		font-size: var(--fs-code);
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--text-3);
	}

	.current-source {
		font-size: var(--fs-title);
		font-weight: 600;
		color: var(--text-1);
	}

	.current-note {
		margin: 0.3rem 0 0;
		font-size: var(--fs-body);
		color: var(--text-3);
	}

	.alert-hint {
		margin-top: 0.2rem;
		font-size: var(--fs-tab);
		color: var(--text-3);
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
		font-size: var(--fs-body);
		font-weight: 600;
	}

	.panel-note {
		margin: 0.2rem 0 0;
		font-size: var(--fs-code);
		color: var(--text-3);
	}

	.panel-body {
		padding: 0.9rem 1.1rem;
	}

	.read-only {
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
		font-size: var(--fs-body);
		color: var(--text-2);
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
		font-size: var(--fs-body);
	}

	.outcome.bad {
		border-color: color-mix(in srgb, var(--danger, #dc2626) 35%, transparent);
		background: color-mix(in srgb, var(--danger, #dc2626) 8%, transparent);
	}

	.detail {
		font-family: var(--font-mono);
		font-size: var(--fs-meta);
		color: var(--text-3);
		word-break: break-word;
	}

	.stack {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
	}
</style>
