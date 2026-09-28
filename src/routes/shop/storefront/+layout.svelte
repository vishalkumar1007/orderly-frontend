<script lang="ts">
	import { onMount } from 'svelte';
	import {
		ensureLiveStorefrontAdmin,
		getStorefrontAdminOrDefault,
		loadStorefrontAdmin,
		setStorefrontAdmin,
		type AdminStorefront
	} from '$lib/storefront/adminCache.svelte';
	import { setStorefrontContext, type StorefrontContext } from '$lib/storefront/admin-context';
	import type { Snippet } from 'svelte';

	/**
	 * The storefront screens that are not Customize: Preview, QR & Share and
	 * Operating hours.
	 *
	 * They share one storefront document, loaded here once, so the preview and
	 * the controls beside it can never describe different states of the same
	 * shop. The Customize hub has its own shell under `/shop/customize`.
	 *
	 * The page always renders: an API failure shows a banner above it, never a
	 * blank screen.
	 */
	let {
		data,
		children
	}: {
		data: { storefront: AdminStorefront | null; storefrontError: string | null };
		children: Snippet<[StorefrontContext]>;
	} = $props();

	let config = $state<AdminStorefront>(data.storefront ?? getStorefrontAdminOrDefault());
	let error = $state(data.storefrontError ?? '');
	let retrying = $state(false);

	setStorefrontContext({
		get config() {
			return config;
		},
		save,
		refresh
	});

	async function bootstrap(force = false) {
		try {
			const fetched = await loadStorefrontAdmin(force);
			config = fetched;
			setStorefrontAdmin(fetched);
			error = '';
		} catch (err) {
			error = err instanceof Error ? err.message : 'Could not load your storefront';
		} finally {
			retrying = false;
		}
	}

	onMount(() => {
		void bootstrap(false);
	});

	async function save(run: () => Promise<AdminStorefront>): Promise<boolean> {
		try {
			await ensureLiveStorefrontAdmin();
			const updated = await run();
			config = updated;
			setStorefrontAdmin(updated);
			error = '';
			return true;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Could not save';
			return false;
		}
	}

	async function refresh() {
		await bootstrap(true);
	}

	async function retry() {
		retrying = true;
		await bootstrap(true);
	}
</script>

{#if error}
	<div class="alert alert-danger sf-shell-alert">
		<div><strong>API notice:</strong> {error}</div>
		<button
			class="btn btn-primary btn-sm"
			type="button"
			disabled={retrying}
			onclick={() => void retry()}
		>
			{retrying ? 'Retrying…' : 'Try again'}
		</button>
	</div>
{/if}

{@render children({ config, save, refresh })}

<style>
	.sf-shell-alert {
		margin-bottom: 1rem;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		flex-wrap: wrap;
	}
</style>
