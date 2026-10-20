<script lang="ts">
	import { friendlyError, storefrontApi, type StoreSlot } from '$lib/storefront/api';
	import { clockIn, dateStrip, groupSlots } from '$lib/storefront/booking';

	/**
	 * Choose a day, then a time. Days come from the business's calendar, and
	 * times from the server's slot engine, so everything offered is bookable
	 * at the moment it is shown. Booking re-checks it anyway.
	 */
	let {
		serviceId,
		staffId = '',
		timezone,
		days = 14,
		date = $bindable(''),
		selected = '',
		reload = 0,
		onpick
	}: {
		serviceId: string;
		/** '' offers every staff member's times. */
		staffId?: string;
		timezone: string;
		days?: number;
		date?: string;
		/** The chosen start, highlighted. */
		selected?: string;
		/** Bump to fetch the day's times again, e.g. after one was taken. */
		reload?: number;
		onpick: (slot: StoreSlot) => void;
	} = $props();

	const strip = $derived(dateStrip(timezone, days));
	let slots = $state<StoreSlot[]>([]);
	let loading = $state(false);
	let error = $state('');

	$effect.pre(() => {
		if (!date) date = strip[0]?.date ?? '';
	});

	$effect(() => {
		const d = date;
		const s = staffId;
		void reload;
		if (!d) return;
		let cancelled = false;
		loading = true;
		error = '';
		storefrontApi
			.slots(serviceId, d, s)
			.then((res) => {
				if (!cancelled) slots = res.slots;
			})
			.catch((err) => {
				if (!cancelled) {
					slots = [];
					error = friendlyError(err, 'Could not load times. Try again.');
				}
			})
			.finally(() => {
				if (!cancelled) loading = false;
			});
		return () => {
			cancelled = true;
		};
	});

	const groups = $derived(groupSlots(slots, timezone));
	const dayName = $derived(strip.find((d) => d.date === date)?.weekday ?? 'this day');
	const nextDay = $derived(strip[strip.findIndex((d) => d.date === date) + 1]);
</script>

<div class="sp">
	<div class="sp-days" role="radiogroup" aria-label="Day">
		{#each strip as d (d.date)}
			<button
				type="button"
				role="radio"
				aria-checked={d.date === date}
				onclick={() => (date = d.date)}
			>
				<span class="sp-wd">{d.weekday}</span>
				<span class="sp-d">{d.day}</span>
				<span class="sp-m">{d.month}</span>
			</button>
		{/each}
	</div>

	<div class="sp-times" aria-live="polite" aria-busy={loading}>
		{#if loading && !slots.length}
			<div class="sp-skeleton" aria-hidden="true">
				{#each Array.from({ length: 8 }) as _, i (i)}<span></span>{/each}
			</div>
		{:else if error}
			<p class="sp-note">{error}</p>
		{:else if !groups.length}
			<p class="sp-note">
				No free times {dayName === 'Today' || dayName === 'Tomorrow' ? dayName.toLowerCase() : `on ${dayName}`}.
				{#if nextDay}
					<button type="button" onclick={() => (date = nextDay.date)}>Try {nextDay.weekday === 'Tomorrow' ? 'tomorrow' : nextDay.weekday}</button>
				{/if}
			</p>
		{:else}
			{#each groups as g (g.label)}
				<div class="sp-group">
					<h4>{g.label}</h4>
					<div class="sp-grid" role="radiogroup" aria-label="{g.label} times">
						{#each g.slots as s (s.start + s.staff_id)}
							<button
								type="button"
								role="radio"
								aria-checked={s.start === selected}
								onclick={() => onpick(s)}
							>
								{clockIn(timezone, s.start)}
							</button>
						{/each}
					</div>
				</div>
			{/each}
		{/if}
	</div>
</div>

<style>
	.sp {
		--sp-tint: color-mix(in srgb, var(--sf-primary) 14%, var(--sf-surface));
	}
	.sp-days {
		display: flex;
		gap: 8px;
		margin: 0 calc(var(--sh-gutter, 16px) * -1);
		padding: 2px var(--sh-gutter, 16px) 6px;
		overflow-x: auto;
		scrollbar-width: none;
	}
	.sp-days::-webkit-scrollbar {
		display: none;
	}
	.sp-days button {
		flex: none;
		display: grid;
		justify-items: center;
		gap: 1px;
		width: 64px;
		padding: 8px 0;
		border: 1px solid var(--sf-border);
		border-radius: var(--sf-radius-sm);
		background: var(--sf-surface);
		color: var(--sf-text);
		font: inherit;
		cursor: pointer;
	}
	.sp-days button[aria-checked='true'] {
		border-color: var(--sf-primary);
		background: var(--sp-tint);
	}
	.sp-wd {
		font-size: 12px;
		color: var(--sf-text-2);
	}
	.sp-d {
		font-size: 19px;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}
	.sp-m {
		font-size: 12px;
		color: var(--sf-text-3);
	}
	.sp-times {
		margin-top: 16px;
		min-height: 120px;
	}
	.sp-group + .sp-group {
		margin-top: 16px;
	}
	.sp-group h4 {
		margin: 0 0 8px;
		font-size: 13.5px;
		font-weight: 600;
		color: var(--sf-text-2);
	}
	.sp-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(92px, 1fr));
		gap: 8px;
	}
	.sp-grid button {
		height: 42px;
		border: 1px solid var(--sf-border-strong);
		border-radius: var(--sf-radius-sm);
		background: var(--sf-surface);
		color: var(--sf-text);
		font: inherit;
		font-size: 14.5px;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		cursor: pointer;
	}
	.sp-grid button:hover {
		border-color: var(--sf-primary);
	}
	.sp-grid button[aria-checked='true'] {
		border-color: var(--sf-primary);
		background: var(--sf-primary);
		color: var(--sf-primary-ink);
	}
	.sp-days button:focus-visible,
	.sp-grid button:focus-visible,
	.sp-note button:focus-visible {
		outline: 2px solid var(--sf-primary);
		outline-offset: 2px;
	}
	.sp-note {
		margin: 0;
		color: var(--sf-text-2);
	}
	.sp-note button {
		margin-left: 4px;
		padding: 0;
		border: 0;
		background: none;
		color: var(--sf-primary);
		font: inherit;
		font-weight: 600;
		cursor: pointer;
	}
	.sp-skeleton {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(92px, 1fr));
		gap: 8px;
	}
	.sp-skeleton span {
		height: 42px;
		border-radius: var(--sf-radius-sm);
		background: var(--sf-surface-2);
	}
</style>
