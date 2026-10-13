<script lang="ts">
	import { entitlementState } from '$lib/tenant/entitlements.svelte';

	const license = $derived(entitlementState.data?.license);
	const day = (iso?: string) =>
		iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '';
</script>

{#if license?.state === 'GRACE'}
	<div class="license-banner" role="alert">
		<strong>Your license has expired.</strong>
		Everything keeps working until {day(license.grace_ends_at)}. Contact the platform administrator
		to renew before then.
	</div>
{/if}

<style>
	.license-banner {
		margin: 0 0 1rem;
		padding: 0.65rem 0.9rem;
		border-radius: 8px;
		border: 1px solid color-mix(in srgb, #d97706 45%, transparent);
		background: color-mix(in srgb, #d97706 14%, var(--surface, transparent));
		color: var(--text-1, inherit);
		font-size: 0.9rem;
	}
</style>
