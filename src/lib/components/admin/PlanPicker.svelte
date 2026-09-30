<script lang="ts">
	import Check from '@lucide/svelte/icons/check';
	import Sparkles from '@lucide/svelte/icons/sparkles';
	import type { PlanOption } from '$lib/admin/types';

	let {
		plans = [] as PlanOption[],
		value = $bindable(''),
		defaultCode = '',
		disabled = false
	}: {
		plans?: PlanOption[];
		value?: string;
		/** Platform setting `platform.default_plan`, badged in the UI. */
		defaultCode?: string;
		disabled?: boolean;
	} = $props();

	function limits(p: PlanOption): string[] {
		const out: string[] = [];
		if (p.maxStaff != null) out.push(`${p.maxStaff} staff`);
		if (p.maxProducts != null) out.push(`${p.maxProducts} products`);
		// A trial is a limit like any other: it is how long this plan lasts.
		if (p.trialDays > 0) out.push(`${p.trialDays}-day trial`);
		return out;
	}

	/** How the price reads. A plan that only exists as a trial has no period. */
	function period(p: PlanOption): string {
		switch (p.billingPeriod) {
			case 'monthly':
				return '/month';
			case 'yearly':
				return '/year';
			case 'trial':
				return 'trial';
			default:
				return '';
		}
	}
</script>

{#if plans.length === 0}
	<p class="muted" style="font-size:var(--fs-body);margin:0;">
		No plan is on offer. Create or activate one under
		<a href="/superadmin/plans" style="color:var(--accent-dark);">Plans &amp; subscriptions</a>.
	</p>
{:else}
	<div class="plan-grid" role="radiogroup" aria-label="Plan">
		{#each plans as plan (plan.id)}
			{@const selected = value === plan.code}
			<button
				type="button"
				class={['plan-option', selected ? 'selected' : ''].join(' ')}
				role="radio"
				aria-checked={selected}
				{disabled}
				onclick={() => (value = plan.code)}
			>
				<div class="plan-option-head">
					<span class="plan-option-name">{plan.label}</span>
					{#if plan.code === defaultCode}
						<span class="plan-tag">
							<Sparkles size={10} strokeWidth={2.4} />
							Default
						</span>
					{/if}
					{#if selected}
						<span class="plan-check" aria-hidden="true"><Check size={12} strokeWidth={3} /></span>
					{/if}
				</div>

				<div class="plan-price">
					{#if plan.price === 0}
						<span class="plan-amount">Free</span>
					{:else}
						<span class="plan-amount">₹{plan.price.toLocaleString('en-IN')}</span>
						<span class="plan-per">{period(plan)}</span>
					{/if}
				</div>

				{#if plan.description}
					<p class="plan-desc">{plan.description}</p>
				{/if}

				{#if limits(plan).length}
					<ul class="plan-limits">
						{#each limits(plan) as l (l)}
							<li>{l}</li>
						{/each}
					</ul>
				{/if}

				{#if plan.features.length > 0}
					<ul class="plan-features">
						{#each plan.features.slice(0, 3) as feature (feature)}
							<li>{feature}</li>
						{/each}
						{#if plan.features.length > 3}
							<li class="more">+{plan.features.length - 3} more</li>
						{/if}
					</ul>
				{/if}
			</button>
		{/each}
	</div>
{/if}

<style>
	.plan-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr));
		gap: 0.6rem;
	}

	.plan-option {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		padding: 0.85rem 0.9rem;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface);
		color: var(--text);
		font-family: inherit;
		text-align: left;
		cursor: pointer;
		transition: border-color 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
	}

	.plan-option:hover:not(:disabled) {
		border-color: color-mix(in srgb, var(--accent) 40%, var(--border));
	}

	.plan-option.selected {
		border-color: var(--accent);
		background: color-mix(in srgb, var(--accent) 5%, var(--surface));
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 14%, transparent);
	}

	.plan-option:disabled {
		opacity: 0.55;
		cursor: not-allowed;
	}

	.plan-option-head {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}

	.plan-option-name {
		font-size: var(--fs-body);
		font-weight: 650;
		letter-spacing: -0.01em;
	}

	.plan-tag {
		display: inline-flex;
		align-items: center;
		gap: 0.2rem;
		padding: 0.1rem 0.35rem;
		border-radius: 4px;
		background: var(--surface-3);
		color: var(--text-3);
		font-size: var(--fs-micro);
		font-weight: 650;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	.plan-check {
		margin-left: auto;
		width: 1.15rem;
		height: 1.15rem;
		flex-shrink: 0;
		display: grid;
		place-items: center;
		border-radius: 999px;
		background: var(--accent);
		color: var(--on-accent);
	}

	.plan-price {
		display: flex;
		align-items: baseline;
		gap: 0.25rem;
	}

	.plan-amount {
		font-family: var(--font-display);
		font-size: var(--fs-h1);
		font-weight: 700;
		letter-spacing: -0.02em;
		line-height: 1.1;
	}

	.plan-per {
		font-size: var(--fs-code);
		color: var(--text-3);
	}

	.plan-desc {
		margin: 0;
		font-size: var(--fs-code);
		line-height: 1.45;
		color: var(--text-3);
	}

	.plan-limits {
		list-style: none;
		margin: 0.15rem 0 0;
		padding: 0;
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
	}

	.plan-limits li {
		padding: 0.1rem 0.35rem;
		border-radius: 4px;
		background: var(--surface-3);
		color: var(--text-2);
		font-size: var(--fs-label);
		font-weight: 550;
	}

	.plan-features {
		list-style: none;
		margin: 0.35rem 0 0;
		padding: 0;
		display: grid;
		gap: 0.18rem;
	}

	.plan-features li {
		position: relative;
		padding-left: 0.8rem;
		font-size: var(--fs-meta);
		line-height: 1.4;
		color: var(--text-2);
	}

	.plan-features li::before {
		content: '';
		position: absolute;
		left: 0.15rem;
		top: 0.45rem;
		width: 0.25rem;
		height: 0.25rem;
		border-radius: 999px;
		background: var(--success);
	}

	.plan-features li.more {
		color: var(--text-3);
	}

	.plan-features li.more::before {
		background: var(--text-3);
	}
</style>
