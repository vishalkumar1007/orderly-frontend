<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import Megaphone from '@tabler/icons-svelte/icons/speakerphone';
	import Send from '@tabler/icons-svelte/icons/send';
	import Eye from '@tabler/icons-svelte/icons/eye';
	import UserOff from '@tabler/icons-svelte/icons/user-off';
	import Lock from '@tabler/icons-svelte/icons/lock';
	import Link from '@tabler/icons-svelte/icons/link';
	import Qrcode from '@tabler/icons-svelte/icons/qrcode';
	import Trash from '@tabler/icons-svelte/icons/trash';
	import Copy from '@tabler/icons-svelte/icons/copy';
	import { ApiClientError } from '$lib/api/client';
	import { formatRelative } from '$lib/admin/format';
	import ConfirmDialog from '$lib/components/admin/ConfirmDialog.svelte';
	import FormField from '$lib/components/admin/FormField.svelte';
	import Modal from '$lib/components/admin/Modal.svelte';
	import StatCard from '$lib/components/admin/StatCard.svelte';
	import StatGrid from '$lib/components/admin/StatGrid.svelte';
	import StatusBadge from '$lib/components/admin/StatusBadge.svelte';
	import TextInput from '$lib/components/admin/TextInput.svelte';
	import { toast } from '$lib/components/admin/toast';
	import { featureAccess } from '$lib/tenant/entitlements.svelte';
	import MarketingTabs from '$lib/components/tenant/MarketingTabs.svelte';
	import {
		GOAL_CARDS,
		marketingApi,
		statusBadge,
		type Channel,
		type MarketingLink,
		type Overview,
		type Platform
	} from '$lib/tenant/marketingApi';

	/**
	 * Marketing home. One screen answers "how is it going", "what should I do
	 * next" and "what is in the way": numbers, goal cards into the campaign
	 * wizard, channel readiness, consent posture and trackable links.
	 */

	const access = $derived(featureAccess('MARKETING'));
	let lockedMessage = $state('');
	const locked = $derived(!access.enabled || lockedMessage !== '');

	let data = $state<Overview | null>(null);
	let links = $state<MarketingLink[]>([]);
	let loading = $state(true);
	let loadError = $state('');

	async function load() {
		loadError = '';
		try {
			const [o, l] = await Promise.all([marketingApi.overview(), marketingApi.links()]);
			data = o;
			links = l.links ?? [];
			lockedMessage = '';
		} catch (err) {
			if (err instanceof ApiClientError && err.code === 'feature_not_in_plan') lockedMessage = err.message;
			else loadError = err instanceof Error ? err.message : 'Could not load marketing';
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		if (access.enabled) void load();
		else loading = false;
	});

	/* ---------- consent ---------- */

	let grantOpen = $state(false);
	let grantChannel = $state<Channel>('EMAIL');
	let granting = $state(false);

	function openGrant(ch: Channel) {
		grantChannel = ch;
		grantOpen = true;
	}

	async function grantAll() {
		granting = true;
		try {
			const r = await marketingApi.grantAll(grantChannel);
			toast.success(`Consent recorded for ${r.granted} ${r.granted === 1 ? 'customer' : 'customers'}`);
			grantOpen = false;
			await load();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Could not record consent');
		} finally {
			granting = false;
		}
	}

	/* ---------- links ---------- */

	let linkOpen = $state(false);
	let linkLabel = $state('');
	let linkPath = $state('/');
	let linkSaving = $state(false);
	let linkError = $state('');

	async function createLink() {
		linkSaving = true;
		linkError = '';
		try {
			const l = await marketingApi.createLink(linkLabel, linkPath);
			links = [l, ...links];
			linkOpen = false;
			linkLabel = '';
			linkPath = '/';
			toast.success('Link created');
		} catch (err) {
			linkError = err instanceof Error ? err.message : 'Could not create the link';
		} finally {
			linkSaving = false;
		}
	}

	let deleteTarget = $state<MarketingLink | null>(null);
	async function deleteLink() {
		if (!deleteTarget) return;
		try {
			await marketingApi.deleteLink(deleteTarget.id);
			links = links.filter((l) => l.id !== deleteTarget?.id);
			toast.success('Link deleted');
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Could not delete the link');
		} finally {
			deleteTarget = null;
		}
	}

	async function copy(text: string) {
		try {
			await navigator.clipboard.writeText(text);
			toast.success('Copied');
		} catch {
			toast.error('Could not copy');
		}
	}

	let qrOpen = $state(false);
	let qrLink = $state<MarketingLink | null>(null);
	let qr = $state<{ png: string; svg: string } | null>(null);
	let qrLoading = $state(false);

	async function showQr(l: MarketingLink) {
		qrLink = l;
		qr = null;
		qrOpen = true;
		qrLoading = true;
		try {
			qr = await marketingApi.linkQr(l.id);
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Could not render the QR code');
			qrOpen = false;
		} finally {
			qrLoading = false;
		}
	}

	function downloadQr() {
		if (!qr || !qrLink) return;
		const a = document.createElement('a');
		a.href = qr.png;
		a.download = `${qrLink.label || qrLink.code}-qr.png`;
		a.click();
	}

	const stats = $derived(data?.stats);
	const consent = $derived(data?.consent);
	const channels = $derived(data?.channels);
	const CHANNEL_ROWS: { id: Channel | Platform; label: string; hint: string }[] = [
		{ id: 'EMAIL', label: 'Email', hint: 'Campaigns and automations' },
		{ id: 'SMS', label: 'SMS', hint: 'Short texts with a link' },
		{ id: 'WHATSAPP', label: 'WhatsApp', hint: 'Approved templates via Meta' },
		{ id: 'FACEBOOK', label: 'Facebook', hint: 'Page posts' },
		{ id: 'INSTAGRAM', label: 'Instagram', hint: 'Image posts' }
	];
	const attributedRevenue = $derived(Number(stats?.attributed_revenue_30d ?? 0));
