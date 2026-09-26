<script lang="ts">
	type Tab = { id: string; label: string };

	let {
		tabs = [] as Tab[],
		active = '',
		onSelect
	}: {
		tabs?: Tab[];
		active?: string;
		onSelect?: (id: string) => void;
	} = $props();
</script>

<nav class="settings-nav" aria-label="Settings sections">
	{#each tabs as t (t.id)}
		<button
			type="button"
			class={active === t.id ? 'active' : ''}
			aria-current={active === t.id ? 'true' : undefined}
			onclick={() => onSelect?.(t.id)}
		>
			{t.label}
		</button>
	{/each}
</nav>
