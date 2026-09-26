<script lang="ts">
	import { onMount } from 'svelte';
	import {
		fetchTenantTypes,
		fetchTenants,
		resendTenantInvite,
		setTenantStatus,
		tenantPublicUrl,
		updateTenantLocal
	} from '$lib/admin/api';
	import { businessTypeLabel, formatDate } from '$lib/admin/format';
	import type { Tenant, TenantType } from '$lib/admin/types';
	import Copy from '@lucide/svelte/icons/copy';
	import ConfirmDialog from '$lib/components/admin/ConfirmDialog.svelte';
	import DataTable from '$lib/components/admin/DataTable.svelte';
	import EmptyState from '$lib/components/admin/EmptyState.svelte';
	import ErrorState from '$lib/components/admin/ErrorState.svelte';
	import FilterBar from '$lib/components/admin/FilterBar.svelte';
	import FormField from '$lib/components/admin/FormField.svelte';
	import Menu from '$lib/components/admin/Menu.svelte';
	import Pagination from '$lib/components/admin/Pagination.svelte';
	import SearchInput from '$lib/components/admin/SearchInput.svelte';
	import Select from '$lib/components/admin/Select.svelte';
	import SelectField from '$lib/components/admin/SelectField.svelte';
	import SlideOver from '$lib/components/admin/SlideOver.svelte';
	import StatusBadge from '$lib/components/admin/StatusBadge.svelte';
	import TenantAvatar from '$lib/components/admin/TenantAvatar.svelte';
	import TextArea from '$lib/components/admin/TextArea.svelte';
	import TextInput from '$lib/components/admin/TextInput.svelte';
	import { toast } from '$lib/components/admin/toast';

	let tenants = $state<Tenant[]>([]);
	let loading = $state(true);
	let error = $state('');

	let search = $state('');
	let statusFilter = $state('');
	let typeFilter = $state('');
	let types = $state<TenantType[]>([]);
	let setupFilter = $state('');
	let sortKey = $state<'name' | 'created' | 'status'>('created');
	let pageIndex = $state(0);
	const pageSize = 10;

	let actionTenant = $state<Tenant | null>(null);
	let confirmOpen = $state(false);
	let confirmAction = $state<'suspend' | 'activate'>('suspend');
	let confirmLoading = $state(false);

	let editOpen = $state(false);
	let editForm = $state({
		name: '',
		owner_name: '',
		phone: '',
		email: '',
		address: '',
		business_type: 'MOMO'
	});
	let saving = $state(false);

	async function load() {
		loading = true;
		error = '';
		try {
			const [rows, loadedTypes] = await Promise.all([fetchTenants(), fetchTenantTypes()]);
			tenants = rows;
			types = loadedTypes;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load tenants';
		} finally {
			loading = false;
		}
	}

	onMount(load);

	const filtered = $derived.by(() => {
		let list = [...tenants];
		const q = search.trim().toLowerCase();
		if (q) {
			list = list.filter(
				(t) =>
					t.name.toLowerCase().includes(q) ||
					t.slug.toLowerCase().includes(q) ||
					(t.owner_name || '').toLowerCase().includes(q) ||
					(t.email || '').toLowerCase().includes(q)
			);
		}
		if (statusFilter) list = list.filter((t) => t.status === statusFilter);
		if (typeFilter) list = list.filter((t) => t.business_type === typeFilter);
		if (setupFilter) list = list.filter((t) => String(t.setup_status || '') === setupFilter);

		list.sort((a, b) => {
			if (sortKey === 'name') return a.name.localeCompare(b.name);
			if (sortKey === 'status') return String(a.status).localeCompare(String(b.status));
			return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
		});
		return list;
	});

	const pageRows = $derived(filtered.slice(pageIndex * pageSize, pageIndex * pageSize + pageSize));

	$effect(() => {
		search;
		statusFilter;
		typeFilter;
		setupFilter;
		sortKey;
		pageIndex = 0;
	});

	function askStatus(t: Tenant, action: 'suspend' | 'activate') {
		actionTenant = t;
		confirmAction = action;
		confirmOpen = true;
	}

	async function runConfirm() {
		if (!actionTenant) return;
		confirmLoading = true;
		try {
			const updated = await setTenantStatus(actionTenant.id, confirmAction);
			tenants = tenants.map((t) => (t.id === updated.id ? { ...t, ...updated } : t));
			toast.success(
				confirmAction === 'suspend'
					? `${actionTenant.name} suspended`
					: `${actionTenant.name} activated`
			);
			confirmOpen = false;
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Action failed');
		} finally {
			confirmLoading = false;
		}
	}

	function openEdit(t: Tenant) {
		actionTenant = t;
		editForm = {
			name: t.name,
			owner_name: t.owner_name || '',
			phone: t.phone || '',
			email: t.email || '',
			address: t.address || '',
			business_type: t.business_type || 'MOMO'
		};
		editOpen = true;
	}

	async function resend(t: Tenant) {
		try {
			const r = await resendTenantInvite(t.id);
			toast.success(r.email_sent ? `Setup email sent to ${r.admin_email}` : 'Setup link generated');
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Resend failed');
		}
	}

	async function saveEdit() {
		if (!actionTenant) return;
		saving = true;
		try {
			const updated = await updateTenantLocal(actionTenant.id, editForm);
			tenants = tenants.map((t) => (t.id === updated.id ? { ...t, ...updated } : t));
			toast.success('Tenant updated');
			editOpen = false;
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Update failed');
		} finally {
			saving = false;
		}
	}

	function openStore(t: Tenant) {
		window.open(tenantPublicUrl(t), '_blank', 'noopener');
	}

	async function copyUrl(t: Tenant) {
		try {
			await navigator.clipboard.writeText(tenantPublicUrl(t));
			toast.success('Storefront URL copied');
		} catch {
			toast.error('Copy failed');
		}
	}

	async function copySlug(slug: string) {
		try {
			await navigator.clipboard.writeText(slug);
			toast.success('Slug copied');
		} catch {
			toast.error('Copy failed');
		}
	}
