<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import Zap from '@lucide/svelte/icons/zap';
	import { useStorefront, type StorefrontContext } from '$lib/storefront/admin-context';
	import OpeningHoursForm from '$lib/components/storefront/OpeningHoursForm.svelte';
	import LaunchBroadcast from '$lib/components/storefront/launch/LaunchBroadcast.svelte';
	import ActionStoreStatus from '$lib/components/storefront/actions/ActionStoreStatus.svelte';
	import '$lib/components/storefront/launch/launch-shared.css';

	let sfProps: Partial<StorefrontContext> = $props();
	const ctx = useStorefront(() => sfProps);
	const config = $derived(ctx.config);
	const save = (run: Parameters<StorefrontContext['save']>[0]) => ctx.save(run);

	const publicHost = $derived.by(() => {
		const url = config.public_url;
		if (!url) return '';
		try {
			return new URL(url).host;
		} catch {
			return '';
		}
	});

	const section = $derived($page.url.searchParams.get('section') ?? '');

	onMount(() => {
		if (!section) return;
		const el = document.getElementById(
			section === 'hours' ? 'opening-hours' : section === 'banner' ? 'customer-banner' : 'store-status'
		);
		el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	});
</script>

<header class="action-header">
	<div class="action-header-main">
		<div class="action-header-icon" aria-hidden="true">
			<Zap size={22} strokeWidth={2} />
		</div>
		<div>
			<h1 class="action-title">Action</h1>
			<p class="action-subtitle">
				Update store status, customer banner, and opening hours — saved live for customers right away.
			</p>
		</div>
	</div>
</header>

<div class="action-stack">
	<ActionStoreStatus {config} {save} />

	<div id="customer-banner">
		<LaunchBroadcast {config} {save} {publicHost} />
	</div>

	<div class="panel action-hours-wrap" id="opening-hours">
		<OpeningHoursForm {...sfProps} />
	</div>
</div>

<style>
	.action-header {
		margin-bottom: 1.25rem;
	}
	.action-header-main {
		display: flex;
		gap: 0.85rem;
		align-items: flex-start;
	}
	.action-header-icon {
		width: 2.5rem;
		height: 2.5rem;
		border-radius: var(--radius);
		background: color-mix(in srgb, var(--accent) 14%, transparent);
		border: 1px solid color-mix(in srgb, var(--accent) 28%, transparent);
		display: grid;
		place-items: center;
		color: var(--accent);
		flex-shrink: 0;
	}
	.action-title {
		margin: 0;
		font-family: var(--font-display);
		font-size: 1.35rem;
		font-weight: 700;
	}
	.action-subtitle {
		margin: 0.3rem 0 0;
		font-size: 0.9rem;
		color: var(--text-2);
		max-width: 42rem;
		line-height: 1.45;
	}
	.action-stack {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}
	.action-hours-wrap {
		padding: 0;
		border: none;
		background: transparent;
		box-shadow: none;
	}
	.action-stack :global(.panel),
	.action-stack :global(.studio-section-intro),
	.action-stack :global(.broadcast-builder-panel),
	.action-stack :global(.action-panel),
	.action-stack :global(.sfctl-section) {
		box-shadow: none;
	}
	.action-stack :global(.intro-icon-wrap) {
		background: color-mix(in srgb, var(--accent) 14%, transparent);
		color: var(--accent);
		border-radius: var(--radius);
	}
</style>
