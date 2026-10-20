<script lang="ts">
	import { formatDateTime, formatRelative } from '$lib/admin/format';
	import ConfirmDialog from '$lib/components/admin/ConfirmDialog.svelte';
	import SlideOver from '$lib/components/admin/SlideOver.svelte';
	import StatusBadge from '$lib/components/admin/StatusBadge.svelte';
	import { toast } from '$lib/components/admin/toast';
	import { formatDuration, listAttendance, punchSeconds, ymd, type StaffPunch } from '$lib/tenant/attendanceApi';
	import { featureAccess } from '$lib/tenant/entitlements.svelte';
	import {
		deviceLabel,
		getStaffStats,
		listStaffLogins,
		listStaffSessions,
		signOutStaffEverywhere,
		type LoginEvent,
		type ShopUser,
		type StaffSession,
		type StaffStats
	} from '$lib/tenant/staffApi';

	let { open = $bindable(false), user }: { open?: boolean; user: ShopUser | null } = $props();

	let tab = $state<'overview' | 'signins' | 'attendance'>('overview');
	let stats = $state<StaffStats | null>(null);
	let logins = $state<LoginEvent[] | null>(null);
	let sessions = $state<StaffSession[] | null>(null);
	let punches = $state<StaffPunch[] | null>(null);
	let confirmOpen = $state(false);
	let confirmLoading = $state(false);

	const hasAttendance = $derived(featureAccess('ATTENDANCE').enabled);
	const role = $derived(user?.role === 'TENANT_ADMIN' ? 'Owner' : user?.role === 'MANAGER' ? 'Manager' : 'Staff');
	const totalSecs = $derived((punches ?? []).reduce((a, p) => a + punchSeconds(p), 0));

	// Reload whenever a different person is opened.
	let loadedFor = '';
	$effect(() => {
		if (!open || !user || loadedFor === user.id) return;
		const id = user.id;
		loadedFor = id;
		tab = 'overview';
		stats = logins = sessions = punches = null;
		const fail = (e: unknown) => {
			toast.error(e instanceof Error ? e.message : 'Failed to load');
			return null;
		};
		getStaffStats(id, 30).then((r) => loadedFor === id && (stats = r)).catch(fail);
		listStaffLogins(id).then((r) => loadedFor === id && (logins = r)).catch(fail);
		listStaffSessions(id).then((r) => loadedFor === id && (sessions = r)).catch(fail);
		if (hasAttendance) {
			const to = new Date();
			to.setDate(to.getDate() + 1);
			const from = new Date();
			from.setDate(from.getDate() - 14);
			listAttendance(ymd(from), ymd(to), id).then((r) => loadedFor === id && (punches = r)).catch(fail);
		}
	});
	$effect(() => {
		if (!open) loadedFor = '';
	});

	async function signOutAll() {
		if (!user) return;
		confirmLoading = true;
		try {
			await signOutStaffEverywhere(user.id);
			sessions = [];
			confirmOpen = false;
			toast.success(`${user.name} signed out everywhere`);
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Could not sign out');
		} finally {
			confirmLoading = false;
		}
	}
</script>

