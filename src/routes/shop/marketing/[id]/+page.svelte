<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import ConfirmDialog from '$lib/components/admin/ConfirmDialog.svelte';
	import StatCard from '$lib/components/admin/StatCard.svelte';
	import StatGrid from '$lib/components/admin/StatGrid.svelte';
	import StatusBadge from '$lib/components/admin/StatusBadge.svelte';
	import { toast } from '$lib/components/admin/toast';
	import { formatDateTime, formatRelative } from '$lib/admin/format';
	import { marketingApi, statusBadge, type CampaignDetail } from '$lib/tenant/marketingApi';

	/**
	 * One campaign: where it is, what it reached, and the actions its state
	 * allows. Polls while the worker is sending so the counters move.
	 */

	const id = $derived($page.params.id ?? '');
	let c = $state<CampaignDetail | null>(null);
	let error = $state('');
	let busy = $state('');

	async function load() {
		try {
			c = await marketingApi.campaign(id);
			error = '';
		} catch (err) {
			error = err instanceof Error ? err.message : 'Could not load the campaign';
		}
	}

	const live = $derived(c ? ['SCHEDULED', 'QUEUED', 'RUNNING'].includes(c.status) : false);

	onMount(() => {
		void load();
		const timer = setInterval(() => {
			if (live) void load();
		}, 5000);
		return () => clearInterval(timer);
	});

	async function act(action: 'pause' | 'resume' | 'cancel' | 'unschedule') {
		busy = action;
		try {
			await marketingApi.action(id, action);
			toast.success({ pause: 'Paused', resume: 'Resumed', cancel: 'Cancelled', unschedule: 'Back to draft' }[action]);
			await load();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Could not update');
		} finally {
			busy = '';
		}
	}

	let cancelOpen = $state(false);
	let deleteOpen = $state(false);

	async function remove() {
		try {
			await marketingApi.remove(id);
			toast.success('Draft deleted');
			await goto('/shop/marketing');
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Could not delete');
		}
	}

	const badge = $derived(c ? statusBadge(c.status) : null);
	const progress = $derived(
		c && c.total_count > 0 ? Math.round(((c.sent_count + c.failed_count + c.skipped_count) / c.total_count) * 100) : 0
	);

	function recipientBadge(s: string): { label: string; kind: 'ok' | 'warn' | 'danger' | 'neutral' | 'accent' } {
		switch (s) {
			case 'SENT':
				return { label: 'Sent', kind: 'ok' };
			case 'DELIVERED':
				return { label: 'Delivered', kind: 'ok' };
			case 'READ':
				return { label: 'Read', kind: 'ok' };
			case 'FAILED':
				return { label: 'Failed', kind: 'danger' };
			case 'SKIPPED':
				return { label: 'Skipped', kind: 'neutral' };
			case 'RETRYING':
				return { label: 'Retrying', kind: 'warn' };
			default:
				return { label: 'Queued', kind: 'accent' };
		}
	}
</script>

