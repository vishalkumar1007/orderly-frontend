<script lang="ts">
	import Plus from '@lucide/svelte/icons/plus';
	import X from '@lucide/svelte/icons/x';
	import FormField from '$lib/components/admin/FormField.svelte';
	import Select from '$lib/components/admin/Select.svelte';
	import Switch from '$lib/components/admin/Switch.svelte';
	import {
		DAYS,
		DAY_LABELS,
		storefrontAdminApi,
		type AdminStorefront
	} from '$lib/storefront/admin';
	import { seed, useStorefront, type StorefrontContext } from '$lib/storefront/admin-context';
	import { toast } from '$lib/components/admin/toast';

	let {
		onsaved,
		studio,
		...ctxProps
	}: Partial<StorefrontContext> & {
		onsaved?: () => void | Promise<void>;
		/**
		 * Studio mode: keep the editor in sync with the working copy.
		 * When `onSave` is set, the form saves via the same live hours API as Action.
		 */
		studio?: {
			hours: AdminStorefront['hours'];
			onChange: (patch: {
				always_open: boolean;
				timezone: string;
				schedule: Record<string, string[]>;
			}) => void;
			onSave?: (patch: {
				always_open: boolean;
				timezone: string;
				schedule: Record<string, string[]>;
			}) => Promise<boolean>;
		};
	} = $props();
	const ctx = useStorefront(() => ctxProps);
	const config = $derived(studio ? { hours: studio.hours } : ctx.config);
	const save = (run: Parameters<StorefrontContext['save']>[0]) => ctx.save(run);

	const TIMEZONES = [
		{ value: 'Asia/Kolkata', label: 'India (Kolkata)' },
		{ value: 'Asia/Dubai', label: 'UAE (Dubai)' },
		{ value: 'Asia/Singapore', label: 'Singapore' },
		{ value: 'Europe/London', label: 'UK (London)' },
		{ value: 'America/New_York', label: 'US (New York)' },
		{ value: 'UTC', label: 'UTC' }
	];

	let alwaysOpen = $state(seed(() => config.hours.always_open));
	let timezone = $state(seed(() => config.hours.timezone || 'Asia/Kolkata'));
	let schedule = $state<Record<string, string[]>>(
		seed(() => flattenSchedule(config.hours.schedule))
	);
	let saving = $state(false);

	$effect(() => {
		if (!studio) return;
		alwaysOpen = studio.hours.always_open;
		timezone = studio.hours.timezone || 'Asia/Kolkata';
		schedule = flattenSchedule(studio.hours.schedule);
	});

	function pushStudioHours() {
		if (!studio) return;
		studio.onChange({
			always_open: alwaysOpen,
			timezone,
			schedule
		});
	}

	/** API returns nested [[open,close],…] or legacy flat [open,close,…]; editor stores flat. */
	function flattenSchedule(raw: Record<string, unknown> | undefined | null): Record<string, string[]> {
		const out: Record<string, string[]> = {};
		for (const [day, shifts] of Object.entries(raw ?? {})) {
			if (!Array.isArray(shifts)) continue;
			const flat: string[] = [];
			for (const entry of shifts) {
				if (Array.isArray(entry) && entry.length >= 2) {
					flat.push(String(entry[0]), String(entry[1]));
				} else if (typeof entry === 'string') {
					flat.push(entry);
				}
			}
			out[day] = flat;
		}
		return out;
	}

	function shiftsFor(day: string): string[][] {
		const rows = schedule[day] ?? [];
		const pairs: string[][] = [];
		for (let i = 0; i + 1 < rows.length; i += 2) pairs.push([rows[i], rows[i + 1]]);
		return pairs;
	}

	function write(day: string, pairs: string[][]) {
		const flat: string[] = [];
		for (const pair of pairs) flat.push(pair[0], pair[1]);
		schedule = { ...schedule, [day]: flat };
		pushStudioHours();
	}

	function addShift(day: string) {
		write(day, [...shiftsFor(day), ['09:00', '21:00']]);
	}

	function removeShift(day: string, index: number) {
		const pairs = shiftsFor(day);
		pairs.splice(index, 1);
		write(day, pairs);
	}

	function updateShift(day: string, index: number, which: 0 | 1, value: string) {
		const pairs = shiftsFor(day);
		if (!pairs[index]) return;
		pairs[index][which] = value;
		write(day, pairs);
	}

	function applyToAll(fromDay: string) {
		const source = shiftsFor(fromDay);
		const next: Record<string, string[]> = {};
		for (const day of DAYS) {
			next[day] = source.flatMap((pair) => [...pair]);
		}
		schedule = next;
		pushStudioHours();
	}

	const totalShifts = $derived(
		DAYS.reduce((sum, day) => sum + shiftsFor(day).length, 0)
	);

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		for (const day of DAYS) {
			for (const pair of shiftsFor(day)) {
				for (const value of pair) {
					if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) {
						toast.error(`${DAY_LABELS[day]}: “${value}” is not a valid time. Use 24-hour HH:MM.`);
						return;
					}
				}
				if (pair[1] <= pair[0]) {
					toast.error(`${DAY_LABELS[day]}: the closing time must be after the opening time.`);
					return;
				}
			}
		}
		const patch = {
			always_open: alwaysOpen,
			timezone,
			schedule
		};
		if (studio?.onSave) {
			saving = true;
			const ok = await studio.onSave(patch);
			saving = false;
			if (ok) {
				toast.success('Opening hours saved');
				await onsaved?.();
			} else toast.error('Could not save your opening hours');
			return;
		}
		if (studio) return;
		saving = true;
		const ok = await save(() => storefrontAdminApi.saveHours(patch));
		saving = false;
		if (ok) {
			toast.success('Opening hours saved');
			await onsaved?.();
		} else toast.error('Could not save your opening hours');
	}
