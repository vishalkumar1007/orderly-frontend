<script lang="ts">
	import SlidersHorizontal from '@lucide/svelte/icons/sliders-horizontal';
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import type { StorefrontContext } from '$lib/storefront/admin-context';
	import './launch-shared.css';

	let { config }: { config: StorefrontContext['config'] } = $props();

	const status = $derived(config.behaviour.store_status || 'OPEN');
</script>

<div class="studio-content-grid">
	<div class="panel studio-section-intro">
		<div class="intro-icon-wrap">
			<SlidersHorizontal size={24} strokeWidth={1.8} />
		</div>
		<div>
			<h2 class="intro-h">Store status &amp; ordering</h2>
			<p class="intro-p">
				Status, hours, pricing, and ordering rules are edited in Customize Studio and published as
				one draft.
			</p>
		</div>
	</div>

	<div class="panel status-selector-panel">
		<h3 class="section-h">Current snapshot</h3>
		<ul class="launch-readonly-list">
			<li>Status: <strong>{status}</strong></li>
			<li>Ordering: <strong>{config.behaviour.ordering_enabled ? 'On' : 'Paused'}</strong></li>
			<li>
				Prep time: <strong>{config.behaviour.prep_time_minutes ?? 20} min</strong> · Tax:
				<strong>{config.behaviour.tax_percent ?? 0}%</strong> · Packaging:
				<strong>{config.behaviour.packaging_fee ?? 0}</strong>
			</li>
		</ul>
		<a class="btn btn-primary" href="/shop/customize?section=ordering">
			<ExternalLink size={15} strokeWidth={2} />
			Edit in Customize → Store rules
		</a>
	</div>
</div>

<style>
	.status-selector-panel {
		padding: 1.25rem 1.5rem;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-md, 12px);
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	.launch-readonly-list {
		margin: 0;
		padding-left: 1.1rem;
		color: var(--text-2);
		font-size: 0.92rem;
	}
</style>
