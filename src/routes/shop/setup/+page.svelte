<script lang="ts">
	import { onMount } from 'svelte';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import CircleDashed from '@lucide/svelte/icons/circle-dashed';
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import QrCode from '@lucide/svelte/icons/qr-code';
	import Rocket from '@lucide/svelte/icons/rocket';
	import Share2 from '@lucide/svelte/icons/share-2';
	import { api } from '$lib/api/client';
	import ErrorState from '$lib/components/admin/ErrorState.svelte';
	import Reveal from '$lib/components/admin/Reveal.svelte';
	import Skeleton from '$lib/components/admin/Skeleton.svelte';
	import StatusBadge from '$lib/components/admin/StatusBadge.svelte';
	import { toast } from '$lib/components/admin/toast';

	type Setup = {
		setup_status: string;
		is_published: boolean;
		steps: {
			business_info: boolean;
			menu: boolean;
			payment: boolean;
			qr: boolean;
			launch: boolean;
		};
	};

	type StoreLink = { name: string; public_host: string; public_path: string; is_published: boolean };

	let setup = $state<Setup | null>(null);
	let store = $state<StoreLink | null>(null);
	let error = $state('');
	let loading = $state(true);
	let busy = $state(false);

	const STEPS = [
		{ key: 'business_info' as const, label: 'Business details', hint: 'Name, type and contact', href: '/shop' },
		{ key: 'menu' as const, label: 'Your menu', hint: 'At least one item to sell', href: '/shop/menu' },
		{ key: 'payment' as const, label: 'Payment methods', hint: 'How customers pay', href: '/shop/setup' },
		{ key: 'qr' as const, label: 'QR & share link', hint: 'Get it in front of customers', href: '/shop/setup' },
		{ key: 'launch' as const, label: 'Go live', hint: 'Publish your storefront', href: '/shop/setup' }
	];

	const done = $derived(setup ? STEPS.filter((s) => setup!.steps[s.key]).length : 0);
	const progress = $derived(Math.round((done / STEPS.length) * 100));
	const canPublish = $derived(Boolean(setup && setup.steps.menu));
	const storefrontUrl = $derived(
		store ? `http://${store.public_host}${store.public_path}` : ''
	);

	onMount(() => {
		let cancelled = false;
		(async () => {
			try {
				const [s, l] = await Promise.all([
					api<Setup>('/api/v1/tenant/setup'),
					api<StoreLink>('/api/v1/tenant/store-link')
				]);
				if (cancelled) return;
				setup = s;
				store = l;
			} catch (err) {
				if (!cancelled) error = err instanceof Error ? err.message : 'Failed to load setup';
			} finally {
				if (!cancelled) loading = false;
			}
		})();
		return () => {
			cancelled = true;
		};
	});

	async function publish() {
		if (busy) return;
		busy = true;
		try {
			await api('/api/v1/tenant/publish', { method: 'POST' });
			toast.success('Your store is live 🎉');
			const s = await api<Setup>('/api/v1/tenant/setup');
			setup = s;
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Could not publish');
		} finally {
			busy = false;
		}
	}

	async function unpublish() {
		if (busy) return;
		busy = true;
		try {
			await api('/api/v1/tenant/unpublish', { method: 'POST' });
			toast.info('Store unpublished');
			const s = await api<Setup>('/api/v1/tenant/setup');
			setup = s;
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Could not unpublish');
		} finally {
			busy = false;
		}
	}

	async function markInProgress() {
		if (busy) return;
		busy = true;
		try {
			await api('/api/v1/tenant/setup/complete-step', { method: 'POST' });
			setup = await api<Setup>('/api/v1/tenant/setup');
			toast.success('Setup updated');
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Could not update');
		} finally {
			busy = false;
		}
	}

	async function copyLink() {
		if (!storefrontUrl) return;
		try {
			await navigator.clipboard.writeText(storefrontUrl);
			toast.success('Storefront link copied');
		} catch {
			toast.error('Could not copy — select the link instead');
		}
	}

	async function share() {
		if (!storefrontUrl) return;
		// Native share sheet on phones; clipboard everywhere else.
		if (navigator.share) {
			try {
				await navigator.share({ title: store?.name ?? 'Our shop', url: storefrontUrl });
				return;
			} catch {
				/* user dismissed the sheet */
			}
		}
		await copyLink();
	}
</script>

