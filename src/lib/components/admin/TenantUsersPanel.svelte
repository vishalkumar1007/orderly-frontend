<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import {
		createTenantUser,
		fetchTenantUsers,
		resetUserAccess,
		resendUserInvite,
		updateTenantUser
	} from '$lib/admin/api';
	import { formatRelative, initials } from '$lib/admin/format';
	import type { TenantAdmin, UserInviteResult } from '$lib/admin/types';
	import Copy from '@lucide/svelte/icons/copy';
	import KeyRound from '@lucide/svelte/icons/key-round';
	import Send from '@lucide/svelte/icons/send';
	import UserPlus from '@lucide/svelte/icons/user-plus';
	import ConfirmDialog from '$lib/components/admin/ConfirmDialog.svelte';
	import DataTable from '$lib/components/admin/DataTable.svelte';
	import FormField from '$lib/components/admin/FormField.svelte';
	import InviteLinkDialog from '$lib/components/admin/InviteLinkDialog.svelte';
	import Menu from '$lib/components/admin/Menu.svelte';
	import Modal from '$lib/components/admin/Modal.svelte';
	import SelectField from '$lib/components/admin/SelectField.svelte';
	import StatusBadge from '$lib/components/admin/StatusBadge.svelte';
	import TextInput from '$lib/components/admin/TextInput.svelte';
	import { toast } from '$lib/components/admin/toast';

	const ROLES = [
		{ value: 'TENANT_ADMIN', label: 'Tenant Admin' },
		{ value: 'STAFF', label: 'Staff' }
	];

	let users = $state<TenantAdmin[]>([]);
	let loading = $state(true);
	let saving = $state(false);

	let addOpen = $state(false);
	let addForm = $state({ name: '', email: '', phone: '', role: 'STAFF' });
	let addErrors = $state<Record<string, string>>({});

	let target = $state<TenantAdmin | null>(null);
	let confirmOpen = $state(false);
	let confirmKind = $state<'disable' | 'enable' | 'reset'>('disable');
	let confirmLoading = $state(false);

	let invite = $state<UserInviteResult | null>(null);
	let inviteOpen = $state(false);
	let inviteHeading = $state('Setup link ready');

	const tenantId = $derived($page.params.id ?? '');
	const admins = $derived(users.filter((u) => u.role === 'TENANT_ADMIN' && u.status === 'ACTIVE').length);

	async function load() {
		if (!tenantId) return;
		loading = true;
		try {
			users = await fetchTenantUsers(tenantId);
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Failed to load users');
		} finally {
			loading = false;
		}
	}

	onMount(load);

	function openAdd() {
		addForm = { name: '', email: '', phone: '', role: 'STAFF' };
		addErrors = {};
		addOpen = true;
	}

	async function submitAdd() {
		const errs: Record<string, string> = {};
		if (!addForm.name.trim()) errs.name = 'Name is required';
		if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addForm.email.trim())) errs.email = 'Enter a valid email';
		if (addForm.phone.trim() && !/^[+\d][\d\s()-]{5,19}$/.test(addForm.phone.trim()))
			errs.phone = 'Enter a valid phone';
		addErrors = errs;
		if (Object.keys(errs).length) return;

		saving = true;
		try {
			const res = await createTenantUser(tenantId, {
				name: addForm.name.trim(),
				email: addForm.email.trim(),
				phone: addForm.phone.trim(),
				role: addForm.role as 'TENANT_ADMIN' | 'STAFF'
			});
			addOpen = false;
			toast.success(`${res.user.name} invited`);
			showInvite(res, 'Setup link ready');
			await load();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Could not invite user');
		} finally {
			saving = false;
		}
	}

	function ask(user: TenantAdmin, kind: 'disable' | 'enable' | 'reset') {
		target = user;
		confirmKind = kind;
		confirmOpen = true;
	}

	async function runConfirm() {
		if (!target) return;
		confirmLoading = true;
		try {
			if (confirmKind === 'reset') {
				const res = await resetUserAccess(tenantId, target.id);
				confirmOpen = false;
				toast.success('Access reset — all sessions revoked');
				showInvite(res, 'Access reset');
			} else {
				const status = confirmKind === 'disable' ? 'DISABLED' : 'ACTIVE';
				const updated = await updateTenantUser(tenantId, target.id, { status });
				users = users.map((u) => (u.id === updated.id ? updated : u));
				confirmOpen = false;
				toast.success(confirmKind === 'disable' ? `${target.name} disabled` : `${target.name} enabled`);
			}
			await load();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Action failed');
		} finally {
			confirmLoading = false;
		}
	}

	async function resend(user: TenantAdmin) {
		try {
			const res = await resendUserInvite(tenantId, user.id);
			toast.success('Setup link regenerated');
			showInvite(res, 'Setup link regenerated');
			await load();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Could not regenerate link');
		}
	}

	function showInvite(res: UserInviteResult, heading: string) {
		invite = res;
		// Track the heading per-invitation — confirmKind persists between
		// actions, so deriving the copy from it would show the stale label.
		inviteHeading = heading;
		inviteOpen = true;
	}

	const confirmCopy = $derived(
		confirmKind === 'reset'
			? {
					title: 'Reset access?',
					message: target
						? `${target.name} will be signed out everywhere and must set a new password via a fresh setup link.`
						: '',
					label: 'Reset access'
				}
			: confirmKind === 'disable'
				? {
						title: 'Disable user?',
						message: target
							? `${target.name} will be signed out immediately and cannot sign back in until re-enabled.`
							: '',
						label: 'Disable'
					}
				: {
						title: 'Re-enable user?',
						message: target ? `${target.name} will be able to sign in again.` : '',
						label: 'Enable'
					}
	);
