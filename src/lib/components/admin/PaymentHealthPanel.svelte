<script lang="ts">
	/**
	 * What needs a person, at a glance.
	 *
	 * Every row is a count of something that should normally be zero. A row that
	 * is not zero says what it means and what to do, so an operator is never left
	 * decoding a number.
	 */
	import { onMount } from 'svelte';
	import CircleCheck from '@tabler/icons-svelte/icons/circle-check';
	import RefreshCw from '@tabler/icons-svelte/icons/refresh';
	import TriangleAlert from '@tabler/icons-svelte/icons/alert-triangle';
	import { fetchPaymentHealth, type PaymentHealth } from '$lib/admin/paymentsApi';
	import { errorLines } from '$lib/admin/errors';
	import ErrorState from '$lib/components/admin/ErrorState.svelte';
	import Skeleton from '$lib/components/admin/Skeleton.svelte';
	import StatusBadge from '$lib/components/admin/StatusBadge.svelte';

	let health = $state<PaymentHealth | null>(null);
	let loading = $state(true);
	let error = $state('');

	async function load() {
		loading = true;
		error = '';
		try {
			health = await fetchPaymentHealth();
		} catch (err) {
			error = errorLines(err, 'load payment health').detail;
		} finally {
			loading = false;
		}
	}

	onMount(() => void load());

	type Row = { label: string; count: number; hint: string };
	const rows = $derived<Row[]>(
		health
			? [
					{
						label: 'Payments stuck waiting',
						count: health.overdue_pending,
						hint: 'More than 10 minutes past their window. The gateway could not be asked, or has not answered. Check the connection, then reconcile the payment.'
					},
					{
						label: 'Refunds not confirmed',
						count: health.stuck_refunds + health.stuck_refunding,
						hint: 'Accepted by the gateway over an hour ago but never confirmed. Look the refund up in the gateway dashboard.'
					},
					{
						label: 'Wrong-amount payments (24 h)',
						count: health.mismatches_24h,
						hint: 'The gateway reported a different amount than the order. These were not marked paid. Check them in the gateway dashboard.'
					},
					{
						label: 'Double charges (24 h)',
						count: health.duplicates_24h,
						hint: 'A customer paid twice for one order. The extra payment is refunded automatically: confirm it completed.'
					},
					{
						label: 'Callbacks that failed to apply (24 h)',
						count: health.failed_events_24h,
						hint: 'A gateway notification could not be processed. It will be retried; if it keeps failing, check the logs.'
					}
				]
			: []
	);
</script>

<section class="panel" aria-labelledby="pay-health-h">
	<div class="panel-head">
		<div class="head-row">
			<h3 class="panel-h" id="pay-health-h">Payment health</h3>
			<div class="head-actions">
				{#if health}
					<StatusBadge
						status={health.needs_attention ? 'Needs attention' : 'All clear'}
						kind={health.needs_attention ? 'warn' : 'ok'}
					/>
				{/if}
				<button
					class="btn btn-quiet btn-sm"
					type="button"
					onclick={load}
					disabled={loading}
					aria-label="Refresh payment health"
				>
					<RefreshCw size={13} stroke={1.6} />
				</button>
			</div>
		</div>
		<p class="panel-note">
			Everything here should normally be zero. Real-payment activity over the last 24 hours is shown
			underneath.
		</p>
	</div>

	<div class="panel-body">
		{#if loading && !health}
			<Skeleton height="8rem" />
		{:else if error}
			<ErrorState message={error} onretry={load} />
		{:else if health}
			<ul class="rows">
				{#each rows as row (row.label)}
					<li class:bad={row.count > 0}>
						<span class="ico" aria-hidden="true">
							{#if row.count > 0}
								<TriangleAlert size={16} stroke={1.6} />
							{:else}
								<CircleCheck size={16} stroke={1.6} />
							{/if}
						</span>
						<span class="text">
							<span class="label">{row.label}</span>
							{#if row.count > 0}<span class="hint">{row.hint}</span>{/if}
						</span>
						<span class="count" aria-label={`${row.count} ${row.label}`}>{row.count}</span>
					</li>
				{/each}
			</ul>
			<p class="activity">
				<strong>{health.live_paid_24h}</strong>
				real payment{health.live_paid_24h === 1 ? '' : 's'} taken in the last 24 hours, worth
				<strong>₹{Number(health.live_paid_amount_24h).toLocaleString('en-IN')}</strong>.
			</p>
		{/if}
	</div>
</section>

<style>
	.head-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	.head-actions {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
	}

	.rows {
		list-style: none;
		margin: 0;
		padding: 0;
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius);
		overflow: hidden;
	}

	.rows li {
		display: flex;
		align-items: flex-start;
		gap: 0.6rem;
		padding: 0.6rem 0.8rem;
		border-top: 1px solid var(--border-subtle);
		color: var(--text-3);
	}

	.rows li:first-child {
		border-top: 0;
	}

	.rows li .ico {
		display: inline-flex;
		margin-top: 0.05rem;
		color: var(--ok);
	}

	.rows li.bad {
		background: var(--warn-bg);
		color: var(--text-1);
	}

	.rows li.bad .ico {
		color: var(--warn);
	}

	.text {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		flex: 1;
		min-width: 0;
	}

	.label {
		font-size: var(--fs-body);
		font-weight: 550;
	}

	.hint {
		font-size: var(--fs-meta);
		line-height: 1.45;
		color: var(--text-2);
	}

	.count {
		font-variant-numeric: tabular-nums;
		font-weight: 650;
		font-size: var(--fs-body);
	}

	.activity {
		margin: 0.8rem 0 0;
		font-size: var(--fs-tab);
		color: var(--text-2);
	}
</style>
