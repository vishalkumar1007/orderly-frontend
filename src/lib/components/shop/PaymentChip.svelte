<script lang="ts">
	/**
	 * One way to say "how is this order paid, and has the money arrived?".
	 *
	 * Used on every staff order surface so the same payment reads the same
	 * everywhere: cash due vs paid, online awaiting / paid / failed / refunded,
	 * and a TEST marker when the money went through the dummy gateway and nobody
	 * was charged.
	 */
	type Payment = {
		method: string;
		status: string;
		is_test?: boolean;
		refund_status?: string;
	};

	let { payment }: { payment: Payment } = $props();

	type Tone = 'ok' | 'warn' | 'danger' | 'neutral';

	const view = $derived.by((): { label: string; tone: Tone } => {
		const cash = payment.method === 'CASH';
		switch (payment.status) {
			case 'PAID':
				return { label: cash ? 'Cash received' : 'Paid online', tone: 'ok' };
			case 'PENDING':
				return { label: cash ? 'Cash due' : 'Awaiting payment', tone: 'warn' };
			case 'FAILED':
				return { label: 'Payment failed', tone: 'danger' };
			case 'EXPIRED':
				return { label: 'Payment expired', tone: 'neutral' };
			case 'REFUNDING':
				return { label: 'Refunding', tone: 'warn' };
			case 'REFUNDED':
				return { label: 'Refunded', tone: 'neutral' };
			case 'CANCELLED':
				return { label: 'Cancelled', tone: 'neutral' };
			default:
				return { label: payment.status || 'No payment', tone: 'neutral' };
		}
	});
</script>

<span class="pchip">
	<span class={`badge badge-${view.tone} badge-plain`}>{view.label}</span>
	{#if payment.is_test}
		<span class="pchip-test" title="Dummy payment: nobody was charged">TEST</span>
	{/if}
</span>

<style>
	.pchip {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		vertical-align: middle;
	}

	.pchip-test {
		padding: 0.05rem 0.4rem;
		border-radius: 999px;
		border: 1px solid color-mix(in srgb, var(--warn) 40%, var(--border));
		background: var(--warn-bg);
		color: var(--warn);
		font-size: var(--fs-micro);
		font-weight: 700;
		letter-spacing: 0.04em;
	}
</style>
