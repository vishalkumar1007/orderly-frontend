<script lang="ts">
	import ChevronLeft from '@tabler/icons-svelte/icons/chevron-left';
	import ChevronRight from '@tabler/icons-svelte/icons/chevron-right';
	import { initials } from '$lib/admin/format';
	import Modal from '$lib/components/admin/Modal.svelte';
	import SelectField from '$lib/components/admin/SelectField.svelte';
	import { toast } from '$lib/components/admin/toast';
	import {
		correctPunch,
		formatDuration,
		listAttendance,
		punchSeconds,
		ymd,
		type StaffPunch
	} from '$lib/tenant/attendanceApi';
	import type { ShopUser } from '$lib/tenant/staffApi';

	let { users, enabled, onsettings }: { users: ShopUser[]; enabled: boolean; onsettings: () => void } =
		$props();

	function mondayOf(d: Date): Date {
		const m = new Date(d.getFullYear(), d.getMonth(), d.getDate());
		m.setDate(m.getDate() - ((m.getDay() + 6) % 7));
		return m;
	}

	let weekStart = $state(mondayOf(new Date()));
	let filter = $state('');
	let punches = $state<StaffPunch[]>([]);
	let loading = $state(true);
	let failed = $state(false);

	const days = $derived(
		Array.from({ length: 7 }, (_, i) => new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + i))
	);
	const rows = $derived(filter ? users.filter((u) => u.id === filter) : users);
	const rangeLabel = $derived(
		`${days[0].toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} - ${days[6].toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}`
	);

	let seq = 0;
	async function load() {
		const mine = ++seq;
		loading = true;
		failed = false;
		try {
			const end = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 7);
			const res = await listAttendance(ymd(weekStart), ymd(end), filter || undefined);
			if (mine === seq) punches = res;
		} catch (err) {
			if (mine === seq) {
				failed = true;
				toast.error(err instanceof Error ? err.message : 'Failed to load attendance');
			}
		} finally {
			if (mine === seq) loading = false;
		}
	}

	$effect(() => {
		weekStart;
		filter;
		if (enabled) void load();
		else loading = false;
	});

	function shift(weeks: number) {
		weekStart = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + weeks * 7);
	}

	// A shift counts on the day it started.
	function cell(userId: string, day: Date): StaffPunch[] {
		const k = ymd(day);
		return punches.filter((p) => p.user_id === userId && ymd(new Date(p.clock_in_at)) === k);
	}
	function secs(list: StaffPunch[]): number {
		return list.reduce((a, p) => a + punchSeconds(p), 0);
	}
	function hours(sec: number): string {
		return `${(Math.round(sec / 360) / 10).toString()}h`;
	}

	// Day editor
	let editUser = $state<ShopUser | null>(null);
	let editDay = $state<Date | null>(null);
	let editOpen = $state(false);
	let drafts = $state<Record<string, { in: string; out: string; note: string }>>({});
	let savingId = $state('');

	const dayPunches = $derived(editUser && editDay ? cell(editUser.id, editDay) : []);

	function toLocalInput(iso: string | null): string {
		if (!iso) return '';
		const d = new Date(iso);
		return `${ymd(d)}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
	}

	function openCell(u: ShopUser, d: Date) {
		const list = cell(u.id, d);
		if (list.length === 0) return;
		editUser = u;
		editDay = d;
		drafts = Object.fromEntries(
			list.map((p) => [p.id, { in: toLocalInput(p.clock_in_at), out: toLocalInput(p.clock_out_at), note: p.note ?? '' }])
		);
		editOpen = true;
	}

	async function save(p: StaffPunch) {
		const d = drafts[p.id];
		if (!d?.in) return toast.error('Clock-in time is required');
		const inAt = new Date(d.in);
		const outAt = d.out ? new Date(d.out) : null;
		if (outAt && outAt <= inAt) return toast.error('Clock-out must be after clock-in');
		savingId = p.id;
		try {
			const res = await correctPunch(p.id, {
				clock_in_at: inAt.toISOString(),
				clock_out_at: outAt ? outAt.toISOString() : null,
				note: d.note.trim()
			});
			punches = punches.map((x) => (x.id === p.id ? { ...x, ...res } : x));
			toast.success('Punch updated');
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Could not update punch');
		} finally {
			savingId = '';
		}
	}
</script>

{#if !enabled}
	<div class="panel ts-hint">
		<p class="muted" style="margin:0;">
			Attendance is turned off. <button type="button" class="link" onclick={onsettings}>Turn it on in Settings</button>
			to let your team punch in and out.
		</p>
	</div>
{:else}
	<div class="ts-bar">
		<div class="ts-week">
			<button type="button" class="btn btn-ghost btn-sm" aria-label="Previous week" onclick={() => shift(-1)}>
				<ChevronLeft size={15} stroke={1.6} />
			</button>
			<strong>{rangeLabel}</strong>
			<button type="button" class="btn btn-ghost btn-sm" aria-label="Next week" onclick={() => shift(1)}>
				<ChevronRight size={15} stroke={1.6} />
			</button>
			<button type="button" class="btn btn-quiet btn-sm" onclick={() => (weekStart = mondayOf(new Date()))}>This week</button>
		</div>
		<div class="ts-filter">
			<SelectField
				id="ts-person"
				bind:value={filter}
				options={[{ value: '', label: 'Everyone' }, ...users.map((u) => ({ value: u.id, label: u.name || u.email }))]}
			/>
		</div>
	</div>

	<section class="panel panel-flush ts-scroll" aria-busy={loading}>
		<table class="ts-table">
			<thead>
				<tr>
					<th>Person</th>
					{#each days as d (d.getTime())}
						<th class="num">{d.toLocaleDateString(undefined, { weekday: 'short' })}<span>{d.getDate()}</span></th>
					{/each}
					<th class="num">Total</th>
				</tr>
			</thead>
			<tbody>
				{#each rows as u (u.id)}
					{@const total = secs(punches.filter((p) => p.user_id === u.id))}
					<tr>
						<td>
							<div class="cell-id">
								<span class="cell-avatar" style="width:1.6rem;height:1.6rem;font-size:var(--fs-meta);">{initials(u.name || u.email)}</span>
								<strong>{u.name || u.email}</strong>
							</div>
						</td>
						{#each days as d (d.getTime())}
							{@const list = cell(u.id, d)}
							<td class="num">
								{#if list.length === 0}
									<span class="muted">-</span>
								{:else}
									<button type="button" class="ts-cell" class:live={list.some((p) => !p.clock_out_at)} onclick={() => openCell(u, d)}>
										{#if list.some((p) => !p.clock_out_at)}On shift{:else}{hours(secs(list))}{/if}
									</button>
								{/if}
							</td>
						{/each}
						<td class="num"><strong>{total ? hours(total) : '-'}</strong></td>
					</tr>
				{/each}
				{#if !loading && rows.length === 0}
					<tr><td colspan="9" class="muted">No people to show.</td></tr>
				{/if}
			</tbody>
		</table>
		{#if failed}<p class="muted" style="padding:0.75rem;">Could not load this week.</p>{/if}
	</section>
{/if}

<Modal bind:open={editOpen} title={editUser && editDay ? `${editUser.name || editUser.email}, ${editDay.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' })}` : 'Punches'}>
	<div style="display:grid;gap:1rem;">
		{#each dayPunches as p (p.id)}
			{@const d = drafts[p.id]}
			{#if d}
				<div class="ts-punch">
					<div class="ts-punch-meta muted">
						{p.clock_out_at ? formatDuration(punchSeconds(p)) : 'On shift'}
						{#if p.edited} - edited{/if}
						{#if p.in_distance_m != null} - {Math.round(p.in_distance_m)} m from shop at clock-in{/if}
					</div>
					<label class="ts-lbl">Clock in <input class="input" type="datetime-local" bind:value={d.in} /></label>
					<label class="ts-lbl">Clock out <input class="input" type="datetime-local" bind:value={d.out} /></label>
					<label class="ts-lbl">Note <input class="input" type="text" maxlength="200" bind:value={d.note} /></label>
					<button type="button" class="btn btn-primary btn-sm" disabled={savingId === p.id} onclick={() => save(p)}>
						{savingId === p.id ? 'Saving...' : 'Save'}
					</button>
				</div>
			{/if}
		{/each}
	</div>
</Modal>

<style>
	.ts-bar {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.75rem;
	}
	.ts-week {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		flex-wrap: wrap;
	}
	.ts-filter {
		min-width: 12rem;
		max-width: 100%;
	}
	.ts-scroll {
		overflow-x: auto;
		max-width: 100%;
	}
	.ts-table {
		width: 100%;
		min-width: 40rem;
		border-collapse: collapse;
		font-size: var(--fs-body);
	}
	.ts-table th,
	.ts-table td {
		padding: 0.55rem 0.6rem;
		text-align: left;
		border-bottom: 1px solid var(--border-subtle);
	}
	.ts-table th.num,
	.ts-table td.num {
		text-align: center;
	}
	.ts-table th span {
		display: block;
		font-weight: 500;
		color: var(--text-3);
	}
	.ts-cell {
		border: 0;
		background: transparent;
		cursor: pointer;
		font: inherit;
		color: var(--text);
		padding: 0.15rem 0.45rem;
		border-radius: var(--radius-sm);
	}
	.ts-cell:hover {
		background: var(--surface-hover);
	}
	.ts-cell.live {
		color: var(--accent-dark);
		font-weight: 650;
	}
	.ts-hint {
		padding: 1rem;
	}
	.link {
		border: 0;
		background: none;
		padding: 0;
		color: var(--accent-dark);
		font: inherit;
		cursor: pointer;
		text-decoration: underline;
	}
	.ts-punch {
		display: grid;
		gap: 0.6rem;
		padding-bottom: 1rem;
		border-bottom: 1px solid var(--border-subtle);
	}
	.ts-lbl {
		display: grid;
		gap: 0.2rem;
		font-size: var(--fs-meta);
		color: var(--text-2);
	}
</style>
