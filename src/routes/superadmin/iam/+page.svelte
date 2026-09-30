<script lang="ts">
	import { onMount } from 'svelte';
	import Building2 from '@lucide/svelte/icons/building-2';
	import Check from '@lucide/svelte/icons/check';
	import Minus from '@lucide/svelte/icons/minus';
	import ShieldCheck from '@lucide/svelte/icons/shield-check';
	import UserPlus from '@lucide/svelte/icons/user-plus';
	import {
		fetchConsoleAccess,
		inviteConsoleUser,
		resendConsoleInvite,
		updateConsoleUser,
		type ConsoleAccess,
		type ConsoleInviteResult,
		type ConsolePermission,
		type ConsoleUser
	} from '$lib/admin/api';
	import { errorMessage } from '$lib/admin/errors';
	import { formatDate, formatRelative, initials } from '$lib/admin/format';
	import ConfirmDialog from '$lib/components/admin/ConfirmDialog.svelte';
	import DataTable from '$lib/components/admin/DataTable.svelte';
	import ErrorState from '$lib/components/admin/ErrorState.svelte';
	import FormField from '$lib/components/admin/FormField.svelte';
	import InviteLinkDialog from '$lib/components/admin/InviteLinkDialog.svelte';
	import Menu from '$lib/components/admin/Menu.svelte';
	import Modal from '$lib/components/admin/Modal.svelte';
	import SelectField from '$lib/components/admin/SelectField.svelte';
	import Skeleton from '$lib/components/admin/Skeleton.svelte';
	import StatusBadge from '$lib/components/admin/StatusBadge.svelte';
	import Tabs from '$lib/components/admin/Tabs.svelte';
	import TextInput from '$lib/components/admin/TextInput.svelte';
	import { toast } from '$lib/components/admin/toast';

	/**
	 * Console access.
	 *
	 * Who can reach *this* console — nothing else. A business's own staff are
	 * invited and managed inside that business by someone who works there, and
	 * no screen here can create or change one. That boundary is the product's,
	 * not this page's: the API has no route for it either.
	 *
	 * Access is granted by invitation, never by handing over a password.
	 */

	const tabs = [
		{ id: 'people', label: 'People' },
		{ id: 'roles', label: 'Roles & permissions' }
	];

	let tab = $state('people');
	let data = $state<ConsoleAccess | null>(null);
	let loading = $state(true);
	let error = $state('');

	let inviteOpen = $state(false);
	let inviteForm = $state({ name: '', email: '', phone: '', role: 'SUPPORT' });
	let inviteErrors = $state<Record<string, string>>({});
	let inviting = $state(false);

	let target = $state<ConsoleUser | null>(null);
	let confirmOpen = $state(false);
	let confirmKind = $state<'disable' | 'enable'>('disable');
	let confirmLoading = $state(false);

	let issued = $state<ConsoleInviteResult | null>(null);
	let issuedOpen = $state(false);
	let issuedHeading = $state('Invitation ready');

	async function load() {
		loading = true;
		error = '';
		try {
			data = await fetchConsoleAccess();
		} catch (err) {
			error = errorMessage(err, 'load console access');
			data = null;
		} finally {
			loading = false;
		}
	}

	onMount(load);

	const users = $derived(data?.users ?? []);
	const roles = $derived(data?.roles ?? []);
	const permissions = $derived(data?.permissions ?? []);
	const assignable = $derived(roles.filter((r) => r.assignable));

	function roleHas(roleKey: string, permission: ConsolePermission): boolean {
		return roles.find((r) => r.key === roleKey)?.permissions.includes(permission) ?? false;
	}

	/** The short "what they can reach" line under a person's name. */
	function accessSummary(user: ConsoleUser): string {
		const labels = user.permissions
			.map((key) => permissions.find((p) => p.key === key)?.label ?? key)
			.slice(0, 3);
		if (user.permissions.length > labels.length) {
			labels.push(`+${user.permissions.length - labels.length}`);
		}
		return labels.join(' · ') || 'No access';
	}

	/* ---------- inviting ---------- */

	function openInvite() {
		inviteForm = { name: '', email: '', phone: '', role: 'SUPPORT' };
		inviteErrors = {};
		inviteOpen = true;
	}

	async function submitInvite() {
		const errs: Record<string, string> = {};
		if (!inviteForm.name.trim()) errs.name = 'A name is required';
		if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteForm.email.trim())) {
			errs.email = 'Enter a valid email address';
		}
		inviteErrors = errs;
		if (Object.keys(errs).length > 0) return;

		inviting = true;
		try {
			const result = await inviteConsoleUser({
				name: inviteForm.name.trim(),
				email: inviteForm.email.trim(),
				phone: inviteForm.phone.trim(),
				role: inviteForm.role as 'PLATFORM_ADMIN' | 'SUPPORT'
			});
			inviteOpen = false;
			toast.success(`${result.user.name} invited`);
			issued = result;
			issuedHeading = 'Invitation ready';
			issuedOpen = true;
			await load();
		} catch (err) {
			toast.error(errorMessage(err, 'invite this person'));
		} finally {
			inviting = false;
		}
	}

	async function changeRole(user: ConsoleUser, role: string) {
		try {
			await updateConsoleUser(user.id, { role: role as 'PLATFORM_ADMIN' | 'SUPPORT' });
			toast.success(`${user.name} is now ${role === 'PLATFORM_ADMIN' ? 'a platform admin' : 'support'}`);
			await load();
		} catch (err) {
			toast.error(errorMessage(err, 'change this role'));
		}
	}

	function ask(user: ConsoleUser, kind: 'disable' | 'enable') {
		target = user;
		confirmKind = kind;
		confirmOpen = true;
	}

	async function runConfirm() {
		if (!target) return;
		confirmLoading = true;
		try {
			await updateConsoleUser(target.id, {
				status: confirmKind === 'disable' ? 'DISABLED' : 'ACTIVE'
			});
			confirmOpen = false;
			toast.success(
				confirmKind === 'disable' ? `${target.name}'s access revoked` : `${target.name} restored`
			);
			await load();
		} catch (err) {
			toast.error(errorMessage(err, 'change this account'));
		} finally {
			confirmLoading = false;
		}
	}

	async function reissue(user: ConsoleUser) {
		try {
			const result = await resendConsoleInvite(user.id);
			issued = result;
			issuedHeading = 'New invitation issued';
			issuedOpen = true;
			toast.success('A fresh link was issued and old sessions ended');
			await load();
		} catch (err) {
			toast.error(errorMessage(err, 'reissue the invitation'));
		}
	}

	type RowAction = {
		label: string;
		onclick?: () => void;
		danger?: boolean;
		separatorBefore?: boolean;
		disabled?: boolean;
	};

	function actionsFor(user: ConsoleUser): RowAction[] {
		// The owner is the account that cannot be locked out, and nobody edits
		// their own access — both would end with a console nobody can reach.
		if (user.is_owner) {
			return [{ label: 'The owner account cannot be changed', disabled: true }];
		}
		const items: RowAction[] = [];
		for (const role of assignable) {
			if (role.key === user.role) continue;
			items.push({
				label: `Make ${role.label.toLowerCase()}`,
				disabled: user.is_self,
				onclick: () => {
					void changeRole(user, role.key);
				}
			});
		}
		items.push({
			label: user.status === 'INVITED' ? 'Reissue invitation' : 'Reset access',
			separatorBefore: true,
			disabled: user.is_self,
			onclick: () => {
				void reissue(user);
			}
		});
		items.push(
			user.status === 'DISABLED'
				? { label: 'Restore access', onclick: () => ask(user, 'enable') }
				: {
						label: 'Revoke access',
						danger: true,
						disabled: user.is_self,
						onclick: () => ask(user, 'disable')
					}
		);
		return items;
	}
