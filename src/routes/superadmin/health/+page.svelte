<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import RefreshCw from '@lucide/svelte/icons/refresh-cw';
	import { fetchSystemHealth } from '$lib/admin/api';
	import { errorLines } from '$lib/admin/errors';
	import { formatRelative } from '$lib/admin/format';
	import type { SystemHealth } from '$lib/admin/types';
	import SystemHealthPanel from '$lib/components/admin/SystemHealthPanel.svelte';
	import { healthCheckMessage, healthSummary } from '$lib/admin/health';
	import { toast } from '$lib/components/admin/toast';

	/**
	 * System health.
	 *
	 * Live component status, polled while the screen is open. It reports what
	 * the platform can actually observe: the API and database are probed on
	 * each request; providers report the state their last save or test
	 * recorded. Nothing dials a provider on a timer — a health check that sent
	 * mail every thirty seconds would be its own outage.
	 */

	const POLL_MS = 30_000;

	let health = $state<SystemHealth | null>(null);
	let loading = $state(true);
	let error = $state('');
	let timer: ReturnType<typeof setInterval> | undefined;

	/**
	 * @param manual true when the operator pressed the button.
	 *
	 * Only a manual check is confirmed with a toast. The poll runs every thirty
	 * seconds on its own, and confirming those would bury the screen in
	 * notifications nobody asked for.
	 */
	async function load(manual = false) {
		loading = true;
		error = '';
		try {
			health = await fetchSystemHealth();
			if (manual) {
				const summary = healthSummary(health);
				const message = healthCheckMessage(health);
				// The tone matches what came back: a green toast over a failing
				// component would confirm the request and misreport the answer.
				if (summary.tone === 'bad') toast.error(message);
				else if (summary.tone === 'warn') toast.info(message);
				else toast.success(message);
			}
		} catch (err) {
			const lines = errorLines(err, 'read system health');
			error = lines.detail;
			health = null;
			if (manual) toast.error(`${lines.title}. ${lines.detail}`);
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		void load();
		timer = setInterval(() => void load(), POLL_MS);
	});

	onDestroy(() => {
		// Polling belongs to this screen only; leaving it running would keep
		// hitting the API from a page nobody is looking at.
		if (timer) clearInterval(timer);
	});

	// One reading of the payload, shared with the panel and the toast.
	const counts = $derived(healthSummary(health));
	const headline = $derived(counts.headline);
	const tone = $derived(counts.tone);
</script>

<section class="panel hero">
	<div class="hero-main">
		<span class={['status-dot', tone].join(' ')} style="width:0.7rem;height:0.7rem;"></span>
		<div>
			<h2>{headline}</h2>
			<p>
				{#if health}
					{counts.healthy} healthy · {counts.warning} warning · {counts.error} failing ·
					{counts.unavailable} not deployed · checked {formatRelative(health.checked_at)}
				{:else if error}
					{error}
				{:else}
					Probing the API, the database and every configured provider.
				{/if}
			</p>
		</div>
	</div>
	<button type="button" class="btn btn-ghost btn-sm" disabled={loading} onclick={() => void load(true)}>
		<RefreshCw size={13} strokeWidth={2} class={loading ? 'spin' : ''} />
		Check now
	</button>
</section>

<SystemHealthPanel {health} {loading} {error} onrefresh={() => void load(true)} />

<p class="foot-note">
	Re-checked automatically every {POLL_MS / 1000} seconds while this screen is open. "Not deployed"
	means the platform has no such component in this build, not that something has failed.
</p>

<style>
	.hero {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.85rem;
		margin-bottom: 0.85rem;
	}

	.hero-main {
		display: flex;
		align-items: flex-start;
		gap: 0.7rem;
		min-width: 0;
	}

	.hero-main > span {
		margin-top: 0.4rem;
		flex-shrink: 0;
	}

	.hero h2 {
		margin: 0;
		font-family: var(--font-display);
		font-size: var(--fs-title);
		font-weight: 600;
		letter-spacing: -0.02em;
	}

	.hero p {
		margin: 0.2rem 0 0;
		font-size: var(--fs-tab);
		line-height: 1.5;
		color: var(--text-3);
	}

	.foot-note {
		margin: 0.85rem 0 0;
		font-size: var(--fs-code);
		color: var(--text-3);
		line-height: 1.5;
	}
</style>
