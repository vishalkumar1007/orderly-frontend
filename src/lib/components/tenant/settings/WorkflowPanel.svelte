<script lang="ts">
	import {
		ACCEPTANCE_MODES,
		PAYMENT_TIMINGS,
		storefrontAdminApi
	} from '$lib/storefront/admin';
	import { seed, useStorefront, type StorefrontContext } from '$lib/storefront/admin-context';
	import SettingsSection from '$lib/components/admin/SettingsSection.svelte';
	import { toast } from '$lib/components/admin/toast';
	import { configHref } from '$lib/tenant/configuration';

	/**
	 * Order workflow.
	 *
	 * The five stages are fixed on the server; these settings tune what happens
	 * around them. What a customer is *told* along the way belongs to
	 * Notifications: one setting, one home, so neither screen can quietly
	 * overwrite the other's idea of the document.
	 */
	let props: Partial<StorefrontContext> = $props();
	const ctx = useStorefront(() => props);

	let acceptance = $state(seed(() => ctx.config.workflow.acceptance_mode));
	let timing = $state(seed(() => ctx.config.workflow.payment_requirement));
	let autoComplete = $state(seed(() => ctx.config.workflow.auto_complete));
	let saving = $state(false);
	let justSaved = $state(false);

	/**
	 * Re-seed from the server until the first edit.
	 *
	 * The shell replaces the document after every successful write anywhere in
	 * Settings, and this panel may not have been open when that happened. After
	 * someone starts editing, their unsaved work wins.
	 */
	let dirty = $state(false);
	$effect(() => {
		const w = ctx.config.workflow;
		if (!dirty && w) {
			acceptance = w.acceptance_mode;
			timing = w.payment_requirement;
			autoComplete = w.auto_complete;
		}
	});

	function reset() {
		dirty = false;
		const w = ctx.config.workflow;
		acceptance = w.acceptance_mode;
		timing = w.payment_requirement;
		autoComplete = w.auto_complete;
	}

	async function submit() {
		saving = true;
		const ok = await ctx.save(() =>
			storefrontAdminApi.saveWorkflow({
				acceptance_mode: acceptance,
				payment_requirement: timing,
				auto_complete: autoComplete
			})
		);
		saving = false;
		if (!ok) {
			toast.error('Could not save your workflow settings');
			return;
		}
		dirty = false;
		justSaved = true;
		setTimeout(() => (justSaved = false), 2500);
	}
</script>

<div class="workflow">
	<SettingsSection
		title="The pipeline"
		description="Every order moves through these five stages, in this order. An order can be cancelled while it is Order placed or Accepted; after that the food is already being made, so it can only be completed. This is enforced on the server."
	>
		<ol class="wf-stages">
			<li><strong>Order placed</strong>: the customer has checked out</li>
			<li><strong>Accepted</strong>: the shop has taken it</li>
			<li><strong>Preparing</strong>: the kitchen is on it</li>
			<li><strong>Ready</strong>: waiting for collection</li>
			<li><strong>Completed</strong>: collected</li>
		</ol>
	</SettingsSection>

	<SettingsSection
		title="Acceptance"
		description="Whether a new order waits for you before the kitchen starts."
	>
		<div class="wf-options">
			{#each ACCEPTANCE_MODES as mode (mode.value)}
				<button
					class="sfopt"
					type="button"
					aria-pressed={acceptance === mode.value}
					onclick={() => {
						acceptance = mode.value;
						dirty = true;
					}}
				>
					<span class="sfopt-mark" aria-hidden="true"></span>
					<span class="sfopt-body">
						<span class="sfopt-label">{mode.label}</span>
						<span class="sfopt-hint">{mode.hint}</span>
					</span>
				</button>
			{/each}
		</div>
	</SettingsSection>

	<SettingsSection
		title="When payment is required"
		description="Applies to online payment. Cash at the counter is always settled in person, so it never holds the kitchen up."
	>
		<div class="wf-options">
			{#each PAYMENT_TIMINGS as option (option.value)}
				<button
					class="sfopt"
					type="button"
					aria-pressed={timing === option.value}
					onclick={() => {
						timing = option.value;
						dirty = true;
					}}
				>
					<span class="sfopt-mark" aria-hidden="true"></span>
					<span class="sfopt-body">
						<span class="sfopt-label">{option.label}</span>
						<span class="sfopt-hint">{option.hint}</span>
					</span>
				</button>
			{/each}
		</div>
		{#if timing === 'BEFORE_PREPARATION'}
			<div class="alert alert-info">
				An unpaid online order can still be <strong>Accepted</strong>, but it cannot move to
				<strong>Preparing</strong> until the payment lands. The screen says so instead of failing
				silently.
			</div>
		{/if}
		<p class="field-hint">
			Which methods you accept is set under <a href={configHref('payments')}>Configuration, Payments</a>.
		</p>
	</SettingsSection>

	<SettingsSection
		title="Finishing up"
		description="Changes apply to new orders only."
		{dirty}
		{saving}
		saved={justSaved}
		saveLabel="Save workflow settings"
		onsave={submit}
		onreset={reset}
	>
		<div class="wf-options">
			<button
				class="sfopt"
				type="button"
				aria-pressed={autoComplete}
				onclick={() => {
					autoComplete = !autoComplete;
					dirty = true;
				}}
			>
				<span class="sfopt-mark" aria-hidden="true"></span>
				<span class="sfopt-body">
					<span class="sfopt-label">Auto-complete when ready</span>
					<span class="sfopt-hint">
						{autoComplete
							? 'Marking an order ready also closes it. Good when you do not track the pickup counter.'
							: 'You confirm collection yourself, so you keep a record of when food left.'}
					</span>
				</span>
			</button>
		</div>
		{#if autoComplete}
			<div class="alert alert-warn">
				With this on, <strong>Ready</strong> is never a resting state: an order goes straight from
				preparing to completed. You will not see ready orders waiting on the board.
			</div>
		{/if}
		<p class="field-hint">
			What the customer is told as their order moves is set under
			<a href={configHref('notifications')}>Configuration, Notifications</a>.
		</p>
	</SettingsSection>
</div>

<style>
	.workflow {
		display: flex;
		flex-direction: column;
		gap: var(--sp-11);
	}

	.wf-options {
		display: grid;
		gap: 0.4rem;
	}

	.wf-stages {
		margin: 0;
		padding-left: 1.4rem;
		display: grid;
		gap: 0.3rem;
		color: var(--text-2);
		font-size: var(--fs-body);
		line-height: 1.5;
	}

	.wf-stages strong {
		color: var(--text);
	}

	.field-hint {
		margin: 0;
	}
</style>
