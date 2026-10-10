<script lang="ts">
	import {
		CATEGORY_LABEL,
		CHANNEL_LABEL,
		type NotificationEventDef,
		type NotificationRule
	} from '$lib/admin/notificationTypes';
	import StatusBadge from './StatusBadge.svelte';
	import Switch from './Switch.svelte';

	/**
	 * One row per rule, grouped by the event's category. Not a literal
	 * event-by-channel grid: a rule is keyed by (event, channel, audience),
	 * and the handful of events with two audiences for the same channel
	 * (rare) just render as two rows rather than forcing a cell to hold more
	 * than one state. Simpler to read and to implement correctly.
	 *
	 * `rules` should already be filtered to one audience bucket by the
	 * caller (e.g. "not CUSTOMER" for Admin Notifications, "CUSTOMER" for
	 * Storefront) — see isCustomerFacing in notificationTypes.ts.
	 */
	let {
		events,
		rules,
		busyKey = '',
		onchange,
		onrevert
	}: {
		events: NotificationEventDef[];
		rules: NotificationRule[];
		/** The `event_code:channel:recipient_policy` key currently saving. */
		busyKey?: string;
		onchange: (rule: NotificationRule, enabled: boolean) => void;
		/** Omit to hide the revert-to-inherited action (e.g. on a read-only view). */
		onrevert?: (rule: NotificationRule) => void;
	} = $props();

	const eventLabel = (code: string) => events.find((e) => e.code === code)?.label ?? code;

	const ruleKey = (r: NotificationRule) => `${r.event_code}:${r.channel}:${r.recipient_policy}`;

	const grouped = $derived.by(() => {
		const byEvent = new Set(events.map((e) => e.code));
		const visible = rules.filter((r) => byEvent.has(r.event_code));
		const groups = new Map<string, NotificationRule[]>();
		for (const r of visible) {
			const ev = events.find((e) => e.code === r.event_code);
			const cat = ev?.category ?? 'PLATFORM';
			if (!groups.has(cat)) groups.set(cat, []);
			groups.get(cat)!.push(r);
		}
		return groups;
	});
</script>

{#if grouped.size === 0}
	<p class="erm-empty muted">No events apply to this business yet.</p>
{:else}
	{#each grouped as [category, rows] (category)}
		<div class="erm-group">
			<h4 class="erm-group-h">{CATEGORY_LABEL[category as keyof typeof CATEGORY_LABEL] ?? category}</h4>
			<ul class="erm-rows">
				{#each rows as rule (ruleKey(rule))}
					<li class="erm-row">
						<div class="erm-main">
							<strong>{eventLabel(rule.event_code)}</strong>
							<span class="erm-meta">
								{CHANNEL_LABEL[rule.channel]} · {rule.recipient_policy}
							</span>
						</div>
						<div class="erm-end">
							{#if rule.locked}
								<StatusBadge status="Required" kind="accent" />
							{:else}
								<Switch
									checked={rule.enabled}
									label=""
									disabled={busyKey === ruleKey(rule)}
									onchange={(v) => onchange(rule, v)}
								/>
							{/if}
							{#if rule.overridden && !rule.locked}
								<StatusBadge status="Custom" kind="neutral" />
								{#if onrevert}
									<button type="button" class="btn btn-quiet btn-sm" onclick={() => onrevert(rule)}>
										Revert
									</button>
								{/if}
							{/if}
						</div>
					</li>
				{/each}
			</ul>
		</div>
	{/each}
{/if}

<style>
	.erm-empty {
		padding: 1.2rem 0;
		text-align: center;
	}

	.erm-group {
		margin-bottom: 1.1rem;
	}

	.erm-group:last-child {
		margin-bottom: 0;
	}

	.erm-group-h {
		margin: 0 0 0.35rem;
		font-size: var(--fs-code);
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--text-3);
	}

	.erm-rows {
		list-style: none;
		margin: 0;
		padding: 0;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		overflow: hidden;
	}

	.erm-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		padding: 0.6rem 0.85rem;
		border-top: 1px solid var(--border-subtle);
		background: var(--surface-1);
	}

	.erm-row:first-child {
		border-top: none;
	}

	.erm-main {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
		min-width: 0;
	}

	.erm-meta {
		font-size: var(--fs-code);
		color: var(--text-3);
	}

	.erm-end {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-shrink: 0;
	}
</style>
