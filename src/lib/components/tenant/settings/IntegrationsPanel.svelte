<script lang="ts">
	/**
	 * Integrations: the services your business connects to.
	 *
	 * A list first, each service with its status in plain words, because the
	 * question on arrival is "what is connected?". Picking one opens its
	 * details in place, with a way back. The payment provider is not here: it
	 * lives under Configuration → Payments, beside the methods it powers.
	 *
	 * The service lives in the query string, so a link can point at Storage and
	 * a reload stays there.
	 */
	import { onMount } from 'svelte';
	import ArrowLeft from '@tabler/icons-svelte/icons/arrow-left';
	import ChevronRight from '@tabler/icons-svelte/icons/chevron-right';
	import HardDrive from '@tabler/icons-svelte/icons/database';
	import Mail from '@tabler/icons-svelte/icons/mail';
	import MessageSquare from '@tabler/icons-svelte/icons/message';
	import Sparkles from '@tabler/icons-svelte/icons/sparkles';
	import type { IconComponent as Component } from '$lib/icons';
	import type { ConfigService, EffectiveConfig } from '$lib/admin/configTypes';
	import { loadTenantConfig } from '$lib/admin/tenantConfigCache.svelte';
	import StatusBadge from '$lib/components/admin/StatusBadge.svelte';
	import Skeleton from '$lib/components/admin/Skeleton.svelte';
	import ConfigCard from '$lib/components/config/ConfigCard.svelte';
	import ServiceConfigPanel from './ServiceConfigPanel.svelte';

	let {
		service = '',
		onselect
	}: {
		/** The open service, or empty for the list. */
		service?: ConfigService | '';
		/** The screen owns the URL, so opening a service is reported upwards. */
		onselect?: (service: ConfigService | '') => void;
	} = $props();

	const SERVICES: Array<{ id: ConfigService; label: string; hint: string; icon: Component }> = [
		{ id: 'SMTP', label: 'Email', hint: 'Order emails, receipts and staff invitations', icon: Mail },
		{ id: 'SMS', label: 'SMS', hint: 'Order and booking text messages', icon: MessageSquare },
		{ id: 'STORAGE', label: 'Storage', hint: 'Menu photos, logos and other uploads', icon: HardDrive },
		{ id: 'AI', label: 'AI', hint: 'Writing help for menus and descriptions', icon: Sparkles }
	];

	let status = $state<Partial<Record<ConfigService, EffectiveConfig | null>>>({});

	onMount(() => {
		for (const s of SERVICES) {
			loadTenantConfig(s.id)
				.then((entry) => (status = { ...status, [s.id]: entry.effective }))
				.catch(() => (status = { ...status, [s.id]: null }));
		}
	});

	const open = $derived(SERVICES.find((s) => s.id === service));

	function badge(e: EffectiveConfig | null | undefined): { text: string; kind: 'ok' | 'warn' | 'neutral' } {
		if (e === null) return { text: 'Not checked', kind: 'neutral' };
		if (!e?.available) return { text: 'Not connected', kind: 'warn' };
		return { text: e.source === 'ORGANIZATION' ? 'Your account' : 'Via platform', kind: 'ok' };
	}
</script>

{#if open}
	<div class="ip-detail">
		<button type="button" class="ip-back" onclick={() => onselect?.('')}>
			<ArrowLeft size={14} stroke={1.6} /> All integrations
		</button>
		<!-- Keyed so switching service remounts the form rather than leaving one
		     service's draft credentials sitting in another's fields. -->
		{#key open.id}
			<ServiceConfigPanel service={open.id} title={open.label} />
		{/key}
	</div>
{:else}
	<ConfigCard
		id="ip-list"
		title="Services"
		description="Each one runs on the platform's service until you connect an account of your own."
		flush
	>
		<ul class="ip-list">
			{#each SERVICES as s (s.id)}
				{@const b = badge(status[s.id])}
				<li>
					<button type="button" class="ip-row" onclick={() => onselect?.(s.id)}>
						<span class="ip-icon" aria-hidden="true"><s.icon size={16} stroke={1.6} /></span>
						<span class="ip-text">
							<span class="ip-label">{s.label}</span>
							<span class="ip-hint">{s.hint}</span>
						</span>
						{#if s.id in status}
							<StatusBadge status={b.text} kind={b.kind} />
						{:else}
							<Skeleton height="1.1rem" width="5.5rem" />
						{/if}
						<ChevronRight size={16} stroke={1.6} class="ip-chev" />
					</button>
				</li>
			{/each}
		</ul>
	</ConfigCard>
{/if}

<style>
	.ip-list {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.ip-list li + li {
		border-top: 1px solid var(--border-subtle);
	}

	.ip-row {
		display: flex;
		align-items: center;
		gap: var(--sp-7);
		width: 100%;
		padding: var(--sp-8) var(--sp-10);
		border: 0;
		background: transparent;
		color: var(--text-3);
		font: inherit;
		text-align: left;
		cursor: pointer;
		transition: background var(--tr, 0.15s);
	}

	.ip-row:hover,
	.ip-row:focus-visible {
		background: var(--surface-hover);
	}

	.ip-icon {
		display: grid;
		place-items: center;
		flex: none;
		width: 34px;
		height: 34px;
		border-radius: var(--radius-md, 8px);
		background: var(--icon-bg, var(--surface-2));
		color: var(--icon-fg, var(--text-2));
	}

	.ip-text {
		display: flex;
		flex-direction: column;
		gap: var(--sp-1);
		flex: 1;
		min-width: 0;
	}

	.ip-label {
		font-size: var(--fs-body);
		font-weight: 600;
		color: var(--text);
	}

	.ip-hint {
		font-size: var(--fs-tab);
		color: var(--text-3);
	}

	.ip-detail {
		display: flex;
		flex-direction: column;
		gap: var(--sp-8);
	}

	.ip-back {
		display: inline-flex;
		align-items: center;
		gap: var(--sp-3);
		align-self: flex-start;
		padding: 0;
		border: 0;
		background: none;
		color: var(--text-2);
		font: inherit;
		font-size: var(--fs-tab);
		font-weight: 600;
		cursor: pointer;
	}

	.ip-back:hover {
		color: var(--text);
	}
</style>
