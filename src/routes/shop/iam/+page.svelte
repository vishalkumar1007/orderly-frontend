<script lang="ts">
	import { onMount } from 'svelte';
	import Check from '@lucide/svelte/icons/check';
	import Minus from '@lucide/svelte/icons/minus';
	import ShieldCheck from '@lucide/svelte/icons/shield-check';
	import UserPlus from '@lucide/svelte/icons/user-plus';
	import { errorMessage } from '$lib/admin/errors';
	import { formatDate, formatRelative, initials } from '$lib/admin/format';
	import { fetchIam, type IamOverview, type IamUser, type PermissionKey } from '$lib/tenant/iamApi';
	import {
		resendShopUserInvite,
		resetShopUserAccess,
		updateShopUser
	} from '$lib/tenant/staffApi';
	import type { UserInviteResult } from '$lib/admin/types';
	import ConfirmDialog from '$lib/components/admin/ConfirmDialog.svelte';
	import DataTable from '$lib/components/admin/DataTable.svelte';
	import ErrorState from '$lib/components/admin/ErrorState.svelte';
	import InviteLinkDialog from '$lib/components/admin/InviteLinkDialog.svelte';
	import Menu from '$lib/components/admin/Menu.svelte';
	import Skeleton from '$lib/components/admin/Skeleton.svelte';
	import StatusBadge from '$lib/components/admin/StatusBadge.svelte';
	import Tabs from '$lib/components/admin/Tabs.svelte';
	import { toast } from '$lib/components/admin/toast';

	/**
	 * IAM — what people can reach.
	 *
	 * Staff answers "who works here"; this answers "what are they allowed to
	 * do". They are deliberately separate screens over the same people: the
	 * first is a hiring record, the second is an access decision, and running
	 * them together is how someone gets handed the storefront by accident.
	 *
	 * The role catalogue and permission matrix come from the API, which is the
	 * same table the middleware enforces — the grid below is a description of
	 * reality, not a second copy of the rules.
	 */

	const tabs = [
		{ id: 'people', label: 'People' },
		{ id: 'roles', label: 'Roles & permissions' }
	];

	let tab = $state('people');
	let data = $state<IamOverview | null>(null);
	let loading = $state(true);
	let error = $state('');

	let target = $state<IamUser | null>(null);
	let confirmOpen = $state(false);
	let confirmKind = $state<'disable' | 'enable' | 'reset'>('disable');
	let confirmLoading = $state(false);

	let invite = $state<UserInviteResult | null>(null);
	let inviteOpen = $state(false);
	let inviteHeading = $state('Setup link ready');

	async function load() {
		loading = true;
		error = '';
		try {
			data = await fetchIam();
		} catch (err) {
			error = errorMessage(err, 'load access control');
			data = null;
		} finally {
			loading = false;
		}
	}

	onMount(load);

	const users = $derived(data?.users ?? []);
	const roles = $derived(data?.roles ?? []);
	const permissions = $derived(data?.permissions ?? []);

	/** Permission groups in catalogue order, for the matrix rows. */
	const permissionGroups = $derived.by(() => {
		const order: string[] = [];
		const byGroup = new Map<string, typeof permissions>();
		for (const permission of permissions) {
			if (!byGroup.has(permission.group)) {
				byGroup.set(permission.group, []);
				order.push(permission.group);
			}
			byGroup.get(permission.group)!.push(permission);
		}
		return order.map((label) => ({ label, rows: byGroup.get(label)! }));
	});

	function roleHas(roleKey: string, permission: PermissionKey): boolean {
		return roles.find((r) => r.key === roleKey)?.permissions.includes(permission) ?? false;
	}

	/** The short "what they can reach" line under a person's name. */
	function accessSummary(user: IamUser): string {
		const labels = user.permissions
			.map((key) => permissions.find((p) => p.key === key)?.label ?? key)
			.slice(0, 4);
		if (user.permissions.length > labels.length) {
			labels.push(`+${user.permissions.length - labels.length} more`);
		}
		return labels.join(' · ') || 'No access';
	}

	/* ---------- actions ---------- */

	async function changeRole(user: IamUser, role: string) {
		if (user.is_self) {
			toast.error('You cannot change your own access');
			return;
		}
		try {
			await updateShopUser(user.id, { role: role as 'TENANT_ADMIN' | 'MANAGER' | 'STAFF' });
			toast.success(`${user.name} is now ${role === 'TENANT_ADMIN' ? 'an owner' : role === 'MANAGER' ? 'a manager' : 'staff'}`);
			await load();
		} catch (err) {
			toast.error(errorMessage(err, 'change this role'));
		}
	}

	function ask(user: IamUser, kind: 'disable' | 'enable' | 'reset') {
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
				toast.success('Access reset — every session signed out');
				invite = res;
				inviteHeading = 'Access reset';
				inviteOpen = true;
			} else {
				await updateShopUser(target.id, {
					status: confirmKind === 'disable' ? 'DISABLED' : 'ACTIVE'
				});
				confirmOpen = false;
				toast.success(confirmKind === 'disable' ? `${target.name} disabled` : `${target.name} enabled`);
			}
			await load();
		} catch (err) {
			toast.error(errorMessage(err, confirmKind === 'reset' ? 'reset access' : 'update this person'));
		} finally {
			confirmLoading = false;
		}
	}

	async function resend(user: IamUser) {
		try {
			const res = await resendShopUserInvite(user.id);
			invite = res;
			inviteHeading = 'Setup link regenerated';
			inviteOpen = true;
			toast.success('Setup link regenerated');
			await load();
		} catch (err) {
			toast.error(errorMessage(err, 'regenerate the setup link'));
		}
	}

	type RowAction = { label: string; href?: string; onclick?: () => void; danger?: boolean; separatorBefore?: boolean; disabled?: boolean };

	function actionsFor(user: IamUser): RowAction[] {
		const items: RowAction[] = [];
		for (const role of roles) {
			if (!role.assignable || role.key === user.role) continue;
			items.push({
				label: `Make ${role.label.toLowerCase()}`,
				disabled: user.is_self,
				onclick: () => {
					void changeRole(user, role.key);
				}
			});
		}
		if (user.status === 'INVITED') {
			items.push({
				label: 'Resend setup link',
				separatorBefore: true,
				onclick: () => {
					void resend(user);
				}
			});
		}
		items.push({
			label: 'Reset access',
			separatorBefore: user.status !== 'INVITED',
			disabled: user.is_self,
			onclick: () => ask(user, 'reset')
		});
		items.push(
			user.status === 'DISABLED'
				? { label: 'Enable', onclick: () => ask(user, 'enable') }
				: { label: 'Disable', danger: true, disabled: user.is_self, onclick: () => ask(user, 'disable') }
		);
		return items;
	}

	const confirmCopy = $derived(
		confirmKind === 'reset'
			? {
					title: 'Reset access?',
					message: target
						? `${target.name} is signed out on every device and must set a new password through a fresh link. Their role does not change.`
						: '',
					label: 'Reset access'
				}
			: confirmKind === 'disable'
				? {
						title: 'Disable this person?',
						message: target
							? `${target.name} is signed out immediately and cannot sign back in until you enable them again.`
							: '',
						label: 'Disable'
					}
				: {
						title: 'Enable this person?',
						message: target ? `${target.name} will be able to sign in again.` : '',
						label: 'Enable'
					}
	);