</script>

{#if error}
	<div class="panel" style="margin-bottom:0.85rem;"><ErrorState message={error} onretry={load} /></div>
{/if}

<section class="panel scope">
	<span class="scope-icon"><ShieldCheck size={16} strokeWidth={1.9} /></span>
	<div>
		<strong>This list is the platform console, not your businesses</strong>
		<p>
			Everyone here can sign in to this console. Nobody here has any access inside a business —
			a business's own staff are invited by its owner, on its own address, and cannot be created
			from the platform side.
		</p>
	</div>
	<a class="btn btn-quiet btn-sm" href="/superadmin/businesses">
		<Building2 size={14} strokeWidth={2} />
		Businesses
	</a>
</section>

<Tabs {tabs} bind:active={tab} />

{#if tab === 'people'}
	<section class="panel panel-flush">
		<div class="iam-head">
			<div>
				<h2>Console access</h2>
				<p>
					{#if data}
						{data.summary.total}
						{data.summary.total === 1 ? 'account' : 'accounts'} · {data.summary.owners} owner ·
						{data.summary.admins} platform admin{data.summary.admins === 1 ? '' : 's'} ·
						{data.summary.support} support
					{:else}
						Loading…
					{/if}
				</p>
			</div>
			<button type="button" class="btn btn-primary btn-sm" onclick={openInvite}>
				<UserPlus size={14} strokeWidth={2.2} />
				Invite to console
			</button>
		</div>

		<DataTable
			{loading}
			empty={!loading && users.length === 0}
			emptyTitle="No console accounts"
			emptyDescription="Invite a colleague to help run the platform."
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
							<span class="cell-avatar" style="width:1.9rem;height:1.9rem;font-size:var(--fs-meta);">
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
					<td class="col-sm muted" style="font-size:var(--fs-code);">{accessSummary(user)}</td>
					<td><StatusBadge status={String(user.status)} /></td>
					<td class="num col-md muted">{user.active_sessions}</td>
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
					What each console role may reach. This is the table the API enforces, so anything
					unticked is refused by the server rather than merely hidden here.
				</p>
			</div>
		</div>

		{#if loading}
			<div style="padding:0 1.25rem 1.25rem;"><Skeleton height="16rem" /></div>
		{:else}
			<div class="role-cards">
				{#each roles as role (role.key)}
					<div class="role-card" class:owner={!role.assignable}>
						<div class="role-card-head">
							<strong>{role.label}</strong>
							{#if !role.assignable}<span class="role-tag">not assignable</span>{/if}
						</div>
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
						{#each permissions as permission (permission.key)}
							<tr>
								<td>
									<strong style="font-weight:550;">{permission.label}</strong>
									<span class="muted" style="display:block;font-size:var(--fs-code);">
										{permission.description}
									</span>
								</td>
								{#each roles as role (role.key)}
									<td class="matrix-cell">
										{#if roleHas(role.key, permission.key)}
											<span class="yes">
												<Check size={13} strokeWidth={2.6} />
												<span class="sr-only">{role.label} can</span>
											</span>
										{:else}
											<span class="no">
												<Minus size={13} strokeWidth={2.6} />
												<span class="sr-only">{role.label} cannot</span>
											</span>
										{/if}
									</td>
								{/each}
							</tr>
						{/each}
					</tbody>
				</table>
			</div>

			<p class="matrix-note">
				Roles are fixed for now. If someone needs a mix these do not cover, give them the
				narrower role rather than sharing an account — every action here is recorded against
				the person who took it.
			</p>
		{/if}
	</section>
{/if}

<Modal bind:open={inviteOpen} title="Invite to the console">
	<p class="muted" style="margin:0 0 0.9rem;font-size:var(--fs-body);line-height:1.55;">
		They receive a single-use link and choose their own password. No password is created here, and
		this grants nothing inside any business.
	</p>
	<div style="display:flex;flex-direction:column;gap:0.85rem;">
		<FormField label="Name" htmlFor="ci-name" required error={inviteErrors.name}>
			<TextInput id="ci-name" bind:value={inviteForm.name} />
		</FormField>
		<FormField label="Email" htmlFor="ci-email" required error={inviteErrors.email}>
			<TextInput id="ci-email" type="email" bind:value={inviteForm.email} />
		</FormField>
		<FormField label="Phone" htmlFor="ci-phone">
			<TextInput id="ci-phone" type="tel" bind:value={inviteForm.phone} />
		</FormField>
		<FormField
			label="Role"
			htmlFor="ci-role"
			hint={inviteForm.role === 'PLATFORM_ADMIN'
				? 'Runs the platform alongside you: businesses, plans, providers and settings. Cannot change who has console access.'
				: 'Can see businesses and monitoring to answer questions. Changes nothing.'}
		>
			<SelectField
				id="ci-role"
				bind:value={inviteForm.role}
				options={assignable.map((r) => ({ value: String(r.key), label: r.label }))}
			/>
		</FormField>
	</div>
	{#snippet footer()}
		<button type="button" class="btn btn-ghost" onclick={() => (inviteOpen = false)}>Cancel</button>
		<button type="button" class="btn btn-primary" disabled={inviting} onclick={submitInvite}>
			{inviting ? 'Inviting…' : 'Send invitation'}
		</button>
	{/snippet}
</Modal>

<ConfirmDialog
	bind:open={confirmOpen}
	title={confirmKind === 'disable' ? 'Revoke console access?' : 'Restore console access?'}
	message={target
		? confirmKind === 'disable'
			? `${target.name} is signed out everywhere immediately and cannot sign back in until you restore them. Their history in the audit log is kept.`
			: `${target.name} will be able to sign in to the console again.`
		: ''}
	confirmLabel={confirmKind === 'disable' ? 'Revoke access' : 'Restore access'}
	danger={confirmKind === 'disable'}
	loading={confirmLoading}
	onconfirm={runConfirm}
/>

<InviteLinkDialog
	bind:open={issuedOpen}
	setupUrl={issued?.setup_url ?? ''}
	email={issued?.user.email ?? ''}
	emailSent={issued?.email_sent ?? false}
	emailError={issued?.email_error ?? ''}
	heading={issuedHeading}
/>

<style>
	.scope {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
		margin-bottom: 0.85rem;
	}

	.scope-icon {
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

	.scope strong {
		font-size: var(--fs-body);
		font-weight: 600;
	}

	.scope p {
		margin: 0.2rem 0 0;
		font-size: var(--fs-tab);
		line-height: 1.55;
		color: var(--text-3);
		max-width: 58rem;
	}

	.iam-head {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		justify-content: space-between;
		gap: 0.85rem;
		padding: 1.1rem 1.25rem 0.85rem;
	}

	.iam-head h2 {
		margin: 0;
		font-size: var(--fs-title);
		font-weight: 600;
	}

	.iam-head p {
		margin: 0.25rem 0 0;
		font-size: var(--fs-tab);
		line-height: 1.5;
		color: var(--text-3);
		max-width: 48rem;
	}

	.you {
		margin-left: 0.35rem;
		padding: 0.05rem 0.3rem;
		border-radius: 999px;
		background: var(--surface-3);
		color: var(--text-3);
		font-size: var(--fs-micro);
		font-weight: 650;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.role-chip {
		display: inline-flex;
		align-items: center;
		padding: 0.15rem 0.5rem;
		border-radius: 999px;
		font-size: var(--fs-code);
		font-weight: 600;
		background: var(--surface-3);
		color: var(--text-2);
	}

	.role-chip[data-role='SUPER_ADMIN'] {
		background: var(--icon-bg);
		color: var(--icon-fg);
	}

	.role-chip[data-role='PLATFORM_ADMIN'] {
		background: var(--info-bg);
		color: var(--info);
	}

	.role-cards {
		display: grid;
		gap: 0.6rem;
		grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
		padding: 0 1.25rem 1rem;
	}

	.role-card {
		border: 1px solid var(--border);
		border-radius: var(--radius);
		padding: 0.85rem 0.95rem;
		background: var(--surface-2);
	}

	.role-card.owner {
		border-color: color-mix(in srgb, var(--icon-fg) 35%, var(--border));
	}

	.role-card-head {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}

	.role-card strong {
		font-size: var(--fs-body);
		font-weight: 650;
	}

	.role-tag {
		padding: 0.05rem 0.35rem;
		border-radius: 999px;
		background: var(--surface-3);
		color: var(--text-3);
		font-size: var(--fs-micro);
		font-weight: 650;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.role-card p {
		margin: 0.3rem 0 0.55rem;
		font-size: var(--fs-tab);
		line-height: 1.5;
		color: var(--text-3);
	}

	.role-count {
		font-size: var(--fs-label);
		font-weight: 600;
		color: var(--icon-fg);
	}

	.matrix-role {
		text-align: center;
		width: 8rem;
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
		font-size: var(--fs-code);
		line-height: 1.55;
		color: var(--text-3);
		max-width: 52rem;
	}
</style>
