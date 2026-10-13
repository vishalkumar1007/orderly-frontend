<script lang="ts">
	import Lock from '@tabler/icons-svelte/icons/lock';
	import {
		CATEGORY_LABEL,
		type NotificationChannel,
		type NotificationEventDef,
		type NotificationRule
	} from '$lib/admin/notificationTypes';
	import Switch from './Switch.svelte';

	/**
	 * Events down the side, channels across the top: one switch answers "does
	 * this event reach this channel". A rule is really keyed by (event, channel,
	 * audience); `rules` is already filtered to one audience by the caller, so a
	 * cell holds one rule — or none, shown as a dash, when the event never uses
	 * that channel.
	 *
	 * `locked` maps a channel to the reason it is unavailable (the plan name), so
	 * the whole column reads as locked rather than as a row of dead switches.
	 */
	let {
		events,
		rules,
		channels,
		locked = {},
		busyKey = '',
		onchange,
		onrevert,
		onedit,
		editLocked = false
	}: {
		events: NotificationEventDef[];
		rules: NotificationRule[];
		channels: { id: NotificationChannel; label: string }[];
		locked?: Partial<Record<NotificationChannel, string>>;
		busyKey?: string;
		onchange: (rule: NotificationRule, enabled: boolean) => void;
		onrevert?: (rule: NotificationRule) => void;
		/** Adds an "Edit wording" action to each event (customer messages). */
		onedit?: (event: NotificationEventDef) => void;
		/** The action is shown but marked as a plan upgrade. */
		editLocked?: boolean;
	} = $props();

	const key = (r: NotificationRule) => `${r.event_code}:${r.channel}:${r.recipient_policy}`;

	const groups = $derived.by(() => {
		const used = new Set(rules.map((r) => r.event_code));
		const out = new Map<string, NotificationEventDef[]>();
		for (const e of events) {
			if (!used.has(e.code)) continue;
			if (!out.has(e.category)) out.set(e.category, []);
			out.get(e.category)!.push(e);
		}
		return out;
	});

	const cell = (code: string, ch: NotificationChannel) =>
		rules.find((r) => r.event_code === code && r.channel === ch);
</script>

{#if groups.size === 0}
	<p class="muted empty">Nothing to configure here for your business type yet.</p>
{:else}
	<div class="grid-wrap">
		<table class="ecg">
			<thead>
				<tr>
					<th scope="col">Event</th>
					{#each channels as ch (ch.id)}
						<th scope="col" class="ch">
							{ch.label}
							{#if locked[ch.id]}<Lock size={12} stroke={1.6} aria-label="Not in your plan" />{/if}
						</th>
					{/each}
				</tr>
			</thead>
			{#each groups as [category, list] (category)}
				<tbody>
					<tr class="cat">
						<th colspan={channels.length + 1} scope="rowgroup">
							{CATEGORY_LABEL[category as keyof typeof CATEGORY_LABEL] ?? category}
						</th>
					</tr>
					{#each list as ev (ev.code)}
						<tr>
							<th scope="row" class="ev">
								<span>{ev.label}</span>
								<span class="desc">{ev.description}</span>
								{#if onedit}
									<button type="button" class="edit" onclick={() => onedit(ev)}>
										{#if editLocked}<Lock size={11} stroke={1.6} />{/if}
										Edit wording
									</button>
								{/if}
							</th>
							{#each channels as ch (ch.id)}
								{@const rule = cell(ev.code, ch.id)}
								<td class="ch">
									{#if !rule}
										<span class="dash" aria-label="Not available">–</span>
									{:else if locked[ch.id]}
										<span class="dash" title={`Available on the ${locked[ch.id]} plan`}>
											<Lock size={14} stroke={1.6} />
										</span>
									{:else if rule.locked}
										<span class="req" title="A required alert; it cannot be turned off">Required</span>
									{:else}
										<Switch
											checked={rule.enabled}
											label=""
											disabled={busyKey === key(rule)}
											onchange={(v) => onchange(rule, v)}
										/>
										{#if rule.overridden && onrevert}
											<button type="button" class="btn btn-quiet btn-sm" onclick={() => onrevert(rule)}>
												Reset
											</button>
										{/if}
									{/if}
								</td>
							{/each}
						</tr>
					{/each}
				</tbody>
			{/each}
		</table>
	</div>
{/if}

<style>
	.empty {
		padding: 1rem 0;
	}

	.grid-wrap {
		overflow-x: auto;
		border: 1px solid var(--border);
		border-radius: var(--radius);
	}

	.ecg {
		width: 100%;
		border-collapse: collapse;
		background: var(--card-bg);
	}

	.ecg th,
	.ecg td {
		padding: 0.55rem 0.85rem;
		text-align: left;
		border-top: 1px solid var(--border-subtle);
		vertical-align: middle;
	}

	.ecg thead th {
		border-top: none;
		font-size: var(--fs-code);
		font-weight: 600;
		color: var(--text-3);
	}

	.ecg .ch {
		text-align: center;
		width: 7rem;
		white-space: nowrap;
	}

	.ecg .cat th {
		background: var(--surface-sunken);
		font-size: var(--fs-code);
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--text-3);
	}

	.ev {
		font-weight: 500;
	}

	.ev span {
		display: block;
	}

	.desc {
		font-size: var(--fs-code);
		font-weight: 400;
		color: var(--text-3);
	}

	.edit {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		margin-top: 0.2rem;
		padding: 0;
		border: 0;
		background: none;
		font-size: var(--fs-code);
		color: var(--accent, var(--text-2));
		cursor: pointer;
	}

	.edit:hover {
		text-decoration: underline;
	}

	.dash {
		color: var(--text-3);
	}

	.req {
		font-size: var(--fs-code);
		color: var(--text-3);
	}
</style>
