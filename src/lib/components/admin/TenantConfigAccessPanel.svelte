<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import {
		fetchTenantConfigOverview,
		setTenantServiceAccess
	} from '$lib/admin/configApi';
	import {
		CONFIG_SERVICE_LABEL,
		type AdminTenantConfigOverview,
		type AdminTenantService
	} from '$lib/admin/configTypes';
	import Building2 from '@lucide/svelte/icons/building-2';
	import Globe from '@lucide/svelte/icons/globe';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import Skeleton from '$lib/components/admin/Skeleton.svelte';
	import StatusBadge from '$lib/components/admin/StatusBadge.svelte';
	import Switch from '$lib/components/admin/Switch.svelte';
	import { toast } from '$lib/components/admin/toast';

	let {
		tenantName = ''
	}: {
		tenantName?: string;
	} = $props();

	let overview = $state<AdminTenantConfigOverview | null>(null);
	let loading = $state(true);
	let error = $state('');
	let busyService = $state('');

	const tenantId = $derived($page.params.id ?? '');

	onMount(load);

	async function load() {
		if (!tenantId) return;
		loading = true;
		error = '';
		try {
			overview = await fetchTenantConfigOverview(tenantId);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Could not load configuration access';
		} finally {
			loading = false;
		}
	}

	async function toggle(entry: AdminTenantService, allow: boolean) {
		busyService = entry.service;
		try {
			const next = await setTenantServiceAccess(tenantId, entry.service, allow);
			if (next.warning) toast.error(next.warning);
			else toast.success(allow ? 'Access granted' : 'Access revoked');
			await load();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Could not change access');
		} finally {
			busyService = '';
		}
	}

	const statusTone = (status: string) =>
		status === 'ENABLED' ? 'ok' : status === 'CONNECTION_FAILED' ? 'danger' : 'neutral';
</script>

<section class="panel">
	<div class="head">
		<div>
			<h3 class="panel-h">Configuration access</h3>
			<p class="panel-note">
				Control whether {tenantName || 'this organization'} may use each platform configuration.
				Secrets are never shown here.
			</p>
		</div>
	</div>

	{#if loading}
		<div class="body">
			<Skeleton height="3.2rem" />
			<Skeleton height="3.2rem" />
			<Skeleton height="3.2rem" />
		</div>
	{:else if error}
		<div class="body">
			<p class="err">{error}</p>
		</div>
	{:else if overview}
		{#if overview.warning}
			<div class="warn-strip">
				<TriangleAlert size={15} strokeWidth={1.9} />
				<span>{overview.warning}</span>
			</div>
		{/if}
		<ul class="rows">
			{#each overview.services as entry (entry.service)}
				<li class="row">
					<div class="row-main">
						<span class="svc">{CONFIG_SERVICE_LABEL[entry.service]}</span>
						<StatusBadge status={entry.organization_status} kind={statusTone(entry.organization_status)} />
						<span class="src" class:platform={entry.source === 'PLATFORM'}>
							{#if entry.source === 'PLATFORM'}
								<Globe size={12} strokeWidth={2} /> Platform
							{:else}
								<Building2 size={12} strokeWidth={2} /> Organization
							{/if}
						</span>
					</div>

					<div class="row-toggle">
						<Switch
							checked={entry.allow_platform}
							label="Allow platform {CONFIG_SERVICE_LABEL[entry.service].toLowerCase()}"
							hint={entry.allow_platform
								? entry.platform_available
									? 'Granted and available'
									: 'Granted, but the platform configuration is not enabled or shared'
								: 'Not granted'}
							disabled={busyService === entry.service}
							onchange={(v: boolean) => toggle(entry, v)}
						/>
					</div>
				</li>
			{/each}
		</ul>
	{/if}
</section>

<style>
	.panel {
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface-1);
		overflow: hidden;
	}

	.head {
		padding: 0.9rem 1.1rem;
		border-bottom: 1px solid var(--border-subtle);
	}

	.panel-h {
		margin: 0;
		font-size: 0.9rem;
		font-weight: 600;
	}

	.panel-note {
		margin: 0.2rem 0 0;
		font-size: 0.78rem;
		color: var(--text-3);
	}

	.body {
		padding: 1.1rem;
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}

	.err {
		margin: 0;
		font-size: 0.82rem;
		color: var(--danger, #dc2626);
	}

	.warn-strip {
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
		margin: 0.85rem 1.1rem 0;
		padding: 0.6rem 0.75rem;
		border: 1px solid color-mix(in srgb, var(--warn, #d97706) 40%, transparent);
		border-radius: var(--radius-sm);
		background: color-mix(in srgb, var(--warn, #d97706) 8%, transparent);
		font-size: 0.8rem;
		color: var(--text-2);
	}

	.rows {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.85rem;
		padding: 0.8rem 1.1rem;
		border-bottom: 1px solid var(--border-subtle);
	}

	.row:last-child {
		border-bottom: none;
	}

	.row-main {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		flex-wrap: wrap;
	}

	.svc {
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--text-1);
		min-width: 7rem;
	}

	.src {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		font-size: 0.75rem;
		color: var(--text-3);
	}

	.src.platform {
		color: var(--accent);
	}

	.row-toggle {
		min-width: 15rem;
	}
</style>
