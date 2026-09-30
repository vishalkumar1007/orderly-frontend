<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import IconCopy from '@tabler/icons-svelte/icons/copy';
	import IconExternalLink from '@tabler/icons-svelte/icons/external-link';
	import IconLayoutGrid from '@tabler/icons-svelte/icons/layout-grid';
	import IconLink from '@tabler/icons-svelte/icons/link';
	import IconList from '@tabler/icons-svelte/icons/list';
	import IconSearch from '@tabler/icons-svelte/icons/search';
	import IconX from '@tabler/icons-svelte/icons/x';
	import {
		changeTenantPlan,
		fetchPlanOptions,
		fetchTenantTypes,
		fetchTenants,
		resendTenantInvite,
		setTenantStatus,
		tenantPublicUrl,
		updateTenantLocal
	} from '$lib/admin/api';
	import { errorMessage } from '$lib/admin/errors';
	import { formatDate } from '$lib/admin/format';
	import { labelForType } from '$lib/admin/businessTypes';
	import type { PlanOption, Tenant, TenantType } from '$lib/admin/types';
	import ConfirmDialog from '$lib/components/admin/ConfirmDialog.svelte';
	import DataTable from '$lib/components/admin/DataTable.svelte';
	import EmptyState from '$lib/components/admin/EmptyState.svelte';
	import ErrorState from '$lib/components/admin/ErrorState.svelte';
	import FormField from '$lib/components/admin/FormField.svelte';
	import Menu from '$lib/components/admin/Menu.svelte';
	import Modal from '$lib/components/admin/Modal.svelte';
	import Pagination from '$lib/components/admin/Pagination.svelte';
	import PlanPicker from '$lib/components/admin/PlanPicker.svelte';
	import SelectField from '$lib/components/admin/SelectField.svelte';
	import Skeleton from '$lib/components/admin/Skeleton.svelte';
	import SlideOver from '$lib/components/admin/SlideOver.svelte';
	import StatusBadge from '$lib/components/admin/StatusBadge.svelte';
	import TenantAvatar from '$lib/components/admin/TenantAvatar.svelte';
	import TextArea from '$lib/components/admin/TextArea.svelte';
	import TextInput from '$lib/components/admin/TextInput.svelte';
	import { toast } from '$lib/components/admin/toast';

	/**
	 * Every business on the platform.
	 *
	 * List and card views share one filter set. Click opens the business; copy
	 * and overflow actions stay on the row/card. Filtering stays in the browser:
	 * one fetch, instant filter.
	 */

	const VIEW_KEY = 'orderly-sa-biz-view-v2';
	type ViewMode = 'cards' | 'list';

	let businesses = $state<Tenant[]>([]);
	let types = $state<TenantType[]>([]);
	let plans = $state<PlanOption[]>([]);
	let loading = $state(true);
	let error = $state('');

	let search = $state('');
	let statusFilter = $state('');
	let typeFilter = $state('');
	let planFilter = $state('');
	let setupFilter = $state('');
	let sortKey = $state('created');
	let view = $state<ViewMode>('list');
	let pageIndex = $state(0);
	const pageSize = 12;

	let target = $state<Tenant | null>(null);

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
		business_type: ''
	});
	let saving = $state(false);

	let planOpen = $state(false);
	let planChoice = $state('');
	let planSaving = $state(false);

	async function load() {
		loading = true;
		error = '';
		try {
			const [rows, loadedTypes, loadedPlans] = await Promise.all([
				fetchTenants(),
				fetchTenantTypes(),
				fetchPlanOptions()
			]);
			businesses = rows;
			types = loadedTypes;
			plans = loadedPlans;
		} catch (err) {
			error = errorMessage(err, 'load businesses');
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		const status = $page.url.searchParams.get('status');
		if (status) statusFilter = status.toUpperCase();
		const type = $page.url.searchParams.get('type');
		if (type) typeFilter = type.toUpperCase();
		try {
			const saved = localStorage.getItem(VIEW_KEY);
			if (saved === 'list' || saved === 'cards') view = saved;
		} catch {
			/* private mode — keep default */
		}
		void load();
	});

	function setView(next: ViewMode) {
		view = next;
		try {
			localStorage.setItem(VIEW_KEY, next);
		} catch {
			/* ignore */
		}
	}

	const planOptions = $derived.by(() => {
		const codes = new Set<string>();
		for (const b of businesses) if (b.plan) codes.add(String(b.plan).toUpperCase());
		return [...codes].sort().map((code) => ({ value: code, label: titleCase(code) }));
	});

	const typeOptions = $derived(
		types
			.slice()
			.sort((a, b) => a.sort_order - b.sort_order)
			.map((t) => ({ value: t.code, label: t.label }))
	);

	const filtered = $derived.by(() => {
		let list = [...businesses];
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
		if (planFilter) list = list.filter((t) => String(t.plan ?? '').toUpperCase() === planFilter);
		if (setupFilter) list = list.filter((t) => String(t.setup_status || '') === setupFilter);

		list.sort((a, b) => {
			if (sortKey === 'name') return a.name.localeCompare(b.name);
			if (sortKey === 'status') return String(a.status).localeCompare(String(b.status));
			if (sortKey === 'plan') return String(a.plan ?? '').localeCompare(String(b.plan ?? ''));
			return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
		});
		return list;
	});

	const pageRows = $derived(filtered.slice(pageIndex * pageSize, pageIndex * pageSize + pageSize));
	const filtersActive = $derived(
		Boolean(search.trim() || statusFilter || typeFilter || planFilter || setupFilter)
	);

	/** Reset to page 1 only when the filter key actually changes — not on every tick. */
	let filterKey = $derived(
		`${search}\0${statusFilter}\0${typeFilter}\0${planFilter}\0${setupFilter}\0${sortKey}`
	);
	let lastFilterKey = '';
	$effect(() => {
		const key = filterKey;
		if (key === lastFilterKey) return;
		lastFilterKey = key;
		pageIndex = 0;
	});

	function clearFilters() {
		search = '';
		statusFilter = '';
		typeFilter = '';
		planFilter = '';
		setupFilter = '';
	}

	function askStatus(t: Tenant, action: 'suspend' | 'activate') {
		target = t;
		confirmAction = action;
		confirmOpen = true;
	}

	async function runConfirm() {
		if (!target) return;
		confirmLoading = true;
		try {
			const updated = await setTenantStatus(target.id, confirmAction);
			businesses = businesses.map((t) => (t.id === updated.id ? { ...t, ...updated } : t));
			toast.success(
				confirmAction === 'suspend' ? `${target.name} suspended` : `${target.name} activated`
			);
			confirmOpen = false;
		} catch (err) {
			toast.error(errorMessage(err, `${confirmAction} this business`));
		} finally {
			confirmLoading = false;
		}
	}

	function openEdit(t: Tenant) {
		target = t;
		editForm = {
			name: t.name,
			owner_name: t.owner_name || '',
			phone: t.phone || '',
			email: t.email || '',
			address: t.address || '',
			business_type: t.business_type || ''
		};
		editOpen = true;
	}

	async function saveEdit() {
		if (!target) return;
		saving = true;
		try {
			const updated = await updateTenantLocal(target.id, editForm);
			businesses = businesses.map((t) => (t.id === updated.id ? { ...t, ...updated } : t));
			toast.success('Business updated');
			editOpen = false;
		} catch (err) {
			toast.error(errorMessage(err, 'update this business'));
		} finally {
			saving = false;
		}
	}

	function openPlan(t: Tenant) {
		target = t;
		planChoice = String(t.plan ?? '').toUpperCase();
		planOpen = true;
	}

	async function savePlan() {
		if (!target || !planChoice) return;
		planSaving = true;
		try {
			const updated = await changeTenantPlan(target.id, planChoice);
			businesses = businesses.map((t) => (t.id === updated.id ? { ...t, ...updated } : t));
			toast.success(`${target.name} moved to ${titleCase(planChoice)}`);
			planOpen = false;
		} catch (err) {
			toast.error(errorMessage(err, 'change the plan'));
		} finally {
			planSaving = false;
		}
	}

	async function resend(t: Tenant) {
		try {
			const r = await resendTenantInvite(t.id);
			toast.success(
				r.email_sent ? `Setup email sent to ${r.admin_email}` : 'Setup link generated'
			);
		} catch (err) {
			toast.error(errorMessage(err, 'send the setup link'));
		}
	}

	function openStore(t: Tenant) {
		window.open(tenantPublicUrl(t), '_blank', 'noopener');
	}

	async function copyText(text: string, what: string) {
		try {
			await navigator.clipboard.writeText(text);
			toast.success(`${what} copied`);
		} catch {
			toast.error(`Could not copy the ${what.toLowerCase()}`);
		}
	}

	function titleCase(v: string): string {
		return v.charAt(0) + v.slice(1).toLowerCase();
	}

	function menuItems(t: Tenant) {
		return [
			{ label: 'Open storefront', onclick: () => openStore(t) },
			{
				label: 'Copy storefront URL',
				onclick: () => copyText(tenantPublicUrl(t), 'Storefront URL')
			},
			{ label: 'Edit details', onclick: () => openEdit(t), separatorBefore: true },
			{ label: 'Change plan', onclick: () => openPlan(t) },
			{ label: 'Resend setup invite', onclick: () => resend(t) },
			t.status === 'SUSPENDED'
				? { label: 'Activate', onclick: () => askStatus(t, 'activate'), separatorBefore: true }
				: {
						label: 'Suspend',
						danger: true,
						separatorBefore: true,
						onclick: () => askStatus(t, 'suspend')
					}
		];
	}
