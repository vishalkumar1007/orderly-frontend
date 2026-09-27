<script lang="ts">
	import { ACCEPTANCE_MODES, PAYMENT_TIMINGS, storefrontAdminApi, type AdminStorefront } from '$lib/storefront/admin';
	import { seed, useStorefront, type StorefrontContext } from '$lib/storefront/admin-context';
	import { toast } from '$lib/components/admin/toast';

	let props: Partial<StorefrontContext> = $props();
	const ctx = useStorefront(() => props);
	const config = $derived(ctx.config);
	const save = (run: Parameters<StorefrontContext['save']>[0]) => ctx.save(run);

	let acceptance = $state(seed(() => ctx.config.workflow.acceptance_mode));
	let timing = $state(seed(() => ctx.config.workflow.payment_requirement));
	let readyNotification = $state(seed(() => ctx.config.workflow.ready_notification));
	let autoComplete = $state(seed(() => ctx.config.workflow.auto_complete));
	let saving = $state(false);

	let dirty = false;
	$effect(() => {
		const w = ctx.config.workflow;
		if (!dirty && w) {
			acceptance = w.acceptance_mode;
			timing = w.payment_requirement;
			readyNotification = w.ready_notification;
			autoComplete = w.auto_complete;
		}
	});

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		saving = true;
		const ok = await save(() =>
			storefrontAdminApi.saveWorkflow({
				acceptance_mode: acceptance,
				payment_requirement: timing,
				ready_notification: readyNotification,
				auto_complete: autoComplete
			})
		);
		saving = false;
		if (ok) toast.success('Order workflow saved');
		else toast.error('Could not save your workflow settings');
	}
</script>

<form onsubmit={submit}>
	<div class="sfctl-section">
		<h2>The pipeline</h2>
		<p class="sfctl-note">Every order moves through these five stages, in this order.</p>
		<ol
			style="margin:0;padding-left:1.4rem;display:grid;gap:0.3rem;color:var(--text-2);font-size:0.875rem;line-height:1.5;"
		>
			<li><strong style="color:var(--text);">Order placed</strong> — the customer has checked out</li>
			<li><strong style="color:var(--text);">Accepted</strong> — the shop has taken it</li>
			<li><strong style="color:var(--text);">Preparing</strong> — the kitchen is on it</li>
			<li><strong style="color:var(--text);">Ready</strong> — waiting for collection</li>
			<li><strong style="color:var(--text);">Completed</strong> — collected</li>
		</ol>
		<p class="field-hint" style="margin-top:0.7rem;">
			An order can be cancelled while it is <em>Order placed</em> or <em>Accepted</em>. After that
			the food is already being made, so it can only be completed. This is enforced on the
			server and cannot be changed from here.
		</p>
	</div>

	<div class="sfctl-section">
		<h2>Acceptance</h2>
		<p class="sfctl-note">Whether a new order waits for you before the kitchen starts.</p>
		<div style="display:grid;gap:0.4rem;">
			{#each ACCEPTANCE_MODES as mode (mode.value)}
				<button
					class="sfopt"
					type="button"
					aria-pressed={acceptance === mode.value}
					onclick={() => (acceptance = mode.value)}
				>
					<span class="sfopt-mark" aria-hidden="true"></span>
					<span class="sfopt-body">
						<span class="sfopt-label">{mode.label}</span>
						<span class="sfopt-hint">{mode.hint}</span>
					</span>
				</button>
			{/each}
		</div>
	</div>

	<div class="sfctl-section">
		<h2>When payment is required</h2>
		<p class="sfctl-note">
			Applies to online payment. Cash at the counter is always settled in person, so it never
			holds the kitchen up.
		</p>
		<div style="display:grid;gap:0.4rem;">
			{#each PAYMENT_TIMINGS as option (option.value)}
				<button
					class="sfopt"
					type="button"
					aria-pressed={timing === option.value}
					onclick={() => (timing = option.value)}
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
			<div class="alert alert-info" style="margin-top:0.9rem;">
				An unpaid online order can still be <strong>Accepted</strong>, but it cannot move to
				<strong>Preparing</strong> until the payment lands. The screen says so instead of
				failing silently.
			</div>
		{/if}
	</div>

	<div class="sfctl-section">
		<h2>Finishing up</h2>
		<div style="display:grid;gap:0.4rem;">
			<button
				class="sfopt"
				type="button"
				aria-pressed={readyNotification}
				onclick={() => (readyNotification = !readyNotification)}
			>
				<span class="sfopt-mark" aria-hidden="true"></span>
				<span class="sfopt-body">
					<span class="sfopt-label">Notify when an order is ready</span>
					<span class="sfopt-hint">
						{readyNotification
							? 'The tracking screen updates the moment you mark an order ready.'
							: 'Customers will still see the tracking screen; it just updates less eagerly.'}
					</span>
				</span>
			</button>
			<button
				class="sfopt"
				type="button"
				aria-pressed={autoComplete}
				onclick={() => (autoComplete = !autoComplete)}
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
			<div class="alert alert-warn" style="margin-top:0.9rem;">
				With this on, <strong>Ready</strong> is never a resting state — an order goes straight
				from preparing to completed. You will not see ready orders waiting on the board.
			</div>
		{/if}
	</div>

	<div class="sfctl-foot">
		<span class="sfctl-foot-note">Changes apply to new orders only.</span>
		<button class="btn btn-primary" type="submit" disabled={saving}>
			{saving ? 'Saving…' : 'Save workflow settings'}
		</button>
	</div>
</form>
