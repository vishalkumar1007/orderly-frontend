<script lang="ts">
	type Tab = { id: string; label: string };

	let {
		tabs = [] as Tab[],
		active = $bindable(''),
		onchange
	}: {
		tabs?: Tab[];
		active?: string;
		onchange?: (id: string) => void;
	} = $props();

	function select(id: string) {
		active = id;
		onchange?.(id);
	}
</script>

<div class="tabs" role="tablist">
	{#each tabs as tab (tab.id)}
		<button
			type="button"
			role="tab"
			aria-selected={active === tab.id}
			onclick={() => select(tab.id)}
		>
			{tab.label}
		</button>
	{/each}
</div>
