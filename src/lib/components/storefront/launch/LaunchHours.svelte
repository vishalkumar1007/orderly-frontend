<script lang="ts">
	import Clock from '@lucide/svelte/icons/clock';
	import OpeningHoursForm from '$lib/components/storefront/OpeningHoursForm.svelte';
	import type { StorefrontContext } from '$lib/storefront/admin-context';
	import './launch-shared.css';

	let {
		sfProps,
		onsaved
	}: {
		sfProps: Partial<StorefrontContext>;
		onsaved: () => void | Promise<void>;
	} = $props();
</script>

<div class="studio-content-grid">
	<div class="panel studio-section-intro">
		<div class="intro-icon-wrap">
			<Clock size={24} strokeWidth={1.8} />
		</div>
		<div>
			<h2 class="intro-h">Store Schedule &amp; Opening Hours</h2>
			<p class="intro-p">
				Set when the store accepts orders by the clock. For live open / busy / closed and pausing
				orders, use the Status tab.
			</p>
		</div>
	</div>

	<div class="panel hours-panel">
		<OpeningHoursForm {...sfProps} {onsaved} />
	</div>
</div>

<style>
	.hours-panel {
		padding: 1.25rem 1.5rem;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-md, 12px);
	}
</style>
