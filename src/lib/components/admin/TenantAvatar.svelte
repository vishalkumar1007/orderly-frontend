<script lang="ts">
	import { initials } from '$lib/admin/format';

	let {
		name,
		size = 'md'
	}: {
		name?: string | null;
		size?: 'sm' | 'md' | 'lg';
	} = $props();

	const px = $derived(size === 'lg' ? '2.75rem' : size === 'sm' ? '1.9rem' : '2.1rem');
	const fs = $derived(size === 'lg' ? '1.05rem' : size === 'sm' ? '0.72rem' : '0.78rem');
	const radius = $derived(size === 'lg' ? '10px' : '7px');
</script>

<span
	class="cell-avatar"
	style:width={px}
	style:height={px}
	style:font-size={fs}
	style:border-radius={radius}
	aria-hidden="true"
>
	{initials(name)}
</span>
