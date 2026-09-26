<script lang="ts">
	import { onMount } from 'svelte';
	import { fetchAllTenantConfigs } from '$lib/admin/configApi';
	import {
		CONFIG_SERVICE_LABEL,
		type ConfigService,
		type PostureResponse,
		type TenantConfigPosture
	} from '$lib/admin/configTypes';
	import Building2 from '@lucide/svelte/icons/building-2';
	import Globe from '@lucide/svelte/icons/globe';
	import DataTable from '$lib/components/admin/DataTable.svelte';
	import ErrorState from '$lib/components/admin/ErrorState.svelte';
	import SearchInput from '$lib/components/admin/SearchInput.svelte';
	import StatusBadge from '$lib/components/admin/StatusBadge.svelte';
	import { toast } from '$lib/components/admin/toast';

	let data = $state<PostureResponse | null>(null);
	let loading = $state(true);
	let error = $state('');
	let search = $state('');

	onMount(load);

	async function load() {
		loading = true;
		error = '';
		try {
			data = await fetchAllTenantConfigs();
		} catch (err) {
			error = err instanceof Error ? err.message : 'Could not load configuration status';
		} finally {
			loading = false;
		}
	}

	/**
	 * The effective source can differ from the stored preference: an organization
	 * that chose the platform but lost access falls back to its own
	 * configuration rather than being left with nothing. Showing the effective
	 * value is what makes that visible.
	 */
	function effectiveSource(row: TenantConfigPosture): 'PLATFORM' | 'ORGANIZATION' {
		if (row.source === 'PLATFORM' && row.platform_allow_tenants && row.allow_platform && row.platform_enabled) {
			return 'PLATFORM';
		}
		return 'ORGANIZATION';
	}

	const filtered = $derived.by(() => {
		const rows = data?.tenants ?? [];
		const q = search.trim().toLowerCase();
		if (!q) return rows;
		return rows.filter((r) => r.tenant_name.toLowerCase().includes(q));
	});

	async function togglePlatform(row: TenantConfigPosture) {
		try {
			const { setTenantServiceAccess } = await import('$lib/admin/configApi');
			await setTenantServiceAccess(row.tenant_id, row.service, !row.allow_platform);
			await load();
			toast.success(
				row.allow_platform ? 'Platform access revoked' : 'Platform access granted'
			);
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Could not change access');
		}
	}

	const tone = (status: string) =>
		status === 'ENABLED' ? 'ok' : status === 'CONNECTION_FAILED' ? 'danger' : 'neutral';
</script>

<section class="page">
	<header class="head">
		<div>
			<h2 class="title">Organization configuration</h2>
			<p class="sub">
				Which configuration each organization uses, and whether it may use the platform's. No
				credentials are shown here.
			</p>
		</div>
		<SearchInput bind:value={search} placeholder="Search organizations" />
	</header>

	{#if error}
		<ErrorState message={error} onretry={load} />
	{:else}
		<DataTable
			{loading}
			empty={!loading && filtered.length === 0}
			emptyTitle="No organizations"
			emptyDescription="Create a tenant to see its configuration status here."
		>
			{#snippet head()}
				<th>Organization</th>
				<th>Service</th>
				<th>Source</th>
				<th>Own status</th>
				<th>Platform</th>
				<th style="width:1%;"><span class="sr-only">Actions</span></th>
			{/snippet}
			{#each filtered as row (`${row.tenant_id}-${row.service}`)}
				<tr>
					<td class="org">{row.tenant_name}</td>
					<td>{CONFIG_SERVICE_LABEL[row.service as ConfigService]}</td>
					<td>
						<span class="src" class:platform={effectiveSource(row) === 'PLATFORM'}>
							{#if effectiveSource(row) === 'PLATFORM'}
								<Globe size={12} strokeWidth={2} /> Platform
							{:else}
								<Building2 size={12} strokeWidth={2} /> Organization
							{/if}
						</span>
					</td>
					<td>
						<StatusBadge status={row.own_status} kind={tone(row.own_status)} />
					</td>
					<td>
						<span class="plat">
							<StatusBadge status={row.platform_status} kind={tone(row.platform_status)} />
							{#if !row.platform_allow_tenants}
								<span class="muted-note">not shared</span>
							{/if}
						</span>
					</td>
					<td>
						<button
							type="button"
							class="btn btn-ghost btn-sm"
							onclick={() => togglePlatform(row)}
						>
							{row.allow_platform ? 'Revoke access' : 'Grant access'}
						</button>
					</td>
				</tr>
			{/each}
		</DataTable>
	{/if}
</section>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
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
		font-size: 1.05rem;
		font-weight: 650;
	}

	.sub {
		margin: 0.2rem 0 0;
		font-size: 0.8rem;
		color: var(--text-3);
		max-width: 48rem;
	}

	.org {
		font-weight: 550;
		color: var(--text-1);
	}

	.src {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		font-size: 0.78rem;
		color: var(--text-3);
	}

	.src.platform {
		color: var(--accent);
	}

	.plat {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
	}

	.muted-note {
		font-size: 0.72rem;
		color: var(--text-3);
	}
</style>
