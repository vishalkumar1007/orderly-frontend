<script lang="ts">
	import PanelLeft from '@tabler/icons-svelte/icons/layout-sidebar';
	import PanelLeftClose from '@tabler/icons-svelte/icons/layout-sidebar-left-collapse';
	import X from '@tabler/icons-svelte/icons/x';

	let {
		brandName = '',
		collapsed = false,
		collapsible = true,
		onToggle,
		onClose
	}: {
		brandName?: string;
		collapsed?: boolean;
		/** False in drawer mode, where collapsing is meaningless: we close instead. */
		collapsible?: boolean;
		onToggle?: () => void;
		onClose?: () => void;
	} = $props();
</script>

<div class="rail-head">
	{#if !collapsed && brandName}
		<span class="rail-name">{brandName}</span>
	{/if}

	{#if collapsible}
		<button
			type="button"
			class="rail-toggle"
			onclick={onToggle}
			aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
			title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
			aria-expanded={!collapsed}
		>
			{#if collapsed}
				<PanelLeft size={18} stroke={1.6} />
			{:else}
				<PanelLeftClose size={18} stroke={1.6} />
			{/if}
		</button>
	{:else}
		<button
			type="button"
			class="rail-toggle"
			onclick={onClose}
			aria-label="Close menu"
			title="Close menu"
		>
			<X size={18} stroke={1.6} />
		</button>
	{/if}
</div>
