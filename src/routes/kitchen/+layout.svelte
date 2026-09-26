<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { api, getAccessToken } from '$lib/api/client';
	import { me, type User } from '$lib/auth';
	import Toaster from '$lib/components/admin/Toaster.svelte';
	import ShopShell from '$lib/components/shop/ShopShell.svelte';
	import Skeleton from '$lib/components/admin/Skeleton.svelte';

	let { children, data } = $props();

	let status = $state<'loading' | 'ready' | 'anon'>('loading');
	let user = $state<User | null>(null);
	let shopName = $state('');
	let storefrontUrl = $state('');

	$effect(() => {
		void $page.url.pathname;
		if (status === 'ready') return;
		if (!getAccessToken()) {
			status = 'anon';
			goto('/shop/login', { replaceState: true });
			return;
		}
		(async () => {
			try {
				const next = await me();
				if (next.role !== 'TENANT_ADMIN' && next.role !== 'STAFF') {
					status = 'anon';
					goto('/shop/login', { replaceState: true });
					return;
				}
				user = next;
				status = 'ready';
			} catch {
				status = 'anon';
				goto('/shop/login', { replaceState: true });
			}
		})();
	});

	$effect(() => {
		if (status !== 'ready') return;
		let cancelled = false;
		(async () => {
			try {
				const link = await api<{ name: string; public_host: string; public_path: string }>(
					'/api/v1/tenant/store-link'
				);
				if (cancelled) return;
				shopName = link.name || data.tenantSlug || 'Your shop';
				storefrontUrl = `http://${link.public_host}${link.public_path}`;
			} catch {
				if (!cancelled) shopName = data.tenantSlug ?? 'Your shop';
			}
		})();
		return () => {
			cancelled = true;
		};
	});

	const initial = $derived((shopName || 'O').trim().charAt(0).toUpperCase() || 'O');
</script>

{#if status === 'anon'}
	<div style="min-height:100dvh;"></div>
{:else if status === 'loading'}
	<div class="oshell">
		<div class="osmain">
			<header class="ostopbar"><div class="ostopbar-inner"><div class="ostopbar-titles">
				<Skeleton height="1rem" width="9rem" />
			</div></div></header>
			<div class="oscontent"><Skeleton height="5rem" /></div>
		</div>
	</div>
{:else}
	<ShopShell {user} {shopName} shopInitial={initial} {storefrontUrl}>
		{@render children()}
	</ShopShell>
	<Toaster />
{/if}