</script>

{#if error}
	<div class="panel" style="margin-bottom:0.85rem;"><ErrorState message={error} onretry={load} /></div>
{/if}

<section class="panel intro">
	<span class="intro-icon"><ShieldCheck size={16} strokeWidth={1.9} /></span>
	<div>
		<strong>Staff is who works here. Access control is what they can reach.</strong>
		<p>
			Every person below signs in on this shop's own address and can never reach another
			business or the platform console. Changing a role takes effect on their next request —
			there is no waiting for them to sign out.
		</p>
	</div>
	<a class="btn btn-ghost btn-sm" href="/shop/staff">
		<UserPlus size={14} strokeWidth={2} />
		Manage staff
	</a>
</section>

<Tabs {tabs} bind:active={tab} />

{#if tab === 'people'}
	<section class="panel panel-flush">
		<div class="iam-head">
			<div>
				<h2>People and access</h2>
				<p>
					{#if data}
						{data.summary.total} with access · {data.summary.owners} owner{data.summary.owners === 1 ? '' : 's'} ·
						{data.summary.managers} manager{data.summary.managers === 1 ? '' : 's'} ·
						{data.summary.staff} staff
					{:else}
						Loading…
					{/if}
				</p>
			</div>
		</div>

		<DataTable
			{loading}
			empty={!loading && users.length === 0}
			emptyTitle="Nobody else has access yet"
			emptyDescription="Invite someone from the Staff screen and set what they can reach here."
		>
			{#snippet head()}
				<th>Person</th>
				<th class="col-md">Role</th>
				<th class="col-sm">Can reach</th>
				<th>Status</th>
				<th class="col-md">Sessions</th>
				<th class="col-md">Last seen</th>
				<th style="width:1%;"><span class="sr-only">Actions</span></th>
			{/snippet}

			{#each users as user (user.id)}
				<tr>
					<td>
						<div class="cell-id">
							<span class="cell-avatar" style="width:1.9rem;height:1.9rem;font-size:0.72rem;">
								{initials(user.name || user.email)}
							</span>
							<span class="cell-id-txt">
								<strong>
									{user.name || '—'}
									{#if user.is_self}<span class="you">you</span>{/if}
								</strong>
								<span style="font-family:var(--font);">{user.email}</span>
							</span>
						</div>
					</td>
					<td class="col-md">
						<span class="role-chip" data-role={user.role}>{user.role_label}</span>
					</td>
					<td class="col-sm muted" style="font-size:0.76rem;">{accessSummary(user)}</td>
					<td><StatusBadge status={String(user.status)} /></td>
					<td class="num col-md muted">
						{user.active_sessions}
						{#if user.active_sessions > 0}
							<span class="sr-only">active sessions</span>
						{/if}
					</td>
					<td class="muted col-md">
						{user.last_activity ? formatRelative(user.last_activity) : 'Never signed in'}
					</td>
					<td>
						<Menu label={`Access for ${user.name || user.email}`} items={actionsFor(user)} />
					</td>
				</tr>
			{/each}
		</DataTable>
	</section>
{:else}
	<section class="panel panel-flush">
		<div class="iam-head">
			<div>
				<h2>Roles &amp; permissions</h2>
				<p>
					What each role may reach. This is the same table the API enforces, so anything
					unticked here is refused by the server, not just hidden in the interface.
				</p>
			</div>
		</div>

		{#if loading}
			<div style="padding:0 1.25rem 1.25rem;"><Skeleton height="18rem" /></div>
		{:else}
			<div class="role-cards">
				{#each roles as role (role.key)}
					<div class="role-card">
						<strong>{role.label}</strong>
						<p>{role.description}</p>
						<span class="role-count">
							{role.permissions.length} of {permissions.length} areas
						</span>
					</div>
				{/each}
			</div>

			<div class="table-wrap">
				<table class="table matrix">
					<thead>
						<tr>
							<th>Area</th>
							{#each roles as role (role.key)}
								<th class="matrix-role">{role.label}</th>
							{/each}
						</tr>
					</thead>
					<tbody>
						{#each permissionGroups as group (group.label)}
							<tr class="matrix-group">
								<td colspan={roles.length + 1}>{group.label}</td>
							</tr>
							{#each group.rows as permission (permission.key)}
								<tr>
									<td>
										<strong style="font-weight:550;">{permission.label}</strong>
										<span class="muted" style="display:block;font-size:0.74rem;">
											{permission.description}
										</span>
									</td>
									{#each roles as role (role.key)}
										<td class="matrix-cell">
											{#if roleHas(role.key, permission.key)}
												<span class="yes" title={`${role.label} can ${permission.label.toLowerCase()}`}>
													<Check size={13} strokeWidth={2.6} />
													<span class="sr-only">Allowed</span>
												</span>
											{:else}
												<span class="no" title={`${role.label} cannot ${permission.label.toLowerCase()}`}>
													<Minus size={13} strokeWidth={2.6} />
													<span class="sr-only">Not allowed</span>
												</span>
											{/if}
										</td>
									{/each}
								</tr>
							{/each}
						{/each}
					</tbody>
				</table>
			</div>

			<p class="matrix-note">
				Custom roles are not available yet. If someone needs a mix these three do not cover,
				give them the closest role and keep the difference in your own notes rather than
				sharing a sign-in.
			</p>
		{/if}
	</section>
{/if}

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
	.intro {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
		margin-bottom: 0.85rem;
	}

	.intro-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2rem;
		height: 2rem;
		border-radius: 10px;
		background: var(--icon-bg);
		color: var(--icon-fg);
		flex-shrink: 0;
	}

	.intro strong {
		font-size: 0.86rem;
		font-weight: 600;
	}

	.intro p {
		margin: 0.2rem 0 0;
		font-size: 0.79rem;
		line-height: 1.55;
		color: var(--text-3);
		max-width: 52rem;
	}

	.intro a {
		flex-shrink: 0;
	}

	.iam-head {
		padding: 1.1rem 1.25rem 0.85rem;
	}

	.iam-head h2 {
		margin: 0;
		font-size: 0.95rem;
		font-weight: 600;
	}

	.iam-head p {
		margin: 0.25rem 0 0;
		font-size: 0.79rem;
		line-height: 1.5;
		color: var(--text-3);
		max-width: 50rem;
	}

	.you {
		margin-left: 0.35rem;
		padding: 0.05rem 0.3rem;
		border-radius: 999px;
		background: var(--surface-3);
		color: var(--text-3);
		font-size: 0.62rem;
		font-weight: 650;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.role-chip {
		display: inline-flex;
		align-items: center;
		padding: 0.15rem 0.5rem;
		border-radius: 999px;
		font-size: 0.74rem;
		font-weight: 600;
		background: var(--surface-3);
		color: var(--text-2);
	}

	.role-chip[data-role='TENANT_ADMIN'] {
		background: var(--icon-bg);
		color: var(--icon-fg);
	}

	.role-chip[data-role='MANAGER'] {
		background: var(--info-bg);
		color: var(--info);
	}

	.role-cards {
		display: grid;
		gap: 0.6rem;
		grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
		padding: 0 1.25rem 1rem;
	}

	.role-card {
		border: 1px solid var(--border);
		border-radius: var(--radius);
		padding: 0.8rem 0.9rem;
		background: var(--surface-2);
	}

	.role-card strong {
		font-size: 0.88rem;
		font-weight: 650;
	}

	.role-card p {
		margin: 0.25rem 0 0.5rem;
		font-size: 0.77rem;
		line-height: 1.5;
		color: var(--text-3);
	}

	.role-count {
		font-size: 0.7rem;
		font-weight: 600;
		color: var(--icon-fg);
	}

	.matrix-role {
		text-align: center;
		width: 7rem;
	}

	.matrix-group td {
		background: var(--surface-2);
		font-size: 0.7rem;
		font-weight: 650;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--text-3);
	}

	.matrix-cell {
		text-align: center;
	}

	.matrix .yes,
	.matrix .no {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.5rem;
		height: 1.5rem;
		border-radius: 999px;
	}

	.matrix .yes {
		background: var(--success-bg);
		color: var(--success);
	}

	.matrix .no {
		background: var(--surface-3);
		color: var(--text-3);
	}

	.matrix-note {
		margin: 0;
		padding: 0 1.25rem 1.25rem;
		font-size: 0.76rem;
		line-height: 1.5;
		color: var(--text-3);
		max-width: 52rem;
	}
</style>
