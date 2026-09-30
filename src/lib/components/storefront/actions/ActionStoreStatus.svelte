<script lang="ts">
	import SlidersHorizontal from '@lucide/svelte/icons/sliders-horizontal';
	import { storefrontAdminApi, STORE_STATUS_OPTIONS } from '$lib/storefront/admin';
	import type { StorefrontContext } from '$lib/storefront/admin-context';
	import { toast } from '$lib/components/admin/toast';
	import { patchDashboardStoreStatus } from '$lib/tenant/dashboardCache.svelte';

	let {
		config,
		save
	}: {
		config: StorefrontContext['config'];
		save: StorefrontContext['save'];
	} = $props();

	let saving = $state(false);
	const current = $derived(config.behaviour.store_status || 'OPEN');

	async function pick(status: string) {
		if (saving || status === current) return;
		saving = true;
		const ok = await save(() => storefrontAdminApi.saveBehaviour({ store_status: status }));
		saving = false;
		if (ok) {
			patchDashboardStoreStatus(status, {
				store_status_label: STORE_STATUS_OPTIONS.find((o) => o.value === status)?.label
			});
			toast.success(`Store is now ${STORE_STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status}`);
		} else toast.error('Could not update store status');
	}
</script>

<div class="panel action-panel" id="store-status">
	<div class="action-intro">
		<div class="intro-icon-wrap">
			<SlidersHorizontal size={24} strokeWidth={1.8} />
		</div>
		<div>
			<h2 class="intro-h">Store status</h2>
			<p class="intro-p">
				Customers see this on your storefront header. Changes apply immediately — no publish step.
			</p>
		</div>
	</div>

	<div class="status-grid" role="group" aria-label="Store status">
		{#each STORE_STATUS_OPTIONS as opt (opt.value)}
			<button
				type="button"
				class="status-card"
				class:active={current === opt.value}
				disabled={saving}
				onclick={() => pick(opt.value)}
			>
				<span class="status-label">{opt.label}</span>
				<span class="status-desc">{opt.desc}</span>
			</button>
		{/each}
	</div>
</div>

<style>
	.action-panel {
		padding: 1.25rem 1.5rem;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg, 12px);
		box-shadow: none;
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}
	.action-intro {
		display: flex;
		gap: 1rem;
		align-items: flex-start;
	}
	.intro-icon-wrap {
		width: 2.75rem;
		height: 2.75rem;
		border-radius: var(--radius);
		background: color-mix(in srgb, var(--accent) 14%, transparent);
		display: grid;
		place-items: center;
		color: var(--accent);
		flex-shrink: 0;
	}
	.intro-h {
		margin: 0;
		font-size: 1.1rem;
		font-weight: 650;
	}
	.intro-p {
		margin: 0.35rem 0 0;
		font-size: 0.88rem;
		color: var(--text-2);
		line-height: 1.45;
	}
	.status-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(10.5rem, 1fr));
		gap: 0.65rem;
	}
	.status-card {
		text-align: left;
		padding: 0.85rem 1rem;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface-2);
		cursor: pointer;
		font: inherit;
		box-shadow: none;
		transition:
			border-color 0.15s,
			background 0.15s;
	}
	.status-card.active {
		border-color: var(--accent);
		background: color-mix(in srgb, var(--accent) 12%, var(--surface));
		box-shadow: none;
	}
	.status-card:disabled {
		opacity: 0.65;
		cursor: wait;
	}
	.status-label {
		display: block;
		font-weight: 650;
		font-size: 0.9rem;
		color: var(--text);
	}
	.status-desc {
		display: block;
		margin-top: 0.25rem;
		font-size: 0.75rem;
		color: var(--text-3);
		line-height: 1.35;
	}
</style>