</script>

<section class="panel panel-flush">
	<div
		class="users-head"
	>
		<div>
			<h3 class="panel-h" style="margin:0;">Tenant users</h3>
			<p class="panel-note" style="margin:0.2rem 0 0;">
				{users.length} user{users.length === 1 ? '' : 's'} · {admins} active admin{admins === 1 ? '' : 's'}.
				Staff can take orders in the kitchen; admins also manage the shop.
			</p>
		</div>
		<button type="button" class="btn btn-primary btn-sm" onclick={openAdd}>
			<UserPlus size={14} strokeWidth={2.2} />
			Add user
		</button>
	</div>

	<DataTable
		{loading}
		empty={!loading && users.length === 0}
		emptyTitle="No users yet"
		emptyDescription="Add a tenant admin or staff member to give them access to this shop."
	>
		{#snippet head()}
			<th>User</th>
			<th>Role</th>
			<th>Status</th>
			<th>Last activity</th>
			<th style="width:1%;"><span class="sr-only">Actions</span></th>
		{/snippet}
		{#each users as u (u.id)}
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
				<td style="color:var(--text-2);">{u.role === 'STAFF' ? 'Staff' : 'Tenant Admin'}</td>
				<td>
					<span class="badge-cluster">
						<StatusBadge status={u.status} />
						{#if u.must_set_password}
							<StatusBadge status="NEEDS PASSWORD" kind="warn" dot={false} />
						{/if}
					</span>
				</td>
				<td class="muted">{u.last_activity ? formatRelative(u.last_activity) : 'Never'}</td>
				<td>
					<Menu
						label={`Actions for ${u.name}`}
						items={[
							{ label: 'Resend setup link', onclick: () => resend(u) },
							{ label: 'Reset access', onclick: () => ask(u, 'reset'), separatorBefore: true },
							u.status === 'ACTIVE'
								? { label: 'Disable user', danger: true, onclick: () => ask(u, 'disable') }
								: { label: 'Re-enable user', onclick: () => ask(u, 'enable') }
						]}
					/>
				</td>
			</tr>
		{/each}
	</DataTable>
</section>

<!-- Add user -->
<Modal bind:open={addOpen} title="Add tenant user">
	<div style="display:flex;flex-direction:column;gap:0.85rem;">
		<FormField label="Full name" htmlFor="nu-name" required error={addErrors.name}>
			<TextInput id="nu-name" bind:value={addForm.name} placeholder="Rahul Sharma" />
		</FormField>
		<FormField label="Email" htmlFor="nu-email" required error={addErrors.email}>
			<TextInput id="nu-email" type="email" bind:value={addForm.email} placeholder="rahul@example.com" />
		</FormField>
		<FormField label="Phone" htmlFor="nu-phone" error={addErrors.phone}>
			<TextInput id="nu-phone" type="tel" bind:value={addForm.phone} placeholder="9876543210" />
		</FormField>
		<FormField
			label="Role"
			htmlFor="nu-role"
			hint={addForm.role === 'TENANT_ADMIN'
				? 'Admins can manage the menu, staff, and shop settings.'
				: 'Staff can take and prepare orders only.'}
		>
			<SelectField id="nu-role" bind:value={addForm.role} options={ROLES} />
		</FormField>
		<p class="field-hint" style="margin:0;">
			They receive a one-time setup link to choose a password. No password is stored in plain text.
		</p>
	</div>
	{#snippet footer()}
		<button type="button" class="btn btn-ghost" onclick={() => (addOpen = false)}>Cancel</button>
		<button
			type="button"
			class="btn btn-primary"
			disabled={saving || !addForm.name.trim() || !addForm.email.trim()}
			onclick={submitAdd}
		>
			{saving ? 'Inviting…' : 'Send invite'}
		</button>
	{/snippet}
</Modal>

<ConfirmDialog
	bind:open={confirmOpen}
	title={confirmCopy.title}
	message={confirmCopy.message}
	confirmLabel={confirmCopy.label}
	danger={confirmKind !== 'enable'}
	loading={confirmLoading}
	onconfirm={runConfirm}
/>

<InviteLinkDialog
	bind:open={inviteOpen}
	setupUrl={invite?.setup_url ?? ''}
	email={invite?.user.email ?? ''}
	emailSent={invite?.email_sent ?? false}
	emailError={invite?.email_error ?? ''}
	heading={inviteHeading}
/>

<style>
	.users-head {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		padding: 1rem 1.25rem;
		border-bottom: 1px solid var(--border-subtle);
	}
</style>
