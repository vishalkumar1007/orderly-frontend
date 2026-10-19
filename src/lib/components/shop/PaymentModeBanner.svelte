<script lang="ts">
	/**
	 * Which payments this shop's customers are actually using right now.
	 *
	 * Read-only on purpose: only the platform's Super Admin switches a business
	 * between dummy and real payments, so the owner is told the state and, when
	 * there is something for them to do (gateway keys), pointed at it.
	 */
	import { onMount } from 'svelte';
	import FlaskConical from '@tabler/icons-svelte/icons/flask';
	import BadgeCheck from '@tabler/icons-svelte/icons/rosette-discount-check';
	import TriangleAlert from '@tabler/icons-svelte/icons/alert-triangle';
	import { fetchOwnPaymentMode, type OwnPaymentMode } from '$lib/admin/paymentsApi';

	let mode = $state<OwnPaymentMode | null>(null);

	onMount(async () => {
		// Informational only: if it cannot load, the page simply has no banner.
		mode = await fetchOwnPaymentMode().catch(() => null);
	});
</script>

{#if mode}
	{#if mode.is_test}
		<div class="pm pm-test" role="status">
			<span class="pm-ico"><FlaskConical size={17} stroke={1.6} /></span>
			<div>
				<strong>Test mode: nobody is charged</strong>
				<p>
					Customers who choose online payment get a dummy checkout. Those orders are marked TEST
					and left out of revenue. Cash at pickup works as normal.
				</p>
			</div>
		</div>
	{:else if mode.online_ready}
		<div class="pm pm-live" role="status">
			<span class="pm-ico"><BadgeCheck size={17} stroke={1.6} /></span>
			<div>
				<strong>Live: real payments</strong>
				<p>Customers who pay online are charged through your payment gateway.</p>
			</div>
		</div>
	{:else}
		<div class="pm pm-warn" role="status">
			<span class="pm-ico"><TriangleAlert size={17} stroke={1.6} /></span>
			<div>
				<strong>Online payment is paused</strong>
				<p>
					Your shop is set to real payments, but the gateway is not ready, so customers can only
					pay at pickup. Check your keys under
					<a href="/shop/settings?section=integrations&service=PAYMENTS">Settings → Integrations → Payments</a>,
					or contact support.
				</p>
			</div>
		</div>
	{/if}
{/if}

<style>
	.pm {
		display: flex;
		align-items: flex-start;
		gap: 0.7rem;
		margin: 0 0 1rem;
		padding: 0.8rem 0.95rem;
		border: 1px solid var(--border);
		border-radius: var(--radius);
	}

	.pm strong {
		font-size: var(--fs-body);
		font-weight: 650;
	}

	.pm p {
		margin: 0.15rem 0 0;
		font-size: var(--fs-tab);
		line-height: 1.5;
		color: var(--text-2);
	}

	.pm a {
		color: var(--accent-dark);
		font-weight: 600;
	}

	.pm-ico {
		display: inline-flex;
		margin-top: 0.1rem;
	}

	.pm-test {
		background: var(--warn-bg);
		border-color: color-mix(in srgb, var(--warn) 30%, var(--border));
	}

	.pm-test .pm-ico,
	.pm-test strong {
		color: var(--warn);
	}

	.pm-live {
		background: color-mix(in srgb, var(--ok) 9%, var(--surface));
		border-color: color-mix(in srgb, var(--ok) 30%, var(--border));
	}

	.pm-live .pm-ico,
	.pm-live strong {
		color: var(--ok);
	}

	.pm-warn {
		background: var(--danger-bg);
		border-color: color-mix(in srgb, var(--danger) 30%, var(--border));
	}

	.pm-warn .pm-ico,
	.pm-warn strong {
		color: var(--danger);
	}
</style>
