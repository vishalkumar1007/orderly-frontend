<script lang="ts">
	import type { Component, Snippet } from 'svelte';
	import Activity from '@lucide/svelte/icons/activity';
	import ShieldCheck from '@lucide/svelte/icons/shield-check';
	import Store from '@lucide/svelte/icons/store';
	import OrderlyMark from './OrderlyMark.svelte';
	import ThemeToggle from './ThemeToggle.svelte';

	type Point = { icon: string; text: string };

	const POINT_ICONS: Record<string, Component> = {
		tenants: Store,
		activity: Activity,
		shield: ShieldCheck
	};

	let {
		children,
		title = 'Platform control center',
		subtitle = 'Onboard shops, watch platform-wide orders, and keep every tenant healthy.',
		badge = 'Super Admin',
		points = [
			{ icon: 'tenants', text: 'Onboard and manage every food business' },
			{ icon: 'activity', text: 'Live orders and revenue across all tenants' },
			{ icon: 'shield', text: 'Strict tenant isolation with full audit history' }
		],
		footer = 'Orderly Platform'
	}: {
		children: Snippet;
		title?: string;
		subtitle?: string;
		badge?: string;
		points?: Point[];
		footer?: string;
	} = $props();
</script>

<div class="auth-split">
	<aside class="auth-aside">
		<div class="auth-aside-inner">
			<div class="auth-brand">
				<OrderlyMark size={30} variant="white" />
				<span class="auth-brand-name">Orderly</span>
			</div>

			<div>
				<span class="auth-aside-badge">{badge}</span>
				<h1>{title}</h1>
				<p>{subtitle}</p>

				<ul class="auth-points">
					{#each points as point}
						{@const Icon = POINT_ICONS[point.icon] ?? ShieldCheck}
						<li>
							<span class="auth-point-icon"><Icon size={16} strokeWidth={2} /></span>
							<span>{point.text}</span>
						</li>
					{/each}
				</ul>
			</div>

			<p class="auth-aside-foot">{footer}</p>
		</div>
	</aside>

	<div class="auth-main">
		<div class="auth-mobile-brand">
			<OrderlyMark size={26} />
			<span class="auth-brand-name dark">Orderly</span>
		</div>

		<div class="auth-theme-toggle">
			<ThemeToggle />
		</div>

		<div class="auth-card fade-in">
			{@render children()}
		</div>
	</div>
</div>
