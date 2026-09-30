<script lang="ts">
	import Plus from '@lucide/svelte/icons/plus';
	import X from '@lucide/svelte/icons/x';
	import FormField from '$lib/components/admin/FormField.svelte';
	import Select from '$lib/components/admin/Select.svelte';
	import Switch from '$lib/components/admin/Switch.svelte';
	import {
		DAYS,
		DAY_LABELS,
		emptySchedule,
		storefrontAdminApi,
	} from '$lib/storefront/admin';
	import { seed, useStorefront, type StorefrontContext } from '$lib/storefront/admin-context';
	import { toast } from '$lib/components/admin/toast';

	let {
		onsaved,
		...ctxProps
	}: Partial<StorefrontContext> & { onsaved?: () => void | Promise<void> } = $props();
	const ctx = useStorefront(() => ctxProps);
	const config = $derived(ctx.config);
	const save = (run: Parameters<StorefrontContext['save']>[0]) => ctx.save(run);

	const TIMEZONES = [
		{ value: 'Asia/Kolkata', label: 'India (Kolkata)' },
		{ value: 'Asia/Dubai', label: 'UAE (Dubai)' },
		{ value: 'Asia/Singapore', label: 'Singapore' },
		{ value: 'Europe/London', label: 'UK (London)' },
		{ value: 'America/New_York', label: 'US (New York)' },
		{ value: 'UTC', label: 'UTC' }
	];

	let alwaysOpen = $state(seed(() => ctx.config.hours.always_open));
	let timezone = $state(seed(() => ctx.config.hours.timezone || 'Asia/Kolkata'));
	let schedule = $state<Record<string, string[]>>(
		seed(() =>
			Object.fromEntries(
				Object.entries(ctx.config.hours.schedule ?? {}).map(([day, shifts]) => [
					day,
					[...(shifts as string[])]
				])
			)
		)
	);
	let saving = $state(false);

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
		saving = true;
		const ok = await save(() =>
			storefrontAdminApi.saveHours({
				always_open: alwaysOpen,
				timezone,
				schedule: alwaysOpen ? emptySchedule() : schedule
			})
		);
		saving = false;
		if (ok) {
			toast.success('Opening hours saved');
			await onsaved?.();
		} else toast.error('Could not save your opening hours');
	}
</script>

<form onsubmit={submit}>
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
			<Switch bind:checked={alwaysOpen} label="Always open" hint="Skip the schedule entirely. Useful for a kiosk or a 24-hour kitchen." />

			<FormField label="Timezone" hint="Your hours are evaluated in this timezone, not the customer's.">
				<Select bind:value={timezone} allLabel="" options={TIMEZONES} />
			</FormField>
		</div>
	</div>

	{#if !alwaysOpen}
		<div class="sfctl-section">
			<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:1rem;flex-wrap:wrap;margin-bottom:0.9rem;">
				<div>
					<h2 style="margin:0;">Weekly schedule</h2>
					<p class="sfctl-note" style="margin:0.2rem 0 0;">
						A day with no shifts is closed. Add a second shift for a lunch break.
					</p>
				</div>
				<Select
					inline
					allLabel=""
					ariaLabel="Copy these hours to every day"
					options={DAYS.map((day) => ({ value: day, label: 'Copy ' + DAY_LABELS[day] + ' hours to every day' }))}
					onchange={(day) => day && applyToAll(day)}
				/>
			</div>

			<div class="sfhours">
				{#each DAYS as day (day)}
					<div class="sfhours-row">
						<span class="sfhours-day">{DAY_LABELS[day]}</span>
						<div class="sfhours-shifts">
							{#each shiftsFor(day) as pair, index (index)}
								<span class="sfshift">
									<input
										type="time"
										value={pair[0]}
										aria-label={`${DAY_LABELS[day]} opening time`}
										onchange={(e) =>
											updateShift(day, index, 0, (e.currentTarget as HTMLInputElement).value)}
									/>
									<span aria-hidden="true">–</span>
									<input
										type="time"
										value={pair[1]}
										aria-label={`${DAY_LABELS[day]} closing time`}
										onchange={(e) =>
											updateShift(day, index, 1, (e.currentTarget as HTMLInputElement).value)}
									/>
									<button
										type="button"
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
							onclick={() => addShift(day)}
							aria-label={'Add a shift on ' + DAY_LABELS[day]}
						>
							<Plus size={13} strokeWidth={2.2} /> Shift
						</button>
					</div>
				{/each}
			</div>

			{#if totalShifts === 0}
				<div class="alert alert-warn" style="margin-top:0.9rem;">
					No shifts are set, so the store is treated as always open. A store with no hours
					would be unorderable, which is never what someone means.
				</div>
			{/if}
		</div>
	{/if}

	<div class="sfctl-foot">
		<span class="sfctl-foot-note">
			{alwaysOpen ? 'Always open — no schedule is stored.' : `${totalShifts} shift${totalShifts === 1 ? '' : 's'} set this week.`}
		</span>
		<button class="btn btn-primary" type="submit" disabled={saving}>
			{saving ? 'Saving…' : 'Save opening hours'}
		</button>
	</div>
</form>
