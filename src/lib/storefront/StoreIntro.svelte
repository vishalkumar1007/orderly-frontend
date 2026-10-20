<script lang="ts">
	import type { StoreConfig } from '$lib/storefront/api';

	/**
	 * The top of every storefront home: cover, logo, the business's name as
	 * the one loud element on the page, its tagline, and one plain sentence of
	 * facts (open or closed, how long things take). Each home writes its own
	 * sentence; this only lays it out.
	 */
	let {
		config,
		title,
		subtitle = '',
		facts,
		tone = 'open',
		notice = ''
	}: {
		config: StoreConfig;
		title: string;
		subtitle?: string;
		facts: string;
		/** Colour of the status dot. */
		tone?: 'open' | 'busy' | 'closed';
		/** A closed or paused message shown under the intro. */
		notice?: string;
	} = $props();

	const store = $derived(config.store);
	const heroStyle = $derived(config.theme?.hero ?? 'gradient');
	const heroImage = $derived((config.theme?.hero_image_url ?? '').trim());
</script>

<header class="sh-intro" data-style={heroStyle}>
	{#if heroStyle === 'image' && heroImage}
		<div class="sh-cover"><img src={heroImage} alt="" /></div>
	{:else if heroStyle === 'gradient'}
		<div class="sh-band" aria-hidden="true"></div>
	{/if}
	{#if config.preview && heroStyle === 'image' && !heroImage}
		<p class="sh-hint">Add a cover photo in Studio to show it here.</p>
	{/if}

	<div class="sh-intro-body">
		{#if store.logo_url}
			<img class="sh-logo" src={store.logo_url} alt="" width="64" height="64" />
		{/if}
		<div class="sh-intro-text">
			<h1 class="sh-name">{title}</h1>
			{#if subtitle}
				<p class="sh-tagline">{subtitle}</p>
			{/if}
			<p class="sh-facts">
				<span class="sh-dot" data-tone={tone} aria-hidden="true"></span>
				{facts}
			</p>
			{#if store.address}
				<p class="sh-address">{store.address}</p>
			{/if}
		</div>
	</div>

	{#if notice}
		<p class="sh-closed" role="status">{notice}</p>
	{/if}
</header>

<style>
	.sh-intro {
		--g: var(--sh-gutter, 16px);
	}
	.sh-intro {
		padding-top: 12px;
	}
	.sh-cover {
		margin: 0 calc(var(--g) * -1);
		height: clamp(170px, 26vw, 340px);
		overflow: hidden;
		background: var(--sf-surface-2);
	}
	.sh-cover img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}
	.sh-band {
		height: 8px;
		margin: 0 calc(var(--g) * -1);
		background: var(--sf-hero-gradient, var(--sf-primary));
	}
	.sh-hint {
		margin: 8px 0 0;
		font-size: 13px;
		color: var(--sf-text-3);
	}

	.sh-intro-body {
		display: flex;
		align-items: flex-start;
		gap: 16px;
		padding-top: 24px;
	}
	.sh-intro[data-style='image'] .sh-logo {
		margin-top: -48px;
		box-shadow: 0 0 0 4px var(--sf-bg, var(--sf-surface));
	}
	.sh-logo {
		width: 64px;
		height: 64px;
		flex: none;
		border-radius: var(--sf-radius);
		object-fit: cover;
		background: var(--sf-surface);
	}
	.sh-intro-text {
		min-width: 0;
	}
	.sh-name {
		margin: 0;
		font-family: var(--sf-font-display, var(--sf-font));
		font-size: clamp(30px, 8vw, 52px);
		font-weight: 800;
		line-height: 1.02;
		letter-spacing: -0.025em;
		overflow-wrap: anywhere;
	}
	.sh-tagline {
		margin: 8px 0 0;
		font-size: 17px;
		color: var(--sf-text-2);
		max-width: 60ch;
	}
	.sh-facts {
		display: flex;
		align-items: baseline;
		gap: 8px;
		margin: 14px 0 0;
		font-size: 15px;
		font-weight: 500;
	}
	.sh-dot {
		width: 9px;
		height: 9px;
		flex: none;
		border-radius: 50%;
		background: var(--sf-text-3);
		transform: translateY(-1px);
	}
	.sh-dot[data-tone='open'] {
		background: var(--sf-success);
		box-shadow: 0 0 0 4px var(--sf-success-soft);
	}
	.sh-dot[data-tone='busy'] {
		background: var(--sf-warn);
		box-shadow: 0 0 0 4px var(--sf-warn-soft);
	}
	.sh-address {
		margin: 4px 0 0 17px;
		font-size: 14px;
		color: var(--sf-text-3);
	}
	.sh-closed {
		margin: 18px 0 0;
		padding: 12px 14px;
		border-radius: var(--sf-radius-sm);
		background: var(--sf-warn-soft);
		color: var(--sf-warn);
		font-size: 14px;
		font-weight: 500;
	}


	@media (min-width: 720px) {
		.sh-cover {
			margin: 16px 0 0;
			border-radius: var(--sf-radius-lg);
		}
		.sh-band {
			margin: 0;
			border-radius: 999px;
		}
		.sh-intro-body {
			gap: 20px;
		}
		.sh-logo {
			width: 80px;
			height: 80px;
		}
		.sh-intro[data-style='image'] .sh-logo {
			margin-left: 24px;
		}
	}
</style>
