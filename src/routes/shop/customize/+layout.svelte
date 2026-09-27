<script lang="ts">
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import {
		isCustomizeShellPath,
		isStorefrontActive,
		STOREFRONT_NAV
	} from '$lib/storefront/admin-nav';
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
	 * Storefront Customize shell.
	 *
	 * Navigation always paints immediately. Config defaults are available
	 * instantly so a slow or failing API cannot blank the route.
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
	let loading = $state(false);
	let retrying = $state(false);

	setStorefrontContext({
		get config() {
			return config;
		},
		save,
		refresh
	});

	async function bootstrap(force = false) {
		loading = true;
		try {
			const fetched = await loadStorefrontAdmin(force);
			config = fetched;
			setStorefrontAdmin(fetched);
			error = '';
		} catch (err) {
			error = err instanceof Error ? err.message : 'Could not load your storefront';
		} finally {
			loading = false;
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

	const pathname = $derived($page.url.pathname);
	const showCustomizeShell = $derived(isCustomizeShellPath(pathname));
</script>

{#snippet statusPane()}
	{#if error}
		<div
			class="alert alert-danger"
			style="margin-bottom:1rem;display:flex;align-items:center;justify-content:space-between;gap:1rem;flex-wrap:wrap;"
		>
			<div>
				<strong>API notice:</strong> {error}
			</div>
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
{/snippet}

{#if showCustomizeShell}
	<div class="sfctl">
		<nav class="sfctl-nav" aria-label="Storefront customize">
			{#each STOREFRONT_NAV as item (item.href)}
				{@const active = isStorefrontActive(pathname, item)}
				<a
					class="sfctl-link"
					class:active
					href={item.href}
					aria-current={active ? 'page' : undefined}
				>
					<span class="sfctl-icon" aria-hidden="true">
						<item.icon size={17} strokeWidth={1.9} />
					</span>
					<span class="sfctl-txt">
						<span class="sfctl-label">{item.label}</span>
						<span class="sfctl-desc">{item.description}</span>
					</span>
				</a>
			{/each}
		</nav>

		<div class="sfctl-main">
			<div class="sfctl-bar">
				<a class="btn btn-ghost btn-sm" href="/shop">
					<ArrowLeft size={15} strokeWidth={2} /> Back to shop
				</a>
				<div class="sfctl-status">
					{#if config}
						<span
							class="badge"
							class:badge-ok={config.behaviour.published}
							class:badge-warn={!config.behaviour.published}
						>
							{config.behaviour.published ? 'Live' : 'Not published'}
						</span>
						<span
							class="badge"
							class:badge-ok={config.ordering_available_now}
							class:badge-warn={!config.ordering_available_now}
						>
							{config.ordering_available_now ? 'Accepting orders' : 'Closed'}
						</span>
					{:else if loading}
						<span class="badge">Loading…</span>
					{:else}
						<span class="badge badge-warn">Unavailable</span>
					{/if}
				</div>
			</div>

			{@render statusPane()}
		</div>
	</div>
{:else}
	{@render statusPane()}
{/if}
