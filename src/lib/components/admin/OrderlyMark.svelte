<script lang="ts">
	let {
		size = 26,
		variant = 'gradient'
	}: {
		size?: number;
		/** `white` is for dark/saturated backgrounds (e.g. the auth brand panel). */
		variant?: 'gradient' | 'white';
	} = $props();
</script>

<svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
	{#if variant === 'white'}
		<rect width="32" height="32" rx="8" fill="rgba(255,255,255,0.16)" />
		<rect
			x="0.5"
			y="0.5"
			width="31"
			height="31"
			rx="7.5"
			stroke="rgba(255,255,255,0.3)"
		/>
	{:else}
		<rect width="32" height="32" rx="8" fill="url(#orderly-mark-grad)" />
	{/if}
	<path
		d="M9 22V10h4.2c2.8 0 4.5 1.4 4.5 3.6 0 1.5-.8 2.6-2.1 3.1L19 22h-3.2l-2.8-4.5H12.2V22H9zm3.2-7.2h1c1.1 0 1.7-.5 1.7-1.3s-.6-1.2-1.7-1.2h-1v2.5zM20.5 22l3.5-12h3.3L24 22h-3.5z"
		fill="#fff"
	/>
	<defs>
		<linearGradient id="orderly-mark-grad" x1="4" y1="4" x2="28" y2="28">
			<stop stop-color="#6366f1" />
			<stop offset="1" stop-color="#8b5cf6" />
		</linearGradient>
	</defs>
</svg>