<SlideOver bind:open title={user?.name || 'Team member'}>
	{#if user}
		<div class="tabs" role="tablist" aria-label="Team member">
			<button type="button" role="tab" aria-selected={tab === 'overview'} onclick={() => (tab = 'overview')}>Overview</button>
			<button type="button" role="tab" aria-selected={tab === 'signins'} onclick={() => (tab = 'signins')}>Sign-ins</button>
			{#if hasAttendance}
				<button type="button" role="tab" aria-selected={tab === 'attendance'} onclick={() => (tab = 'attendance')}>Attendance</button>
			{/if}
		</div>

		{#if tab === 'overview'}
			<dl class="sd-facts">
				<dt>Role</dt><dd>{role}</dd>
				<dt>Status</dt><dd><StatusBadge status={user.status} /></dd>
				<dt>Two-factor</dt><dd>{user.mfa_enabled ? 'On' : 'Off'}</dd>
				<dt>Last sign-in</dt><dd>{user.last_login_at ? formatDateTime(user.last_login_at) : 'Never'}</dd>
			</dl>
			<h4 class="sd-h">Last 30 days</h4>
			{#if !stats}
				<p class="muted">Loading...</p>
			{:else}
				<div class="sd-tiles">
					{#if stats.orders_handled !== undefined}
						<div class="sd-tile"><strong>{stats.orders_handled}</strong><span>Orders handled</span></div>
					{/if}
					{#if stats.appointments_completed !== undefined}
						<div class="sd-tile"><strong>{stats.appointments_completed}</strong><span>Appointments done</span></div>
					{/if}
					{#if stats.hours_worked !== undefined}
						<div class="sd-tile"><strong>{Math.round(stats.hours_worked * 10) / 10}h</strong><span>Hours worked</span></div>
					{/if}
				</div>
				{#if stats.orders_handled === undefined && stats.appointments_completed === undefined && stats.hours_worked === undefined}
					<p class="muted">Nothing tracked for this role yet.</p>
				{:else}
					<p class="muted sd-note">Counts cover activity since tracking began.</p>
				{/if}
			{/if}
		{:else if tab === 'signins'}
			<div class="sd-row">
				<h4 class="sd-h">Active sessions</h4>
				<button type="button" class="btn btn-ghost btn-sm" disabled={!sessions?.length} onclick={() => (confirmOpen = true)}>
					Sign out everywhere
				</button>
			</div>
			{#if !sessions}
				<p class="muted">Loading...</p>
			{:else if sessions.length === 0}
				<p class="muted">No active sessions.</p>
			{:else}
				<ul class="sd-list">
					{#each sessions as s (s.id)}
						<li><strong>{deviceLabel(s.user_agent)}</strong><span class="muted">{s.ip || '-'} - active {formatRelative(s.last_active)}</span></li>
					{/each}
				</ul>
			{/if}
			<h4 class="sd-h">Recent sign-ins</h4>
			{#if !logins}
				<p class="muted">Loading...</p>
			{:else if logins.length === 0}
				<p class="muted">No sign-ins recorded.</p>
			{:else}
				<div class="sd-scroll">
					<table class="sd-table">
						<thead><tr><th>When</th><th>Result</th><th>Device</th><th>IP</th></tr></thead>
						<tbody>
							{#each logins as l (l.at + l.action)}
								<tr>
									<td>{formatDateTime(l.at)}</td>
									<td>
										<StatusBadge
											status={l.result === 'SUCCESS' ? 'SUCCESS' : l.result}
											kind={l.result === 'SUCCESS' ? 'ok' : 'danger'}
											dot={false}
										/>
										{#if l.action === 'mfa.verify'}<span class="muted"> 2FA</span>{/if}
									</td>
									<td>{deviceLabel(l.user_agent)}</td>
									<td class="muted">{l.ip || '-'}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		{:else}
			<h4 class="sd-h">Last 14 days: {formatDuration(totalSecs)}</h4>
			{#if !punches}
				<p class="muted">Loading...</p>
			{:else if punches.length === 0}
				<p class="muted">No punches in this period.</p>
			{:else}
				<ul class="sd-list">
					{#each punches as p (p.id)}
						<li>
							<strong>{new Date(p.clock_in_at).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}</strong>
							<span class="muted">
								{new Date(p.clock_in_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
								to {p.clock_out_at ? new Date(p.clock_out_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'now'}
								({p.clock_out_at ? formatDuration(punchSeconds(p)) : 'On shift'})
							</span>
						</li>
					{/each}
				</ul>
			{/if}
		{/if}
	{/if}
</SlideOver>

<ConfirmDialog
	bind:open={confirmOpen}
	title="Sign out everywhere?"
	message={`${user?.name ?? 'This person'} will be signed out of every device. Their current screen may keep working for up to 15 minutes.`}
	confirmLabel="Sign out everywhere"
	danger
	loading={confirmLoading}
	onconfirm={signOutAll}
/>

<style>
	.sd-facts {
		display: grid;
		grid-template-columns: max-content 1fr;
		gap: 0.5rem 1rem;
		margin: 0 0 1rem;
	}
	.sd-facts dt {
		color: var(--text-3);
	}
	.sd-facts dd {
		margin: 0;
	}
	.sd-h {
		margin: 1rem 0 0.5rem;
		font-size: var(--fs-body);
	}
	.sd-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}
	.sd-tiles {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(7rem, 1fr));
		gap: 0.6rem;
	}
	.sd-tile {
		display: grid;
		gap: 0.15rem;
		padding: 0.75rem;
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-sm);
	}
	.sd-tile strong {
		font-size: 1.35rem;
	}
	.sd-tile span,
	.sd-note {
		font-size: var(--fs-meta);
		color: var(--text-3);
	}
	.sd-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 0.5rem;
	}
	.sd-list li {
		display: grid;
		gap: 0.1rem;
	}
	.sd-scroll {
		overflow-x: auto;
	}
	.sd-table {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--fs-meta);
	}
	.sd-table th,
	.sd-table td {
		text-align: left;
		padding: 0.4rem 0.4rem;
		border-bottom: 1px solid var(--border-subtle);
		white-space: nowrap;
	}
</style>
