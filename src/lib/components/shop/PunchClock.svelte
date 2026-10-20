<script lang="ts">
	import { onMount } from 'svelte';
	import Clock from '@tabler/icons-svelte/icons/clock';
	import { ApiClientError } from '$lib/api/client';
	import { toast } from '$lib/components/admin/toast';
	import {
		formatDuration,
		getAttendanceMe,
		getPosition,
		punchIn,
		punchOut,
		punchSeconds,
		type AttendanceMe
	} from '$lib/tenant/attendanceApi';
	import { entitlementState, featureAccess } from '$lib/tenant/entitlements.svelte';

	let me = $state<AttendanceMe | null>(null);
	let busy = $state(false);
	let now = $state(Date.now());

	// Unknown entitlements read as allowed; the quiet fetch below hides a 403.
	const allowed = $derived((entitlementState.data, featureAccess('ATTENDANCE').enabled));
	const shown = $derived(allowed && me?.enabled === true);
	const elapsed = $derived(me?.open ? formatDuration(punchSeconds(me.open, now)) : '');

	onMount(() => {
		const t = setInterval(() => (now = Date.now()), 30000);
		return () => clearInterval(t);
	});

	$effect(() => {
		if (!allowed) return;
		getAttendanceMe({ quiet: true })
			.then((r) => (me = r))
			.catch(() => (me = null));
	});

	async function toggle() {
		if (!me || busy) return;
		busy = true;
		try {
			const body: { lat?: number; lng?: number } = {};
			if (me.require_location) Object.assign(body, await getPosition());
			if (me.open) {
				await punchOut(body);
				me = { ...me, open: null };
				toast.success('Punched out');
			} else {
				const p = await punchIn(body);
				me = { ...me, open: p };
				now = Date.now();
				toast.success('Punched in');
			}
		} catch (err) {
			if (err instanceof ApiClientError) {
				if (err.code === 'outside_geofence') {
					const d = err.details;
					toast.error(`You are ${Math.round(Number(d.distance_m))} m from the shop, allowed ${Math.round(Number(d.radius_m))} m`);
				} else if (err.code === 'location_required') {
					toast.error('Location is required to punch. Allow location access and try again');
				} else if (err.code === 'already_punched_in' || err.code === 'not_punched_in') {
					toast.error(err.message);
					getAttendanceMe({ quiet: true }).then((r) => (me = r)).catch(() => {});
				} else toast.error(err.message);
			} else toast.error(err instanceof Error ? err.message : 'Could not punch');
		} finally {
			busy = false;
		}
	}
</script>

{#if shown && me}
	<button
		type="button"
		class="btn btn-sm punch"
		class:on={!!me.open}
		class:btn-ghost={!me.open}
		disabled={busy}
		onclick={toggle}
		title={me.open ? 'Punch out' : 'Punch in'}
	>
		<Clock size={14} stroke={1.6} />
		{#if me.open}
			<span class="punch-time">{elapsed}</span>
			<span class="punch-label">On shift: Punch out</span>
		{:else}
			<span class="punch-label">Punch in</span>
		{/if}
	</button>
{/if}

<style>
	.punch {
		white-space: nowrap;
	}
	.punch.on {
		background: color-mix(in srgb, var(--accent) 14%, transparent);
		color: var(--accent-dark);
		border: 1px solid color-mix(in srgb, var(--accent) 35%, transparent);
	}
	@media (max-width: 640px) {
		.punch-label {
			display: none;
		}
		.punch:not(.on) .punch-label {
			display: inline;
		}
	}
</style>