<div class="cmp">
	{#if error}
		<div class="panel cmp-error" role="alert">
			<strong>Could not load the campaign.</strong>
			<span class="muted">{error}</span>
			<button type="button" class="btn btn-ghost btn-sm" onclick={load}>Try again</button>
		</div>
	{:else if !c}
		<p class="muted">Loading…</p>
	{:else}
		<header class="cmp-head">
			<div class="cmp-title">
				<a class="muted cmp-back" href="/shop/marketing">Marketing</a>
				<h1>{c.name}</h1>
				<p class="muted">
					{c.channel === 'EMAIL' ? 'Email' : c.channel === 'SMS' ? 'SMS' : 'WhatsApp'}
					{#if c.kind === 'AUTOMATION'}· Automation{:else}· {c.audience_label} · {c.goal_label}{/if}
					{#if c.offer_code}· offer {c.offer_code}{/if}
					{#if c.created_by && c.kind !== 'AUTOMATION'}· by {c.created_by}{/if}
				</p>
			</div>
			<div class="cmp-actions">
				{#if badge}<StatusBadge status={badge.label} kind={badge.kind} />{/if}
				{#if c.status === 'DRAFT'}
					<a class="btn btn-primary" href={`/shop/marketing/new?id=${c.id}`}>Continue editing</a>
					<button type="button" class="btn btn-ghost" onclick={() => (deleteOpen = true)}>Delete</button>
				{:else if c.status === 'SCHEDULED'}
					<button type="button" class="btn btn-ghost" disabled={busy !== ''} onclick={() => act('unschedule')}>Back to draft</button>
					<button type="button" class="btn btn-ghost" disabled={busy !== ''} onclick={() => act('pause')}>Pause</button>
					<button type="button" class="btn btn-danger" disabled={busy !== ''} onclick={() => (cancelOpen = true)}>Cancel</button>
				{:else if c.status === 'QUEUED' || c.status === 'RUNNING'}
					<button type="button" class="btn btn-ghost" disabled={busy !== ''} onclick={() => act('pause')}>Pause</button>
					<button type="button" class="btn btn-danger" disabled={busy !== ''} onclick={() => (cancelOpen = true)}>Cancel</button>
				{:else if c.status === 'PAUSED'}
					<button type="button" class="btn btn-primary" disabled={busy !== ''} onclick={() => act('resume')}>Resume</button>
					<button type="button" class="btn btn-danger" disabled={busy !== ''} onclick={() => (cancelOpen = true)}>Cancel</button>
				{/if}
			</div>
		</header>

		{#if c.status_reason}
			<div class="panel cmp-note" role="status">{c.status_reason}</div>
		{/if}
		{#if c.status === 'SCHEDULED' && c.scheduled_at}
			<div class="panel cmp-note" role="status">
				Sends {formatRelative(c.scheduled_at)} ({formatDateTime(c.scheduled_at)}).
			</div>
		{/if}

		<StatGrid>
			<StatCard label="Recipients" value={c.total_count} hint={c.started_at ? `Started ${formatRelative(c.started_at)}` : 'Counted when it starts'} />
			<StatCard label="Sent" value={c.sent_count} hint={c.total_count ? `${progress}% processed` : ''} />
			<StatCard label="Failed" value={c.failed_count} hint={c.skipped_count ? `${c.skipped_count} skipped` : ''} />
			<StatCard label="Link visits" value={c.visits} hint={c.link ? 'Observed, via the campaign link' : 'No link in this campaign'} />
			<StatCard
				label="Attributed orders"
				value={c.attributed_orders ?? 0}
				hint={c.attributed_revenue ? `${Number(c.attributed_revenue).toFixed(2)} revenue, from visits that ordered` : 'Orders placed after opening the link'}
			/>
		</StatGrid>

		{#if c.total_count > 0 && live}
			<div class="cmp-bar" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
				<span style={`width:${progress}%`}></span>
			</div>
		{/if}

		<div class="cmp-two">
			<section class="panel cmp-card" aria-labelledby="cmp-msg">
				<h2 id="cmp-msg" class="cmp-h">Message</h2>
				{#if c.channel === 'EMAIL'}<p class="cmp-subject">{c.subject}</p>{/if}
				<p class="cmp-body">{c.body}</p>
				{#if c.link}
					<p class="muted cmp-small">
						{c.channel === 'EMAIL' ? `Button "${c.button_label || 'Visit'}" opens` : 'Link:'}
						<span class="cmp-mono">{c.link.url}</span> → {c.link.target_path}
					</p>
				{/if}
			</section>

			<section class="panel panel-flush cmp-card" aria-labelledby="cmp-rcp">
				<h2 id="cmp-rcp" class="cmp-h cmp-pad">Recipients</h2>
				{#if c.recipients.length === 0}
					<p class="muted cmp-pad">
						{c.status === 'DRAFT' || c.status === 'SCHEDULED'
							? 'The list is built from your customers when the campaign starts.'
							: 'Nobody was eligible.'}
					</p>
				{:else}
					<ul class="cmp-list">
						{#each c.recipients as r (r.id)}
							{@const b = recipientBadge(r.status)}
							<li>
								<span class="cmp-rcp-main">
									<strong>{r.customer_name || r.address}</strong>
									<span class="muted">{r.address}{#if r.last_error} · {r.last_error}{/if}</span>
								</span>
								<StatusBadge status={b.label} kind={b.kind} />
							</li>
						{/each}
					</ul>
					{#if c.total_count > c.recipients.length}
						<p class="muted cmp-pad cmp-small">Showing {c.recipients.length} of {c.total_count}.</p>
					{/if}
				{/if}
			</section>
		</div>
	{/if}
</div>

<ConfirmDialog
	bind:open={cancelOpen}
	title="Cancel this campaign?"
	message="Messages already sent cannot be recalled. Anything still queued will not go out."
	confirmLabel="Cancel campaign"
	danger
	onconfirm={() => act('cancel')}
/>
<ConfirmDialog
	bind:open={deleteOpen}
	title="Delete this draft?"
	message="This cannot be undone."
	confirmLabel="Delete"
	danger
	onconfirm={remove}
/>

<style>
	.cmp {
		display: grid;
		gap: 1rem;
	}
	.cmp-head {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		justify-content: space-between;
		gap: 0.75rem;
	}
	.cmp-title h1 {
		margin: 0.15rem 0;
		font-size: 1.25rem;
	}
	.cmp-title p {
		margin: 0;
		font-size: var(--fs-meta);
	}
	.cmp-back {
		font-size: var(--fs-meta);
		text-decoration: none;
	}
	.cmp-back:hover {
		text-decoration: underline;
	}
	.cmp-actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
	}
	.cmp-note,
	.cmp-error {
		padding: 0.75rem 1rem;
		font-size: var(--fs-body);
		line-height: 1.5;
	}
	.cmp-error {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.75rem;
	}
	.cmp-bar {
		height: 6px;
		border-radius: 999px;
		overflow: hidden;
		background: var(--surface-2, color-mix(in srgb, var(--text) 8%, transparent));
	}
	.cmp-bar span {
		display: block;
		height: 100%;
		background: var(--accent, #4f46e5);
		transition: width 0.4s ease;
	}
	.cmp-two {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(20rem, 1fr));
		gap: 1rem;
	}
	.cmp-card {
		display: grid;
		gap: 0.5rem;
		align-content: start;
	}
	.cmp-card:not(.panel-flush) {
		padding: 1rem;
	}
	.cmp-h {
		margin: 0;
		font-size: var(--fs-body);
		font-weight: 600;
	}
	.cmp-pad {
		padding: 0.9rem 1rem 0;
	}
	p.cmp-pad {
		padding-bottom: 1rem;
		margin: 0;
	}
	.cmp-subject {
		margin: 0;
		font-weight: 600;
	}
	.cmp-body {
		margin: 0;
		white-space: pre-wrap;
		line-height: 1.5;
	}
	.cmp-small {
		margin: 0;
		font-size: var(--fs-meta);
		overflow-wrap: anywhere;
	}
	.cmp-mono {
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
	}
	.cmp-list {
		list-style: none;
		margin: 0.5rem 0 0;
		padding: 0;
	}
	.cmp-list li {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		padding: 0.6rem 1rem;
		border-top: 1px solid var(--border, color-mix(in srgb, var(--text) 10%, transparent));
	}
	.cmp-rcp-main {
		display: grid;
		gap: 0.1rem;
		min-width: 0;
	}
	.cmp-rcp-main .muted {
		font-size: var(--fs-meta);
		overflow-wrap: anywhere;
	}
</style>