</script>

{#if error}
	<div class="panel" style="margin-bottom:1rem;">
		<ErrorState message={error} onretry={load} />
	</div>
{/if}

<section class="panel panel-flush">
	<div style="padding:1rem 1.25rem;border-bottom:1px solid var(--border-subtle);">
		<FilterBar>
			<SearchInput bind:value={search} placeholder="Name, slug, owner…" label="" />
			<Select
				bind:value={statusFilter}
				label="Status"
				id="filter-status"
				options={[
					{ value: 'ACTIVE', label: 'Active' },
					{ value: 'SUSPENDED', label: 'Suspended' }
				]}
			/>
			<Select
				bind:value={typeFilter}
				label="Type"
				id="filter-type"
				options={types.map((t) => ({ value: t.code, label: t.label }))}
			/>
			<Select
				bind:value={setupFilter}
				label="Setup"
				id="filter-setup"
				allLabel="Any"
				options={[
					{ value: 'PENDING', label: 'Pending' },
					{ value: 'IN_PROGRESS', label: 'In progress' },
					{ value: 'COMPLETED', label: 'Completed' }
				]}
			/>
			<div class="field">
				<label class="field-label" for="sort">Sort</label>
				<select class="input" id="sort" bind:value={sortKey}>
					<option value="created">Newest first</option>
					<option value="name">Name</option>
					<option value="status">Status</option>
				</select>
			</div>
		</FilterBar>

		{#if !loading && filtered.length > 0}
			<p class="table-count">
				Showing <strong>{pageRows.length}</strong> of <strong>{filtered.length}</strong>
				{filtered.length === 1 ? 'business' : 'businesses'}
				{#if tenants.length !== filtered.length}
					<span class="muted">· {tenants.length} total</span>
				{/if}
			</p>
		{/if}
	</div>

	{#if !loading && filtered.length === 0 && tenants.length > 0}
		<EmptyState
			title="No tenants match"
			description="Try a different search term or clear the filters."
		>
			{#snippet action()}
				<button
					type="button"
					class="btn btn-ghost btn-sm"
					onclick={() => {
						search = '';
						statusFilter = '';
						typeFilter = '';
						setupFilter = '';
					}}
				>
					Clear filters
				</button>
			{/snippet}
		</EmptyState>
	{:else}
		<DataTable
			{loading}
			empty={!loading && pageRows.length === 0}
			emptyTitle="No tenants yet"
			emptyDescription="Onboard your first food business to get a storefront, QR code, and admin invite."
		>
			{#snippet head()}
				<th>Business</th>
				<th class="col-sm">Owner</th>
				<th class="col-md">Type</th>
				<th>Status</th>
				<th class="col-md">Created</th>
				<th style="width:1%;"><span class="sr-only">Actions</span></th>
			{/snippet}

			{#each pageRows as t (t.id)}
				<tr>
					<td>
						<div class="cell-id">
							<TenantAvatar name={t.name} size="sm" />
							<span class="cell-id-txt">
								<a href={`/superadmin/tenants/${t.id}`} style="font-weight:550;">
									{t.name}
								</a>
								<span style="display:flex;align-items:center;gap:0.3rem;">
									{t.slug}
									<button
										type="button"
										class="btn btn-quiet slug-copy"
										aria-label="Copy subdomain slug for {t.name}"
										title="Copy slug"
										onclick={() => copySlug(t.slug)}
									>
										<Copy size={11} strokeWidth={2} />
									</button>
								</span>
							</span>
						</div>
					</td>
					<td class="col-sm">
						{t.owner_name || '—'}
						{#if t.setup_status === 'PENDING'}
							<span class="muted" style="display:block;font-size:0.72rem;">awaiting setup</span>
						{/if}
					</td>
					<td class="col-md" style="color:var(--text-2);">{businessTypeLabel(t.business_type)}</td>
					<td>
						<span class="badge-cluster">
							<StatusBadge status={String(t.status)} />
							{#if t.is_published}
								<StatusBadge status="PUBLISHED" dot={false} />
							{/if}
						</span>
					</td>
					<td class="num muted col-md" style="white-space:nowrap;">{formatDate(t.created_at)}</td>
					<td>
						<Menu
							label={`Actions for ${t.name}`}
							items={[
								{ label: 'View details', href: `/superadmin/tenants/${t.id}` },
								{ label: 'Edit details', onclick: () => openEdit(t) },
								{ label: 'Open storefront', onclick: () => openStore(t) },
								{ label: 'Copy storefront URL', onclick: () => copyUrl(t) },
								{ label: 'Manage users', href: `/superadmin/tenants/${t.id}?tab=users` },
								{ label: 'View activity', href: `/superadmin/tenants/${t.id}?tab=activity` },
								{
									label: 'Resend setup invite',
									onclick: () => resend(t),
									separatorBefore: true
								},
								t.status === 'SUSPENDED'
									? { label: 'Activate', onclick: () => askStatus(t, 'activate') }
									: {
											label: 'Suspend',
											danger: true,
											onclick: () => askStatus(t, 'suspend')
										}
							]}
						/>
					</td>
				</tr>
			{/each}
		</DataTable>

		<Pagination bind:pageIndex total={filtered.length} {pageSize} noun="tenant" />
	{/if}
</section>

<ConfirmDialog
	bind:open={confirmOpen}
	title={confirmAction === 'suspend' ? 'Suspend tenant?' : 'Activate tenant?'}
	message={actionTenant
		? confirmAction === 'suspend'
			? `Suspend ${actionTenant.name}? Their storefront and shop will be unreachable until you reactivate.`
			: `Activate ${actionTenant.name} and restore platform access?`
		: ''}
	confirmLabel={confirmAction === 'suspend' ? 'Suspend' : 'Activate'}
	danger={confirmAction === 'suspend'}
	loading={confirmLoading}
	onconfirm={runConfirm}
/>

<SlideOver bind:open={editOpen} title="Edit tenant">
	{#if actionTenant}
		<div style="display:flex;flex-direction:column;gap:0.85rem;">
			<FormField label="Business name" htmlFor="edit-name" required>
				<TextInput id="edit-name" bind:value={editForm.name} />
			</FormField>
			<FormField label="Owner" htmlFor="edit-owner">
				<TextInput id="edit-owner" bind:value={editForm.owner_name} />
			</FormField>
			<FormField label="Business type" htmlFor="edit-type">
				<SelectField
					id="edit-type"
					bind:value={editForm.business_type}
					options={types
						.filter((t) => t.active || t.code === editForm.business_type)
						.map((t) => ({ value: t.code, label: t.label }))}
				/>
			</FormField>
			<FormField label="Phone" htmlFor="edit-phone">
				<TextInput id="edit-phone" bind:value={editForm.phone} />
			</FormField>
			<FormField label="Email" htmlFor="edit-email">
				<TextInput id="edit-email" type="email" bind:value={editForm.email} />
			</FormField>
			<FormField label="Address" htmlFor="edit-address">
				<TextArea id="edit-address" bind:value={editForm.address} rows={2} />
			</FormField>
		</div>
	{/if}
	{#snippet footer()}
		<button type="button" class="btn btn-ghost" onclick={() => (editOpen = false)}>Cancel</button>
		<button
			type="button"
			class="btn btn-primary"
			disabled={saving || !editForm.name.trim()}
			onclick={saveEdit}
		>
			{saving ? 'Saving…' : 'Save changes'}
		</button>
	{/snippet}
</SlideOver>
