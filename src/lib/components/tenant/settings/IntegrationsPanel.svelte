<script lang="ts">
	import HardDrive from '@lucide/svelte/icons/hard-drive';
	import Mail from '@lucide/svelte/icons/mail';
	import Sparkles from '@lucide/svelte/icons/sparkles';
	import type { Component } from 'svelte';
	import type { ConfigService } from '$lib/admin/configTypes';
	import ServiceConfigPanel from './ServiceConfigPanel.svelte';

	/**
	 * Integrations.
	 *
	 * Three services, one screen. They were three separate routes reached
	 * through an index page, which meant four navigations to compare two of
	 * them; a service switcher is one.
	 *
	 * The service lives in the query string beside the section, so a link can
	 * point at Storage and a reload stays there.
	 */
	let {
		service = 'SMTP',
		onselect
	}: {
		service?: ConfigService;
		/** The screen owns the URL, so selecting a service is reported upwards. */
		onselect?: (service: ConfigService) => void;
	} = $props();

	const SERVICES: Array<{ id: ConfigService; label: string; hint: string; icon: Component }> = [
		{ id: 'SMTP', label: 'Email', hint: 'Order mail and invites', icon: Mail },
		{ id: 'STORAGE', label: 'Storage', hint: 'Menu images and uploads', icon: HardDrive },
		{ id: 'AI', label: 'AI', hint: 'Assistive generation', icon: Sparkles }
	];
</script>

<div class="int-switch" role="tablist" aria-label="Integration">
	{#each SERVICES as option (option.id)}
		{@const active = service === option.id}
		<button
			type="button"
			role="tab"
			aria-selected={active}
			class="int-tab"
			class:active
			onclick={() => onselect?.(option.id)}
		>
			<span class="int-tab-icon" aria-hidden="true">
				<option.icon size={16} strokeWidth={1.9} />
			</span>
			<span class="int-tab-text">
				<span class="int-tab-label">{option.label}</span>
				<span class="int-tab-hint">{option.hint}</span>
			</span>
		</button>
	{/each}
</div>

<!-- Keyed so switching service remounts the form rather than leaving one
     service's draft credentials sitting in another's fields. -->
{#key service}
	<ServiceConfigPanel {service} />
{/key}

<style>
	.int-switch {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
		gap: 0.5rem;
		margin-bottom: 1.25rem;
	}

	.int-tab {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.65rem 0.75rem;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface);
		color: var(--text-2);
		font-family: inherit;
		text-align: left;
		cursor: pointer;
		transition:
			border-color var(--tr),
			background var(--tr),
			color var(--tr);
	}

	.int-tab:hover {
		border-color: var(--border-strong, var(--border));
		color: var(--text);
	}

	.int-tab.active {
		border-color: var(--accent);
		background: var(--accent-soft);
		color: var(--accent-dark);
	}

	.int-tab-icon {
		display: grid;
		place-items: center;
		width: 2rem;
		height: 2rem;
		flex: none;
		border-radius: 8px;
		background: var(--surface-2);
		color: inherit;
	}

	.int-tab.active .int-tab-icon {
		background: color-mix(in srgb, var(--accent) 18%, transparent);
	}

	.int-tab-text {
		min-width: 0;
	}

	.int-tab-label {
		display: block;
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--text);
	}

	.int-tab.active .int-tab-label {
		color: var(--accent-dark);
	}

	.int-tab-hint {
		display: block;
		font-size: 0.75rem;
		color: var(--text-3);
		line-height: 1.35;
	}
</style>