{#if error}
	<ErrorState message={error} />
{/if}

{#if loading}
	<div class="osstats">
		{#each [1, 2, 3, 4] as _, i (i)}
			<div class="osstat"><Skeleton height="2.4rem" /></div>
		{/each}
	</div>
{:else if setup}
	<!-- ---------- Progress ---------- -->
	<Reveal class="panel osh-setup-hero">
		<div class="osh-setup-top">
			<div>
				<h2 style="font-family:var(--font-display);font-size:1.15rem;font-weight:700;letter-spacing:-0.02em;margin:0 0 0.2rem;">
					{setup.is_published ? 'Your store is live' : 'Get your store live'}
				</h2>
				<p class="muted" style="margin:0;font-size:0.84rem;">
					{done} of {STEPS.length} steps complete · {progress}%
				</p>
			</div>
			<StatusBadge status={setup.setup_status} />
		</div>

		<div
			class="osh-progress"
			role="progressbar"
			aria-valuenow={progress}
			aria-valuemin="0"
			aria-valuemax="100"
			aria-label="Setup progress"
		>
			<span style={`width:${progress}%`}></span>
		</div>

		{#if setup.is_published}
			<button class="btn btn-ghost osh-wide-btn" type="button" disabled={busy} onclick={unpublish}>
				Take the store offline
			</button>
		{:else}
			<button
				class="btn btn-primary osh-wide-btn"
				type="button"
				disabled={!canPublish || busy}
				onclick={publish}
			>
				<Rocket size={15} strokeWidth={2.1} />
				{busy ? 'Publishing…' : 'Publish store'}
			</button>
			{#if !canPublish}
				<p class="field-hint" style="margin:0;">
					Add at least one menu item before publishing.
				</p>
			{/if}
		{/if}
	</Reveal>

	<!-- ---------- Checklist ---------- -->
	<Reveal class="panel osh-panel" delay={60}>
		<h3 class="panel-h" style="margin:0 0 0.6rem;">Checklist</h3>
		<ul class="osh-steps">
			{#each STEPS as s, i (s.key)}
				{@const isDone = setup!.steps[s.key]}
				<li>
					<a class="osh-step" href={s.href}>
						<span class={['osh-step-num', isDone ? 'done' : ''].join(' ')}>
							{#if isDone}
								<CircleCheck size={17} strokeWidth={2.2} />
							{:else}
								<CircleDashed size={17} strokeWidth={1.9} />
							{/if}
						</span>
						<span class="osh-step-main">
							<span class="osh-step-label">{i + 1}. {s.label}</span>
							<span class="osh-step-hint">{s.hint}</span>
						</span>
						{#if isDone}
							<span class="oschip live">Done</span>
						{/if}
					</a>
				</li>
			{/each}
		</ul>
	</Reveal>

	<!-- ---------- Share ---------- -->
	{#if storefrontUrl}
		<Reveal class="panel osh-panel" delay={120}>
			<h3 class="panel-h" style="margin:0 0 0.25rem;">Share your shop</h3>
			<p class="panel-note" style="margin:0 0 0.7rem;">
				Put this link or the QR code where customers will see it.
			</p>

			<div class="osh-link">
				<code>{storefrontUrl.replace(/^https?:\/\//, '')}</code>
			</div>

			<div class="osh-share">
				<button class="btn btn-ghost" type="button" onclick={copyLink}>
					Copy link
				</button>
				<button class="btn btn-ghost" type="button" onclick={share}>
					<Share2 size={15} strokeWidth={1.9} /> Share
				</button>
				<a class="btn btn-ghost" href={storefrontUrl} target="_blank" rel="noreferrer">
					<ExternalLink size={15} strokeWidth={1.9} /> Open
				</a>
			</div>

			<div class="osh-qr">
				<QrCode size={15} strokeWidth={1.9} />
				<span>
					QR codes for print and table tents are available once your store is published.
				</span>
			</div>
		</Reveal>
	{/if}

	<Reveal class="panel" delay={180}>
		<button class="btn btn-ghost" type="button" disabled={busy} onclick={markInProgress}>
			Mark setup in progress
		</button>
	</Reveal>
{/if}

<style>
	.osh-setup-hero {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
		align-items: flex-start;
		margin-bottom: 0.85rem;
	}

	.osh-setup-top {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 0.75rem;
		width: 100%;
	}

	.osh-progress {
		width: 100%;
		height: 0.4rem;
		border-radius: 999px;
		background: var(--surface-3);
		overflow: hidden;
		/* The panel clips overflow, so keep a little breathing room. */
		margin-bottom: 0.15rem;
	}

	.osh-progress span {
		display: block;
		height: 100%;
		border-radius: 999px;
		background: linear-gradient(90deg, var(--accent), var(--accent-2));
		transition: width 0.4s cubic-bezier(0.4, 0, 0.2, 1);
	}

	.osh-wide-btn {
		width: 100%;
		min-height: 2.9rem;
	}

	.osh-panel {
		margin-bottom: 0.85rem;
	}

	.osh-steps {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.osh-step {
		display: flex;
		align-items: center;
		gap: 0.7rem;
		min-height: 3rem;
		padding: 0.5rem 0.55rem;
		border-radius: 10px;
		text-decoration: none;
		color: var(--text);
		-webkit-tap-highlight-color: transparent;
		transition: background var(--tr);
	}

	.osh-step:hover {
		background: var(--surface-2);
	}

	.osh-step-num {
		flex: none;
		width: 1.8rem;
		height: 1.8rem;
		border-radius: 999px;
		display: grid;
		place-items: center;
		background: var(--surface-3);
		color: var(--text-3);
	}

	.osh-step-num.done {
		background: var(--success-bg);
		color: var(--success);
	}

	.osh-step-main {
		flex: 1;
		min-width: 0;
		line-height: 1.3;
	}

	.osh-step-label {
		display: block;
		font-size: 0.88rem;
		font-weight: 600;
	}

	.osh-step-hint {
		display: block;
		font-size: 0.73rem;
		color: var(--text-3);
	}

	.osh-link {
		padding: 0.6rem 0.7rem;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--surface-2);
		overflow: hidden;
	}

	.osh-link code {
		font-family: var(--font-mono);
		font-size: 0.8rem;
		color: var(--text-2);
		word-break: break-all;
	}

	.osh-share {
		display: flex;
		gap: 0.4rem;
		margin-top: 0.6rem;
		flex-wrap: wrap;
	}

	.osh-share .btn {
		flex: 1;
		min-width: 6.5rem;
		min-height: 2.75rem;
	}

	.osh-qr {
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
		margin-top: 0.75rem;
		padding-top: 0.7rem;
		border-top: 1px solid var(--border-subtle);
		font-size: 0.78rem;
		color: var(--text-3);
		line-height: 1.45;
	}

	@media (min-width: 700px) {
		.osh-share .btn {
			flex: none;
		}
	}
</style>
