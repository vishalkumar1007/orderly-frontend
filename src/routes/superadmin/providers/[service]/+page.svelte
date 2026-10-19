<script lang="ts">
	import { page } from '$app/stores';
	import ArrowLeft from '@tabler/icons-svelte/icons/arrow-left';
	import type { ConfigService } from '$lib/admin/configTypes';
	import EmptyState from '$lib/components/admin/EmptyState.svelte';
	import PaymentHealthPanel from '$lib/components/admin/PaymentHealthPanel.svelte';
	import PaymentModePanel from '$lib/components/admin/PaymentModePanel.svelte';
	import PlatformProviderPanel from '$lib/components/admin/PlatformProviderPanel.svelte';

	/**
	 * One provider's configuration.
	 *
	 * The panel is shared with the business-side screens, so a credential form
	 * behaves identically wherever it appears: and the redaction rules it
	 * relies on live in one component rather than two.
	 */

	const SERVICES: Record<string, ConfigService> = {
		smtp: 'SMTP',
		email: 'SMTP',
		storage: 'STORAGE',
		ai: 'AI',
		sms: 'SMS',
		payments: 'PAYMENTS'
	};

	const service = $derived(SERVICES[($page.params.service ?? '').toLowerCase()]);
</script>

<a class="btn btn-quiet btn-sm" href="/superadmin/providers" style="margin-bottom:0.85rem;">
	<ArrowLeft size={14} stroke={1.6} />
	All providers
</a>

{#if service}
	{#key service}
		{#if service === 'PAYMENTS'}
			<div class="pay-stack">
				<PaymentModePanel />
				<PaymentHealthPanel />
				<PlatformProviderPanel {service} />
			</div>
		{:else}
			<PlatformProviderPanel {service} />
		{/if}
	{/key}
{:else}
	<div class="panel">
		<EmptyState
			title="Unknown provider"
			description="The platform manages email, SMS, storage, AI and payments."
		>
			{#snippet action()}
				<a class="btn btn-ghost btn-sm" href="/superadmin/providers">Back to providers</a>
			{/snippet}
		</EmptyState>
	</div>
{/if}

<style>
	.pay-stack {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
</style>
