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
	import CircleCheck from '@tabler/icons-svelte/icons/circle-check';
	import CircleSlash from '@tabler/icons-svelte/icons/ban';
	import Send from '@tabler/icons-svelte/icons/send';
	import Trash2 from '@tabler/icons-svelte/icons/trash';
	import Upload from '@tabler/icons-svelte/icons/upload';
	import ConfigForm from '$lib/components/admin/ConfigForm.svelte';
	import StatusBadge from '$lib/components/admin/StatusBadge.svelte';
	import ConfigCard from '$lib/components/config/ConfigCard.svelte';
	import ConfigRow from '$lib/components/config/ConfigRow.svelte';
	import Segmented from '$lib/components/config/Segmented.svelte';
	import ConfirmDialog from '$lib/components/admin/ConfirmDialog.svelte';
	import ErrorState from '$lib/components/admin/ErrorState.svelte';
	import FormField from '$lib/components/admin/FormField.svelte';
	import SelectField from '$lib/components/admin/SelectField.svelte';
	import Skeleton from '$lib/components/admin/Skeleton.svelte';
	import Switch from '$lib/components/admin/Switch.svelte';
	import TextInput from '$lib/components/admin/TextInput.svelte';
	import { toast } from '$lib/components/admin/toast';

	let {
		service = 'SMTP',
		title = ''
	}: {
		service?: ConfigService;
		/** Heading for the connection card; defaults to "<Service> connection". */
		title?: string;
	} = $props();

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
		// Nothing saved yet: default the first save to switched on.
		enabled = d.own_config.status === 'UNCONFIGURED' ? true : (d.own_config.enabled ?? false);
		testTo = String(d.own_config.config?.from_email ?? '');
	}

	/** First load / cache miss: shares inflight with other panels. */
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