</script>

<div class="mk-page">
	{#if locked}
		<section class="panel mk-locked" aria-labelledby="mk-locked-title">
			<span class="mk-locked-icon"><Lock size={22} stroke={1.6} /></span>
			<h2 id="mk-locked-title">Marketing is not part of your plan</h2>
			<p class="muted">
				{lockedMessage ||
					(access.requiredPlan
						? `Marketing is part of the ${access.requiredPlan} plan.`
						: 'Ask your platform administrator to add it to your plan.')}
			</p>
			<ul class="mk-benefits">
				<li>Email and SMS campaigns to customers who said yes</li>
				<li>Audiences built from your real orders and bookings</li>
				<li>Trackable links and QR codes for posters and social posts</li>
				<li>One place to see what was sent and what it brought in</li>
			</ul>
			<p class="muted">Plans are changed by your platform administrator.</p>
		</section>
	{:else}
		<MarketingTabs />
		<header class="mk-head">
			<p class="muted mk-lead">
				Reach the customers who agreed to hear from you, through the channels you have connected,
				and see what each campaign brought back.
			</p>
			<a class="btn btn-primary" href="/shop/marketing/new">New campaign</a>
		</header>

		<StatGrid>
			<StatCard label="Campaigns" value={stats?.campaigns ?? 0} hint={`${stats?.active_campaigns ?? 0} in progress`} {loading}>
				{#snippet icon()}<Megaphone size={15} stroke={1.6} />{/snippet}
			</StatCard>
			<StatCard label="Messages sent" value={stats?.messages_sent ?? 0} hint={stats?.messages_failed ? `${stats.messages_failed} failed` : 'All time'} {loading}>
				{#snippet icon()}<Send size={15} stroke={1.6} />{/snippet}
			</StatCard>
			<StatCard label="Link visits" value={stats?.visits_30d ?? 0} hint="Last 30 days, observed" {loading}>
				{#snippet icon()}<Eye size={15} stroke={1.6} />{/snippet}
			</StatCard>
			<StatCard
				label="Attributed orders"
				value={stats?.attributed_orders_30d ?? 0}
				hint={attributedRevenue ? `${attributedRevenue.toFixed(2)} revenue, 30 days, via links and offers` : 'Last 30 days, via links and offers'}
				{loading}
			/>
			<StatCard label="Unsubscribes" value={stats?.unsubscribes_30d ?? 0} hint="Last 30 days" {loading}>
				{#snippet icon()}<UserOff size={15} stroke={1.6} />{/snippet}
			</StatCard>
		</StatGrid>

		{#if loadError}
			<div class="panel mk-error" role="alert">
				<strong>Could not load marketing.</strong>
				<span class="muted">{loadError}</span>
				<button type="button" class="btn btn-ghost btn-sm" onclick={load}>Try again</button>
			</div>
		{:else}
			<!-- Goals -->
			<section class="mk-section" aria-labelledby="mk-goals">
				<h2 id="mk-goals" class="mk-h">What do you want to do?</h2>
				<div class="mk-goals">
					{#each GOAL_CARDS as g (g.goal)}
						<a class="panel mk-goal" href={`/shop/marketing/new?goal=${g.goal}&audience=${g.audience}`}>
							<strong>{g.title}</strong>
							<span class="muted">{g.hint}</span>
						</a>
					{/each}
				</div>
			</section>

			<div class="mk-two">
				<!-- Channels -->
				<section class="panel mk-card" aria-labelledby="mk-channels">
					<h2 id="mk-channels" class="mk-h">Channels</h2>
					{#if channels}
						{#each CHANNEL_ROWS as row (row.id)}
							{@const c = channels[row.id]}
							<div class="mk-row">
								<span class="mk-row-main">
									<strong>{row.label}</strong>
									<span class="muted">{c?.ready ? row.hint : c?.reason ?? row.hint}</span>
								</span>
								<StatusBadge status={c?.ready ? 'Ready' : c?.allowed ? 'Not connected' : 'Not in plan'} kind={c?.ready ? 'ok' : c?.allowed ? 'warn' : 'neutral'} />
							</div>
						{/each}
						{#if CHANNEL_ROWS.some((row) => channels[row.id]?.allowed && !channels[row.id]?.ready)}
							<a class="btn btn-ghost btn-sm" href="/shop/configuration">Open Configuration</a>
						{/if}
					{:else}
						<p class="muted">Loading…</p>
					{/if}
				</section>

				<!-- Consent -->
				<section class="panel mk-card" aria-labelledby="mk-consent">
					<h2 id="mk-consent" class="mk-h">Who can you contact?</h2>
					{#if consent}
						<p class="muted mk-small">
							Campaigns only go to customers with recorded marketing consent. Customers can
							unsubscribe from any message; that choice is kept.
						</p>
						<div class="mk-row">
							<span class="mk-row-main">
								<strong>Email</strong>
								<span class="muted">{consent.email_granted} of {consent.with_email} with an address</span>
							</span>
							{#if consent.email_granted < consent.with_email}
								<button type="button" class="btn btn-ghost btn-sm" onclick={() => openGrant('EMAIL')}>Record consent</button>
							{/if}
						</div>
						<div class="mk-row">
							<span class="mk-row-main">
								<strong>SMS</strong>
								<span class="muted">{consent.sms_granted} of {consent.with_phone} with a number</span>
							</span>
							{#if consent.sms_granted < consent.with_phone}
								<button type="button" class="btn btn-ghost btn-sm" onclick={() => openGrant('SMS')}>Record consent</button>
							{/if}
						</div>
						<div class="mk-row">
							<span class="mk-row-main">
								<strong>WhatsApp</strong>
								<span class="muted">{consent.whatsapp_granted} of {consent.with_phone} with a number</span>
							</span>
							{#if consent.whatsapp_granted < consent.with_phone}
								<button type="button" class="btn btn-ghost btn-sm" onclick={() => openGrant('WHATSAPP')}>Record consent</button>
							{/if}
						</div>
						<p class="muted mk-small">Customers also opt in themselves at checkout and on their profile.</p>
						{#if consent.revoked > 0}
							<p class="muted mk-small">{consent.revoked} {consent.revoked === 1 ? 'customer has' : 'customers have'} unsubscribed.</p>
						{/if}
					{:else}
						<p class="muted">Loading…</p>
					{/if}
				</section>
			</div>

			<!-- Recent campaigns -->
			<section class="panel panel-flush mk-card" aria-labelledby="mk-recent">
				<div class="mk-card-head">
					<h2 id="mk-recent" class="mk-h">Recent campaigns</h2>
					{#if (data?.recent.length ?? 0) > 0}
						<a class="btn btn-ghost btn-sm" href="/shop/marketing/new">New campaign</a>
					{/if}
				</div>
				{#if loading}
					<p class="muted mk-pad">Loading…</p>
				{:else if (data?.recent.length ?? 0) === 0}
					<div class="mk-empty">
						<p class="muted">No campaigns yet. Pick a goal above to start one.</p>
					</div>
				{:else}
					<ul class="mk-list">
						{#each data?.recent ?? [] as c (c.id)}
							{@const b = statusBadge(c.status)}
							<li>
								<a class="mk-list-row" href={`/shop/marketing/${c.id}`}>
									<span class="mk-row-main">
										<strong>{c.name}</strong>
										<span class="muted">
											{c.channel === 'EMAIL' ? 'Email' : c.channel === 'SMS' ? 'SMS' : 'WhatsApp'}{c.kind === 'AUTOMATION' ? ' · Automation' : ` · ${c.audience_label}`}
											{#if c.status === 'SCHEDULED' && c.scheduled_at}
												· {formatRelative(c.scheduled_at)}
											{:else if c.total_count > 0}
												· {c.sent_count}/{c.total_count} sent
											{/if}
										</span>
									</span>
									<StatusBadge status={b.label} kind={b.kind} />
								</a>
							</li>
						{/each}
					</ul>
				{/if}
			</section>

			<!-- Links -->
			<section class="panel panel-flush mk-card" aria-labelledby="mk-links">
				<div class="mk-card-head">
					<h2 id="mk-links" class="mk-h">Trackable links and QR codes</h2>
					<button type="button" class="btn btn-ghost btn-sm" onclick={() => (linkOpen = true)}>New link</button>
				</div>
				{#if links.length === 0}
					<div class="mk-empty">
						<p class="muted">
							A trackable link counts every visit. Put one on a poster, a table card or a social
							post, and use it as the button in a campaign.
						</p>
					</div>
				{:else}
					<ul class="mk-list">
						{#each links as l (l.id)}
							<li class="mk-list-row">
								<span class="mk-row-main">
									<strong>{l.label || l.target_path}</strong>
									<span class="muted mk-mono">{l.url}</span>
								</span>
								<span class="mk-link-meta muted">{l.visits} {l.visits === 1 ? 'visit' : 'visits'}</span>
								<span class="mk-actions">
									<button type="button" class="btn btn-quiet btn-sm" title="Copy link" aria-label="Copy link" onclick={() => copy(l.url)}><Copy size={15} stroke={1.6} /></button>
									<button type="button" class="btn btn-quiet btn-sm" title="QR code" aria-label="QR code" onclick={() => showQr(l)}><Qrcode size={15} stroke={1.6} /></button>
									<button type="button" class="btn btn-quiet btn-sm" title="Delete" aria-label="Delete link" onclick={() => (deleteTarget = l)}><Trash size={15} stroke={1.6} /></button>
								</span>
							</li>
						{/each}
					</ul>
				{/if}
			</section>
		{/if}
	{/if}
</div>

<ConfirmDialog
	bind:open={grantOpen}
	title={`Record ${grantChannel === 'EMAIL' ? 'email' : grantChannel === 'SMS' ? 'SMS' : 'WhatsApp'} consent`}
	message={`This marks every customer with ${grantChannel === 'EMAIL' ? 'an email address' : 'a phone number'} as having agreed to receive marketing from you. Only do this if they actually agreed, for example at checkout or in person. Customers who unsubscribed are not changed.`}
	confirmLabel="They agreed, record it"
	loading={granting}
	onconfirm={grantAll}
/>

<ConfirmDialog
	open={deleteTarget !== null}
	title="Delete this link?"
	message="Anyone scanning or opening it will see a not-found page. Visit counts are removed with it."
	confirmLabel="Delete"
	danger
	onconfirm={deleteLink}
/>

<Modal bind:open={linkOpen} title="New trackable link">
	<div class="mk-form">
		<FormField label="Label" htmlFor="mk-link-label" hint="For you: where this link will be used.">
			<TextInput id="mk-link-label" bind:value={linkLabel} placeholder="Table cards, Instagram bio" maxlength={60} />
		</FormField>
		<FormField label="Destination" htmlFor="mk-link-path" hint="A page on your storefront. / is the home page.">
			<TextInput id="mk-link-path" bind:value={linkPath} placeholder="/menu" maxlength={200} />
		</FormField>
		{#if linkError}<p class="field-error" role="alert">{linkError}</p>{/if}
	</div>
	{#snippet footer()}
		<button type="button" class="btn btn-ghost" onclick={() => (linkOpen = false)}>Cancel</button>
		<button type="button" class="btn btn-primary" disabled={linkSaving} onclick={createLink}>
			{linkSaving ? 'Creating…' : 'Create link'}
		</button>
	{/snippet}
</Modal>

<Modal bind:open={qrOpen} title={qrLink ? `QR code: ${qrLink.label || qrLink.target_path}` : 'QR code'}>
	<div class="mk-qr">
		{#if qrLoading}
			<p class="muted">Rendering…</p>
		{:else if qr}
			<div class="mk-qr-img">{@html qr.svg}</div>
			<p class="muted mk-mono">{qrLink?.url}</p>
		{/if}
	</div>
	{#snippet footer()}
		<button type="button" class="btn btn-ghost" onclick={() => (qrOpen = false)}>Close</button>
		<button type="button" class="btn btn-primary" disabled={!qr} onclick={downloadQr}>Download PNG</button>
	{/snippet}
</Modal>

<style>
	.mk-page {
		display: grid;
		gap: 1rem;
	}
	.mk-head {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
	}
	.mk-lead {
		margin: 0;
		font-size: var(--fs-body);
		line-height: 1.5;
		max-width: 46rem;
	}
	.mk-h {
		margin: 0;
		font-size: var(--fs-body);
		font-weight: 600;
	}
	.mk-section {
		display: grid;
		gap: 0.6rem;
	}
	.mk-goals {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(13rem, 1fr));
		gap: 0.75rem;
	}
	.mk-goal {
		display: grid;
		gap: 0.25rem;
		padding: 0.9rem 1rem;
		text-decoration: none;
		color: inherit;
		transition: border-color 0.15s ease;
	}
	.mk-goal:hover {
		border-color: var(--accent, #4f46e5);
	}
	.mk-goal .muted {
		font-size: var(--fs-meta);
		line-height: 1.4;
	}
	.mk-two {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr));
		gap: 1rem;
	}
	.mk-card {
		display: grid;
		gap: 0.6rem;
		align-content: start;
	}
	.mk-card:not(.panel-flush) {
		padding: 1rem;
	}
	.mk-card-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		padding: 0.9rem 1rem 0.5rem;
	}
	.mk-small {
		margin: 0;
		font-size: var(--fs-meta);
		line-height: 1.45;
	}
	.mk-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		padding: 0.45rem 0;
		border-top: 1px solid var(--border, color-mix(in srgb, var(--text) 10%, transparent));
	}
	.mk-row-main {
		display: grid;
		gap: 0.1rem;
		min-width: 0;
	}
	.mk-row-main .muted {
		font-size: var(--fs-meta);
		overflow-wrap: anywhere;
	}
	.mk-list {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.mk-list-row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.7rem 1rem;
		border-top: 1px solid var(--border, color-mix(in srgb, var(--text) 10%, transparent));
		text-decoration: none;
		color: inherit;
	}
	a.mk-list-row:hover {
		background: var(--surface-2, color-mix(in srgb, var(--text) 4%, transparent));
	}
	.mk-list-row .mk-row-main {
		flex: 1;
	}
	.mk-link-meta {
		font-size: var(--fs-meta);
		white-space: nowrap;
	}
	.mk-actions {
		display: flex;
		gap: 0.15rem;
	}
	.mk-mono {
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: var(--fs-meta);
	}
	.mk-empty,
	.mk-pad {
		padding: 0.5rem 1rem 1rem;
	}
	.mk-empty p {
		margin: 0;
		line-height: 1.5;
	}
	.mk-error {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.75rem;
		padding: 1rem;
	}
	.mk-form {
		display: grid;
		gap: 0.9rem;
	}
	.mk-qr {
		display: grid;
		justify-items: center;
		gap: 0.75rem;
	}
	.mk-qr-img :global(svg) {
		width: min(280px, 80vw);
		height: auto;
	}
	.mk-locked {
		display: grid;
		gap: 0.75rem;
		justify-items: start;
		padding: 1.5rem;
		max-width: 40rem;
	}
	.mk-locked h2 {
		margin: 0;
		font-size: 1.1rem;
	}
	.mk-locked p {
		margin: 0;
		line-height: 1.5;
	}
	.mk-locked-icon {
		display: inline-grid;
		place-items: center;
		width: 2.5rem;
		height: 2.5rem;
		border-radius: 999px;
		background: var(--surface-2, color-mix(in srgb, var(--text) 6%, transparent));
	}
	.mk-benefits {
		margin: 0;
		padding-left: 1.2rem;
		line-height: 1.6;
	}
</style>
