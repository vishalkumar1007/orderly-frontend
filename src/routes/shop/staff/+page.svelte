<script lang="ts">
	import { onMount } from 'svelte';
	import UserPlus from '@lucide/svelte/icons/user-plus';
	import { formatRelative, initials } from '$lib/admin/format';
	import type { UserInviteResult } from '$lib/admin/types';
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
	import {
		createShopUser,
		listShopUsers,
		resendShopUserInvite,
		resetShopUserAccess,
		resetShopUserMFA,
		updateShopUser,
		type ShopUser
	} from '$lib/tenant/staffApi';

	// Mirrors the roles the API accepts. What each one can reach is shown on
	// the IAM screen; this list only decides who can be invited as what.
	const ROLES = [
		{ value: 'TENANT_ADMIN', label: 'Owner — full control of this business' },
		{ value: 'MANAGER', label: 'Manager — runs the shop, cannot reconfigure it' },
		{ value: 'STAFF', label: 'Staff — selling and kitchen only' }
	];

	let users = $state<ShopUser[]>([]);
	let loading = $state(true);
	let saving = $state(false);

	let addOpen = $state(false);
	let addForm = $state({ name: '', email: '', phone: '', role: 'STAFF' });
	let addErrors = $state<Record<string, string>>({});

	let target = $state<ShopUser | null>(null);
	let confirmOpen = $state(false);
	let confirmKind = $state<'disable' | 'enable' | 'reset'>('disable');
	let confirmLoading = $state(false);

	let invite = $state<UserInviteResult | null>(null);
	let inviteOpen = $state(false);
	let inviteHeading = $state('Setup link ready');

	const admins = $derived(
		users.filter((u) => u.role === 'TENANT_ADMIN' && u.status === 'ACTIVE').length
	);
	const staffCount = $derived(users.filter((u) => u.role === 'STAFF').length);
	const managerCount = $derived(users.filter((u) => u.role === 'MANAGER').length);

	/** Human label for a role, so the table never prints a raw enum. */
	function roleLabel(role: string): string {
		switch (role) {
			case 'TENANT_ADMIN':
				return 'Owner';
			case 'MANAGER':
				return 'Manager';
			case 'STAFF':
				return 'Staff';
			default:
				return role;
		}
	}

	async function load() {
		loading = true;
		try {
			users = await listShopUsers();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Failed to load staff');
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
			const res = await createShopUser({
				name: addForm.name.trim(),
				email: addForm.email.trim(),
				phone: addForm.phone.trim(),
				role: addForm.role as 'TENANT_ADMIN' | 'MANAGER' | 'STAFF'
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

	function ask(user: ShopUser, kind: 'disable' | 'enable' | 'reset') {
		target = user;
		confirmKind = kind;
		confirmOpen = true;
	}

	async function runConfirm() {
		if (!target) return;
		confirmLoading = true;
		try {
			if (confirmKind === 'reset') {
				const res = await resetShopUserAccess(target.id);
				confirmOpen = false;
				toast.success('Access reset — all sessions revoked');
				showInvite(res, 'Access reset');
			} else {
				const status = confirmKind === 'disable' ? 'DISABLED' : 'ACTIVE';
				await updateShopUser(target.id, { status });
				confirmOpen = false;
				toast.success(
					confirmKind === 'disable' ? `${target.name} disabled` : `${target.name} enabled`
				);
			}
			await load();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Action failed');
		} finally {
			confirmLoading = false;
		}
	}

	async function resend(user: ShopUser) {
		try {
			const res = await resendShopUserInvite(user.id);
			toast.success('Setup link regenerated');
			showInvite(res, 'Setup link regenerated');
			await load();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Could not regenerate link');
		}
	}

	async function resetMFA(user: ShopUser) {
		try {
			await resetShopUserMFA(user.id);
			toast.success(`Two-factor authentication turned off for ${user.name}`);
			await load();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Could not reset two-factor authentication');
		}
	}

	function showInvite(res: UserInviteResult, heading: string) {
		invite = res;
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

<div class="staff-page">
	<header class="staff-head">
		<div>
			<p class="muted staff-lead">
				Who works here. To see or change what each person can reach, open
				<a href="/shop/iam">access control</a>.
			</p>
			<div class="staff-stats">
				<span><strong>{users.length}</strong> people</span>
				<span><strong>{admins}</strong> owner{admins === 1 ? '' : 's'}</span>
				{#if managerCount > 0}
					<span><strong>{managerCount}</strong> manager{managerCount === 1 ? '' : 's'}</span>
				{/if}
				<span><strong>{staffCount}</strong> staff</span>
				<a class="staff-iam-link" href="/shop/iam">What each role can reach →</a>
			</div>
		</div>
		<button type="button" class="btn btn-primary" onclick={openAdd}>
			<UserPlus size={15} strokeWidth={2.2} />
			Invite teammate
		</button>
	</header>

	<section class="panel panel-flush">
		<DataTable
			{loading}
			empty={!loading && users.length === 0}
			emptyTitle="No team members yet"
			emptyDescription="Invite a staff member for the counter, or another admin to help manage the shop."
		>
			{#snippet head()}
				<th>Person</th>
				<th>Role</th>
				<th>Status</th>
				<th>Last activity</th>
				<th style="width:1%;"><span class="sr-only">Actions</span></th>
			{/snippet}
			{#each users as u (u.id)}
				<tr>
					<td>
						<div class="cell-id">
							<span class="cell-avatar" style="width:1.9rem;height:1.9rem;font-size:var(--fs-meta);">
								{initials(u.name || u.email)}
							</span>
							<span class="cell-id-txt">
								<strong>{u.name || '—'}</strong>
								<span style="font-family:var(--font);">{u.email}</span>
							</span>
						</div>
					</td>
					<td style="color:var(--text-2);">{roleLabel(String(u.role))}</td>
					<td>
						<span class="badge-cluster">
							<StatusBadge status={u.status} />
							{#if u.must_set_password}
								<StatusBadge status="NEEDS PASSWORD" kind="warn" dot={false} />
							{/if}
							{#if u.mfa_enabled}
								<StatusBadge status="2FA ON" kind="ok" dot={false} />
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
								...(u.mfa_enabled
									? [{ label: 'Reset two-factor authentication', onclick: () => resetMFA(u) }]
									: []),
								u.status === 'ACTIVE'
									? { label: 'Disable', danger: true, onclick: () => ask(u, 'disable') }
									: { label: 'Re-enable', onclick: () => ask(u, 'enable') }
							]}
						/>
					</td>
				</tr>
			{/each}
		</DataTable>
	</section>
</div>

<Modal bind:open={addOpen} title="Invite teammate">
	<div style="display:flex;flex-direction:column;gap:0.85rem;">
		<FormField label="Full name" htmlFor="su-name" required error={addErrors.name}>
			<TextInput id="su-name" bind:value={addForm.name} placeholder="Rahul Sharma" />
		</FormField>
		<FormField label="Email" htmlFor="su-email" required error={addErrors.email}>
			<TextInput id="su-email" type="email" bind:value={addForm.email} placeholder="rahul@example.com" />
		</FormField>
		<FormField label="Phone" htmlFor="su-phone" error={addErrors.phone}>
			<TextInput id="su-phone" type="tel" bind:value={addForm.phone} placeholder="9876543210" />
		</FormField>
		<FormField
			label="Role"
			htmlFor="su-role"
			hint={addForm.role === 'TENANT_ADMIN'
				? 'Owners can change anything here, including payments, the storefront and who has access.'
				: addForm.role === 'MANAGER'
					? 'Managers run orders, the kitchen, the menu, customers and staff — but cannot change how the business is configured.'
					: 'Staff can work Selling and Kitchen. They see no configuration at all.'}
		>
			<SelectField id="su-role" bind:value={addForm.role} options={ROLES} />
		</FormField>
		<p class="field-hint" style="margin:0;">
			They get a one-time setup link to choose a password. No password is stored in plain text.
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
	.staff-page {
		display: grid;
		gap: 1rem;
	}

	.staff-head {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
	}

	.staff-lead {
		margin: 0 0 0.45rem;
		font-size: var(--fs-body);
		line-height: 1.45;
	}

	.staff-stats {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		font-size: var(--fs-body);
		color: var(--text-2);
	}

	.staff-iam-link {
		color: var(--accent-dark);
		font-weight: 550;
		text-decoration: none;
	}

	.staff-iam-link:hover {
		text-decoration: underline;
	}

	.staff-lead a {
		color: var(--accent-dark);
	}

	.staff-stats strong {
		color: var(--text);
		font-weight: 750;
		margin-right: 0.15rem;
	}
</style>