{#snippet outcomeBox()}
	{#if outcome}
		<div class="sc-outcome" class:bad={!outcome.ok} role="status">
			{#if outcome.ok}<CircleCheck size={15} stroke={1.8} />{:else}<CircleSlash size={15} stroke={1.8} />{/if}
			<div>
				<strong>{outcome.ok ? 'It works' : 'It did not work'}</strong>
				<span>{outcome.message}</span>
				{#if outcome.detail}<span class="sc-detail">{outcome.detail}</span>{/if}
			</div>
		</div>
	{/if}
{/snippet}

{#if loading}
	<div class="sc">
		<Skeleton height="10rem" />
		<Skeleton height="12rem" />
	</div>
{:else if error}
	<ErrorState message={error} />
{:else if options && own}
	{@const label = CONFIG_SERVICE_LABEL[service]}
	<div class="sc">
		<ConfigCard
			id={`sc-${service}`}
			title={title || `${label} connection`}
			description="Use the platform's service, or connect an account of your own."
			flush
		>
			{#snippet aside()}
				{#if effective}
					<StatusBadge
						status={effective.available ? (usingPlatform ? 'Connected via platform' : 'Connected') : 'Not connected'}
						kind={effective.available ? 'ok' : 'warn'}
					/>
				{/if}
			{/snippet}

			{#if effective && !effective.available}
				<div class="sc-alert sc-alert-inset" role="status">
					<CircleSlash size={15} stroke={1.6} />
					<div>
						<strong>Not available right now.</strong>
						{effective.reason}
						{#if effective.hint}<span class="sc-detail">{effective.hint}</span>{/if}
					</div>
				</div>
			{/if}

			<ConfigRow
				label="Source"
				description={usingPlatform
					? 'Managed for you by the platform. No keys or passwords needed.'
					: options.platform_available
						? 'Your own provider account, with its keys.'
						: `Your own provider account. The platform option is unavailable: ${options.platform_reason ?? 'not offered for your business'}.`}
			>
				<Segmented
					label="Where this service comes from"
					value={options.source}
					disabled={busy}
					options={[
						{ value: 'PLATFORM', label: 'Platform', disabled: !options.platform_available },
						{ value: 'ORGANIZATION', label: 'Your account' }
					]}
					onchange={(v) => chooseSource(v)}
				/>
			</ConfigRow>
		</ConfigCard>

		{#if !usingPlatform}
			<ConfigCard
				id={`sc-${service}-account`}
				title="Account details"
				description="Stored encrypted. Passwords and keys are never shown again after saving."
			>
				<div class="sc-form">
					<FormField label="Provider" htmlFor={`tcfg-${service}-provider`}>
						<SelectField
							id={`tcfg-${service}-provider`}
							bind:value={provider}
							options={(own.providers ?? []).map((p) => ({ value: p.value, label: p.label }))}
						/>
					</FormField>
					<ConfigForm {service} view={own} onchange={(d) => (draft = d)} />
					<Switch bind:checked={enabled} label="Use this account" hint="Turn off to keep these details without using them." />
				</div>
				{@render outcomeBox()}
				{#if own.last_error && !outcome}
					<div class="sc-outcome bad" role="status">
						<CircleSlash size={15} stroke={1.8} />
						<div><strong>Last attempt failed</strong><span class="sc-detail">{own.last_error}</span></div>
					</div>
				{/if}

				{#snippet footer()}
					{#if options.organization_configured}
						<button type="button" class="btn btn-quiet btn-sm sc-remove" disabled={busy} onclick={() => (deleteOpen = true)}>
							<Trash2 size={14} stroke={1.6} /> Remove
						</button>
					{/if}
					<button type="button" class="btn btn-ghost btn-sm" disabled={testing || busy} onclick={testConnection}>
						<CircleCheck size={14} stroke={1.6} />
						{testing ? 'Testing...' : 'Test connection'}
					</button>
					<button type="button" class="btn btn-primary btn-sm" disabled={saving} onclick={save}>
						{saving ? 'Saving...' : 'Save'}
					</button>
				{/snippet}
			</ConfigCard>

			{#if service === 'SMTP' || service === 'STORAGE' || service === 'AI'}
				<ConfigCard
					id={`sc-${service}-check`}
					title="Check it works"
					description={service === 'SMTP'
						? 'Send a real email through this account.'
						: service === 'STORAGE'
							? 'Upload and remove a small test file.'
							: 'Ask the model for a short reply.'}
				>
					<div class="sc-check">
						{#if service === 'SMTP'}
							<TextInput id="tcfg-test-to" type="email" bind:value={testTo} placeholder="you@example.com" />
							<button type="button" class="btn btn-ghost btn-sm" disabled={busy} onclick={() => testAction('send_email')}>
								<Send size={14} stroke={1.6} /> Send test email
							</button>
						{:else if service === 'STORAGE'}
							<button type="button" class="btn btn-ghost btn-sm" disabled={busy} onclick={() => testAction('upload')}>
								<Upload size={14} stroke={1.6} /> Test upload
							</button>
						{:else}
							<button type="button" class="btn btn-ghost btn-sm" disabled={busy} onclick={() => testAction('test_model')}>
								<CircleCheck size={14} stroke={1.6} /> Test the model
							</button>
						{/if}
					</div>
				</ConfigCard>
			{/if}
		{/if}
	</div>
{/if}

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
	.sc {
		display: flex;
		flex-direction: column;
		gap: var(--sp-9);
	}

	.sc-alert,
	.sc-outcome {
		display: flex;
		align-items: flex-start;
		gap: var(--sp-5);
		margin-bottom: var(--sp-8);
		padding: var(--sp-6) var(--sp-7);
		border-radius: var(--radius-md, 8px);
		background: var(--warn-bg);
		color: var(--warn);
		font-size: var(--fs-tab);
		line-height: 1.5;
	}

	.sc-alert-inset {
		margin: 0 var(--sp-10) var(--sp-4);
	}

	.sc-outcome {
		margin: var(--sp-8) 0 0;
		background: var(--success-bg, var(--ok-soft));
		color: var(--success, var(--ok));
	}

	.sc-outcome.bad {
		background: var(--danger-bg, rgba(220, 38, 38, 0.1));
		color: var(--danger);
	}

	.sc-alert div,
	.sc-outcome div {
		display: flex;
		flex-direction: column;
		gap: var(--sp-1);
	}

	.sc-detail {
		display: block;
		opacity: 0.85;
		word-break: break-word;
	}












	.sc-form {
		display: flex;
		flex-direction: column;
		gap: var(--sp-8);
		max-width: 34rem;
	}

	.sc-remove {
		margin-right: auto;
		color: var(--danger);
	}

	.sc-check {
		display: flex;
		align-items: center;
		gap: var(--sp-5);
		flex-wrap: wrap;
		max-width: 34rem;
	}

	.sc-check :global(input) {
		flex: 1;
		min-width: 12rem;
	}

</style>
