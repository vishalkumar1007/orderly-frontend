<script lang="ts">
	import { onMount } from 'svelte';
	import { fetchUsers } from '$lib/admin/api';
	import { formatDate, formatRelative, initials } from '$lib/admin/format';
	import type { PlatformUser } from '$lib/admin/types';
	import DataTable from '$lib/components/admin/DataTable.svelte';
	import ErrorState from '$lib/components/admin/ErrorState.svelte';
	import FilterBar from '$lib/components/admin/FilterBar.svelte';
	import SearchInput from '$lib/components/admin/SearchInput.svelte';
	import Select from '$lib/components/admin/Select.svelte';
	import StatusBadge from '$lib/components/admin/StatusBadge.svelte';

	let users = $state<PlatformUser[]>([]);
	let loading = $state(true);
	let error = $state('');
	let search = $state('');
	let roleFilter = $state('');
	let tenantFilter = $state('');
	let statusFilter = $state('');

	async function load() {
		loading = true;
		error = '';
		try {
			users = await fetchUsers();
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load users';
		} finally {
			loading = false;
		}
	}

	onMount(load);

	const tenantOptions = $derived(
		[...new Set(users.map((u) => u.tenant_name).filter(Boolean) as string[])].map((t) => ({
			value: t,
			label: t
		}))
	);

	const filtered = $derived.by(() => {
		let list = [...users];
		const q = search.trim().toLowerCase();
		if (q) {
			list = list.filter(
				(u) =>
					u.name.toLowerCase().includes(q) ||
					u.email.toLowerCase().includes(q) ||
					(u.tenant_name || '').toLowerCase().includes(q)
			);
		}
		if (roleFilter) list = list.filter((u) => u.role === roleFilter);
		if (tenantFilter) list = list.filter((u) => u.tenant_name === tenantFilter);
		if (statusFilter) list = list.filter((u) => u.status === statusFilter);
		return list;
	});
</script>

{#if error}
	<div class="panel" style="margin-bottom:1rem;"><ErrorState message={error} onretry={load} /></div>
{/if}

<section class="panel panel-flush">
	<div style="padding:1rem 1.25rem;border-bottom:1px solid var(--border-subtle);">
		<FilterBar>
			<SearchInput bind:value={search} placeholder="Name, email, tenant…" label="" />
			<Select
				bind:value={roleFilter}
				label="Role"
				id="user-role"
				allLabel="Any role"
				options={[
					{ value: 'SUPER_ADMIN', label: 'Super Admin' },
					{ value: 'TENANT_ADMIN', label: 'Tenant Admin' },
					{ value: 'STAFF', label: 'Staff' }
				]}
			/>
			<Select bind:value={tenantFilter} label="Tenant" id="user-tenant" allLabel="All tenants" options={tenantOptions} />
			<Select
				bind:value={statusFilter}
				label="Status"
				id="user-status"
				allLabel="Any status"
				options={[
					{ value: 'ACTIVE', label: 'Active' },
					{ value: 'INVITED', label: 'Invited' },
					{ value: 'DISABLED', label: 'Disabled' }
				]}
			/>
		</FilterBar>
	</div>

	<DataTable
		{loading}
		empty={!loading && filtered.length === 0}
		emptyTitle="No users found"
		emptyDescription="Try a different search term or clear the filters."
	>
		{#snippet head()}
			<th>User</th>
			<th>Tenant</th>
			<th>Role</th>
			<th>Status</th>
			<th>Last activity</th>
			<th>Created</th>
		{/snippet}
		{#each filtered as u (u.id)}
			<tr>
				<td>
					<div class="cell-id">
						<span class="cell-avatar" style="width:1.9rem;height:1.9rem;font-size:0.72rem;">
							{initials(u.name || u.email)}
						</span>
						<span class="cell-id-txt">
							<strong>{u.name || '—'}</strong>
							<span style="font-family:var(--font);">{u.email}</span>
						</span>
					</div>
				</td>
				<td>
					{#if u.tenant_id}
						<a href={`/superadmin/tenants/${u.tenant_id}`}>{u.tenant_name}</a>
					{:else}
						<span class="muted">Platform</span>
					{/if}
				</td>
				<td style="color:var(--text-2);">{String(u.role).replaceAll('_', ' ')}</td>
				<td><StatusBadge status={String(u.status)} /></td>
				<td class="muted">{u.last_activity ? formatRelative(u.last_activity) : '—'}</td>
				<td class="num muted" style="white-space:nowrap;">{formatDate(u.created_at)}</td>
			</tr>
		{/each}
	</DataTable>
</section>