</script>

<form class="sfhours-form" onsubmit={submit}>
	<div class="sfctl-section">
		<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:1rem;flex-wrap:wrap;">
			<div>
				<h2 style="margin:0;">Opening hours</h2>
				<p class="sfctl-note" style="margin:0.2rem 0 0;">
					Right now your store is
					<span style="color:{config.hours.is_open ? 'var(--success)' : 'var(--danger)'};font-weight:600;">
						{config.hours.is_open ? 'open' : 'closed'}
					</span>
					{config.hours.detail ? ` · ${config.hours.detail}` : ''}
				</p>
			</div>
			<span class="badge {config.hours.is_open ? 'badge-ok' : 'badge-warn'}">
				{config.hours.label}
			</span>
		</div>

		<div style="margin-top:1rem;display:grid;gap:0.8rem;">
			<Switch
				bind:checked={alwaysOpen}
				label="Always open"
				hint="Ignore the weekly schedule. Useful for a kiosk or a 24-hour kitchen."
				onchange={() => pushStudioHours()}
			/>

			<FormField label="Timezone" hint="Your hours are evaluated in this timezone, not the customer's.">
				<Select bind:value={timezone} allLabel="" options={TIMEZONES} onchange={() => pushStudioHours()} />
			</FormField>
		</div>
	</div>

	<div class="sfctl-section">
		<div class="sfhours-head">
			<div>
				<h2 style="margin:0;">Weekly schedule</h2>
				<p class="sfctl-note" style="margin:0.2rem 0 0;">
					{alwaysOpen
						? 'Always open is on, so these hours are kept but not used.'
						: 'A day with no shifts is closed. Add a second shift for a lunch break.'}
				</p>
			</div>
			<div class:is-paused={alwaysOpen}>
				<FormField label="Copy a day to every day" hint="Replaces every day's shifts with the day you pick.">
					<div class="sfhours-copy">
						<select
							class="input"
							aria-label="Copy these hours to every day"
							disabled={alwaysOpen}
							onchange={(e) => {
								const el = e.currentTarget as HTMLSelectElement;
								const day = el.value;
								el.value = '';
								if (day) applyToAll(day);
							}}
						>
							<option value="">Choose a day</option>
							{#each DAYS as day (day)}
								<option value={day}>{DAY_LABELS[day]}</option>
							{/each}
						</select>
					</div>
				</FormField>
			</div>
		</div>

		<div class="sfhours" class:is-paused={alwaysOpen}>
			{#each DAYS as day (day)}
				<div class="sfhours-row">
					<span class="sfhours-day">{DAY_LABELS[day]}</span>
					<div class="sfhours-shifts">
						{#each shiftsFor(day) as pair, index (index)}
							<span class="sfshift">
								<input
									type="time"
									value={pair[0]}
									disabled={alwaysOpen}
									aria-label={`${DAY_LABELS[day]} opening time`}
									onchange={(e) =>
										updateShift(day, index, 0, (e.currentTarget as HTMLInputElement).value)}
								/>
								<span aria-hidden="true">–</span>
								<input
									type="time"
									value={pair[1]}
									disabled={alwaysOpen}
									aria-label={`${DAY_LABELS[day]} closing time`}
									onchange={(e) =>
										updateShift(day, index, 1, (e.currentTarget as HTMLInputElement).value)}
								/>
								<button
									type="button"
									disabled={alwaysOpen}
									aria-label={`Remove shift on ${DAY_LABELS[day]}`}
									onclick={() => removeShift(day, index)}
								>
									<X size={12} strokeWidth={2.2} />
								</button>
							</span>
						{/each}
					</div>
					<button
						class="btn btn-secondary btn-sm"
						type="button"
						disabled={alwaysOpen}
						onclick={() => addShift(day)}
						aria-label={'Add a shift on ' + DAY_LABELS[day]}
					>
						<Plus size={13} strokeWidth={2.2} /> Shift
					</button>
				</div>
			{/each}
		</div>

		{#if !alwaysOpen && totalShifts === 0}
			<div class="alert alert-warn" style="margin-top:0.9rem;">
				No shifts are set, so the store is treated as always open. A store with no hours
				would be unorderable, which is never what someone means.
			</div>
		{/if}
	</div>

	{#if !studio || studio.onSave}
		<div class="sfctl-foot">
			<span class="sfctl-foot-note">
				{alwaysOpen ? 'Always open — no schedule is stored.' : `${totalShifts} shift${totalShifts === 1 ? '' : 's'} set this week.`}
			</span>
			<button class="btn btn-primary" type="submit" disabled={saving}>
				{saving ? 'Saving…' : 'Save opening hours'}
			</button>
		</div>
	{:else}
		<p class="sfctl-note" style="margin:1rem 0 0;">
			Hours are saved with your Studio draft — use Review &amp; Publish when you are ready.
		</p>
	{/if}
</form>
