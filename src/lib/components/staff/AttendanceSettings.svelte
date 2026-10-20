<script lang="ts">
	import { onMount } from 'svelte';
	import MapPin from '@tabler/icons-svelte/icons/map-pin';
	import FormField from '$lib/components/admin/FormField.svelte';
	import TextInput from '$lib/components/admin/TextInput.svelte';
	import { toast } from '$lib/components/admin/toast';
	import {
		getAttendanceSettings,
		getPosition,
		saveAttendanceSettings,
		type AttendanceSettings
	} from '$lib/tenant/attendanceApi';

	let { onsaved }: { onsaved?: (s: AttendanceSettings) => void } = $props();

	let s = $state<AttendanceSettings | null>(null);
	let radius = $state('200');
	let rule = $state(false);
	let saving = $state(false);
	let locating = $state(false);

	onMount(async () => {
		try {
			const r = await getAttendanceSettings();
			s = r;
			rule = r.geo_lat != null && r.geo_lng != null;
			if (r.geo_radius_m) radius = String(r.geo_radius_m);
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Failed to load settings');
		}
	});

	async function locate() {
		if (!s) return;
		locating = true;
		try {
			const p = await getPosition();
			s.geo_lat = p.lat;
			s.geo_lng = p.lng;
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Could not get your location');
		} finally {
			locating = false;
		}
	}

	function removeRule() {
		if (!s) return;
		rule = false;
		s.geo_lat = s.geo_lng = null;
		s.require_location = false;
	}

	async function save() {
		if (!s) return;
		const r = Number(radius);
		if (rule) {
			if (s.geo_lat == null || s.geo_lng == null) return toast.error('Set the shop location first');
			if (!Number.isFinite(r) || r < 20 || r > 50000) return toast.error('Radius must be between 20 and 50000 metres');
		}
		saving = true;
		try {
			const body = {
				enabled: s.enabled,
				require_location: rule && s.require_location,
				geo_lat: rule ? s.geo_lat : null,
				geo_lng: rule ? s.geo_lng : null,
				geo_radius_m: rule ? Math.round(r) : s.geo_radius_m || 200
			};
			s = await saveAttendanceSettings(body);
			onsaved?.(s);
			toast.success('Attendance settings saved');
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Could not save settings');
		} finally {
			saving = false;
		}
	}
</script>

<section class="panel" style="padding:1rem;display:grid;gap:1rem;max-width:36rem;">
	{#if !s}
		<p class="muted" style="margin:0;">Loading...</p>
	{:else}
		<label class="as-toggle">
			<input type="checkbox" bind:checked={s.enabled} />
			<span>
				<strong>Staff attendance</strong>
				<span class="muted">Let your team punch in and out from the top bar.</span>
			</span>
		</label>

		{#if s.enabled}
			{#if !rule}
				<div>
					<button type="button" class="btn btn-ghost btn-sm" onclick={() => (rule = true)}>+ Add location rule</button>
				</div>
			{:else}
				<div class="as-rule">
					<button type="button" class="btn btn-ghost btn-sm" disabled={locating} onclick={locate}>
						<MapPin size={14} stroke={1.6} />
						{locating ? 'Locating...' : 'Use my current location'}
					</button>
					<p class="muted" style="margin:0;">
						{#if s.geo_lat != null && s.geo_lng != null}
							Shop location: {s.geo_lat.toFixed(5)}, {s.geo_lng.toFixed(5)}
						{:else}
							No location set yet. Stand at the shop and use the button above.
						{/if}
					</p>
					<FormField label="Allowed distance (metres)" htmlFor="as-radius" hint="Between 20 and 50000.">
						<TextInput id="as-radius" type="number" inputmode="numeric" min={20} max={50000} bind:value={radius} />
					</FormField>
					<label class="as-toggle">
						<input type="checkbox" bind:checked={s.require_location} />
						<span><strong>Require staff to be at the shop</strong></span>
					</label>
					<div>
						<button type="button" class="btn btn-quiet btn-sm" onclick={removeRule}>Remove rule</button>
					</div>
				</div>
			{/if}
		{/if}

		<div>
			<button type="button" class="btn btn-primary" disabled={saving} onclick={save}>
				{saving ? 'Saving...' : 'Save'}
			</button>
		</div>
	{/if}
</section>

<style>
	.as-toggle {
		display: flex;
		gap: 0.6rem;
		align-items: flex-start;
		cursor: pointer;
	}
	.as-toggle > span {
		display: grid;
		gap: 0.1rem;
	}
	.as-rule {
		display: grid;
		gap: 0.75rem;
		padding: 0.85rem;
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-sm);
	}
</style>