</script>

{#if error}
	<div class="panel biz-error-panel">
		<ErrorState message={error} onretry={load} />
	</div>
{/if}

<section class="biz-page">
	<div class="biz-toolbar panel">
		<div class="biz-search">
			<span class="biz-search-icon" aria-hidden="true">
				<IconSearch size={15} stroke={1.7} />
			</span>
			<input
				class="input biz-search-input"
				id="biz-search"
				type="search"
				placeholder="Search name, subdomain, owner, email…"
				bind:value={search}
				autocomplete="off"
			/>
			{#if search.trim()}
				<button
					type="button"
					class="biz-search-clear"
					aria-label="Clear search"
					onclick={() => (search = '')}
				>
					<IconX size={14} stroke={1.9} />
				</button>
			{/if}
		</div>

		<div class="biz-filter-row">
			<label class="biz-filter">
				<span>Status</span>
				<select class="input" bind:value={statusFilter}>
					<option value="">Any</option>
					<option value="ACTIVE">Active</option>
					<option value="SUSPENDED">Suspended</option>
				</select>
			</label>
			<label class="biz-filter">
				<span>Type</span>
				<select class="input" bind:value={typeFilter}>
					<option value="">Any</option>
					{#each typeOptions as opt (opt.value)}
						<option value={opt.value}>{opt.label}</option>
					{/each}
				</select>
			</label>
			<label class="biz-filter">
				<span>Plan</span>
				<select class="input" bind:value={planFilter}>
					<option value="">Any</option>
					{#each planOptions as opt (opt.value)}
						<option value={opt.value}>{opt.label}</option>
					{/each}
				</select>
			</label>
			<label class="biz-filter">
				<span>Setup</span>
				<select class="input" bind:value={setupFilter}>
					<option value="">Any</option>
					<option value="PENDING">Pending</option>
					<option value="IN_PROGRESS">In progress</option>
					<option value="COMPLETED">Completed</option>
				</select>
			</label>
			<label class="biz-filter">
				<span>Sort</span>
				<select class="input" bind:value={sortKey}>
					<option value="created">Newest</option>
					<option value="name">Name</option>
					<option value="status">Status</option>
					<option value="plan">Plan</option>
				</select>
			</label>
		</div>

		<div class="biz-toolbar-foot">
			<div class="biz-toolbar-left">
				{#if !loading && filtered.length > 0}
					<p class="table-count table-count-flush">
						<strong>{pageRows.length}</strong> of <strong>{filtered.length}</strong>
						{filtered.length === 1 ? 'business' : 'businesses'}
						{#if businesses.length !== filtered.length}
							<span class="muted">· {businesses.length} total</span>
						{/if}
					</p>
				{:else if !loading}
					<p class="table-count table-count-flush">
						{businesses.length === 0 ? 'No businesses yet' : 'No matches'}
					</p>
				{/if}
				{#if filtersActive}
					<button type="button" class="btn btn-quiet btn-sm" onclick={clearFilters}>
						Clear filters
					</button>
				{/if}
			</div>

			<div class="biz-view-toggle" role="group" aria-label="View mode">
				<button
					type="button"
					class={['biz-view-btn', view === 'list' ? 'active' : ''].join(' ')}
					aria-pressed={view === 'list'}
					title="List view"
					onclick={() => setView('list')}
				>
					<IconList size={15} stroke={1.7} />
					<span>List</span>
				</button>
				<button
					type="button"
					class={['biz-view-btn', view === 'cards' ? 'active' : ''].join(' ')}
					aria-pressed={view === 'cards'}
					title="Card view"
					onclick={() => setView('cards')}
				>
					<IconLayoutGrid size={15} stroke={1.7} />
					<span>Cards</span>
				</button>
			</div>
		</div>
	</div>

	{#if loading}
		{#if view === 'cards'}
			<div class="biz-grid" aria-busy="true">
				{#each [1, 2, 3, 4, 5, 6] as _, i (i)}
					<div class="biz-card biz-card-skel">
						<Skeleton height="5.5rem" />
					</div>
				{/each}
			</div>
		{:else}
			<div class="panel biz-skel-rows" aria-busy="true">
				{#each [1, 2, 3, 4, 5] as _, i (i)}
					<Skeleton height="2.1rem" />
				{/each}
			</div>
		{/if}
	{:else if filtered.length === 0 && businesses.length > 0}
		<div class="panel">
			<EmptyState
				title="No businesses match these filters"
				description="Try a different search term, or clear the filters to see the whole estate."
			>
				{#snippet action()}
					<button type="button" class="btn btn-ghost btn-sm" onclick={clearFilters}>
						Clear filters
					</button>
				{/snippet}
			</EmptyState>
		</div>
	{:else if businesses.length === 0}
		<div class="panel">
			<EmptyState
				title="No businesses yet"
				description="Onboard the first business to give it a storefront, a configured menu and an administrator."
			>
				{#snippet action()}
					<a class="btn btn-primary btn-sm" href="/superadmin/businesses/new">Onboard business</a>
				{/snippet}
			</EmptyState>
		</div>
	{:else if view === 'cards'}
		<div class="biz-grid">
			{#each pageRows as t (t.id)}
				<a class="biz-card" href={`/superadmin/businesses/${t.id}`}>
					<div class="biz-card-top">
						<TenantAvatar name={t.name} size="md" />
						<div class="biz-card-id">
							<strong class="biz-card-name">{t.name}</strong>
							<span class="biz-card-slug">
								<span class="mono">{t.slug}</span>
								<button
									type="button"
									class="biz-icon-btn"
									aria-label="Copy storefront URL for {t.name}"
									title="Copy storefront URL"
									onclick={(e) => {
										e.preventDefault();
										e.stopPropagation();
										void copyText(tenantPublicUrl(t), 'Storefront URL');
									}}
								>
									<IconCopy size={12} stroke={1.9} />
								</button>
							</span>
						</div>
						<div
							class="biz-card-menu"
							role="presentation"
							onclick={(e) => {
								e.preventDefault();
								e.stopPropagation();
							}}
						>
							<Menu label={`Actions for ${t.name}`} items={menuItems(t)} />
						</div>
					</div>

					<div class="biz-card-meta">
						<span class="biz-meta-item">{labelForType(t.business_type, types)}</span>
						{#if t.plan}
							<StatusBadge status={String(t.plan)} kind="accent" dot={false} />
						{/if}
						<StatusBadge status={String(t.status)} />
						{#if t.is_published}
							<StatusBadge status="PUBLISHED" dot={false} />
						{/if}
						{#if t.setup_status === 'PENDING'}
							<span class="biz-meta-muted">Awaiting setup</span>
						{/if}
					</div>

					<div class="biz-card-foot">
						<span class="biz-meta-muted">
							{t.owner_name || 'No owner'} · {formatDate(t.created_at)}
						</span>
						<div class="biz-card-quick">
							<button
								type="button"
								class="biz-icon-btn"
								aria-label="Copy console route for {t.name}"
								title="Copy admin route"
								onclick={(e) => {
									e.preventDefault();
									e.stopPropagation();
									void copyText(
										`${window.location.origin}/superadmin/businesses/${t.id}`,
										'Admin route'
									);
								}}
							>
								<IconLink size={13} stroke={1.7} />
							</button>
							<button
								type="button"
								class="biz-icon-btn"
								aria-label="Open storefront for {t.name}"
								title="Open storefront"
								onclick={(e) => {
									e.preventDefault();
									e.stopPropagation();
									openStore(t);
								}}
							>
								<IconExternalLink size={13} stroke={1.7} />
							</button>
						</div>
					</div>
				</a>
			{/each}
		</div>

		<Pagination bind:pageIndex total={filtered.length} {pageSize} noun="business" />
	{:else}
		<section class="panel panel-flush">
			<DataTable
				loading={false}
				empty={pageRows.length === 0}
				emptyTitle="No businesses"
				emptyDescription="Nothing on this page."
			>
				{#snippet head()}
					<th>Business</th>
					<th class="col-md">Type</th>
					<th class="col-sm">Owner</th>
					<th class="col-md">Plan</th>
					<th>Status</th>
					<th class="col-md">Created</th>
					<th class="col-actions"><span class="sr-only">Actions</span></th>
				{/snippet}

				{#snippet children()}
					{#each pageRows as t (t.id)}
						<tr>
							<td>
								<div class="cell-id">
									<TenantAvatar name={t.name} size="sm" />
									<span class="cell-id-txt">
										<a class="biz-name-link" href={`/superadmin/businesses/${t.id}`}>{t.name}</a>
										<span class="biz-list-slug">
											<span class="mono">{t.slug}</span>
											<button
												type="button"
												class="biz-icon-btn"
												aria-label="Copy storefront URL for {t.name}"
												title="Copy storefront URL"
												onclick={() => copyText(tenantPublicUrl(t), 'Storefront URL')}
											>
												<IconCopy size={11} stroke={1.9} />
											</button>
										</span>
									</span>
								</div>
							</td>
							<td class="col-md muted">
								{labelForType(t.business_type, types)}
							</td>
							<td class="col-sm">
								{t.owner_name || '—'}
								{#if t.setup_status === 'PENDING'}
									<span class="muted biz-sub-line">awaiting setup</span>
								{/if}
							</td>
							<td class="col-md">
								{#if t.plan}
									<StatusBadge status={String(t.plan)} kind="accent" dot={false} />
								{:else}
									<span class="muted">—</span>
								{/if}
							</td>
							<td>
								<span class="badge-cluster">
									<StatusBadge status={String(t.status)} />
									{#if t.is_published}
										<StatusBadge status="PUBLISHED" dot={false} />
									{/if}
								</span>
							</td>
							<td class="num muted col-md biz-nowrap">{formatDate(t.created_at)}</td>
							<td>
								<div class="biz-list-actions">
									<button
										type="button"
										class="biz-icon-btn"
										aria-label="Copy admin route for {t.name}"
										title="Copy admin route"
										onclick={() =>
											copyText(
												`${window.location.origin}/superadmin/businesses/${t.id}`,
												'Admin route'
											)}
									>
										<IconLink size={13} stroke={1.7} />
									</button>
									<button
										type="button"
										class="biz-icon-btn"
										aria-label="Open storefront for {t.name}"
										title="Open storefront"
										onclick={() => openStore(t)}
									>
										<IconExternalLink size={13} stroke={1.7} />
									</button>
									<Menu label={`Actions for ${t.name}`} items={menuItems(t)} />
								</div>
							</td>
						</tr>
					{/each}
				{/snippet}
			</DataTable>

			<Pagination bind:pageIndex total={filtered.length} {pageSize} noun="business" />
		</section>
	{/if}
</section>

<ConfirmDialog
	bind:open={confirmOpen}
	title={confirmAction === 'suspend' ? 'Suspend this business?' : 'Activate this business?'}
	message={target
		? confirmAction === 'suspend'
			? `Suspend ${target.name}? Its storefront stops serving customers and its staff cannot sign in until you reactivate it. Nothing is deleted.`
			: `Activate ${target.name}? Its storefront and console become reachable again immediately.`
		: ''}
	confirmLabel={confirmAction === 'suspend' ? 'Suspend business' : 'Activate business'}
	danger={confirmAction === 'suspend'}
	loading={confirmLoading}
	onconfirm={runConfirm}
/>

<Modal bind:open={planOpen} title={target ? `Change plan — ${target.name}` : 'Change plan'}>
	<p class="muted biz-lede">
		The business moves to the new plan immediately and its subscription follows. Nothing is
		charged — this records which plan it is provisioned on.
	</p>
	<PlanPicker {plans} bind:value={planChoice} />
	{#snippet footer()}
		<button type="button" class="btn btn-ghost" onclick={() => (planOpen = false)}>Cancel</button>
		<button
			type="button"
			class="btn btn-primary"
			disabled={planSaving || !planChoice || planChoice === String(target?.plan ?? '').toUpperCase()}
			onclick={savePlan}
		>
			{planSaving ? 'Moving…' : 'Change plan'}
		</button>
	{/snippet}
</Modal>

<SlideOver bind:open={editOpen} title="Edit business">
	{#if target}
		<div class="biz-field-stack">
			<FormField label="Business name" htmlFor="edit-name" required>
				<TextInput id="edit-name" bind:value={editForm.name} />
			</FormField>
			<FormField label="Owner" htmlFor="edit-owner">
				<TextInput id="edit-owner" bind:value={editForm.owner_name} />
			</FormField>
			<FormField
				label="Business type"
				htmlFor="edit-type"
				hint="Changing the type does not rewrite a storefront the owner has already configured."
			>
				<SelectField
					id="edit-type"
					bind:value={editForm.business_type}
					options={types
						.filter((t) => t.active || t.code === editForm.business_type)
						.map((t) => ({ value: t.code, label: t.label }))}
				/>
			</FormField>
			<FormField label="Phone" htmlFor="edit-phone">
				<TextInput id="edit-phone" type="tel" bind:value={editForm.phone} />
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

<style>
	/*
	 * Everything below used to be an inline `style` attribute on the element it
	 * applied to. That put layout decisions — a 1%-wide column, a 550 weight, a
	 * `white-space` — in the markup where they could not be reused, could not be
	 * found by searching the stylesheet, and could not carry a comment explaining
	 * why the value was what it was.
	 *
	 * The values are unchanged; only their location is not.
	 */
	.biz-page {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	/* The error banner above the page, separated from the toolbar below it. */
	.biz-error-panel {
		margin-bottom: 1rem;
	}

	/* The count line already carries a margin from the shared primitive. */
	.table-count-flush {
		margin: 0;
	}

	/* List-view skeleton: a panel holding a stack of bars. */
	.biz-skel-rows {
		padding: 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	/*
	 * `width: 1%` on a table header is the standard way to make a column shrink
	 * to its content while the other columns share the remaining width — the
	 * actions column should be as narrow as the buttons in it, not a share of the
	 * table. On its own, not scoped to `.table`, because this table is not always
	 * inside one.
	 */
	.col-actions {
		width: 1%;
	}

	/* The business name is the row's primary identifier, so it carries weight
	   the rest of the row does not. */
	.biz-name-link {
		font-weight: 550;
	}

	/* Secondary line under a value in the same cell. */
	.biz-sub-line {
		display: block;
		font-size: var(--fs-meta);
	}

	/* A formatted date should never wrap mid-timestamp. */
	.biz-nowrap {
		white-space: nowrap;
	}

	/* Intro line under a card grid or a table, before the result. */
	.biz-lede {
		margin: 0 0 0.9rem;
		font-size: var(--fs-body);
		line-height: 1.5;
	}

	/* The form inside the edit slide-over. */
	.biz-field-stack {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
	}

	.biz-toolbar {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
		padding: 1rem 1.15rem;
	}

	.biz-search {
		position: relative;
		display: flex;
		align-items: center;
	}

	.biz-search-icon {
		position: absolute;
		left: 0.75rem;
		display: inline-flex;
		color: var(--text-3);
		pointer-events: none;
	}

	.biz-search-input {
		padding-left: 2.25rem;
		padding-right: 2.25rem;
		height: 2.45rem;
		font-size: var(--fs-body);
	}

	.biz-search-clear {
		position: absolute;
		right: 0.45rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.6rem;
		height: 1.6rem;
		padding: 0;
		border: 0;
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--text-3);
		cursor: pointer;
	}

	.biz-search-clear:hover {
		background: var(--surface-3);
		color: var(--text);
	}

	.biz-filter-row {
		display: grid;
		gap: 0.55rem;
		grid-template-columns: repeat(5, minmax(0, 1fr));
	}

	@media (max-width: 1100px) {
		.biz-filter-row {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
	}

	@media (max-width: 640px) {
		.biz-filter-row {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}

	.biz-filter {
		display: flex;
		flex-direction: column;
		gap: 0.28rem;
		min-width: 0;
	}

	.biz-filter span {
		font-size: var(--fs-micro);
		font-weight: 550;
		letter-spacing: 0.01em;
		color: var(--text-3);
	}

	.biz-filter .input {
		padding: 0.35rem 0.55rem;
		font-size: var(--fs-body);
	}

	.biz-toolbar-foot {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		flex-wrap: wrap;
		padding-top: 0.15rem;
		border-top: 1px solid var(--border-subtle);
		padding-top: 0.75rem;
	}

	.biz-toolbar-left {
		display: flex;
		align-items: center;
		gap: 0.65rem;
		flex-wrap: wrap;
		min-width: 0;
	}

	.biz-view-toggle {
		display: inline-flex;
		padding: 2px;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--surface-2);
		gap: 2px;
	}

	.biz-view-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.3rem 0.55rem;
		border: 0;
		border-radius: calc(var(--radius-sm) - 1px);
		background: transparent;
		color: var(--text-3);
		font-family: inherit;
		font-size: var(--fs-code);
		font-weight: 550;
		cursor: pointer;
		transition:
			background var(--tr),
			color var(--tr);
	}

	.biz-view-btn:hover {
		color: var(--text);
	}

	.biz-view-btn.active {
		background: var(--surface);
		color: var(--text);
		box-shadow: var(--shadow-sm);
	}

	@media (max-width: 520px) {
		.biz-view-btn span {
			display: none;
		}
	}

	.biz-grid {
		display: grid;
		gap: 0.85rem;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 18.5rem), 1fr));
	}

	.biz-card {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
		padding: 1rem 1.05rem;
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		background: var(--surface);
		box-shadow: var(--shadow-sm);
		cursor: pointer;
		min-width: 0;
		text-decoration: none;
		color: inherit;
		transition:
			border-color var(--tr),
			box-shadow var(--tr),
			background var(--tr);
	}

	.biz-card:hover,
	.biz-card:focus-visible {
		border-color: color-mix(in srgb, var(--accent) 40%, var(--border));
		box-shadow: var(--shadow);
		outline: none;
	}

	.biz-card-skel {
		cursor: default;
		pointer-events: none;
	}

	.biz-card-top {
		display: flex;
		align-items: flex-start;
		gap: 0.7rem;
		min-width: 0;
	}

	.biz-card-id {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		min-width: 0;
		flex: 1;
	}

	.biz-card-name {
		font-size: var(--fs-title);
		font-weight: 600;
		letter-spacing: -0.01em;
		color: var(--text);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.biz-card-slug,
	.biz-list-slug {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		font-size: var(--fs-meta);
		color: var(--text-3);
		min-width: 0;
	}

	.biz-card-slug .mono,
	.biz-list-slug .mono {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.biz-card-menu {
		flex-shrink: 0;
		margin: -0.25rem -0.35rem 0 0;
	}

	.biz-card-meta {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.35rem;
	}

	.biz-meta-item {
		font-size: var(--fs-code);
		font-weight: 550;
		color: var(--text-2);
		padding: 0.12rem 0.4rem;
		border-radius: var(--radius-sm);
		background: var(--surface-3);
	}

	.biz-meta-muted {
		font-size: var(--fs-meta);
		color: var(--text-3);
	}

	.biz-card-foot {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		padding-top: 0.65rem;
		border-top: 1px solid var(--border-subtle);
	}

	.biz-card-quick,
	.biz-list-actions {
		display: inline-flex;
		align-items: center;
		gap: 0.15rem;
	}

	.biz-icon-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.7rem;
		height: 1.7rem;
		padding: 0;
		border: 0;
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--text-3);
		cursor: pointer;
		transition:
			background var(--tr),
			color var(--tr);
	}

	.biz-icon-btn:hover {
		background: var(--surface-3);
		color: var(--text);
	}
</style>
