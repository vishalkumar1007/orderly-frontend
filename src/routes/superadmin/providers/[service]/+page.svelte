<script lang="ts">
	import { page } from '$app/stores';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import type { ConfigService } from '$lib/admin/configTypes';
	import EmptyState from '$lib/components/admin/EmptyState.svelte';
	import PlatformProviderPanel from '$lib/components/admin/PlatformProviderPanel.svelte';

	/**
	 * One provider's configuration.
	 *
	 * The panel is shared with the business-side screens, so a credential form
	 * behaves identically wherever it appears — and the redaction rules it
	 * relies on live in one component rather than two.
	 */

	const SERVICES: Record<string, ConfigService> = {
		smtp: 'SMTP',
		email: 'SMTP',
		storage: 'STORAGE',
		ai: 'AI',
		sms: 'SMS'
	};

	const service = $derived(SERVICES[($page.params.service ?? '').toLowerCase()]);
</script>

<a class="btn btn-quiet btn-sm" href="/superadmin/providers" style="margin-bottom:0.85rem;">
	<ArrowLeft size={14} strokeWidth={2} />
	All providers
</a>

{#if service}
	{#key service}
		<PlatformProviderPanel {service} />
	{/key}
{:else}
	<div class="panel">
		<EmptyState
			title="Unknown provider"
			description="The platform manages email, SMS, storage and AI. Payments are configured per business."
		>
			{#snippet action()}
				<a class="btn btn-ghost btn-sm" href="/superadmin/providers">Back to providers</a>
			{/snippet}
		</EmptyState>
	</div>
{/if}
