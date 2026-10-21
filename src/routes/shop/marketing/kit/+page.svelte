<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import MarketingTabs from '$lib/components/tenant/MarketingTabs.svelte';
	import MarketingAssetStudio from '$lib/components/storefront/promote/MarketingAssetStudio.svelte';
	import {
		resolveMarketingAsset,
		type MarketingAsset
	} from '$lib/components/storefront/promote/types';
	import { storefrontAdminApi, type AdminQr } from '$lib/storefront/admin';
	import {
		getStorefrontAdminOrDefault,
		loadStorefrontAdmin,
		type AdminStorefront
	} from '$lib/storefront/adminCache.svelte';

	/**
	 * The share kit: QR code, business card, thumbnail and banner for the
	 * store. It lives with the rest of Marketing rather than on the Publish
	 * screen, because printing a QR code is a marketing job you come back to,
	 * not a step in going live.
	 */
	let config = $state<AdminStorefront>(getStorefrontAdminOrDefault());
	let asset = $state<MarketingAsset>('qr');
	let qr = $state<AdminQr | null>(null);
	let qrLoading = $state(false);
	let qrError = $state('');

	async function loadQr() {
		qrLoading = true;
		try {
			qr = await storefrontAdminApi.qr();
			qrError = '';
		} catch (err) {
			qrError = err instanceof Error ? err.message : 'Could not generate the QR code';
		} finally {
			qrLoading = false;
		}
	}

	function setAsset(next: MarketingAsset) {
		asset = next;
		const url = new URL(window.location.href);
		url.searchParams.set('asset', next);
		history.replaceState(history.state, '', url);
	}

	onMount(() => {
		asset = resolveMarketingAsset($page.url.searchParams);
		void loadStorefrontAdmin().then((cfg) => (config = cfg));
		void loadQr();
	});
</script>

<div class="kit-page">
	<MarketingTabs />
	<MarketingAssetStudio bind:asset {config} {qr} {qrLoading} {qrError} onRetryQr={loadQr} onAssetChange={setAsset} />
</div>

<style>
	.kit-page {
		display: grid;
		gap: 1rem;
	}
</style>
