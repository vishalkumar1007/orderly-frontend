<script lang="ts">
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import { isStorefrontActive, STOREFRONT_NAV } from '$lib/storefront/admin-nav';
	import { storefrontAdminApi, type AdminStorefront } from '$lib/storefront/admin';
	import type { StorefrontContext } from '$lib/storefront/admin-context';
	import ErrorState from '$lib/components/admin/ErrorState.svelte';
	import Skeleton from '$lib/components/admin/Skeleton.svelte';
	import type { Snippet } from 'svelte';

	/**
	 * The storefront control shell.
	 *
	 * Loads the whole configuration document once and shares it with the child
	 * screen. Every screen here edits one part of that document, so loading it per
	 * screen would mean a round trip per tab and a risk of two screens showing
	 * different values.
	 */
	let { children }: { children: Snippet<[StorefrontContext]> } = $props();

	let config = $state<AdminStorefront | null>(null);
	let loading = $state(true);
	let error = $state('');

	async function load() {
		loading = true;
		try {
			config = await storefrontAdminApi.get();
			error = '';
		} catch (err) {
			error = err instanceof Error ? err.message : 'Could not load your storefront';
		} finally {
			loading = false;
		}
	}

	onMount(load);

	async function save(run: () => Promise<AdminStorefront>): Promise<boolean> {
		try {
			config = await run();
			error = '';
			return true;
		} catch (err) {
			// A rejected write leaves the previous configuration in place, so the
			// form still shows what the server holds rather than what was refused.
			error = err instanceof Error ? err.message : 'Could not save';
			return false;
		}
	}

	async function refresh() {
		await load();
	}

	const pathname = $derived($page.url.pathname);
</script>

{#if loading}
	<div class="panel">
		<Skeleton height="1.2rem" width="12rem" />
		<div style="margin-top:1rem;display:grid;gap:0.7rem;grid-template-columns:repeat(auto-fill,minmax(11rem,1fr));">
			{#each [1, 2, 3, 4, 5, 6] as i (i)}
				<Skeleton height="4.5rem" />
			{/each}
		</div>
	</div>
{:else if error && !config}
	<ErrorState message={error} />
{:else if config}
	<div class="sfctl">
		<nav class="sfctl-nav" aria-label="Storefront settings">
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
					<span class="badge" class:badge-ok={config.behaviour.published} class:badge-warn={!config.behaviour.published}>
						{config.behaviour.published ? 'Live' : 'Not published'}
					</span>
					<span class="badge" class:badge-ok={config.ordering_available_now} class:badge-warn={!config.ordering_available_now}>
						{config.ordering_available_now ? 'Accepting orders' : 'Closed'}
					</span>
				</div>
			</div>

			{@render children({ config, save, refresh })}
		</div>
	</div>
{/if}
